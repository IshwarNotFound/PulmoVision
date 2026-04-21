"use client";

import { useMemo, useState } from "react";

import type { SyncEvent } from "@/lib/viewSync";

import { OverlayView } from "@/components/results/views/OverlayView";
import { ThreeDView } from "@/components/results/views/ThreeDView";

import styles from "./Views.module.css";

interface SplitViewProps {
  imageSrc: string | null;
  activationMap: number[][];
  gridDims: [number, number];
  zoom: number;
  overlayOpacity: number;
  threshold: number;
  hoveredCell: { i: number; j: number } | null;
  onSync: (event: SyncEvent) => void;
  onClear: () => void;
  onThreeDUnavailable?: () => void;
  sliceEnabled: boolean;
  sliceY: number;
}

export const SplitView = ({
  imageSrc,
  activationMap,
  gridDims,
  zoom,
  overlayOpacity,
  threshold,
  hoveredCell,
  onSync,
  onClear,
  onThreeDUnavailable,
  sliceEnabled,
  sliceY,
}: SplitViewProps) => {
  const [expandedPanel, setExpandedPanel] = useState<"left" | "right" | null>(null);

  const columns = useMemo(() => {
    if (expandedPanel === "left") return "1.45fr 0.55fr";
    if (expandedPanel === "right") return "0.55fr 1.45fr";
    return "1fr 1fr";
  }, [expandedPanel]);

  return (
    <div className={styles.splitGrid} style={{ gridTemplateColumns: columns }}>
      <div
        className={`${styles.splitPanel} glass-card p-2`}
        onClick={() => {
          setExpandedPanel((prev) => (prev === "left" ? null : "left"));
        }}
      >
        <OverlayView
          imageSrc={imageSrc}
          activationMap={activationMap}
          gridDims={gridDims}
          zoom={zoom}
          overlayOpacity={overlayOpacity}
          threshold={threshold}
          hoveredCell={hoveredCell}
          onSync={onSync}
          onClear={onClear}
        />
      </div>

      <div
        className={`${styles.splitPanel} glass-card p-2`}
        onClick={() => {
          setExpandedPanel((prev) => (prev === "right" ? null : "right"));
        }}
      >
        <ThreeDView
          activationMap={activationMap}
          gridDims={gridDims}
          threshold={threshold}
          comparisonMode
          hoveredCell={hoveredCell}
          onSync={onSync}
          onClear={onClear}
          onRenderUnavailable={onThreeDUnavailable}
          sliceEnabled={sliceEnabled}
          sliceY={sliceY}
        />
      </div>
    </div>
  );
};
