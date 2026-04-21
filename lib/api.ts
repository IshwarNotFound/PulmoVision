import type {
  ConfidenceDistribution,
  EnsembleMetadata,
  HealthResponse,
  InferenceTelemetry,
  PredictedClass,
  PredictModelSelection,
  PredictResponse,
  ReliabilityMetadata,
} from "@/lib/types";

type UnknownRecord = Record<string, unknown>;
export type PredictErrorCode =
  | "timeout"
  | "cancelled"
  | "network"
  | "server"
  | "validation"
  | "unknown";

export class PredictRequestError extends Error {
  readonly code: PredictErrorCode;
  readonly detail?: string;

  constructor(code: PredictErrorCode, message: string, detail?: string) {
    super(message);
    this.name = "PredictRequestError";
    this.code = code;
    this.detail = detail;
  }
}

const CLASS_KEYS = ["COVID", "Lung_Opacity", "Normal", "Viral Pneumonia"] as const;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNormalizedScore = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

const getPayloadError = (payload: unknown) => {
  if (!isRecord(payload)) return null;
  return typeof payload.error === "string" ? payload.error : null;
};

const getPayloadDetail = (payload: unknown) => {
  if (!isRecord(payload)) return null;
  return typeof payload.detail === "string" ? payload.detail : null;
};

const getPayloadCode = (payload: unknown) => {
  if (!isRecord(payload)) return null;
  return typeof payload.code === "string" ? payload.code : null;
};

const TIMEOUT_MESSAGE = "Inference timed out - model may still be loading, try again";

const toNonOkPredictError = (response: Response, payload: unknown) => {
  const payloadError = getPayloadError(payload);
  const payloadDetail = getPayloadDetail(payload);
  const payloadCode = getPayloadCode(payload)?.toLowerCase();

  const normalizedError = payloadError?.toLowerCase() ?? "";
  const normalizedDetail = payloadDetail?.toLowerCase() ?? "";

  let code: PredictErrorCode = "server";
  if (
    response.status === 408 ||
    response.status === 504 ||
    payloadCode === "timeout" ||
    normalizedError.includes("timeout") ||
    normalizedDetail.includes("timeout")
  ) {
    code = "timeout";
  } else if (
    response.status === 499 ||
    payloadCode === "cancelled" ||
    normalizedError.includes("aborted")
  ) {
    code = "cancelled";
  } else if (response.status >= 400 && response.status < 500) {
    code = "validation";
  }

  let message = "Inference failed on the server. Please retry analysis.";
  if (code === "timeout") {
    message = TIMEOUT_MESSAGE;
  } else if (code === "cancelled") {
    message = "Inference was cancelled.";
  } else if (code === "validation") {
    message = "Prediction request was rejected. Please verify the image and retry.";
  }

  return new PredictRequestError(code, message, payloadDetail ?? payloadError ?? undefined);
};

const isAbortError = (err: unknown): err is DOMException =>
  err instanceof DOMException && err.name === "AbortError";

const parseHealthResponse = (payload: unknown): HealthResponse => {
  if (!isRecord(payload)) {
    throw new Error("Invalid health payload: expected object");
  }

  const { status, models_loaded, cors_enabled, inference, message } = payload;

  if (typeof status !== "string") {
    throw new Error("Invalid health payload: status");
  }

  if (!Array.isArray(models_loaded) || !models_loaded.every((model) => typeof model === "string")) {
    throw new Error("Invalid health payload: models_loaded");
  }

  if (typeof cors_enabled !== "boolean") {
    throw new Error("Invalid health payload: cors_enabled");
  }

  if (typeof inference !== "string") {
    throw new Error("Invalid health payload: inference");
  }

  if (typeof message !== "string") {
    throw new Error("Invalid health payload: message");
  }

  return {
    status,
    models_loaded,
    cors_enabled,
    inference,
    message,
  };
};

const parseConfidenceDistribution = (
  payload: unknown,
  context: string,
): ConfidenceDistribution => {
  if (!isRecord(payload)) {
    throw new Error(`Invalid prediction payload: ${context}`);
  }

  const confidenceValues = {
    COVID: payload.COVID,
    Lung_Opacity: payload.Lung_Opacity,
    Normal: payload.Normal,
    "Viral Pneumonia": payload["Viral Pneumonia"],
  } as const;

  if (!Object.values(confidenceValues).every((value) => isNormalizedScore(value))) {
    throw new Error(`Invalid prediction payload: ${context} values`);
  }

  return {
    COVID: confidenceValues.COVID as number,
    Lung_Opacity: confidenceValues.Lung_Opacity as number,
    Normal: confidenceValues.Normal as number,
    "Viral Pneumonia": confidenceValues["Viral Pneumonia"] as number,
  };
};

const parseEnsembleMetadata = (payload: unknown): EnsembleMetadata | undefined => {
  if (payload === undefined) {
    return undefined;
  }

  if (!isRecord(payload)) {
    throw new Error("Invalid prediction payload: ensemble");
  }

  if (typeof payload.method !== "string" || payload.method.trim().length === 0) {
    throw new Error("Invalid prediction payload: ensemble.method");
  }

  if (typeof payload.degraded !== "boolean") {
    throw new Error("Invalid prediction payload: ensemble.degraded");
  }

  if (typeof payload.agreement !== "boolean") {
    throw new Error("Invalid prediction payload: ensemble.agreement");
  }

  if (typeof payload.winning_model !== "string" || payload.winning_model.trim().length === 0) {
    throw new Error("Invalid prediction payload: ensemble.winning_model");
  }

  if (!Array.isArray(payload.failed_models)) {
    throw new Error("Invalid prediction payload: ensemble.failed_models");
  }

  const failedModels = payload.failed_models.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid prediction payload: ensemble.failed_models[${index}]`);
    }
    if (typeof entry.model !== "string" || typeof entry.error !== "string") {
      throw new Error(`Invalid prediction payload: ensemble.failed_models[${index}] values`);
    }
    return {
      model: entry.model,
      error: entry.error,
    };
  });

  if (!Array.isArray(payload.individual_predictions)) {
    throw new Error("Invalid prediction payload: ensemble.individual_predictions");
  }

  const individualPredictions = payload.individual_predictions.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}]`);
    }

    if (typeof entry.model !== "string" || entry.model.trim().length === 0) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].model`);
    }

    if (
      typeof entry.predicted_class !== "string" ||
      !CLASS_KEYS.includes(entry.predicted_class as (typeof CLASS_KEYS)[number])
    ) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].predicted_class`);
    }

    const confidence = parseConfidenceDistribution(
      entry.confidence,
      `ensemble.individual_predictions[${index}].confidence`,
    );

    if (!isFiniteNumber(entry.confidence_sum)) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].confidence_sum`);
    }

    if (typeof entry.gradcam_failed !== "boolean") {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].gradcam_failed`);
    }

    const mapShape = entry.activation_map_shape;
    if (
      !Array.isArray(mapShape) ||
      mapShape.length !== 2 ||
      !Number.isInteger(mapShape[0]) ||
      !Number.isInteger(mapShape[1]) ||
      mapShape[0] <= 0 ||
      mapShape[1] <= 0
    ) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].activation_map_shape`);
    }

    if (!isNormalizedScore(entry.weight)) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].weight`);
    }

    if (!isNormalizedScore(entry.top_confidence)) {
      throw new Error(`Invalid prediction payload: ensemble.individual_predictions[${index}].top_confidence`);
    }

    return {
      model: entry.model,
      predicted_class: entry.predicted_class as PredictedClass,
      confidence,
      confidence_sum: entry.confidence_sum,
      gradcam_failed: entry.gradcam_failed,
      activation_map_shape: [mapShape[0] as number, mapShape[1] as number] as [number, number],
      weight: entry.weight,
      top_confidence: entry.top_confidence,
    };
  });

  return {
    method: payload.method,
    degraded: payload.degraded,
    agreement: payload.agreement,
    winning_model: payload.winning_model,
    failed_models: failedModels,
    individual_predictions: individualPredictions,
  };
};

const parseTelemetryMetadata = (payload: unknown): InferenceTelemetry | undefined => {
  if (payload === undefined) {
    return undefined;
  }

  if (!isRecord(payload)) {
    throw new Error("Invalid prediction payload: telemetry");
  }

  const telemetry: InferenceTelemetry = {};
  const keys: Array<keyof InferenceTelemetry> = [
    "preprocess_ms",
    "infer_ms",
    "gradcam_ms",
    "ensemble_ms",
    "total_ms",
  ];

  for (const key of keys) {
    const value = payload[key as string];
    if (value === undefined) {
      continue;
    }
    if (!isFiniteNumber(value) || value < 0) {
      throw new Error(`Invalid prediction payload: telemetry.${key}`);
    }
    telemetry[key] = value;
  }

  return telemetry;
};

const parseReliabilityMetadata = (payload: unknown): ReliabilityMetadata | undefined => {
  if (payload === undefined) {
    return undefined;
  }

  if (!isRecord(payload)) {
    throw new Error("Invalid prediction payload: reliability");
  }

  if (typeof payload.degraded !== "boolean") {
    throw new Error("Invalid prediction payload: reliability.degraded");
  }

  if (!Array.isArray(payload.flags) || !payload.flags.every((flag) => typeof flag === "string")) {
    throw new Error("Invalid prediction payload: reliability.flags");
  }

  const source = payload.source_image;
  if (source !== "png" && source !== "jpeg" && source !== "dicom" && source !== "unknown") {
    throw new Error("Invalid prediction payload: reliability.source_image");
  }

  return {
    degraded: payload.degraded,
    flags: payload.flags,
    source_image: source,
  };
};

const parsePredictResponse = (payload: unknown): PredictResponse => {
  if (!isRecord(payload)) {
    throw new Error("Invalid prediction payload: expected object");
  }

  const predictedClass = payload.predicted_class;
  if (typeof predictedClass !== "string" || !CLASS_KEYS.includes(predictedClass as (typeof CLASS_KEYS)[number])) {
    throw new Error("Invalid prediction payload: predicted_class");
  }

  const normalizedConfidence = parseConfidenceDistribution(payload.confidence, "confidence");

  const activationMap = payload.activation_map;
  if (
    !Array.isArray(activationMap) ||
    activationMap.length === 0 ||
    !activationMap.every(
      (row) =>
        Array.isArray(row) &&
        row.length > 0 &&
        row.every((value) => isNormalizedScore(value)),
    )
  ) {
    throw new Error("Invalid prediction payload: activation_map");
  }

  const mapShape = payload.activation_map_shape;
  if (
    !Array.isArray(mapShape) ||
    mapShape.length !== 2 ||
    !Number.isInteger(mapShape[0]) ||
    !Number.isInteger(mapShape[1]) ||
    mapShape[0] <= 0 ||
    mapShape[1] <= 0
  ) {
    throw new Error("Invalid prediction payload: activation_map_shape");
  }

  const mapRows = mapShape[0] as number;
  const mapCols = mapShape[1] as number;
  if (
    activationMap.length !== mapRows ||
    !activationMap.every((row) => row.length === mapCols)
  ) {
    throw new Error("Invalid prediction payload: activation map shape mismatch");
  }

  if (payload.activation_map_origin !== "top_left") {
    throw new Error("Invalid prediction payload: activation_map_origin");
  }

  if (payload.activation_map_encoding !== "normalized_float32") {
    throw new Error("Invalid prediction payload: activation_map_encoding");
  }

  if (typeof payload.gradcam_failed !== "boolean") {
    throw new Error("Invalid prediction payload: gradcam_failed");
  }

  if (!isFiniteNumber(payload.confidence_sum)) {
    throw new Error("Invalid prediction payload: confidence_sum");
  }

  if (typeof payload.confidence_tolerance_ok !== "boolean") {
    throw new Error("Invalid prediction payload: confidence_tolerance_ok");
  }

  if (typeof payload.model !== "string" || payload.model.trim().length === 0) {
    throw new Error("Invalid prediction payload: model");
  }

  const ensembleMetadata = parseEnsembleMetadata(payload.ensemble);
  const telemetryMetadata = parseTelemetryMetadata(payload.telemetry);
  const reliabilityMetadata = parseReliabilityMetadata(payload.reliability);

  return {
    predicted_class: predictedClass as PredictedClass,
    confidence: normalizedConfidence,
    activation_map: activationMap as number[][],
    activation_map_shape: [mapRows, mapCols],
    activation_map_origin: "top_left",
    activation_map_encoding: "normalized_float32",
    gradcam_failed: payload.gradcam_failed,
    confidence_sum: payload.confidence_sum,
    confidence_tolerance_ok: payload.confidence_tolerance_ok,
    model: payload.model,
    ensemble: ensembleMetadata,
    telemetry: telemetryMetadata,
    reliability: reliabilityMetadata,
  };
};

const withNoCache = {
  cache: "no-store" as RequestCache,
  headers: {
    Accept: "application/json",
  },
};

export const checkHealth = async () => {
  const response = await fetch("/api/health", withNoCache);
  if (!response.ok) {
    throw new Error("Health endpoint unavailable");
  }

  const payload = await response.json();
  return parseHealthResponse(payload);
};

const PREDICT_TIMEOUT_MS = 265_000;
const ENSEMBLE_PREDICT_TIMEOUT_MS = 265_000;

export const predictImage = async (
  file: File,
  model: PredictModelSelection = "densenet",
  externalSignal?: AbortSignal,
) => {
  if (externalSignal?.aborted) {
    throw new PredictRequestError("cancelled", "Inference was cancelled.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeoutMs = model === "ensemble" ? ENSEMBLE_PREDICT_TIMEOUT_MS : PREDICT_TIMEOUT_MS;

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener("abort", onExternalAbort, { once: true });

  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("model", model);

    const response = await fetch("/api/predict", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw toNonOkPredictError(response, payload);
    }

    const payload = await response.json().catch(() => {
      throw new PredictRequestError("server", "Inference response could not be read. Please retry.");
    });

    try {
      return parsePredictResponse(payload);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      throw new PredictRequestError(
        "validation",
        "Inference response validation failed. Please retry analysis.",
        detail,
      );
    }
  } catch (err) {
    if (isAbortError(err)) {
      if (timedOut) {
        throw new PredictRequestError("timeout", TIMEOUT_MESSAGE);
      }
      if (externalSignal?.aborted) {
        throw new PredictRequestError("cancelled", "Inference was cancelled.");
      }
      throw new PredictRequestError(
        "network",
        "Inference request was interrupted by the network. Please retry.",
      );
    }

    if (err instanceof PredictRequestError) {
      throw err;
    }

    if (err instanceof TypeError) {
      throw new PredictRequestError(
        "network",
        "Could not reach the inference service. Check your connection and retry.",
      );
    }

    if (err instanceof Error) {
      throw new PredictRequestError("unknown", err.message);
    }

    throw new PredictRequestError("unknown", "Prediction request failed.");
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener("abort", onExternalAbort);
  }
};
