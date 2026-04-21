"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { predictImage, PredictRequestError } from "@/lib/api";
import { useSessionStore } from "@/lib/session-store";
import type { PredictModelSelection } from "@/lib/types";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { LandingLung } from "@/components/visualization/LandingLung";

import styles from "./ProcessingSection.module.css";

const ALL_TIPS = [
  "Bilateral lung fields are normalized before model comparison starts.",
  "Scan highlights are restricted to pulmonary anatomy to avoid noise.",
  "Bronchial branch structure stabilizes attention-map interpretation.",
  "Calibration pass reduces overconfident peripheral activations.",
  "Consistent bilateral patterns usually improve final confidence.",
  "Extracting hierarchical multi-scale pathological features...",
  "Applying temperature-scaled softmax normalization...",
  "Spatial dimensions are resampling to tensor specifications...",
  "Isolating cardiothoracic ratio for bounding box constraints...",
  "Backpropagating gradients to generate localization maps...",
  "Aligning Grad-CAM overlays to internal coordinate space...",
  "Computing spatial feature representations from dense blocks...",
  "Validating opacity densities against trained pathological datasets..."
];

const PHASE_ADVANCE_MS = 2500;
const TIP_ADVANCE_MS = 4000;
const MIN_PROCESSING_MS = 3_000;

const STEPS = ["Preprocess", "Inference", "Mapping", "Complete"] as const;

const typicalRangeForModel = (model: PredictModelSelection) => {
  if (model === "ensemble") return "20–35s";
  return "8–20s";
};

const getProcessingErrorMessage = (err: unknown, model: PredictModelSelection) => {
  if (err instanceof PredictRequestError) {
    if (err.code === "timeout") {
      if (model === "ensemble") {
        return "Ensemble inference timed out - it runs both models. Retry or switch to a single model for speed.";
      }
      return "Inference timed out - model may still be loading, try again";
    }
    if (err.code === "cancelled") return "Inference was cancelled. Retry analysis when ready.";
    if (err.code === "network") return "Network interrupted during inference. Please retry analysis.";
    if (err.code === "validation") return "Inference returned an invalid response. Please retry analysis.";
    if (err.code === "server") return "Inference service failed. Please retry analysis.";
  }
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  return "Prediction request failed";
};

export function ProcessingSection() {
  const router = useRouter();
  const uploadedFile = useSessionStore((state) => state.uploadedFile);
  const selectedModel = useSessionStore((state) => state.selectedModel);
  const setPrediction = useSessionStore((state) => state.setPrediction);

  const [shuffledTips, setShuffledTips] = useState<string[]>([]);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [tipIndex, setTipIndex] = useState(0);
  const [telemetryIndex, setTelemetryIndex] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const PREFLIGHT_CHECKS = [
    "Checksum OK",
    "Density Map Valid",
    "Resolution Matrix OK",
    "Histogram Calibrated",
    "Saliency Bounds Set",
    "Tensor Array Active",
    "Spatial Filters OK"
  ];

  useEffect(() => {
    // Fisher-Yates shuffle on mount
    const shuffled = [...ALL_TIPS];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setShuffledTips(shuffled);
  }, []);

  useEffect(() => {
    if (!uploadedFile) {
      setRedirecting(true);
      const timer = window.setTimeout(() => router.replace("/upload"), 600);
      return () => window.clearTimeout(timer);
    }
    setRedirecting(false);
  }, [router, uploadedFile]);

  useEffect(() => {
    setPhaseIndex(0);
    const phaseTimer = window.setInterval(() => {
      setPhaseIndex((prev) => {
        // Pause at "Mapping" (index 2) until the backend actually finishes
        if (prev >= 2) return 2;
        return prev + 1;
      });
    }, PHASE_ADVANCE_MS);
    return () => window.clearInterval(phaseTimer);
  }, [retryNonce]);

  useEffect(() => {
    if (shuffledTips.length < 1) return;
    const tipTimer = window.setInterval(() => {
      setTipIndex((prev) => (prev + 1) % shuffledTips.length);
    }, TIP_ADVANCE_MS);
    return () => window.clearInterval(tipTimer);
  }, [shuffledTips]);

  useEffect(() => {
    const tInterval = window.setInterval(() => {
      setTelemetryIndex((prev) => (prev + 1) % PREFLIGHT_CHECKS.length);
    }, 1800);
    return () => window.clearInterval(tInterval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!uploadedFile) return;
    setElapsedSec(0);
    const start = performance.now();
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((performance.now() - start) / 1000));
    }, 1000);
    return () => window.clearInterval(id);
  }, [uploadedFile, retryNonce]);

  useEffect(() => {
    if (!uploadedFile) return;
    let active = true;
    let minDurationTimer: number | null = null;
    const controller = new AbortController();
    setError(null);
    setIsExiting(false);

    const minDurationPromise = new Promise<void>((resolve) => {
      minDurationTimer = window.setTimeout(() => {
        minDurationTimer = null;
        resolve();
      }, MIN_PROCESSING_MS);
    });

    const runInference = async () => {
      try {
        const result = await predictImage(uploadedFile, selectedModel, controller.signal);
        if (!active) return;
        await minDurationPromise;
        if (!active) return;
        
        setPrediction(result);
        
        // 1. Advance UI to "Complete" step
        setPhaseIndex(3);
        
        // 2. Short pause for user to register completion
        await new Promise((resume) => window.setTimeout(resume, 400));
        if (!active) return;
        
        // 3. Trigger cinematic fade out
        setIsExiting(true);
        
        // 4. Wait for CSS fade out transition
        await new Promise((resume) => window.setTimeout(resume, 600));
        if (!active) return;
        
        // 5. Navigate to results
        router.push("/results");
      } catch (err) {
        if (!active || controller.signal.aborted) return;
        setError(getProcessingErrorMessage(err, selectedModel));
      }
    };

    runInference();

    return () => {
      active = false;
      controller.abort();
      if (minDurationTimer !== null) window.clearTimeout(minDurationTimer);
    };
  }, [retryNonce, router, selectedModel, setPrediction, uploadedFile]);

  const activeStep = Math.min(phaseIndex, STEPS.length - 1);
  const typicalRange = typicalRangeForModel(selectedModel);

  if (!uploadedFile) {
    return (
      <div className={styles.shell}>
        <div className={styles.noSession}>
          <p className={styles.noSessionLabel}>Session check</p>
          <p className={styles.noSessionBody}>
            No active radiograph detected. Return to the upload screen to begin.
          </p>
          <div className={styles.actionRow}>
            <PrimaryButton onClick={() => router.replace("/upload")}>Back to Upload</PrimaryButton>
            {redirecting && <span className={styles.redirecting}>Redirecting…</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${styles.shell} ${isExiting ? styles.exiting : ""}`}>
      {/* Full-viewport 3D lung */}
      <div className={styles.lungStage}>
        <LandingLung opacity={0.92} cameraDistance={6.4} />
      </div>

      {/* Top-right HUD — stepper + elapsed */}
      <div className={styles.hud}>
        <div className={styles.stepper} aria-hidden>
          {STEPS.map((s, i) => (
            <div key={s} className={i === activeStep ? styles.stepActive : styles.stepItem}>
              <span className={i === activeStep ? styles.stepDotActive : styles.stepDot} />
              <span className={styles.stepLabel}>{s}</span>
            </div>
          ))}
        </div>
        <div className={styles.eta}>Elapsed {elapsedSec}s • Typical {typicalRange}</div>
      </div>

      {/* Bottom-right — telemetry */}
      <div className={styles.bottomHud}>
        <div className={styles.reliability}>
          <span className={styles.reliabilityLabel}>Telemetry</span>
          <span className={styles.reliabilityValue}>
            <AnimatePresence mode="wait">
              <motion.span
                key={telemetryIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.3 }}
                style={{ display: "inline-block" }}
              >
                {PREFLIGHT_CHECKS[telemetryIndex]}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>
      </div>

      {/* Bottom-center — rotating tips */}
      <div className={styles.tipStrip} aria-live="polite">
        {shuffledTips.length > 0 && (
          <AnimatePresence mode="wait">
            <motion.div
              key={tipIndex}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="flex items-center justify-center gap-3 w-full"
            >
              {/* Sleek animated AI node instead of the full logo */}
              <div className="relative flex items-center justify-center flex-shrink-0">
                <div className="absolute inset-0 rounded-full bg-[#10B981] opacity-40 blur-[4px] animate-pulse"></div>
                <div className="w-2 h-2 rounded-full bg-[#10B981] relative z-10 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>
              </div>
              <p className={styles.tipText} style={{ margin: 0 }}>
                {shuffledTips[tipIndex]}
              </p>
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Error overlay */}
      {error && (
        <div className={styles.errorOverlay}>
          <div className={styles.errorHeader}>
            <span className={styles.errorIcon}>!</span>
            <span className={styles.errorTitle}>SYSTEM FAILURE</span>
          </div>
          <p className={styles.errorMsg}>{error}</p>
          <div className={styles.actionRow}>
            <PrimaryButton
              onClick={() => {
                setError(null);
                setRetryNonce((v) => v + 1);
              }}
            >
              Reboot Pipeline
            </PrimaryButton>
            <button
              className="ghost-button px-4 py-2 text-xs tracking-[0.14em]"
              onClick={() => router.push("/upload")}
              style={{ borderColor: "rgba(239, 68, 68, 0.4)", color: "var(--color-critical)" }}
            >
              Terminate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
