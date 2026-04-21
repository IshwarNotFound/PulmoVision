import * as THREE from "three";

/**
 * Parenchyma — Ultra-Subtle Atmospheric Depth
 *
 * Option B: "Ghost Whisper"
 * Barely there. Just enough to make the lung feel solid and volumetric
 * without ever competing with the wireframe or the mesh surface.
 * Alpha maxes at 0.04. Blending is Normal (no accumulation mudding).
 * Color matches the lung mesh material — sage-bone, not peachy-brown.
 */

const VERTEX_SHADER = `
  uniform float u_size;
  varying float vWorldY;
  varying float vDepth;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldY = worldPos.y;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = u_size * (260.0 / -mvPos.z);
    gl_Position = projectionMatrix * mvPos;
    vDepth = clamp(1.0 + mvPos.z / 3.0, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform float u_clipY;
  varying float vWorldY;
  varying float vDepth;

  void main() {
    // Clip fade
    float d = vWorldY - u_clipY;
    if (d > 0.1) discard;
    float fade = clamp(1.0 - d / 0.1, 0.0, 1.0);

    // Circular soft point — very broad, gentle falloff
    vec2 cxy = 2.0 * gl_PointCoord - 1.0;
    float r = dot(cxy, cxy);
    if (r > 1.0) discard;
    float edge = 1.0 - smoothstep(0.0, 1.0, r); // Maximum softness

    // Ghost whisper — not felt, just sensed
    float alpha = fade * edge * 0.04;
    if (alpha < 0.002) discard;

    // Match the lung mesh color (sage-bone #CDC8C0) — not peachy, not brown
    // Slightly cooler at depth to suggest interior space
    vec3 color = mix(vec3(0.80, 0.78, 0.75), vec3(0.72, 0.76, 0.80), vDepth);
    gl_FragColor = vec4(color, alpha);
  }
`;

const mulberry32 = (seed: number) => {
  return (): number => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Anatomical lung profile — exact match to lungGeometry.ts
const getLungProfile = (v: number) => {
  const y = 1.4 - v * 2.8;
  let rLateral: number;
  let rAP: number;

  if (v < 0.08) {
    const t = v / 0.08;
    rLateral = t * 0.28;
    rAP = t * 0.13;
  } else if (v < 0.25) {
    const t = (v - 0.08) / 0.17;
    rLateral = 0.28 + t * 0.38;
    rAP = 0.13 + t * 0.18;
  } else if (v < 0.6) {
    const t = (v - 0.25) / 0.35;
    rLateral = 0.66 + t * 0.14;
    rAP = 0.31 + t * 0.07;
  } else if (v < 0.85) {
    const t = (v - 0.6) / 0.25;
    rLateral = 0.8 - t * 0.1;
    rAP = 0.38 - t * 0.06;
  } else {
    const t = (v - 0.85) / 0.15;
    rLateral = 0.7 - t * 0.12;
    rAP = 0.32 - t * 0.14;
  }

  return { y, rLateral, rAP };
};

const getMedialFactor = (angle: number, v: number, activeSide: "left" | "right"): number => {
  const medialAngle = activeSide === "right" ? Math.PI : 0;
  const angularDist = Math.abs(((angle - medialAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
  const medialness = 1 - angularDist / Math.PI;
  const heightFactor = Math.max(0, 1 - Math.abs(v - 0.5) / 0.38);
  const notchDepth = activeSide === "left" ? 0.52 : 0.34;
  const concavity = Math.pow(medialness, 1.4) * heightFactor * notchDepth;
  return 1.0 - concavity;
};

export const createParenchyma = (side: "left" | "right"): THREE.Points => {
  const rng = mulberry32(side === "left" ? 0xbeefcafe : 0xfaceb00c);

  // 3,000 points — sparse, ghost-like
  const count = 3000;
  const positions = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const v = rng();
    const { y, rLateral, rAP } = getLungProfile(v);
    const angle = rng() * Math.PI * 2;

    // Uniform distribution — no edge bias, let the anatomy do the work
    const radialMult = rng() * getMedialFactor(angle, v, side);

    let x = Math.cos(angle) * rLateral * radialMult;
    const z = Math.sin(angle) * rAP * radialMult;

    if (side === "right") {
      x *= 1.08;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      u_size: { value: 0.35 }, // Tiny, precise particles
      u_clipY: { value: 999 },
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending, // Normal — no additive mud buildup
  });

  const points = new THREE.Points(geometry, material);
  points.visible = false;
  points.renderOrder = -5;

  return points;
};
