import type * as THREE from "three";

export interface SyncEvent {
  i: number;
  j: number;
  source: "2d" | "3d";
}

export interface HoverTooltipData {
  activation: string;
  region: string;
  cell: string;
  level: "High" | "Moderate" | "Low";
}

export const DEFAULT_ACTIVATION_THRESHOLD = 0.35;

export const onHeatmapHover = (
  e: MouseEvent,
  containerEl: HTMLElement,
  activationMap: number[][],
  onSync: (event: SyncEvent) => void,
  onClear: () => void,
  gridDims?: [number, number],
  threshold = DEFAULT_ACTIVATION_THRESHOLD,
) => {
  const rect = containerEl.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    onClear();
    return;
  }

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const rows = Math.max(1, gridDims?.[0] ?? activationMap.length ?? 1);
  const cols = Math.max(1, gridDims?.[1] ?? activationMap[0]?.length ?? 1);
  const j = Math.max(0, Math.min(cols - 1, Math.floor((x / rect.width) * cols)));
  const i = Math.max(0, Math.min(rows - 1, Math.floor((y / rect.height) * rows)));

  const activation = activationMap[i]?.[j] ?? 0;

  if (activation >= threshold) {
    onSync({ i, j, source: "2d" });
  } else {
    onClear();
  }
};

export const onHotspotHover = (
  intersectedSprite: THREE.Sprite | null,
  onSync: (event: SyncEvent) => void,
  onClear: () => void,
) => {
  if (intersectedSprite?.userData?.i !== undefined) {
    const { i, j } = intersectedSprite.userData;
    onSync({ i: Number(i), j: Number(j), source: "3d" });
  } else {
    onClear();
  }
};

export const getHoverTooltip = (
  i: number,
  j: number,
  activationMap: number[][],
  gridDims?: [number, number],
): HoverTooltipData => {
  const raw = activationMap[i]?.[j];
  const hasActivation = typeof raw === "number" && Number.isFinite(raw);
  const activation = hasActivation ? (raw as number) : 0;
  const rows = Math.max(1, gridDims?.[0] ?? activationMap.length ?? 1);
  const cols = Math.max(1, gridDims?.[1] ?? activationMap[0]?.length ?? 1);
  const side = j < cols / 2 ? "Left" : "Right";
  const vertical = i < rows / 3 ? "Upper" : i < (rows * 2) / 3 ? "Mid" : "Lower";

  return {
    activation: hasActivation ? activation.toFixed(3) : "—",
    region: `${vertical} ${side} Lung`,
    cell: `[${i}, ${j}]`,
    level: activation > 0.7 ? "High" : activation > 0.4 ? "Moderate" : "Low",
  };
};
