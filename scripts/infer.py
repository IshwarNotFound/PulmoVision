"""
PulmoVision local inference script.
Usage: python infer.py <model_path> <image_path>
Outputs a single JSON line to stdout.
"""
import sys
import os
import json
import time

os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"
os.environ["TF_CPP_MIN_LOG_LEVEL"] = "3"

import h5py
import numpy as np
from PIL import Image
import tensorflow as tf
from keras.applications.densenet import preprocess_input as densenet_preprocess
from keras.applications.efficientnet import preprocess_input as efficientnet_preprocess

try:
    import pydicom
except Exception:
    pydicom = None

CLASS_NAMES = ["COVID", "Lung_Opacity", "Normal", "Viral Pneumonia"]
HEAD_LAYERS = ("head_gap", "head_bn", "head_dense", "head_dropout", "head_output")
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def detect_image_source(image_path: str) -> str:
    ext = os.path.splitext(image_path)[1].lower()
    if ext in (".dcm", ".dicom"):
        return "dicom"
    if ext == ".png":
        return "png"
    if ext in (".jpg", ".jpeg"):
        return "jpeg"

    try:
        with open(image_path, "rb") as f:
            header = f.read(132)
    except Exception:
        return "unknown"

    if len(header) >= 132 and header[128:132] == b"DICM":
        return "dicom"
    if header.startswith(PNG_MAGIC):
        return "png"
    if header.startswith(JPEG_MAGIC):
        return "jpeg"

    return "unknown"


def _dicom_to_rgb_array(image_path: str, input_size: int) -> np.ndarray:
    if pydicom is None:
        raise RuntimeError("pydicom_dependency_missing")

    ds = pydicom.dcmread(image_path, force=True)
    if "PixelData" not in ds:
        raise ValueError("dicom_missing_pixel_data")

    pixels = np.asarray(ds.pixel_array)

    if pixels.ndim == 3 and pixels.shape[-1] not in (3, 4):
        # Multi-frame grayscale: pick first frame for single-study inference.
        pixels = pixels[0]

    if pixels.ndim == 2:
        arr = pixels.astype(np.float32)
        slope = float(getattr(ds, "RescaleSlope", 1.0) or 1.0)
        intercept = float(getattr(ds, "RescaleIntercept", 0.0) or 0.0)
        arr = arr * slope + intercept

        photometric = str(getattr(ds, "PhotometricInterpretation", "")).upper()
        if photometric == "MONOCHROME1":
            arr = np.max(arr) - arr

        lo = float(np.percentile(arr, 1.0))
        hi = float(np.percentile(arr, 99.0))
        if (not np.isfinite(lo)) or (not np.isfinite(hi)) or hi <= lo:
            lo = float(np.min(arr))
            hi = float(np.max(arr))

        if hi <= lo:
            arr8 = np.zeros(arr.shape, dtype=np.uint8)
        else:
            arr8 = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
            arr8 = (arr8 * 255.0).astype(np.uint8)

        img = Image.fromarray(arr8, mode="L").convert("RGB")

    elif pixels.ndim == 3 and pixels.shape[-1] in (3, 4):
        arr = pixels[..., :3]
        if arr.dtype != np.uint8:
            arr = arr.astype(np.float32)
            lo = float(np.min(arr))
            hi = float(np.max(arr))
            if hi > lo:
                arr = np.clip((arr - lo) / (hi - lo), 0.0, 1.0)
                arr = (arr * 255.0).astype(np.uint8)
            else:
                arr = np.zeros(arr.shape, dtype=np.uint8)
        img = Image.fromarray(arr, mode="RGB")
    else:
        raise ValueError(f"unsupported_dicom_pixel_shape: {pixels.shape}")

    img = img.resize((input_size, input_size), Image.LANCZOS)
    arr = np.array(img, dtype=np.float32)
    return np.expand_dims(arr, axis=0)


def _read_model_layer_names(model_path: str) -> set[str]:
    names: set[str] = set()
    with h5py.File(model_path, "r") as f:
        mw = f.get("model_weights")
        if mw is not None:
            names.update(str(key) for key in mw.keys())

        config_raw = f.attrs.get("model_config")
        if config_raw is not None:
            try:
                if isinstance(config_raw, bytes):
                    config_raw = config_raw.decode("utf-8")
                cfg = json.loads(config_raw)
                for layer in cfg.get("config", {}).get("layers", []):
                    name = layer.get("config", {}).get("name")
                    if name:
                        names.add(str(name))
            except Exception:
                # If model_config parsing fails, fallback to model_weights keys only.
                pass

    return names


def _validate_saved_head(model_path: str, arch: str) -> None:
    with h5py.File(model_path, "r") as f:
        mw = f.get("model_weights", f)

        missing_layers = [name for name in HEAD_LAYERS if name not in mw]
        if missing_layers:
            raise ValueError(f"Missing required head layers in model file: {missing_layers}")

        head_bn = _find_datasets(mw["head_bn"])
        bn_keys = {"gamma", "beta", "moving_mean", "moving_variance"}
        if not bn_keys.issubset(head_bn.keys()):
            raise ValueError("head_bn weights are incomplete in model file")

        head_dense = _find_datasets(mw["head_dense"])
        if "kernel" not in head_dense or "bias" not in head_dense:
            raise ValueError("head_dense weights are incomplete in model file")
        expected_dense_in = 1536 if arch == "efficientnet" else 1024
        if tuple(head_dense["kernel"].shape) != (expected_dense_in, 256):
            raise ValueError(
                "head_dense kernel shape mismatch: "
                f"expected ({expected_dense_in}, 256), got {head_dense['kernel'].shape}"
            )

        head_output = _find_datasets(mw["head_output"])
        if "kernel" not in head_output or "bias" not in head_output:
            raise ValueError("head_output weights are incomplete in model file")
        if tuple(head_output["kernel"].shape) != (256, len(CLASS_NAMES)):
            raise ValueError(
                "head_output kernel shape mismatch: "
                f"expected (256, {len(CLASS_NAMES)}), got {head_output['kernel'].shape}"
            )


def detect_architecture(model_path: str, layer_names: set[str] | None = None) -> str:
    if layer_names is None:
        layer_names = _read_model_layer_names(model_path)

    if "top_conv" in layer_names and "stem_conv" in layer_names:
        return "efficientnet"

    if "conv5_block16_2_conv" in layer_names and ("conv1" in layer_names or "conv1_conv" in layer_names):
        return "densenet"

    name = os.path.basename(model_path).lower()
    if "efficientnet" in name:
        print(
            "[infer] Warning: architecture inferred from filename fallback (efficientnet)",
            file=sys.stderr,
        )
        return "efficientnet"
    if "densenet" in name:
        print(
            "[infer] Warning: architecture inferred from filename fallback (densenet)",
            file=sys.stderr,
        )
        return "densenet"

    raise ValueError("Unable to detect model architecture from model metadata")


def build_model(model_path: str):
    layer_names = _read_model_layer_names(model_path)
    arch = detect_architecture(model_path, layer_names)
    has_built_in_preprocess = "rescaling" in layer_names and "normalization" in layer_names

    _validate_saved_head(model_path, arch)

    if arch == "efficientnet":
        input_size = 300
        last_conv = "top_conv"
        base = tf.keras.applications.EfficientNetB3(
            include_top=False, weights=None,
            input_shape=(input_size, input_size, 3), pooling=None,
        )
    else:
        input_size = 224
        last_conv = "conv5_block16_2_conv"
        base = tf.keras.applications.DenseNet121(
            include_top=False, weights=None,
            input_shape=(input_size, input_size, 3), pooling=None,
        )

    x = base.output
    x = tf.keras.layers.GlobalAveragePooling2D(name="head_gap")(x)
    x = tf.keras.layers.BatchNormalization(name="head_bn")(x)
    x = tf.keras.layers.Dense(256, activation="relu", name="head_dense")(x)
    x = tf.keras.layers.Dropout(0.3, name="head_dropout")(x)
    out = tf.keras.layers.Dense(len(CLASS_NAMES), activation="softmax", name="head_output")(x)

    model = tf.keras.Model(inputs=base.input, outputs=out)
    model.load_weights(model_path, by_name=True, skip_mismatch=False)

    # DenseNet stores conv1 weights nested under conv1/{conv,bn} — fix manually
    if arch == "densenet":
        _fix_densenet_conv1(model, model_path)

    return model, last_conv, input_size, arch, has_built_in_preprocess


def _find_datasets(group) -> dict:
    """Recursively collect all dataset leaf values in an h5 group."""
    result = {}
    for key in group.keys():
        item = group[key]
        if hasattr(item, "keys"):
            result.update(_find_datasets(item))
        else:
            clean = key.replace(":0", "")
            result[clean] = np.array(item)
    return result


def _fix_densenet_conv1(model: tf.keras.Model, model_path: str) -> None:
    """Load conv1_conv and conv1_bn from the nested conv1/{conv,bn} h5 groups."""
    try:
        with h5py.File(model_path, "r") as f:
            mw = f.get("model_weights", f)
            if "conv1" not in mw:
                return
            c1 = mw["conv1"]

            if "conv" in c1:
                w = _find_datasets(c1["conv"])
                if "kernel" in w:
                    model.get_layer("conv1_conv").set_weights([w["kernel"]])

            if "bn" in c1:
                w = _find_datasets(c1["bn"])
                weights = [w[k] for k in ("gamma", "beta", "moving_mean", "moving_variance") if k in w]
                if len(weights) == 4:
                    model.get_layer("conv1_bn").set_weights(weights)
    except Exception as exc:
        print(f"[infer] Warning: conv1 manual fix failed: {type(exc).__name__}: {exc}", file=sys.stderr)


def preprocess(image_path: str, input_size: int, arch: str, has_built_in_preprocess: bool) -> tuple[np.ndarray, str]:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image not found: {image_path}")

    source_image = detect_image_source(image_path)

    if source_image == "dicom":
        arr = _dicom_to_rgb_array(image_path, input_size)
    else:
        img = Image.open(image_path).convert("RGB").resize((input_size, input_size), Image.LANCZOS)
        arr = np.array(img, dtype=np.float32)
        arr = np.expand_dims(arr, axis=0)  # shape: (1, H, W, 3), values in [0, 255]

    if has_built_in_preprocess:
        # Model has internal Rescaling/Normalization layers.
        return arr, source_image

    if arch == "efficientnet":
        # Fallback: if internal preprocessing layers are absent, preprocess explicitly.
        return efficientnet_preprocess(arr), source_image
    else:
        # Fallback: DenseNet default preprocessing.
        return densenet_preprocess(arr), source_image


def compute_gradcam(model: tf.keras.Model, img_array: np.ndarray, class_idx: int, last_conv_layer: str):
    try:
        last_conv = model.get_layer(last_conv_layer)
        grad_model = tf.keras.Model(
            inputs=model.inputs,
            outputs=[last_conv.output, model.output],
        )

        with tf.GradientTape() as tape:
            inputs = tf.cast(img_array, tf.float32)
            # training=False disables dropout so Grad-CAM is deterministic
            conv_outputs, predictions = grad_model(inputs, training=False)
            loss = predictions[:, class_idx]

        grads = tape.gradient(loss, conv_outputs)
        if grads is None:
            raise RuntimeError("Gradient computation returned None")

        pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
        conv_out = conv_outputs[0]
        heatmap = conv_out @ pooled_grads[..., tf.newaxis]
        heatmap = tf.squeeze(heatmap)
        heatmap = tf.maximum(heatmap, 0)
        max_val = tf.reduce_max(heatmap)
        if max_val > 0:
            heatmap = heatmap / max_val

        heatmap_np = heatmap.numpy()
        return heatmap_np.tolist(), list(heatmap_np.shape), False  # gradcam_failed=False

    except Exception as e:
        print(f"[infer] Warning: Grad-CAM fallback used: {type(e).__name__}: {e}", file=sys.stderr)
        # Fallback: synthetic bilateral lung heatmap
        # gradcam_failed=True so frontend can show a warning
        size = 14
        rows = []
        for i in range(size):
            row = []
            for j in range(size):
                dx = j - 6.5
                dy = i - 6.5
                lb = float(np.exp(-((dx + 2.2) ** 2 + (dy + 0.6) ** 2) / 8))
                rb = float(np.exp(-((dx - 2.0) ** 2 + (dy - 0.8) ** 2) / 7))
                cg = float(np.exp(-(dx ** 2 + dy ** 2) / 18))
                row.append(min(1.0, lb * 0.55 + rb * 0.7 + cg * 0.2))
            rows.append(row)
        return rows, [size, size], True  # gradcam_failed=True


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"error": "usage: infer.py <model_path> <image_path>"}))
        sys.exit(1)

    model_path = sys.argv[1]
    image_path = sys.argv[2]

    if not os.path.exists(model_path):
        print(json.dumps({"error": f"model_not_found: {model_path}"}))
        sys.exit(1)

    if not os.path.exists(image_path):
        print(json.dumps({"error": f"image_not_found: {image_path}"}))
        sys.exit(1)

    started = time.perf_counter()

    model, last_conv, input_size, arch, has_built_in_preprocess = build_model(model_path)

    preprocess_started = time.perf_counter()
    img_array, source_image = preprocess(image_path, input_size, arch, has_built_in_preprocess)
    preprocess_ms = (time.perf_counter() - preprocess_started) * 1000.0

    # model.predict() already runs in inference mode (dropout disabled)
    infer_started = time.perf_counter()
    predictions = model.predict(img_array, verbose=0)[0]
    infer_ms = (time.perf_counter() - infer_started) * 1000.0
    if not np.all(np.isfinite(predictions)):
        raise ValueError("Model returned non-finite confidence scores")
    class_idx = int(np.argmax(predictions))
    predicted_class = CLASS_NAMES[class_idx]

    confidence = {CLASS_NAMES[i]: float(predictions[i]) for i in range(len(CLASS_NAMES))}
    confidence_sum = float(sum(predictions))

    gradcam_started = time.perf_counter()
    activation_map, activation_map_shape, gradcam_failed = compute_gradcam(
        model, img_array, class_idx, last_conv
    )
    gradcam_ms = (time.perf_counter() - gradcam_started) * 1000.0

    reliability_flags: list[str] = []
    if source_image == "dicom":
        reliability_flags.append("dicom_input")
    if gradcam_failed:
        reliability_flags.append("gradcam_fallback")
    if abs(confidence_sum - 1.0) >= 0.05:
        reliability_flags.append("confidence_drift")

    result = {
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
            "total_ms": round((time.perf_counter() - started) * 1000.0, 3),
        },
        "reliability": {
            "degraded": len(reliability_flags) > 0,
            "flags": reliability_flags,
            "source_image": source_image,
        },
    }

    print(json.dumps(result))


if __name__ == "__main__":
    main()
