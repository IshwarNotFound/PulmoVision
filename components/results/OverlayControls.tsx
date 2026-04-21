"use client";

import styles from "./OverlayControls.module.css";

interface ControlsProps {
  opacity: number;
  threshold: number;
  zoom?: number;
  is3DMode?: boolean;
  sliceEnabled?: boolean;
  sliceY?: number;
  onOpacityChange: (value: number) => void;
  onThresholdChange: (value: number) => void;
  onZoomChange?: (value: number) => void;
  onSliceToggle?: () => void;
  onSliceYChange?: (value: number) => void;
}

export const OverlayControls = ({
  opacity,
  threshold,
  zoom = 100,
  is3DMode = false,
  sliceEnabled = false,
  sliceY = 0,
  onOpacityChange,
  onThresholdChange,
  onZoomChange,
  onSliceToggle,
  onSliceYChange,
}: ControlsProps) => (
  <div className={styles.card} style={{ display: 'flex', flexDirection: 'column' }}>
    <div className={styles.controlsGrid} style={{ display: 'flex', flexDirection: 'column' }}>

      {/* ── OVERLAY / ORIGINAL mode ── */}
      {!is3DMode && (
        <>
          <div className={styles.controlRow}>
            <div className={styles.controlHeader}>
              <span className={styles.label}>Overlay Intensity</span>
              <span className={styles.value}>{opacity}%</span>
            </div>
            <div className={styles.sliderWrap}>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={100}
                step={1}
                value={opacity}
                onChange={(event) => onOpacityChange(Number(event.target.value))}
              />
            </div>
          </div>

          <div className={styles.controlRow}>
            <div className={styles.controlHeader}>
              <span className={styles.label}>Activation Threshold</span>
              <span className={styles.value}>{threshold.toFixed(2)}</span>
            </div>
            <div className={styles.sliderWrap}>
              <span className={styles.axisLabel}>MORE</span>
              <input
                className={styles.slider}
                type="range"
                min={0}
                max={0.8}
                step={0.01}
                value={threshold}
                onChange={(event) => onThresholdChange(Number(event.target.value))}
              />
              <span className={styles.axisLabel}>LESS</span>
            </div>
          </div>

          {onZoomChange && (
            <div className={styles.controlRow}>
              <div className={styles.controlHeader}>
                <span className={styles.label}>Zoom</span>
                <span className={styles.value}>{zoom}%</span>
              </div>
              <div className={styles.zoomButtons}>
                {[50, 75, 100, 125, 150].map((step) => (
                  <button
                    key={step}
                    className={styles.zoomBtn}
                    data-active={zoom === step}
                    onClick={() => onZoomChange(step)}
                    aria-label={`Zoom ${step}%`}
                  >
                    {step}%
                  </button>
                ))}
              </div>
              <div className={styles.sliderWrap} style={{ marginTop: 6 }}>
                <span className={styles.axisLabel}>50</span>
                <input
                  className={styles.slider}
                  type="range"
                  min={50}
                  max={200}
                  step={5}
                  value={zoom}
                  onChange={(event) => onZoomChange(Number(event.target.value))}
                />
                <span className={styles.axisLabel}>200</span>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── 3D mode: Solid Tactile Hardware Buttons ── */}
      {is3DMode && onSliceToggle && onSliceYChange && (
        <>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            {!sliceEnabled ? (
              <button className={styles.hardwareBtn} onClick={onSliceToggle}>
                <div className={styles.statusIndicator} />
                <span>Activate Tomography</span>
              </button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
                <button className={styles.hardwareBtn} onClick={onSliceToggle}>
                  <div className={`${styles.statusIndicator} ${styles.activeIndicator}`} />
                  <span>Exit Tomography</span>
                </button>

                <div style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '12px',
                }}>
                  <div className={styles.controlHeader} style={{ width: '100%' }}>
                    <span className={styles.label}>Tomographic Depth</span>
                    <span className={styles.value}>{sliceY.toFixed(2)}</span>
                  </div>
                  <div className={styles.gaugeContainer}>
                    <span className={styles.axisLabel}>APEX</span>
                    <input
                      className={styles.slider}
                      type="range"
                      min={-1.3}
                      max={1.3}
                      step={0.01}
                      value={sliceY}
                      onChange={(event) => onSliceYChange(Number(event.target.value))}
                      style={{
                        writingMode: 'vertical-lr',
                        direction: 'rtl',
                        width: '32px',
                        flex: 1,
                        cursor: 'ns-resize',
                      }}
                    />
                    <span className={styles.axisLabel}>BASE</span>
                  </div>
                  <div className={styles.diagnosticTip}>
                    <span className={styles.tipLabel}>Clinical Note</span>
                    <p className={styles.tipText}>
                      Parenchyma: Volumetric density visualized for anatomical context. Cross-referencing tissue depth for precise diagnostic localization.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  </div>
);
