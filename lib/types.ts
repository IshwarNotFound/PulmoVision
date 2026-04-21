export type PredictedClass = "COVID" | "Lung_Opacity" | "Normal" | "Viral Pneumonia";
export type PredictModelSelection = "densenet" | "efficientnet" | "ensemble";

export interface ConfidenceDistribution {
  COVID: number;
  Lung_Opacity: number;
  Normal: number;
  "Viral Pneumonia": number;
}

export interface EnsembleIndividualPrediction {
  model: string;
  predicted_class: PredictedClass;
  confidence: ConfidenceDistribution;
  confidence_sum: number;
  gradcam_failed: boolean;
  activation_map_shape: [number, number];
  weight: number;
  top_confidence: number;
}

export interface EnsembleFailedModel {
  model: string;
  error: string;
}

export interface EnsembleMetadata {
  method: string;
  degraded: boolean;
  agreement: boolean;
  winning_model: string;
  failed_models: EnsembleFailedModel[];
  individual_predictions: EnsembleIndividualPrediction[];
}

export interface InferenceTelemetry {
  preprocess_ms?: number;
  infer_ms?: number;
  gradcam_ms?: number;
  ensemble_ms?: number;
  total_ms?: number;
}

export interface ReliabilityMetadata {
  degraded: boolean;
  flags: string[];
  source_image: "png" | "jpeg" | "dicom" | "unknown";
}

export interface PredictResponse {
  predicted_class: PredictedClass;
  confidence: ConfidenceDistribution;
  activation_map: number[][];
  activation_map_shape: [number, number];
  activation_map_origin: "top_left";
  activation_map_encoding: "normalized_float32";
  gradcam_failed: boolean;
  confidence_sum: number;
  confidence_tolerance_ok: boolean;
  model: string;
  ensemble?: EnsembleMetadata;
  telemetry?: InferenceTelemetry;
  reliability?: ReliabilityMetadata;
}

export interface HealthResponse {
  status: "ok" | "degraded" | "offline" | string;
  models_loaded: string[];
  cors_enabled: boolean;
  inference: "local" | string;
  message: string;
}
