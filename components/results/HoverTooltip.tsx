"use client";

import type { HoverTooltipData } from "@/lib/viewSync";

interface HoverTooltipProps {
  data: HoverTooltipData | null;
  position: { x: number; y: number } | null;
}

export const HoverTooltip = ({ data, position }: HoverTooltipProps) => {
  if (!data || !position) return null;

  return (
    <div
      className="glass-card"
      style={{
        position: "absolute",
        transform: `translate3d(${position.x + 14}px, ${position.y + 14}px, 0)`,
        pointerEvents: "none",
        padding: "8px 10px",
        borderRadius: "10px",
        minWidth: "170px",
      }}
    >
      <p className="reading" style={{ fontSize: "10px", color: "var(--color-text-tertiary)" }}>
        {data.region} {data.cell}
      </p>
      <p className="reading" style={{ fontSize: "12px" }}>
        Activation {data.activation}
      </p>
      <p className="reading" style={{ fontSize: "10px", color: "var(--color-attention)" }}>
        {data.level} attention
      </p>
    </div>
  );
};
