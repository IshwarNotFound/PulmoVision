"use client";

export const HeatmapLegend = () => (
  <div className="glass-card rounded-[14px] p-3">
    <div className="mb-2 flex items-center justify-between">
      <span className="reading text-[10px] tracking-[0.12em]" style={{ color: "var(--color-text-tertiary)" }}>
        LOW ATTENTION
      </span>
      <span className="reading text-[10px] tracking-[0.12em]" style={{ color: "var(--color-text-tertiary)" }}>
        HIGH ATTENTION
      </span>
    </div>

    <div
      style={{
        height: "8px",
        borderRadius: "999px",
        background:
          "linear-gradient(90deg, rgba(16,185,129,0.0) 0%, rgba(16,185,129,0.45) 15%, rgba(253,230,138,0.72) 50%, rgba(251,113,133,0.85) 100%)",
      }}
    />

    <div className="mt-2 flex items-center justify-between">
      <span className="reading text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
        0.15
      </span>
      <span className="reading text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
        0.50
      </span>
      <span className="reading text-[10px]" style={{ color: "var(--color-text-tertiary)" }}>
        1.0
      </span>
    </div>
  </div>
);
