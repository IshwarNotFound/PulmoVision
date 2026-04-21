"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";

import { GlassCard } from "@/components/ui/GlassCard";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { LandingLung } from "@/components/visualization/LandingLung";
import { useSessionStore } from "@/lib/session-store";
import type { PredictModelSelection } from "@/lib/types";
import { cn } from "@/lib/utils";

import styles from "./UploadSection.module.css";

type UploadState = "idle" | "drag-over" | "validating" | "error" | "ready";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const DICOM_EXTENSIONS = [".dcm", ".dicom"];
const DICOM_MIME_TYPES = new Set(["application/dicom", "application/dicom+json"]);

const getFileExtension = (name: string) => {
  const idx = name.lastIndexOf(".");
  return idx >= 0 ? name.slice(idx).toLowerCase() : "";
};

const isDicomUpload = (nextFile: File) => {
  const mime = nextFile.type.toLowerCase();
  const hasDicomExtension = DICOM_EXTENSIONS.includes(getFileExtension(nextFile.name));
  return DICOM_MIME_TYPES.has(mime) || (mime === "application/octet-stream" && hasDicomExtension) || hasDicomExtension;
};

const isRasterUpload = (nextFile: File) => {
  const mime = nextFile.type.toLowerCase();
  const ext = getFileExtension(nextFile.name);
  return mime === "image/png" || mime === "image/jpeg" || ext === ".png" || ext === ".jpg" || ext === ".jpeg";
};

export function UploadSection() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const validationTimeoutRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const demoAbortRef = useRef<AbortController | null>(null);

  const setUpload = useSessionStore((state) => state.setUpload);
  const clearSession = useSessionStore((state) => state.clearSession);

  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedModel, setSelectedModel] = useState<PredictModelSelection>("densenet");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    clearSession();
  }, [clearSession]);

  useEffect(() => {
    previewUrlRef.current = previewUrl;
  }, [previewUrl]);

  useEffect(() => {
    return () => {
      if (validationTimeoutRef.current) {
        window.clearTimeout(validationTimeoutRef.current);
      }
      demoAbortRef.current?.abort();

      const persistedPreview = useSessionStore.getState().previewUrl;
      if (previewUrlRef.current && previewUrlRef.current !== persistedPreview) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const validateFile = (nextFile: File) => {
    const validMime = isRasterUpload(nextFile) || isDicomUpload(nextFile);
    return validMime && nextFile.size <= MAX_FILE_SIZE;
  };

  const handleAcceptedFile = (nextFile: File) => {
    if (validationTimeoutRef.current) {
      window.clearTimeout(validationTimeoutRef.current);
    }

    setSubmitting(false);
    setUploadState("validating");
    setErrorMessage("");

    validationTimeoutRef.current = window.setTimeout(() => {
      if (!validateFile(nextFile)) {
        setUploadState("error");
        setErrorMessage("Invalid format. PNG, JPEG, or DICOM required. Max 10MB. Ensure file is a valid chest radiograph export.");
        return;
      }

      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }

      const nextPreview = isRasterUpload(nextFile) ? URL.createObjectURL(nextFile) : null;
      previewUrlRef.current = nextPreview;
      setPreviewUrl(nextPreview);
      setFile(nextFile);
      setUploadState("ready");
    }, 700);
  };

  const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    demoAbortRef.current?.abort();
    setUploadState("validating");

    const dropped = event.dataTransfer.files?.[0];
    if (dropped) {
      handleAcceptedFile(dropped);
    }
  };

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (uploadState === "ready") return;

    setUploadState("drag-over");
    event.currentTarget.style.setProperty("--cursor-x", `${event.nativeEvent.offsetX}px`);
    event.currentTarget.style.setProperty("--cursor-y", `${event.nativeEvent.offsetY}px`);
  };

  const onDragLeave = () => {
    if (uploadState === "ready") return;
    setUploadState("idle");
  };

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    demoAbortRef.current?.abort();
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    handleAcceptedFile(nextFile);
    event.target.value = "";
  };

  const loadDemo = async () => {
    demoAbortRef.current?.abort();
    const controller = new AbortController();
    demoAbortRef.current = controller;

    setUploadState("validating");
    try {
      const response = await fetch("/demo-scan.png", {
        signal: controller.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Demo image not available");
      const blob = await response.blob();
      if (blob.size === 0) throw new Error("Demo image is empty");
      if (!blob.type.startsWith("image/")) throw new Error("Demo file is not an image");
      const demoFile = new File([blob], "demo-scan.png", { type: "image/png" });
      handleAcceptedFile(demoFile);
    } catch (err) {
      if (controller.signal.aborted) {
        return;
      }
      setUploadState("error");
      setErrorMessage(err instanceof Error ? err.message : "Failed to load demo image");
    }
  };

  const submitReady = () => {
    if (!file || submitting) return;

    setSubmitting(true);
    setUpload(file, previewUrl, selectedModel);
    router.push("/processing");
  };

  const isDicomSelected = Boolean(file && isDicomUpload(file));

  const statusMessage = useMemo(() => {
    if (uploadState === "validating") return "Validating Radiograph Format and Dimensions...";
    if (uploadState === "error") return errorMessage;
    if (uploadState === "ready") {
      if (isDicomSelected) {
        return "DICOM Acquisition Confirmed. Pixel data ready for inference.";
      }
      return "Acquisition Confirmed. Ready for Convolutional Inference.";
    }
    return "Drag & Drop Radiograph Here";
  }, [uploadState, errorMessage, isDicomSelected]);

  return (
    <section className={styles.shell}>
      <GlassCard className={cn(styles.dropCard, "ui-enter")}>
        <motion.div
          layoutId="scan-preview"
          className={cn(
            styles.dropZone,
            uploadState === "drag-over" && styles.dragOver,
            uploadState === "validating" && styles.validating,
          )}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => fileInputRef.current?.click()}
          data-interactive="true"
        >
          <input
            ref={fileInputRef}
            hidden
            type="file"
            accept="image/png,image/jpeg,.dcm,.dicom,application/dicom"
            onChange={onFileChange}
          />
          <span className={styles.cornerTL} aria-hidden="true" />
          <span className={styles.cornerTR} aria-hidden="true" />
          <span className={styles.cornerBL} aria-hidden="true" />
          <span className={styles.cornerBR} aria-hidden="true" />

          <div className={styles.zoneHead}>
            <span className={styles.zoneTag}>
              <span className={styles.zoneTagDot} aria-hidden="true" />
              Acquisition Node
            </span>
            <div className={styles.zoneMeta}>
              <span>PA Projection</span>
              <span>PNG / JPEG / DICOM</span>
              <span>≤10MB</span>
            </div>
          </div>

          <div className={styles.zoneBody}>
            {uploadState === "ready" && previewUrl ? (
              <motion.img
                initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                className={styles.thumbnail}
                src={previewUrl}
                alt="Uploaded chest radiograph"
              />
            ) : (
              <motion.div
                className={styles.lungScene}
                animate={uploadState === "drag-over" ? { y: -4, scale: 1.04 } : { y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
              >
                <LandingLung cameraDistance={4.85} />
              </motion.div>
            )}

            <div className={styles.zoneText}>
              <p className={cn(styles.zoneTitle, uploadState === "error" && styles.zoneTitleError)}>
                {statusMessage}
              </p>
              <p className={styles.zoneSub}>
                {uploadState === "idle" || uploadState === "drag-over"
                  ? "Click to browse system files or drag securely into the zone"
                  : "Posteroanterior Projection · PNG / JPEG / DICOM · Max 10MB"}
              </p>
            </div>
          </div>

          <div className={styles.zoneFoot}>
            <button
              type="button"
              className={styles.demoChip}
              onClick={(event) => {
                event.stopPropagation();
                void loadDemo();
              }}
            >
              <span className={styles.demoChipDot} aria-hidden="true" />
              <span>No Radiograph? Load the Reference Scan for Demonstration</span>
              <span className={styles.demoChipArrow} aria-hidden="true">→</span>
            </button>
          </div>
        </motion.div>
      </GlassCard>

      <GlassCard className={cn(styles.rightPanel, "ui-enter ui-enter-delay-1")}>
        <div className={styles.rightEyebrow}>
          <span className={styles.rightEyebrowDot} aria-hidden="true" />
          <p className="label">Acquisition Protocol</p>
        </div>

        <h1 className={cn("headline", styles.rightHeadline)}>
          Submit Radiograph for Analysis.
        </h1>

        <div className={styles.infoList}>
          <div className={styles.infoChip}>Posteroanterior (PA) Projection Required</div>
          <div className={styles.infoChip}>Accepts PNG, JPEG, or DICOM (Max 10MB)</div>
          <div className={styles.infoChip}>De-identify Protected Health Information (PHI)</div>
        </div>

        <div className={styles.modelPicker}>
          <p className={cn("label", styles.modelLabel)}>Select Inference Architecture — Latency vs. Accuracy</p>
          <div className={styles.modelToggle}>
            <button
              type="button"
              className={cn(styles.modelBtn, selectedModel === "densenet" && styles.modelBtnActive)}
              onClick={() => setSelectedModel("densenet")}
            >
              <span className={styles.modelName}>DenseNet121</span>
              <span className={styles.modelDesc}>224×224 · 6.96M params · Low Latency</span>
            </button>
            <button
              type="button"
              className={cn(styles.modelBtn, selectedModel === "efficientnet" && styles.modelBtnActive)}
              onClick={() => setSelectedModel("efficientnet")}
            >
              <span className={styles.modelName}>EfficientNetB3</span>
              <span className={styles.modelDesc}>300×300 · Compound-Scaled · High-Res</span>
            </button>
            <button
              type="button"
              className={cn(styles.modelBtn, selectedModel === "ensemble" && styles.modelBtnActive)}
              onClick={() => setSelectedModel("ensemble")}
            >
              <span className={styles.modelName}>Ensemble</span>
              <span className={styles.modelDesc}>Posterior Fusion · Maximum Robustness</span>
            </button>
          </div>
        </div>

        <PrimaryButton
          className={cn("mt-2", styles.submitBtn)}
          disabled={uploadState !== "ready" || submitting}
          onClick={submitReady}
        >
          Initiate Inference Pipeline →
        </PrimaryButton>
      </GlassCard>
    </section>
  );
}
