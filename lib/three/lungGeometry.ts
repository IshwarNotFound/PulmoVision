import * as THREE from "three";

interface LungConfig {
  side: "left" | "right";
  segments?: number;
}

export const createLungGeometry = ({ side, segments = 48 }: LungConfig) => {
  const uCount = segments;
  const vCount = segments;

  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

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

  const getHilumIndent = (angle: number, v: number, activeSide: "left" | "right"): number => {
    const medialAngle = activeSide === "right" ? Math.PI : 0;
    const angularDist = Math.abs(((angle - medialAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);

    const angularProximity = Math.max(0, 1 - angularDist / (Math.PI * 0.28));
    const heightProximity = Math.max(0, 1 - Math.abs(v - 0.45) / 0.12);

    return 1.0 - angularProximity * heightProximity * 0.18;
  };

  for (let vi = 0; vi <= vCount; vi += 1) {
    const v = vi / vCount;
    const { y, rLateral, rAP } = getLungProfile(v);

    for (let ui = 0; ui <= uCount; ui += 1) {
      const angle = (ui / uCount) * Math.PI * 2;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      const medialMult = getMedialFactor(angle, v, side);
      const hilumMult = getHilumIndent(angle, v, side);
      const totalMult = medialMult * hilumMult;

      let x = cosA * rLateral * totalMult;
      const z = sinA * rAP * totalMult;

      if (side === "right") {
        x *= 1.08;
      }

      positions.push(x, y, z);
      uvs.push(ui / uCount, vi / vCount);
      normals.push(0, 0, 1);
    }
  }

  for (let vi = 0; vi < vCount; vi += 1) {
    for (let ui = 0; ui < uCount; ui += 1) {
      const a = vi * (uCount + 1) + ui;
      const b = vi * (uCount + 1) + ui + 1;
      const c = (vi + 1) * (uCount + 1) + ui;
      const d = (vi + 1) * (uCount + 1) + ui + 1;

      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();

  return geo;
};
