import * as THREE from "three";

interface HotspotConfig {
  activationMap: number[][];
  threshold?: number;
  maxHotspots?: number;
  style?: "cinematic" | "diagnostic";
  leftGroup: THREE.Group;
  rightGroup: THREE.Group;
  gridDims?: [number, number];
}

interface ProjectedHotspot {
  position: THREE.Vector3;
  side: "left" | "right";
  activation: number;
}

const HOTSPOT_COLORMAP = (value: number): [number, number, number] => {
  if (value < 0.5) {
    const t = THREE.MathUtils.clamp((value - 0.15) / 0.35, 0, 1);
    return [
      Math.round(45 + t * (253 - 45)),
      Math.round(212 + t * (230 - 212)),
      Math.round(191 + t * (138 - 191)),
    ];
  }

  const t = THREE.MathUtils.clamp((value - 0.5) / 0.5, 0, 1);
  return [
    Math.round(253 + t * (251 - 253)),
    Math.round(230 - t * (230 - 113)),
    Math.round(138 - t * (138 - 133)),
  ];
};

const textureCache = new Map<string, THREE.CanvasTexture>();

const getCachedTexture = (
  r: number,
  g: number,
  b: number,
  isDiagnostic: boolean,
): THREE.CanvasTexture => {
  const qr = Math.min(Math.round(r / 32) * 32, 255);
  const qg = Math.min(Math.round(g / 32) * 32, 255);
  const qb = Math.min(Math.round(b / 32) * 32, 255);
  const key = `${qr}-${qg}-${qb}-${isDiagnostic ? "d" : "c"}`;

  const cached = textureCache.get(key);
  if (cached) {
    return cached;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const fallbackTexture = new THREE.CanvasTexture(canvas);
    textureCache.set(key, fallbackTexture);
    return fallbackTexture;
  }

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, `rgba(${qr}, ${qg}, ${qb}, ${isDiagnostic ? 0.78 : 0.95})`);
  grad.addColorStop(0.4, `rgba(${qr}, ${qg}, ${qb}, ${isDiagnostic ? 0.42 : 0.55})`);
  grad.addColorStop(1, `rgba(${qr}, ${qg}, ${qb}, 0.0)`);

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache.set(key, texture);
  return texture;
};

export const projectToLungSurface = (i: number, j: number, gridDims: [number, number] = [14, 14]): ProjectedHotspot => {
  const u = (j + 0.5) / gridDims[1];
  const v = (i + 0.5) / gridDims[0];

  // Keep side mapping consistent with 2D overlay grid: left half -> left lung, right half -> right lung.
  const side: "left" | "right" = u < 0.5 ? "left" : "right";
  const localU = side === "left" ? u * 2 : (u - 0.5) * 2;

  // Hotspots are now returned in local lung-group coordinates (not world coordinates),
  // so they remain attached to each lung when the group animates.
  const x = side === "left"
    ? THREE.MathUtils.lerp(-0.72, 0.24, localU)
    : THREE.MathUtils.lerp(-0.24, 0.72, localU);
  const y = THREE.MathUtils.lerp(1.22, -1.18, v);

  const xNorm = side === "left"
    ? THREE.MathUtils.clamp((x + 0.72) / 0.96, 0, 1)
    : THREE.MathUtils.clamp((x + 0.24) / 0.96, 0, 1);
  const medialness = side === "left" ? xNorm : 1 - xNorm;
  const xCentered = xNorm * 2 - 1;
  const yCentered = v * 2 - 1;
  const frontalCurve = Math.max(0, 1 - xCentered * xCentered * 0.75 - yCentered * yCentered * 0.55);
  const z = 0.08 + frontalCurve * 0.34 - medialness * 0.05;

  return {
    position: new THREE.Vector3(x, y, z),
    side,
    activation: 0,
  };
};

const createHotspotSprite = (activation: number, style: "cinematic" | "diagnostic") => {
  const [r, g, b] = HOTSPOT_COLORMAP(activation);
  const isDiagnostic = style === "diagnostic";
  const texture = getCachedTexture(r, g, b, isDiagnostic);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    blending: isDiagnostic ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthTest: !isDiagnostic,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);
  const size = isDiagnostic ? 0.045 + activation * 0.11 : 0.08 + activation * 0.18;
  sprite.scale.set(size, size, size);
  sprite.userData.baseScale = size;

  return sprite;
};

export const renderHotspots = ({
  activationMap,
  threshold = 0.35,
  maxHotspots,
  style = "cinematic",
  leftGroup,
  rightGroup,
  gridDims,
}: HotspotConfig): THREE.Sprite[] => {
  const rows = Math.max(1, gridDims?.[0] ?? activationMap.length ?? 1);
  const cols = Math.max(1, gridDims?.[1] ?? activationMap[0]?.length ?? 1);

  const sprites: THREE.Sprite[] = [];
  const cells: Array<{ i: number; j: number; value: number }> = [];

  for (let i = 0; i < rows; i += 1) {
    for (let j = 0; j < cols; j += 1) {
      const value = activationMap[i]?.[j] ?? 0;
      if (value >= threshold) {
        cells.push({ i, j, value });
      }
    }
  }

  const sortedCells = cells.sort((a, b) => b.value - a.value);
  const hasCap = typeof maxHotspots === "number" && Number.isFinite(maxHotspots) && maxHotspots > 0;
  const selectedCells = hasCap ? sortedCells.slice(0, Math.floor(maxHotspots)) : sortedCells;

  selectedCells.forEach(({ i, j, value }) => {
      const projected = projectToLungSurface(i, j, [rows, cols]);
      const sprite = createHotspotSprite(value, style);
      sprite.position.copy(projected.position);
      sprite.userData = {
        ...sprite.userData,
        i,
        j,
        activation: value,
        side: projected.side,
      };

      const targetGroup = projected.side === "left" ? leftGroup : rightGroup;
      targetGroup.add(sprite);
      sprites.push(sprite);
    });

  return sprites;
};

export const clearHotspotTextureCache = () => {
  textureCache.forEach((texture) => texture.dispose());
  textureCache.clear();
};

export const pulseHotspot = (sprite: THREE.Sprite, active: boolean) => {
  const baseScale = Number(sprite.userData.baseScale ?? 0.12);
  const targetScale = active ? baseScale * 1.6 : baseScale;
  sprite.scale.setScalar(targetScale);
};
