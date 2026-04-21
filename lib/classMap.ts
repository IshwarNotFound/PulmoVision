import type { PredictedClass } from "@/lib/types";

export const CLASS_DISPLAY: Record<
  PredictedClass,
  {
    label: string;
    description: string;
    riskLevel: "normal" | "attention";
  }
> = {
  COVID: {
    label: "Viral Pattern - COVID-type",
    description:
      "The model detected patterns consistent with COVID-type viral pneumonia. This is a pattern recognition result, not a clinical diagnosis.",
    riskLevel: "attention",
  },
  Lung_Opacity: {
    label: "Opacity Present",
    description:
      "The model detected areas of increased density that may indicate fluid, infection, or other findings worth reviewing.",
    riskLevel: "attention",
  },
  Normal: {
    label: "No Patterns Detected",
    description:
      "No patterns detected for the 4 trained conditions. This does not constitute a comprehensive radiological clearance.",
    riskLevel: "normal",
  },
  "Viral Pneumonia": {
    label: "Viral Pneumonia Pattern",
    description:
      "The model detected patterns consistent with viral pneumonia. Clinical evaluation is recommended.",
    riskLevel: "attention",
  },
};

export const RESULTS_SCOPE_NOTE =
  "Model trained on 4 conditions only: COVID-type patterns, lung opacity, viral pneumonia, normal presentations.";

export const MODEL_LIMITATIONS =
  "PulmoVision is trained specifically on 4 conditions: COVID-19 type viral patterns, lung opacity, viral pneumonia, and normal presentations. It CANNOT detect: Tuberculosis, lung nodules, lung cancer, pleural effusion, pneumothorax, cardiomegaly, consolidation, atelectasis, rib fractures, or any other condition outside its training scope. A \"Normal\" result means: no patterns found for these 4 conditions. It is not a comprehensive radiological clearance.";
