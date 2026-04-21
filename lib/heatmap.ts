export const renderHeatmap = (
  canvas: HTMLCanvasElement,
  activationMap: number[][],
  displayWidth: number,
  displayHeight: number,
  colorMode: "amber" | "critical" = "amber",
  gridDims?: [number, number],
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = displayWidth;
  canvas.height = displayHeight;

  const rows = Math.max(1, gridDims?.[0] ?? activationMap.length ?? 1);
  const cols = Math.max(1, gridDims?.[1] ?? activationMap[0]?.length ?? 1);
  const cellW = displayWidth / cols;
  const cellH = displayHeight / rows;

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const value = activationMap[i]?.[j] ?? 0;
      if (value < 0.2) continue;

      const x = j * cellW;
      const y = i * cellH;
      const alpha = value * 0.75;

      ctx.fillStyle =
        colorMode === "amber"
          ? `rgba(253, 230, 138, ${alpha})`
          : `rgba(251, 113, 133, ${alpha})`;

      ctx.filter = `blur(${cellW * 0.6}px)`;
      ctx.fillRect(x, y, cellW, cellH);
    }
  }

  ctx.filter = "none";
};
