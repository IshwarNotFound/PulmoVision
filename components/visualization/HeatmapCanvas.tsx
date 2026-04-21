"use client";

import { useEffect, useRef } from "react";

import { renderHeatmap } from "@/lib/heatmap";

export function HeatmapCanvas({
  activationMap,
  colorMode = "amber",
  className,
}: {
  activationMap: number[][];
  colorMode?: "amber" | "critical";
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const redraw = () => {
      const rect = canvas.getBoundingClientRect();
      renderHeatmap(canvas, activationMap, Math.max(1, rect.width), Math.max(1, rect.height), colorMode);
    };

    redraw();
    window.addEventListener("resize", redraw);

    return () => {
      window.removeEventListener("resize", redraw);
    };
  }, [activationMap, colorMode]);

  return <canvas ref={canvasRef} className={className} />;
}
