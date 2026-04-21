const COLORMAP = (value: number): [number, number, number, number] => {
  if (value < 0.15) return [0, 0, 0, 0];

  if (value < 0.5) {
    const t = (value - 0.15) / 0.35;
    return [
      Math.round(45 + t * (253 - 45)),
      Math.round(212 + t * (230 - 212)),
      Math.round(191 + t * (138 - 191)),
      value * 0.78,
    ];
  }

  const t = (value - 0.5) / 0.5;
  return [
    Math.round(253 + t * (251 - 253)),
    Math.round(230 - t * (230 - 113)),
    Math.round(138 - t * (138 - 133)),
    0.78 + t * 0.04,
  ];
};

type HeatmapCache = {
  // Either an OffscreenCanvas (modern browsers) or a detached HTMLCanvasElement.
  canvas: OffscreenCanvas | HTMLCanvasElement;
  cols: number;
  rows: number;
  activationMap: number[][] | null;
  threshold: number;
};

const cacheKey = "__pv_heatmap_cache";

// Prefer OffscreenCanvas — it has no connection to the main-thread layout tree
// so resizing it never triggers browser layout/compositing work, preventing
// micro-stutters during Framer Motion animations.
const createOffscreenBuffer = (cols: number, rows: number): OffscreenCanvas | HTMLCanvasElement => {
  if (typeof OffscreenCanvas !== "undefined") {
    return new OffscreenCanvas(cols, rows);
  }
  const el = document.createElement("canvas");
  el.width = cols;
  el.height = rows;
  return el;
};

const getCache = (owner: HTMLCanvasElement & { [k: string]: unknown }): HeatmapCache => {
  const existing = owner[cacheKey] as HeatmapCache | undefined;
  if (existing) return existing;
  // Dimensions are set lazily on first sourceChanged render.
  const cache: HeatmapCache = {
    canvas: createOffscreenBuffer(1, 1),
    cols: 0,
    rows: 0,
    activationMap: null,
    threshold: -1,
  };
  owner[cacheKey] = cache;
  return cache;
};

export const renderHeatmap2D = (
  canvas: HTMLCanvasElement,
  activationMap: number[][],
  displayWidth: number,
  displayHeight: number,
  threshold = 0.35,
  gridDims?: [number, number],
): void => {
  const rows = Math.max(1, gridDims?.[0] ?? activationMap.length ?? 1);
  const cols = Math.max(1, gridDims?.[1] ?? activationMap[0]?.length ?? 1);

  const cache = getCache(canvas as HTMLCanvasElement & { [k: string]: unknown });
  const sourceChanged =
    cache.activationMap !== activationMap ||
    cache.threshold !== threshold ||
    cache.rows !== rows ||
    cache.cols !== cols;

  if (sourceChanged) {
    // Resize the backing buffer. OffscreenCanvas supports direct width/height
    // assignment just like HTMLCanvasElement.
    const buf = cache.canvas;
    if (buf.width !== cols || buf.height !== rows) {
      buf.width = cols;
      buf.height = rows;
    }
    const offCtx = buf.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!offCtx) return;

    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        const value = activationMap[i]?.[j] ?? 0;
        const thresholdedValue = value < threshold ? 0 : value;
        const [r, g, b, a] = COLORMAP(thresholdedValue);
        offCtx.fillStyle = `rgba(${r},${g},${b},${a})`;
        offCtx.fillRect(j, i, 1, 1);
      }
    }

    cache.activationMap = activationMap;
    cache.threshold = threshold;
    cache.rows = rows;
    cache.cols = cols;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const targetW = Math.max(1, displayWidth);
  const targetH = Math.max(1, displayHeight);
  if (canvas.width !== targetW) canvas.width = targetW;
  if (canvas.height !== targetH) canvas.height = targetH;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(cache.canvas, 0, 0, canvas.width, canvas.height);
};
