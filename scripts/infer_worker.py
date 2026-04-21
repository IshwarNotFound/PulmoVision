"""
PulmoVision persistent inference worker.

Protocol:
- Reads one JSON request per line from stdin.
- Writes one JSON response per line to stdout.

Request shape:
  {"model_path": "...", "image_path": "..."}

Response shape:
- Success: same payload as infer.py output
- Failure: {"error": "..."}
"""
import json
import os
import sys
import time
from typing import Optional

# Add script directory to sys.path to ensure 'infer' can be imported
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
import tensorflow as tf
from tensorflow.keras import backend as K

from infer import CLASS_NAMES, build_model, preprocess, compute_gradcam

# Cache models for process lifetime so repeated calls avoid weight reload.
MODEL_CACHE = {}


def get_model_bundle(model_path: str):
    bundle = MODEL_CACHE.get(model_path)
    if bundle is None:
        bundle = build_model(model_path)
        MODEL_CACHE[model_path] = bundle
    return bundle


def clear_model_cache() -> None:
    MODEL_CACHE.clear()
    K.clear_session()


def _timed_out(started_at: float, timeout_ms: Optional[float]) -> bool:
    if timeout_ms is None:
        return False
    return ((time.perf_counter() - started_at) * 1000.0) > timeout_ms


def run_cached_inference(model_path: str, image_path: str, timeout_ms: Optional[float] = None):
    started_at = time.perf_counter()

    if not os.path.exists(model_path):
        return {"error": f"model_not_found: {model_path}"}

    if not os.path.exists(image_path):
        return {"error": f"image_not_found: {image_path}"}

    preprocess_ms = 0.0
    infer_ms = 0.0
    gradcam_ms = 0.0

    model, last_conv, input_size, arch, has_built_in_preprocess = get_model_bundle(model_path)

    preprocess_started = time.perf_counter()
    img_array, source_image = preprocess(image_path, input_size, arch, has_built_in_preprocess)
    preprocess_ms = (time.perf_counter() - preprocess_started) * 1000.0

    if _timed_out(started_at, timeout_ms):
        return {"error": f"request_timeout_after_{int(timeout_ms or 0)}ms"}

    infer_started = time.perf_counter()
    predictions = model.predict(img_array, verbose=0)[0]
    infer_ms = (time.perf_counter() - infer_started) * 1000.0
    if not np.all(np.isfinite(predictions)):
        return {"error": "Model returned non-finite confidence scores"}

    if _timed_out(started_at, timeout_ms):
        return {"error": f"request_timeout_after_{int(timeout_ms or 0)}ms"}

    class_idx = int(np.argmax(predictions))
    predicted_class = CLASS_NAMES[class_idx]

    confidence = {CLASS_NAMES[i]: float(predictions[i]) for i in range(len(CLASS_NAMES))}
    confidence_sum = float(sum(predictions))

    gradcam_started = time.perf_counter()
    activation_map, activation_map_shape, gradcam_failed = compute_gradcam(
        model, img_array, class_idx, last_conv
    )
    gradcam_ms = (time.perf_counter() - gradcam_started) * 1000.0

    if _timed_out(started_at, timeout_ms):
        return {"error": f"request_timeout_after_{int(timeout_ms or 0)}ms"}

    reliability_flags: list[str] = []
    if source_image == "dicom":
        reliability_flags.append("dicom_input")
    if gradcam_failed:
        reliability_flags.append("gradcam_fallback")
    if abs(confidence_sum - 1.0) >= 0.05:
        reliability_flags.append("confidence_drift")

    return {
        "predicted_class": predicted_class,
        "confidence": confidence,
        "activation_map": activation_map,
        "activation_map_shape": activation_map_shape,
        "activation_map_origin": "top_left",
        "activation_map_encoding": "normalized_float32",
        "gradcam_failed": gradcam_failed,
        "confidence_sum": confidence_sum,
        "confidence_tolerance_ok": abs(confidence_sum - 1.0) < 0.05,
        "model": os.path.basename(model_path),
        "telemetry": {
            "preprocess_ms": round(preprocess_ms, 3),
            "infer_ms": round(infer_ms, 3),
            "gradcam_ms": round(gradcam_ms, 3),
            "total_ms": round((time.perf_counter() - started_at) * 1000.0, 3),
        },
        "reliability": {
            "degraded": len(reliability_flags) > 0,
            "flags": reliability_flags,
            "source_image": source_image,
        },
    }


def _normalize_scores(scores: dict[str, float]) -> dict[str, float]:
    total = float(sum(scores.values()))
    if not np.isfinite(total) or total <= 0:
        fallback = 1.0 / float(len(CLASS_NAMES))
        return {name: fallback for name in CLASS_NAMES}
    return {name: float(scores[name] / total) for name in CLASS_NAMES}


def _top_confidence(confidence: dict[str, float]) -> float:
    vals = [float(confidence.get(name, 0.0)) for name in CLASS_NAMES]
    if not vals:
        return 0.0
    top = float(max(vals))
    return top if np.isfinite(top) and top >= 0 else 0.0


def _resize_heatmap(heatmap: np.ndarray, target_h: int, target_w: int) -> np.ndarray:
    if heatmap.shape == (target_h, target_w):
        return heatmap

    tensor = tf.convert_to_tensor(heatmap[None, ..., None], dtype=tf.float32)
    resized = tf.image.resize(tensor, (target_h, target_w), method="bilinear").numpy()[0, :, :, 0]
    return resized.astype(np.float32)


def _merge_activation_maps(successes: list[dict], normalized_weights: list[float]):
    target_h = max(int(item["activation_map_shape"][0]) for item in successes)
    target_w = max(int(item["activation_map_shape"][1]) for item in successes)

    merged = np.zeros((target_h, target_w), dtype=np.float32)
    for item, weight in zip(successes, normalized_weights):
        raw = np.asarray(item["activation_map"], dtype=np.float32)
        resized = _resize_heatmap(raw, target_h, target_w)
        merged += resized * float(weight)

    merged = np.maximum(merged, 0.0)
    max_val = float(np.max(merged)) if merged.size else 0.0
    if max_val > 0:
        merged /= max_val

    return merged.tolist(), [target_h, target_w]


def run_ensemble_inference(model_paths, image_path: str, timeout_ms: Optional[float] = None):
    started_at = time.perf_counter()
    if not isinstance(model_paths, list) or len(model_paths) == 0:
        return {"error": "invalid_ensemble_payload"}

    successes = []
    failures = []

    for model_path in model_paths:
        if not isinstance(model_path, str):
            continue

        result = run_cached_inference(model_path, image_path, timeout_ms=timeout_ms)
        if "error" in result:
            failures.append({
                "model": os.path.basename(model_path),
                "error": str(result["error"]),
            })
            continue

        successes.append(result)

    if not successes:
        failure_summary = "; ".join(
            f"{entry['model']}: {entry['error']}" for entry in failures
        )
        return {"error": f"ensemble_failed: {failure_summary or 'no_successful_model'}"}

    raw_weights = []
    for item in successes:
        confidence = item.get("confidence", {})
        weight = _top_confidence(confidence if isinstance(confidence, dict) else {})
        raw_weights.append(max(weight, 1e-6))

    raw_weight_sum = float(sum(raw_weights))
    if raw_weight_sum <= 0:
        normalized_weights = [1.0 / float(len(successes))] * len(successes)
    else:
        normalized_weights = [float(weight / raw_weight_sum) for weight in raw_weights]

    if len(successes) == 1:
        single = dict(successes[0])
        actual_model = single["model"]
        single["model"] = "ensemble_fallback"
        single_telemetry = single.get("telemetry", {}) if isinstance(single.get("telemetry"), dict) else {}
        single["telemetry"] = {
            **single_telemetry,
            "ensemble_ms": 0.0,
            "total_ms": round((time.perf_counter() - started_at) * 1000.0, 3),
        }

        existing_reliability = single.get("reliability", {}) if isinstance(single.get("reliability"), dict) else {}
        flags = existing_reliability.get("flags") if isinstance(existing_reliability.get("flags"), list) else []
        reliability_flags = [*flags, "ensemble_degraded"]
        single["reliability"] = {
            "degraded": True,
            "flags": reliability_flags,
            "source_image": existing_reliability.get("source_image", "unknown"),
        }

        single["ensemble"] = {
            "method": "weighted_soft_vote_top_confidence",
            "degraded": True,
            "agreement": True,
            "winning_model": actual_model,
            "failed_models": failures,
            "individual_predictions": [
                {
                    "model": actual_model,
                    "predicted_class": single["predicted_class"],
                    "confidence": single["confidence"],
                    "confidence_sum": single["confidence_sum"],
                    "gradcam_failed": single["gradcam_failed"],
                    "activation_map_shape": single["activation_map_shape"],
                    "weight": 1.0,
                    "top_confidence": _top_confidence(single["confidence"]),
                }
            ],
        }
        return single

    fused_scores = {name: 0.0 for name in CLASS_NAMES}
    for item, weight in zip(successes, normalized_weights):
        confidence = item.get("confidence", {})
        if not isinstance(confidence, dict):
            continue
        for class_name in CLASS_NAMES:
            fused_scores[class_name] += float(weight) * float(confidence.get(class_name, 0.0))

    ensemble_confidence = _normalize_scores(fused_scores)
    confidence_sum = float(sum(ensemble_confidence.values()))
    predicted_class = max(CLASS_NAMES, key=lambda name: ensemble_confidence[name])
    activation_map, activation_map_shape = _merge_activation_maps(successes, normalized_weights)

    winner_idx = int(np.argmax(np.asarray(normalized_weights, dtype=np.float32)))
    winner = successes[winner_idx]
    agreement = len({str(item.get("predicted_class", "")) for item in successes}) == 1

    individual_predictions = []
    for item, weight in zip(successes, normalized_weights):
        confidence = item.get("confidence", {})
        if not isinstance(confidence, dict):
            continue

        individual_predictions.append(
            {
                "model": item.get("model", "unknown"),
                "predicted_class": item.get("predicted_class", "Normal"),
                "confidence": confidence,
                "confidence_sum": float(item.get("confidence_sum", 0.0)),
                "gradcam_failed": bool(item.get("gradcam_failed", False)),
                "activation_map_shape": item.get("activation_map_shape", [0, 0]),
                "weight": float(weight),
                "top_confidence": _top_confidence(confidence),
            }
        )

    preprocess_sum = 0.0
    infer_sum = 0.0
    gradcam_sum = 0.0
    source_image = "unknown"
    reliability_flags = set()

    for item in successes:
        telemetry = item.get("telemetry", {}) if isinstance(item.get("telemetry"), dict) else {}
        preprocess_sum += float(telemetry.get("preprocess_ms", 0.0) or 0.0)
        infer_sum += float(telemetry.get("infer_ms", 0.0) or 0.0)
        gradcam_sum += float(telemetry.get("gradcam_ms", 0.0) or 0.0)

        reliability = item.get("reliability", {}) if isinstance(item.get("reliability"), dict) else {}
        src = reliability.get("source_image")
        if isinstance(src, str) and src in {"png", "jpeg", "dicom"}:
            source_image = src
        for flag in reliability.get("flags", []) if isinstance(reliability.get("flags"), list) else []:
            if isinstance(flag, str):
                reliability_flags.add(flag)

    if len(failures) > 0:
        reliability_flags.add("ensemble_degraded")

    if _timed_out(started_at, timeout_ms):
        return {"error": f"request_timeout_after_{int(timeout_ms or 0)}ms"}

    return {
        "predicted_class": predicted_class,
        "confidence": ensemble_confidence,
        "activation_map": activation_map,
        "activation_map_shape": activation_map_shape,
        "activation_map_origin": "top_left",
        "activation_map_encoding": "normalized_float32",
        "gradcam_failed": any(bool(item.get("gradcam_failed", False)) for item in successes),
        "confidence_sum": confidence_sum,
        "confidence_tolerance_ok": abs(confidence_sum - 1.0) < 0.05,
        "model": "ensemble_weighted_soft_vote",
        "telemetry": {
            "preprocess_ms": round(preprocess_sum, 3),
            "infer_ms": round(infer_sum, 3),
            "gradcam_ms": round(gradcam_sum, 3),
            "ensemble_ms": round((time.perf_counter() - started_at) * 1000.0, 3),
            "total_ms": round((time.perf_counter() - started_at) * 1000.0, 3),
        },
        "reliability": {
            "degraded": len(reliability_flags) > 0,
            "flags": sorted(reliability_flags),
            "source_image": source_image,
        },
        "ensemble": {
            "method": "weighted_soft_vote_top_confidence",
            "degraded": len(failures) > 0,
            "agreement": agreement,
            "winning_model": winner.get("model", "unknown"),
            "failed_models": failures,
            "individual_predictions": individual_predictions,
        },
    }


def warm_model_cache(model_paths):
    warmed_models = []
    errors = {}

    for model_path in model_paths:
        if not isinstance(model_path, str):
            continue

        try:
            get_model_bundle(model_path)
            warmed_models.append(os.path.basename(model_path))
        except Exception as exc:
            errors[model_path] = f"{type(exc).__name__}: {exc}"

    return {
        "ok": len(errors) == 0,
        "warmed_models": warmed_models,
        "errors": errors,
    }


def _emit(response: dict, request_id):
    if isinstance(request_id, str) and request_id:
        response = {**response, "request_id": request_id}
    print(json.dumps(response), flush=True)


def main() -> None:
    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        request_id = None
        try:
            payload = json.loads(line)
            if isinstance(payload, dict):
                request_id = payload.get("request_id")
        except Exception as exc:
            _emit({"error": f"invalid_request_json: {type(exc).__name__}: {exc}"}, request_id)
            continue

        if payload.get("command") == "shutdown":
            clear_model_cache()
            _emit({"ok": True}, request_id)
            break

        if payload.get("command") == "warmup":
            model_paths = payload.get("model_paths")
            if not isinstance(model_paths, list):
                _emit({"error": "invalid_warmup_payload"}, request_id)
                continue

            try:
                _emit(warm_model_cache(model_paths), request_id)
            except Exception as exc:
                _emit({"error": f"warmup_failed: {type(exc).__name__}: {exc}"}, request_id)
            continue

        if payload.get("command") == "ensemble":
            model_paths = payload.get("model_paths")
            image_path = payload.get("image_path")
            timeout_ms = payload.get("timeout_ms")
            timeout_value = float(timeout_ms) if isinstance(timeout_ms, (int, float)) and timeout_ms > 0 else None

            if not isinstance(model_paths, list) or not isinstance(image_path, str):
                _emit({"error": "invalid_ensemble_payload"}, request_id)
                continue

            try:
                _emit(run_ensemble_inference(model_paths, image_path, timeout_ms=timeout_value), request_id)
            except Exception as exc:
                _emit({"error": f"ensemble_failed: {type(exc).__name__}: {exc}"}, request_id)
            continue

        model_path = payload.get("model_path")
        image_path = payload.get("image_path")
        timeout_ms = payload.get("timeout_ms")
        timeout_value = float(timeout_ms) if isinstance(timeout_ms, (int, float)) and timeout_ms > 0 else None

        if not isinstance(model_path, str) or not isinstance(image_path, str):
            _emit({"error": "invalid_request_payload"}, request_id)
            continue

        try:
            _emit(run_cached_inference(model_path, image_path, timeout_ms=timeout_value), request_id)
        except Exception as exc:
            _emit({"error": f"{type(exc).__name__}: {exc}"}, request_id)


if __name__ == "__main__":
    try:
        main()
    finally:
        clear_model_cache()
