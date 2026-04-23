"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { DualViewContainer } from "@/components/results/DualViewContainer";
import { HeatmapLegend } from "@/components/results/HeatmapLegend";
import { OverlayControls } from "@/components/results/OverlayControls";
import { ViewToggle } from "@/components/results/ViewToggle";
import { CLASS_DISPLAY, RESULTS_SCOPE_NOTE } from "@/lib/classMap";
import { interpretConfidence } from "@/lib/confidence";
import { exportClinicalReportPdf } from "@/lib/report-pdf";
import type { PredictResponse } from "@/lib/types";
import { formatModelName } from "@/lib/utils";
import type { SyncEvent } from "@/lib/viewSync";
import type { ViewMode, ViewState } from "@/types/views";

import styles from "./ResultsScreen.module.css";

interface ResultsScreenProps {
  result: PredictResponse;
  imageSrc: string | null;
}

const CLASS_ORDER: Array<keyof PredictResponse["confidence"]> = [
  "COVID",
  "Lung_Opacity",
  "Normal",
  "Viral Pneumonia",
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const isFinite01 = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;

export const ResultsScreen = ({ result, imageSrc }: ResultsScreenProps) => {
  const router = useRouter();
  const visualCardRef = useRef<HTMLDivElement | null>(null);
  const [revealTime, setRevealTime] = useState(0);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [showEndMoment, setShowEndMoment] = useState(false);
  const [reportExporting, setReportExporting] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const reportTimerRef = useRef<number | null>(null);
  const [threeDUnavailable, setThreeDUnavailable] = useState(false);
  const [viewState, setViewState] = useState<ViewState>(() => ({
    mode: imageSrc ? "overlay" : "3d",
    overlayOpacity: 65,
    threshold: 0.35,
    zoom: 100,
    hoveredCell: null,
  }));
  const [sliceEnabled, setSliceEnabled] = useState(false);
  const [sliceY, setSliceY] = useState(0);

  const mapRows = result.activation_map_shape[0];
  const mapCols = result.activation_map_shape[1];
  const mapShapeMatches =
    Number.isInteger(mapRows) &&
    Number.isInteger(mapCols) &&
    mapRows > 0 &&
    mapCols > 0 &&
    result.activation_map.length === mapRows &&
    result.activation_map.every((row) => row.length === mapCols);

  const encodingSupported = result.activation_map_encoding === "normalized_float32";
  const originSupported = result.activation_map_origin === "top_left";
  const confidenceValuesValid = CLASS_ORDER.every((rawClass) => isFinite01(result.confidence[rawClass]));
  const confidenceSumDelta = Number.isFinite(result.confidence_sum) ? Math.abs(result.confidence_sum - 1) : Number.POSITIVE_INFINITY;
  const confidenceSumStable = confidenceSumDelta <= 0.05;

  const payloadRenderable = mapShapeMatches && encodingSupported && originSupported && confidenceValuesValid;
  const ensembleMeta = result.ensemble;

  const mappedClass = CLASS_DISPLAY[result.predicted_class];
  const predictedConfidence = clamp01(Number(result.confidence[result.predicted_class] ?? 0));
  const confidenceLayer = interpretConfidence(predictedConfidence);
  const activeRegionCount = useMemo(
    () =>
      result.activation_map.reduce(
        (total, row) => total + row.filter((value) => Number.isFinite(value) && value >= viewState.threshold).length,
        0,
      ),
    [result.activation_map, viewState.threshold],
  );

  const telemetryRows = useMemo(() => {
    const telemetry = result.telemetry;
    if (!telemetry) {
      return [] as Array<{ label: string; value: number }>;
    }

    const rows = [
      { label: "Preprocess", value: telemetry.preprocess_ms },
      { label: "Infer", value: telemetry.infer_ms },
      { label: "Grad-CAM", value: telemetry.gradcam_ms },
      { label: "Ensemble", value: telemetry.ensemble_ms },
      { label: "Total", value: telemetry.total_ms },
    ];

    return rows.filter((row): row is { label: string; value: number } => Number.isFinite(row.value));
  }, [result.telemetry]);

  const reliabilityNotes = useMemo(() => {
    const notes: string[] = [];
    if (result.gradcam_failed) {
      notes.push("Grad-CAM fallback map used: visual attention is approximate for this scan.");
    }
    if (!confidenceSumStable) {
      notes.push(`Confidence sum drift detected (${result.confidence_sum.toFixed(4)}).`);
    }
    if (ensembleMeta?.degraded) {
      notes.push("Ensemble degraded mode: one model failed, fallback confidence was used.");
    }
    if (ensembleMeta && !ensembleMeta.agreement) {
      notes.push("Model disagreement detected: predictions diverged before consensus fusion.");
    }
    if (result.reliability?.flags?.length) {
      const rendered = result.reliability.flags
        .map((flag) => flag.replace(/_/g, " "))
        .join(", ");
      notes.push(`Reliability flags: ${rendered}.`);
    }
    if (threeDUnavailable) {
      notes.push("3D rendering is unavailable on this device. PulmoVision switched to a compatible 2D view.");
    }
    if (!imageSrc) {
      notes.push("No raster preview is available for this study (likely DICOM source). Overlay/original views may be limited.");
    }
    return notes;
  }, [
    confidenceSumStable,
    ensembleMeta,
    imageSrc,
    result.confidence_sum,
    result.gradcam_failed,
    result.reliability?.flags,
    threeDUnavailable,
  ]);

  const confidenceRows = useMemo(
    () =>
      CLASS_ORDER.map((rawClass) => ({
        rawClass,
        label: CLASS_DISPLAY[rawClass].label,
        score: clamp01(Number(result.confidence[rawClass] ?? 0)),
      })),
    [result.confidence],
  );

  const ensembleVotingRows = useMemo(() => {
    if (!ensembleMeta) {
      return null;
    }

    const voteCounts: Record<(typeof CLASS_ORDER)[number], number> = {
      COVID: 0,
      Lung_Opacity: 0,
      Normal: 0,
      "Viral Pneumonia": 0,
    };

    for (const prediction of ensembleMeta.individual_predictions) {
      voteCounts[prediction.predicted_class] += 1;
    }

    const activeModelCount = Math.max(ensembleMeta.individual_predictions.length, 1);

    const votingRows = CLASS_ORDER
      .map((rawClass) => {
        const votes = voteCounts[rawClass];
        return {
          rawClass,
          label: CLASS_DISPLAY[rawClass].label,
          votes,
          voteShare: votes / activeModelCount,
        };
      })
      .filter((row) => row.votes > 0)
      .sort((a, b) => b.votes - a.votes);

    const modelRows = [...ensembleMeta.individual_predictions]
      .sort((a, b) => b.weight - a.weight)
      .map((prediction) => ({
        model: formatModelName(prediction.model),
        predictedClass: CLASS_DISPLAY[prediction.predicted_class].label,
        voteWeight: clamp01(prediction.weight),
        topConfidence: clamp01(prediction.top_confidence),
        gradcamFailed: prediction.gradcam_failed,
      }));

    return {
      totalModels: ensembleMeta.individual_predictions.length + ensembleMeta.failed_models.length,
      activeModelCount,
      votingRows,
      modelRows,
    };
  }, [ensembleMeta]);

  useEffect(() => {
    if (reportTimerRef.current !== null) {
      window.clearTimeout(reportTimerRef.current);
      reportTimerRef.current = null;
    }

    setRevealTime(0);
    setReportGenerated(false);
    setShowEndMoment(false);
    setReportError(null);
    setReportExporting(false);
    setThreeDUnavailable(false);
    setViewState({
      mode: imageSrc ? "overlay" : "3d",
      overlayOpacity: 65,
      threshold: 0.35,
      zoom: 100,
      hoveredCell: null,
    });

    let startTime: number | null = null;
    const duration = 3000;
    const maxReveal = 11.2;
    let animationFrameId: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (easeOutCubic) to make it look smooth
      const easeOut = 1 - Math.pow(1 - progress, 3);

      setRevealTime(easeOut * maxReveal);

      if (progress < 1) {
        animationFrameId = window.requestAnimationFrame(animate);
      } else {
        setRevealTime(maxReveal);
      }
    };

    animationFrameId = window.requestAnimationFrame(animate);

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [imageSrc, result]);

  // Stable references prevent ThreeDView from rebuilding the Three.js scene on every render.
  // Defined before conditional returns to satisfy Rules of Hooks.
  const onSync = useCallback((event: SyncEvent) => {
    setViewState((prev) => ({ ...prev, hoveredCell: { i: event.i, j: event.j } }));
  }, []);

  const onClear = useCallback(() => {
    setViewState((prev) => ({ ...prev, hoveredCell: null }));
  }, []);

  const onThreeDUnavailable = useCallback(() => {
    setThreeDUnavailable(true);
    setViewState((prev) => {
      if (prev.mode === "3d" || prev.mode === "split") {
        return { ...prev, mode: "overlay" };
      }
      if (prev.mode === "overlay") {
        return imageSrc ? { ...prev, mode: "original" } : prev;
      }
      return prev;
    });
  }, [imageSrc]);

  const disabledModes = useMemo<ViewMode[]>(() => {
    const modes = new Set<ViewMode>();
    if (threeDUnavailable) {
      modes.add("3d");
      modes.add("split");
    }
    if (!imageSrc) {
      modes.add("original");
    }
    return Array.from(modes);
  }, [imageSrc, threeDUnavailable]);

  // Clean up the report-done timer and reset view state to allow 3D context cleanup.
  useEffect(() => {
    return () => {
      if (reportTimerRef.current !== null) {
        window.clearTimeout(reportTimerRef.current);
      }
      setViewState((prev) => ({ ...prev, mode: "original" }));
    };
  }, []);

  if (!payloadRenderable) {
    return (
      <section className={styles.ambiguous}>
        <div className={`glass-card ${styles.ambiguousInner}`}>
          <p className={styles.sectionLabel}>Clinical findings</p>
          <h1 className={styles.className}>Unsupported result payload</h1>
          <p className={styles.description}>
            PulmoVision received an incompatible results payload and cannot safely render this scan.
          </p>
          <div className={styles.noticeList}>
            {!mapShapeMatches && <p className={styles.noticeLine}>Activation map shape does not match payload metadata.</p>}
            {!originSupported && <p className={styles.noticeLine}>Unsupported map origin: {result.activation_map_origin}</p>}
            {!encodingSupported && <p className={styles.noticeLine}>Unsupported map encoding: {result.activation_map_encoding}</p>}
            {!confidenceValuesValid && <p className={styles.noticeLine}>Confidence values contain out-of-range or non-finite scores.</p>}
          </div>
          <button className="primary-button px-5 py-3 text-xs tracking-[0.14em]" onClick={() => router.push("/upload")}>
            Try another scan
          </button>
        </div>
      </section>
    );
  }

  if (!confidenceSumStable) {
    return (
      <section className={styles.ambiguous}>
        <div className={`glass-card ${styles.ambiguousInner}`}>
          <p className={styles.sectionLabel}>Clinical findings</p>
          <h1 className={styles.className}>Ambiguous result state</h1>
          <p className={styles.description}>
            The backend flagged this confidence output as unstable. PulmoVision cannot safely render confidence distribution for
            this scan.
          </p>
          <div className={styles.noticeList}>
            <p className={styles.noticeLine}>Reported confidence sum: {result.confidence_sum.toFixed(4)}</p>
          </div>
          <button className="primary-button px-5 py-3 text-xs tracking-[0.14em]" onClick={() => router.push("/upload")}>
            Try another scan
          </button>
        </div>
      </section>
    );
  }

  const revealProgress = (start: number, duration: number) => clamp01((revealTime - start) / duration);

  const visualProgress = revealProgress(5.1, 1.2);
  const metricsProgress = revealProgress(6.5, 1.5);
  const classProgress = revealProgress(8.0, 0.6);
  const findingProgress = revealProgress(8.6, 0.5);
  const scopeProgress = revealProgress(9.5, 0.5);
  const actionsProgress = 1; // Always fully visible — no delay on the download button
  const pulseVisible = revealTime >= 0.8 && revealTime < 5.1;

  const showImageControls = viewState.mode !== "3d";
  const showOverlayControls = true; // Make OverlayControls render in 3D mode too so it can house the CT sliders!

  const captureThreeSnapshot = () => {
    const root = visualCardRef.current;
    if (!root) {
      return null;
    }

    const canvases = Array.from(root.querySelectorAll("canvas"));
    const webglCanvas = canvases.find((canvas) => {
      try {
        return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
      } catch {
        return false;
      }
    });

    if (!webglCanvas) {
      return null;
    }

    try {
      return webglCanvas.toDataURL("image/png");
    } catch {
      return null;
    }
  };

  const onGenerateReport = async () => {
    if (reportExporting) {
      return;
    }

    setReportExporting(true);
    setReportGenerated(false);
    setShowEndMoment(false);
    setReportError(null);

    if (reportTimerRef.current !== null) {
      window.clearTimeout(reportTimerRef.current);
      reportTimerRef.current = null;
    }

    try {
      const snapshot3d = captureThreeSnapshot();

      await exportClinicalReportPdf({
        result,
        imageSrc,
        threeSnapshotSrc: snapshot3d,
        context: {
          view_mode: viewState.mode,
          zoom: viewState.zoom,
          overlay_opacity: viewState.overlayOpacity,
          threshold: Number(viewState.threshold.toFixed(2)),
          active_regions: activeRegionCount,
          three_unavailable: threeDUnavailable,
        },
        reliabilityNotes,
      });

      setReportGenerated(true);
      reportTimerRef.current = window.setTimeout(() => {
        setShowEndMoment(true);
        reportTimerRef.current = null;
      }, 700);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error("[results] report export failed:", detail);
      setReportError("Report export failed. Please retry.");
    } finally {
      setReportExporting(false);
    }
  };

  return (
    <section className={styles.screen}>
      <ViewToggle
        current={viewState.mode}
        disabledModes={disabledModes}
        onChange={(mode) => {
          setViewState((prev) => ({ ...prev, mode }));
        }}
      />

      <div className={styles.mainGrid}>
        <div ref={visualCardRef} className={`glass-card ${styles.visualCard} ui-enter`}>
          <div
            className={styles.visualReveal}
            style={{
              opacity: 0.16 + visualProgress * 0.84,
              filter: `blur(${(1 - visualProgress) * 5}px)`,
              transform: `scale(${0.985 + visualProgress * 0.015})`,
            }}
          >
            <DualViewContainer
              mode={viewState.mode}
              imageSrc={imageSrc}
              activationMap={result.activation_map}
              gridDims={result.activation_map_shape}
              zoom={viewState.zoom}
              overlayOpacity={viewState.overlayOpacity}
              threshold={viewState.threshold}
              hoveredCell={viewState.hoveredCell}
              onSync={onSync}
              onClear={onClear}
              onThreeDUnavailable={onThreeDUnavailable}
              sliceEnabled={sliceEnabled}
              sliceY={sliceY}
            />
          </div>

          {pulseVisible && <div className={styles.pulseSweep} aria-hidden="true" />}

          <div className={styles.controlsSlot} style={{ opacity: visualProgress }}>
            <OverlayControls
              opacity={viewState.overlayOpacity}
              threshold={viewState.threshold}
              zoom={viewState.zoom}
              is3DMode={viewState.mode === "3d"}
              sliceEnabled={sliceEnabled}
              sliceY={sliceY}
              onOpacityChange={(overlayOpacity) => setViewState((prev) => ({ ...prev, overlayOpacity }))}
              onThresholdChange={(threshold) => setViewState((prev) => ({ ...prev, threshold }))}
              onZoomChange={viewState.mode !== "3d" ? (zoom) => setViewState((prev) => ({ ...prev, zoom })) : undefined}
              onSliceToggle={() => setSliceEnabled((prev) => !prev)}
              onSliceYChange={setSliceY}
            />
          </div>

          {(viewState.mode === "overlay" || viewState.mode === "split") && (
            <div className={styles.legendSlot} style={{ opacity: visualProgress }}>
              <HeatmapLegend />
            </div>
          )}
        </div>

        <aside className={`glass-card ${styles.sideCard} ui-enter ui-enter-delay-1`}>
          {/* ── Scrollable clinical content ── */}
          <div className={styles.sideScroll}>
            <p className={styles.sectionLabel}>Clinical findings</p>

            {reliabilityNotes.length > 0 && (
              <div className={styles.noticeBox}>
                {reliabilityNotes.map((note) => (
                  <p key={note} className={styles.noticeLine}>
                    {note}
                  </p>
                ))}
              </div>
            )}

            <h2
              className={styles.className}
              style={{
                opacity: classProgress,
                transform: `translateY(${(1 - classProgress) * 10}px)`,
              }}
            >
              {mappedClass.label}
            </h2>

            {/* Large confidence percentage */}
            <div className={styles.confidenceHero} style={{ opacity: findingProgress }}>
              <span className={styles.confidenceNumber}>{(predictedConfidence * 100).toFixed(1)}</span>
              <span className={styles.confidenceUnit}>%</span>
              <span className={styles.confidenceLabel}>confidence</span>
            </div>

            <p
              className={styles.description}
              style={{
                opacity: findingProgress,
                transform: `translateY(${(1 - findingProgress) * 8}px)`,
              }}
            >
              {mappedClass.description}
            </p>

            <div
              className="reading text-sm"
              style={{
                color: confidenceLayer.color === "normal" ? "var(--color-normal)" : "var(--color-attention)",
                opacity: findingProgress,
              }}
            >
              {confidenceLayer.level}
            </div>
            <p className={styles.description} style={{ opacity: findingProgress }}>
              {confidenceLayer.note}
            </p>

            <div className={styles.metrics}>
              {confidenceRows.map((row) => (
                <div key={row.rawClass} className={styles.metricRow}>
                  <div className={styles.metricHeader}>
                    <span className={styles.metricLabel}>{row.label}</span>
                    <span className={styles.metricValue}>{(row.score * 100).toFixed(1)}%</span>
                  </div>
                  <div className={styles.metricRail}>
                    <div className={styles.metricFill} style={{ transform: `scaleX(${row.score * metricsProgress})` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.metaGrid}>
              <div className={styles.metaRow}>
                <span>Model</span>
                <span>{formatModelName(result.model)}</span>
              </div>
              {ensembleMeta && (
                <>
                  <div className={styles.metaRow}>
                    <span>Ensemble method</span>
                    <span>{ensembleMeta.method}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span>Model agreement</span>
                    <span>{ensembleMeta.agreement ? "Aligned" : "Divergent"}</span>
                  </div>
                  <div className={styles.metaRow}>
                    <span>Winning model</span>
                    <span>{formatModelName(ensembleMeta.winning_model)}</span>
                  </div>
                </>
              )}
              <div className={styles.metaRow}>
                <span>Confidence sum</span>
                <span>{result.confidence_sum.toFixed(4)}</span>
              </div>
              <div className={styles.metaRow}>
                <span>Activation shape</span>
                <span>{`${mapRows} x ${mapCols}`}</span>
              </div>
              <div className={styles.metaRow}>
                <span>Source image</span>
                <span>{result.reliability?.source_image ?? (imageSrc ? "png/jpeg" : "unknown")}</span>
              </div>
              <div className={styles.metaRow}>
                <span>Active regions</span>
                <span>{activeRegionCount} @ {viewState.threshold.toFixed(2)}</span>
              </div>
            </div>

            {telemetryRows.length > 0 && (
              <div className={styles.telemetryPanel}>
                <p className={styles.telemetryTitle}>Stage timing</p>
                <div className={styles.telemetryGrid}>
                  {telemetryRows.map((row) => (
                    <div key={row.label} className={styles.telemetryBadge}>
                      <span>{row.label}</span>
                      <strong>{row.value.toFixed(1)} ms</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {ensembleMeta && ensembleVotingRows && (
              <div className={styles.ensemblePanel}>
                <div className={styles.ensembleHeader}>
                  <span>Ensemble voting</span>
                  <span>
                    {ensembleVotingRows.activeModelCount}/{ensembleVotingRows.totalModels} models active
                  </span>
                </div>

                <div className={styles.voteSummary}>
                  {ensembleVotingRows.votingRows.map((vote) => (
                    <div key={vote.rawClass} className={styles.voteRow}>
                      <div className={styles.voteHeader}>
                        <span>{vote.label}</span>
                        <span>
                          {vote.votes} vote{vote.votes > 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className={styles.voteRail}>
                        <div className={styles.voteFill} style={{ transform: `scaleX(${vote.voteShare})` }} />
                      </div>
                    </div>
                  ))}
                </div>

                <div className={styles.modelVoteGrid}>
                  {ensembleVotingRows.modelRows.map((row) => (
                    <div key={row.model} className={styles.modelVoteCard}>
                      <div className={styles.modelVoteHeader}>
                        <span>{row.model}</span>
                        <span>{(row.voteWeight * 100).toFixed(1)}% weight</span>
                      </div>
                      <div className={styles.modelVoteMeta}>
                        <span>{row.predictedClass}</span>
                        <span>Top {(row.topConfidence * 100).toFixed(1)}%</span>
                      </div>
                      {row.gradcamFailed && <p className={styles.modelVoteWarn}>Grad-CAM fallback used.</p>}
                    </div>
                  ))}
                </div>

                {ensembleMeta.failed_models.length > 0 && (
                  <div className={styles.failedModelBox}>
                    <p className={styles.failedModelTitle}>Unavailable models</p>
                    {ensembleMeta.failed_models.map((failed) => (
                      <p key={`${failed.model}-${failed.error}`} className={styles.failedModelLine}>
                        {formatModelName(failed.model)}: {failed.error}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className={styles.scope} style={{ opacity: scopeProgress }}>
              {RESULTS_SCOPE_NOTE}
            </p>
          </div>

          {/* ── Pinned action footer — always visible ── */}
          <div className={styles.actionsFooter} style={{ opacity: Math.max(actionsProgress, 0.2) }}>
            {actionsProgress > 0 && (
              <div className={styles.statusBadge}>
                <span className={styles.statusDot} aria-hidden="true" />
                <span className={styles.statusText}>Report available</span>
              </div>
            )}
            <div className={styles.actionsRow}>
              <button
                className="primary-button"
                style={{ padding: '14px 24px', fontSize: '14px', letterSpacing: '0.06em', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                onClick={() => {
                  void onGenerateReport();
                }}
                disabled={reportExporting}
              >
                {reportExporting ? (
                  <>
                    <span className={styles.spinner} aria-hidden="true" />
                    Generating PDF...
                  </>
                ) : (
                  "Generate Clinical Report PDF"
                )}
              </button>
              <button
                className="ghost-button"
                style={{ padding: '14px 24px', fontSize: '14px', letterSpacing: '0.06em' }}
                onClick={() => router.push("/upload")}
              >
                Try another scan
              </button>
            </div>
            {reportGenerated && showEndMoment && <p className={styles.reportDone}>Analysis complete</p>}
            {reportError && <p className={styles.reportError}>{reportError}</p>}
          </div>
        </aside>
      </div>
    </section>
  );
};
