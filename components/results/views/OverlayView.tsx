"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { HoverTooltip } from "@/components/results/HoverTooltip";
import { RadiologyCrosshair } from "@/components/results/RadiologyCrosshair";
import { renderHeatmap2D } from "@/lib/heatmap2D";
import { getHoverTooltip, onHeatmapHover, type HoverTooltipData, type SyncEvent } from "@/lib/viewSync";

import styles from "./Views.module.css";

interface OverlayViewProps {
  imageSrc: string | null;
  activationMap: number[][];
  gridDims: [number, number];
  zoom: number;
  overlayOpacity: number;
  threshold: number;
  hoveredCell: { i: number; j: number } | null;
  onSync: (event: SyncEvent) => void;
  onClear: () => void;
}

export const OverlayView = ({
  imageSrc,
  activationMap,
  gridDims,
  zoom,
  overlayOpacity,
  threshold,
  hoveredCell,
  onSync,
  onClear,
}: OverlayViewProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const moveRafRef = useRef<number | null>(null);
  const lastCellRef = useRef<{ i: number; j: number } | null>(null);
  const pendingMoveRef = useRef<
    | {
        surface: HTMLDivElement;
        clientX: number;
        clientY: number;
      }
    | null
  >(null);

  const [size, setSize] = useState({ width: 0, height: 0 });
  const [imageAspect, setImageAspect] = useState(1);
  const [crosshairPosition, setCrosshairPosition] = useState<{ x: number; y: number } | null>(null);
  const [crosshairLabel, setCrosshairLabel] = useState("");
  const [tooltipData, setTooltipData] = useState<HoverTooltipData | null>(null);

  const mediaFrame = useMemo(() => {
    if (size.width <= 0 || size.height <= 0) {
      return { left: 0, top: 0, width: 0, height: 0 };
    }

    const aspect = imageAspect > 0 ? imageAspect : 1;
    let width = size.width;
    let height = width / aspect;

    if (height > size.height) {
      height = size.height;
      width = height * aspect;
    }

    return {
      left: (size.width - width) / 2,
      top: (size.height - height) / 2,
      width,
      height,
    };
  }, [imageAspect, size.height, size.width]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const update = () => {
      const rect = root.getBoundingClientRect();
      setSize({ width: Math.max(1, Math.round(rect.width)), height: Math.max(1, Math.round(rect.height)) });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const stopClick = (event: MouseEvent) => event.stopPropagation();
    root.addEventListener("click", stopClick);

    return () => {
      root.removeEventListener("click", stopClick);
    };
  }, []);

  useEffect(() => {
    if (!canvasRef.current || mediaFrame.width <= 0 || mediaFrame.height <= 0) return;

    renderHeatmap2D(
      canvasRef.current,
      activationMap,
      Math.max(1, Math.round(mediaFrame.width)),
      Math.max(1, Math.round(mediaFrame.height)),
      threshold,
      gridDims,
    );
  }, [activationMap, gridDims, mediaFrame.height, mediaFrame.width, threshold]);

  useEffect(() => {
    if (!canvasRef.current) return;
    canvasRef.current.style.opacity = String(overlayOpacity / 100);
  }, [overlayOpacity]);

  useEffect(() => {
    if (!hoveredCell || mediaFrame.width <= 0 || mediaFrame.height <= 0) return;

    const x = ((hoveredCell.j + 0.5) / gridDims[1]) * mediaFrame.width;
    const y = ((hoveredCell.i + 0.5) / gridDims[0]) * mediaFrame.height;

    setCrosshairPosition({ x, y });
    setCrosshairLabel(`${hoveredCell.j < gridDims[1] / 2 ? "L" : "R"}${hoveredCell.j + 1} · ${hoveredCell.i + 1}`);
    setTooltipData(getHoverTooltip(hoveredCell.i, hoveredCell.j, activationMap, gridDims));
  }, [activationMap, gridDims, hoveredCell, mediaFrame.height, mediaFrame.width]);

  useEffect(() => {
    return () => {
      if (moveRafRef.current !== null) {
        window.cancelAnimationFrame(moveRafRef.current);
        moveRafRef.current = null;
      }
    };
  }, []);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    pendingMoveRef.current = {
      surface: event.currentTarget,
      clientX: event.clientX,
      clientY: event.clientY,
    };

    if (moveRafRef.current !== null) return;

    moveRafRef.current = window.requestAnimationFrame(() => {
      moveRafRef.current = null;
      const pending = pendingMoveRef.current;
      pendingMoveRef.current = null;
      if (!pending) return;

      const { surface, clientX, clientY } = pending;
      const rect = surface.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      setCrosshairPosition({ x, y });

      const syntheticEvent = { clientX, clientY } as MouseEvent;
      onHeatmapHover(
        syntheticEvent,
        surface,
        activationMap,
        (syncEvent) => {
          const previous = lastCellRef.current;
          if (!previous || previous.i !== syncEvent.i || previous.j !== syncEvent.j) {
            lastCellRef.current = { i: syncEvent.i, j: syncEvent.j };
            onSync(syncEvent);
            setCrosshairLabel(`${syncEvent.j < gridDims[1] / 2 ? "L" : "R"}${syncEvent.j + 1} · ${syncEvent.i + 1}`);
            setTooltipData(getHoverTooltip(syncEvent.i, syncEvent.j, activationMap, gridDims));
          }
        },
        () => {
          if (lastCellRef.current !== null) {
            lastCellRef.current = null;
            onClear();
            setTooltipData(null);
          }
        },
        gridDims,
        threshold,
      );
    });
  };

  const handleMouseLeave = () => {
    if (moveRafRef.current !== null) {
      window.cancelAnimationFrame(moveRafRef.current);
      moveRafRef.current = null;
    }
    pendingMoveRef.current = null;
    lastCellRef.current = null;
    onClear();
    setCrosshairPosition(null);
    setTooltipData(null);
  };

  return (
    <div ref={rootRef} className={styles.viewRoot}>
      <div className={styles.zoomLayer} style={{ transform: `scale(${zoom / 100})` }}>
        <div
          className={styles.mediaFrame}
          style={{
            left: `${mediaFrame.left}px`,
            top: `${mediaFrame.top}px`,
            width: `${mediaFrame.width}px`,
            height: `${mediaFrame.height}px`,
          }}
        >
          {imageSrc && (
            <img
              src={imageSrc}
              alt="Radiograph with saliency overlay"
              className={styles.image}
              onLoad={(event) => {
                const img = event.currentTarget;
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  setImageAspect(img.naturalWidth / img.naturalHeight);
                }
              }}
            />
          )}
          {!imageSrc && <div className={styles.missingImageNotice}>DICOM input loaded. Overlay is rendered without a raster preview.</div>}
          <canvas ref={canvasRef} className={styles.heatmapCanvas} />

          <div className={styles.overlaySurface} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave}>
            <RadiologyCrosshair position={crosshairPosition} label={crosshairLabel} />
            <HoverTooltip data={tooltipData} position={crosshairPosition} />
          </div>
        </div>
      </div>
    </div>
  );
};
