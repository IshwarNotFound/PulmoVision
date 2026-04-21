"use client";

import { useEffect, useMemo, useRef } from "react";
import { animate } from "animejs";
import gsap from "gsap";

type WaveMode = "landing" | "upload" | "processing" | "results";

const RESTING_PATH = "M 0 70 C 80 20, 160 20, 240 70 S 400 120, 480 70 S 640 20, 720 70 S 880 120, 960 70";
const PROCESSING_PATH =
  "M 0 70 C 60 8, 140 8, 220 70 S 380 132, 460 70 S 620 8, 700 70 S 860 132, 960 70";

const MODE_OPACITY: Record<WaveMode, number> = {
  landing: 0.15,
  upload: 0.12,
  processing: 0.25,
  results: 0.1,
};

const MODE_DURATION: Record<WaveMode, number> = {
  landing: 4.3,
  upload: 4.3,
  processing: 3.2,
  results: 5,
};

export function SpirometryWaveform({ mode }: { mode: WaveMode }) {
  const pathRef = useRef<SVGPathElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const shouldUseProcessingShape = useMemo(() => mode === "processing", [mode]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    const totalLength = path.getTotalLength();
    gsap.set(path, {
      strokeDasharray: totalLength,
      strokeDashoffset: totalLength,
      opacity: MODE_OPACITY[mode],
    });

    const tween = gsap.to(path, {
      strokeDashoffset: 0,
      duration: MODE_DURATION[mode],
      repeat: -1,
      ease: "none",
      modifiers: {
        strokeDashoffset: (value) => `${Number(value) % totalLength}`,
      },
    });

    return () => {
      tween.kill();
    };
  }, [mode]);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;

    animate(path, {
      d: [{ to: shouldUseProcessingShape ? PROCESSING_PATH : RESTING_PATH }],
      duration: 2000,
      ease: "inOutSine",
    });
  }, [shouldUseProcessingShape]);

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none fixed bottom-[-72px] left-0 right-0 z-10 overflow-hidden"
      aria-hidden="true"
    >
      <svg width="100%" height="180" viewBox="0 0 960 140" preserveAspectRatio="none">
        <path
          ref={pathRef}
          d={RESTING_PATH}
          fill="none"
          stroke="rgba(16,185,129,0.7)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
