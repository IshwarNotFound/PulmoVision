"use client";

import { useCallback, useRef, useState } from "react";
import gsap from "gsap";

import styles from "./PrototypeSection.module.css";

type Tab = "raw" | "insight" | "heatmap" | "summary";
type AnalysisState = "idle" | "scanning" | "done";

const DEMO_FINDINGS = [
  {
    label: "Lung Opacity",
    confidence: 89.1,
    severity: "high" as const,
    region: "Right lower lobe · Parenchymal opacity · Zone 3",
  },
  {
    label: "Viral Pneumonia",
    confidence: 67.2,
    severity: "moderate" as const,
    region: "Bilateral · Interstitial infiltrates · Diffuse",
  },
];

const TAB_LABELS: Record<Tab, string> = {
  raw: "Source Radiograph",
  insight: "CNN Predictions",
  heatmap: "Grad-CAM Overlay",
  summary: "Full Analysis",
};

export function PrototypeSection() {
  const [tab, setTab] = useState<Tab>("raw");
  const [analysisState, setAnalysisState] = useState<AnalysisState>("idle");
  const [confidence, setConfidence] = useState(0);
  const [findingsVisible, setFindingsVisible] = useState(false);

  const scanLineRef = useRef<HTMLDivElement | null>(null);
  const heatmapRef = useRef<HTMLDivElement | null>(null);
  const counterRef = useRef({ value: 0 });

  const launchAnalysis = useCallback(() => {
    if (analysisState !== "idle") return;

    setAnalysisState("scanning");
    setTab("heatmap");
    setConfidence(0);
    setFindingsVisible(false);

    const scanLine = scanLineRef.current;
    const heatmap = heatmapRef.current;
    if (!scanLine) return;

    // Reset positions
    gsap.set(scanLine, { top: "0%", opacity: 1 });
    if (heatmap) gsap.set(heatmap, { opacity: 0 });
    counterRef.current.value = 0;

    const tl = gsap.timeline({
      onComplete: () => {
        setAnalysisState("done");
        setFindingsVisible(true);
      },
    });

    // Sweep scan line top → bottom
    tl.to(scanLine, {
      top: "calc(100% - 28px)",
      duration: 2.4,
      ease: "none",
    });

    // Heatmap fades in as scan sweeps through midpoint
    if (heatmap) {
      tl.to(heatmap, { opacity: 1, duration: 0.7, ease: "power2.out" }, 1.0);
    }

    // Confidence counter animates during sweep
    tl.to(
      counterRef.current,
      {
        value: 89.1,
        duration: 2.0,
        ease: "power2.out",
        onUpdate: () => {
          setConfidence(parseFloat(counterRef.current.value.toFixed(1)));
        },
      },
      0.4,
    );

    // Scan line fades out at end
    tl.to(scanLine, { opacity: 0, duration: 0.35 }, 2.2);
  }, [analysisState]);

  const resetAnalysis = useCallback(() => {
    setAnalysisState("idle");
    setTab("raw");
    setConfidence(0);
    setFindingsVisible(false);
    counterRef.current.value = 0;
    const heatmap = heatmapRef.current;
    if (heatmap) gsap.set(heatmap, { opacity: 0 });
  }, []);

  const showHeatmap = tab === "heatmap" || tab === "summary";
  const showInsight = tab === "insight" || tab === "summary";

  return (
    <section className={styles.section} id="prototype">
      {/* ── Header ── */}
      <div className={styles.header}>
        <p className={`label ${styles.sectionLabel}`}>Live Inference Demonstration</p>
        <h2 className={styles.headline}>Observe Convolutional Inference in Real Time.</h2>
        <p className={styles.subtext}>
          Execute real-time CNN inference on a reference chest radiograph — observe
          gradient-weighted class activation maps dynamically localizing pathological
          regions as the model computes its posterior probability distribution.
        </p>
      </div>

      {/* ── Demo panel ── */}
      <div className={styles.demoPanel}>
        {/* Tab bar */}
        <div className={styles.tabBar} role="tablist" aria-label="View mode">
          {(["raw", "insight", "heatmap", "summary"] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* Viewer + Panel row */}
        <div className={styles.viewerRow}>
          {/* ── X-ray viewer ── */}
          <div className={styles.viewer}>
            {/* Corner brackets */}
            <span className={`${styles.corner} ${styles.cornerTL}`} aria-hidden="true" />
            <span className={`${styles.corner} ${styles.cornerTR}`} aria-hidden="true" />
            <span className={`${styles.corner} ${styles.cornerBL}`} aria-hidden="true" />
            <span className={`${styles.corner} ${styles.cornerBR}`} aria-hidden="true" />

            {/* X-ray image */}
            <img
              src="/demo-scan.png"
              alt="Sample chest radiograph for analysis"
              className={`${styles.xrayImage} ${tab !== "raw" ? styles.xrayDimmed : ""}`}
              draggable={false}
            />

            {/* Heatmap + insight overlay */}
            <div
              ref={heatmapRef}
              style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: "none" }}
              aria-hidden="true"
            >
              {/* Heat zones — visible on heatmap/summary tabs */}
              {showHeatmap && (
                <>
                  <div className={`${styles.heatZone} ${styles.heatZone1}`} />
                  <div className={`${styles.heatZone} ${styles.heatZone2}`} />
                </>
              )}

              {/* Insight outline boxes — visible on insight/summary tabs */}
              {showInsight && (
                <>
                  <div
                    className={`${styles.insightBox} ${styles.insightBox1} ${
                      analysisState === "done" ? styles.insightBoxVisible : ""
                    }`}
                  >
                    <span className={styles.insightLabel}>Lung Opacity</span>
                  </div>
                  <div
                    className={`${styles.insightBox} ${styles.insightBox2} ${
                      analysisState === "done" ? styles.insightBoxVisible : ""
                    }`}
                  >
                    <span className={styles.insightLabel}>Viral Pneumonia</span>
                  </div>
                </>
              )}
            </div>

            {/* Prototype-local scan line */}
            <div
              ref={scanLineRef}
              className={styles.prototypeScanLine}
              style={{ opacity: 0 }}
              aria-hidden="true"
            />

            {/* Status bar */}
            <div className={styles.viewerStatus} aria-hidden="true">
              <span className={styles.statusText}>
                {analysisState === "idle"
                  ? "AWAITING INPUT · PIPELINE IDLE"
                  : analysisState === "scanning"
                    ? "CNN INFERENCE ACTIVE · GRAD-CAM COMPUTING"
                    : "INFERENCE COMPLETE · SALIENCY MAP: ACTIVE"}
              </span>
              {analysisState !== "idle" && (
                <span className={styles.confidenceDisplay}>
                  CONF: {confidence.toFixed(1)}%
                </span>
              )}
            </div>
          </div>

          {/* ── Analysis panel ── */}
          <div className={`glass-card ${styles.analysisPanel}`}>
            <p className={`label ${styles.panelLabel}`}>Inference Output</p>

            {analysisState === "idle" ? (
              <div className={styles.idleState}>
                <p className={styles.idleText}>
                  Execute inference pipeline to initiate convolutional analysis and Grad-CAM saliency computation.
                </p>
              </div>
            ) : (
              <>
                {/* Confidence meter */}
                <div className={styles.confidenceMeter}>
                  <div className={styles.confidenceRow}>
                    <span className={styles.confidenceLabel}>Primary Class Posterior</span>
                    <span className={styles.confidenceValue}>
                      {confidence.toFixed(1)}%
                    </span>
                  </div>
                  <div className={styles.meterRail}>
                    <div
                      className={styles.meterFill}
                      style={{ width: `${confidence}%` }}
                    />
                  </div>
                </div>

                {/* Findings */}
                <div className={styles.findings}>
                  <p className={`label ${styles.findingsLabel}`}>Pathological Findings</p>
                  {DEMO_FINDINGS.map((finding) => (
                    <div
                      key={finding.label}
                      className={`${styles.finding} ${findingsVisible ? styles.findingVisible : ""}`}
                    >
                      <div className={styles.findingHeader}>
                        <span
                          className={styles.findingDot}
                          style={{
                            background:
                              finding.severity === "high"
                                ? "var(--color-critical)"
                                : "var(--color-attention)",
                          }}
                        />
                        <span className={styles.findingLabel}>{finding.label}</span>
                        <span className={styles.findingConf}>
                          {finding.confidence.toFixed(1)}%
                        </span>
                      </div>
                      <p className={styles.findingRegion}>{finding.region}</p>
                    </div>
                  ))}
                </div>

                {/* Grad-CAM status */}
                {analysisState === "done" && (
                  <div className={styles.gradcamStatus}>
                    <span className={styles.gradcamDot} />
                    <span className={styles.gradcamText}>Grad-CAM Saliency Map Active</span>
                  </div>
                )}
              </>
            )}

            {/* Action button */}
            {analysisState === "idle" ? (
              <button
                className={`primary-button ${styles.launchBtn}`}
                onClick={launchAnalysis}
              >
                Execute Convolutional Inference
              </button>
            ) : analysisState === "scanning" ? (
              <button
                className={`primary-button ${styles.launchBtn}`}
                disabled
              >
                CNN Inference Active...
              </button>
            ) : (
              <button
                className={`ghost-button ${styles.launchBtn}`}
                onClick={resetAnalysis}
                style={{ padding: "0.75rem 1rem", fontSize: "10px", letterSpacing: "0.16em", textTransform: "uppercase" }}
              >
                Reset Pipeline
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
