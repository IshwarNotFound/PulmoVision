import { create } from "zustand";

import type { PredictModelSelection, PredictResponse } from "@/lib/types";

interface SessionState {
  uploadedFile: File | null;
  previewUrl: string | null;
  selectedModel: PredictModelSelection;
  prediction: PredictResponse | null;
  reportGenerated: boolean;
  setUpload: (file: File, previewUrl: string | null, model: PredictModelSelection) => void;
  setPrediction: (prediction: PredictResponse | null) => void;
  setReportGenerated: (generated: boolean) => void;
  clearSession: () => void;
}

const safeRevokeObjectUrl = (url: string | null) => {
  if (!url) return;
  if (typeof URL === "undefined") return;

  try {
    URL.revokeObjectURL(url);
  } catch {
    // No-op: URL may already be revoked.
  }
};

export const useSessionStore = create<SessionState>((set, get) => ({
  uploadedFile: null,
  previewUrl: null,
  selectedModel: "densenet",
  prediction: null,
  reportGenerated: false,
  setUpload: (file, previewUrl, model) => {
    const previousPreview = get().previewUrl;
    if (previousPreview && previousPreview !== previewUrl) {
      safeRevokeObjectUrl(previousPreview);
    }

    set({
      uploadedFile: file,
      previewUrl,
      selectedModel: model,
      prediction: null,
      reportGenerated: false,
    });
  },
  setPrediction: (prediction) => set({ prediction }),
  setReportGenerated: (generated) => set({ reportGenerated: generated }),
  clearSession: () => {
    safeRevokeObjectUrl(get().previewUrl);

    set({
      uploadedFile: null,
      previewUrl: null,
      selectedModel: "densenet",
      prediction: null,
      reportGenerated: false,
    });
  },
}));
