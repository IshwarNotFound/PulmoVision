"use client";

import { motion } from "framer-motion";

import type { ViewMode } from "@/types/views";

import styles from "./ViewToggle.module.css";

interface ViewToggleProps {
  current: ViewMode;
  onChange: (mode: ViewMode) => void;
  disabledModes?: ViewMode[];
}

const MODES: Array<{ id: ViewMode; label: string; description: string }> = [
  { id: "original", label: "ORIGINAL", description: "Raw radiograph" },
  { id: "overlay", label: "OVERLAY", description: "Heatmap on scan" },
  { id: "3d", label: "3D VIEW", description: "Spatial lung model" },
  { id: "split", label: "SPLIT", description: "Both views" },
];

export const ViewToggle = ({ current, onChange, disabledModes = [] }: ViewToggleProps) => (
  <div className={styles.viewToggle}>
    <div className={styles.toggleTrack} role="tablist" aria-label="View mode">
      {MODES.map(({ id, label, description }) => (
        <button
          key={id}
          role="tab"
          aria-selected={current === id}
          aria-label={description}
          aria-disabled={disabledModes.includes(id)}
          disabled={disabledModes.includes(id)}
          className={`${styles.toggleButton} ${current === id ? styles.toggleButtonActive : ""} ${disabledModes.includes(id) ? styles.toggleButtonDisabled : ""}`}
          onClick={() => onChange(id)}
        >
          {current === id && (
            <motion.span
              className={styles.toggleIndicator}
              layoutId="toggle-indicator"
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
            />
          )}
          <span className={styles.label}>{label}</span>
        </button>
      ))}
    </div>

    <motion.p
      key={current}
      className={styles.toggleContext}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {MODES.find((mode) => mode.id === current)?.description}
    </motion.p>
  </div>
);
