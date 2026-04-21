"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import type { SyncEvent } from "@/lib/viewSync";
import type { ViewMode } from "@/types/views";

import { OriginalView } from "@/components/results/views/OriginalView";
import { OverlayView } from "@/components/results/views/OverlayView";
import { SplitView } from "@/components/results/views/SplitView";
import { ThreeDView } from "@/components/results/views/ThreeDView";

interface DualViewContainerProps {
  mode: ViewMode;
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

export const DualViewContainer = ({
  mode,
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
}: DualViewContainerProps) => {
  const threeDIsActive = mode === "3d";
  const [threeViewMounted, setThreeViewMounted] = useState(false);
  const shouldRenderThree = threeViewMounted || threeDIsActive;

  useEffect(() => {
    if (threeDIsActive && !threeViewMounted) {
      setThreeViewMounted(true);
    }
  }, [threeDIsActive, threeViewMounted]);

  const renderNon3dView = () => {
    if (mode === "original") {
      return <OriginalView imageSrc={imageSrc} zoom={zoom} />;
    }

    if (mode === "overlay") {
      return (
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
      );
    }

    return (
      <SplitView
        imageSrc={imageSrc}
        activationMap={activationMap}
        gridDims={gridDims}
        zoom={zoom}
        overlayOpacity={overlayOpacity}
        threshold={threshold}
        hoveredCell={hoveredCell}
        onSync={onSync}
        onClear={onClear}
        onThreeDUnavailable={onThreeDUnavailable}
        sliceEnabled={sliceEnabled}
        sliceY={sliceY}
      />
    );
  };

  return (
    <div style={{ position: "relative", height: "100%" }}>
      {shouldRenderThree && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            visibility: threeDIsActive ? "visible" : "hidden",
            pointerEvents: threeDIsActive ? "auto" : "none",
          }}
        >
          <ThreeDView
            activationMap={activationMap}
            gridDims={gridDims}
            threshold={threshold}
            hoveredCell={hoveredCell}
            onSync={onSync}
            onClear={onClear}
            isActive={threeDIsActive}
            onRenderUnavailable={onThreeDUnavailable}
            sliceEnabled={sliceEnabled}
            sliceY={sliceY}
          />
        </div>
      )}

      {mode !== "3d" && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mode}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            style={{ height: "100%" }}
          >
            {renderNon3dView()}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
};
