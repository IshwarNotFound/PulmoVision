import * as THREE from "three";

interface BronchiConfig {
  side: "left" | "right";
  hilumPosition: THREE.Vector3;
}

const mulberry32 = (seed: number) => {
  return (): number => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createSecondaryBronchi = ({ side, hilumPosition }: BronchiConfig) => {
  const rng = mulberry32(side === "left" ? 0xc0ffee01 : 0xc0ffee02);
  const group = new THREE.Group();

  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x6AB0A0,
    emissive: 0x0F2A25,
    roughness: 0.7,
    metalness: 0,
    clearcoat: 0.1,
    transparent: true,
    opacity: 0.65,
  });

  const bounds = side === "left"
    ? { xMin: -0.72, xMax: -0.05, yMin: -1.3, yMax: 1.3, zMin: -0.28, zMax: 0.28 }
    : { xMin: 0.05, xMax: 0.78, yMin: -1.3, yMax: 1.3, zMin: -0.28, zMax: 0.28 };

  const addBranch = (
    origin: THREE.Vector3,
    direction: THREE.Vector3,
    radius: number,
    length: number,
    depth: number,
  ) => {
    if (depth === 0 || length < 0.05) {
      return;
    }

    const end = origin.clone().addScaledVector(direction, length);
    end.x = THREE.MathUtils.clamp(end.x, bounds.xMin, bounds.xMax);
    end.y = THREE.MathUtils.clamp(end.y, bounds.yMin, bounds.yMax);
    end.z = THREE.MathUtils.clamp(end.z, bounds.zMin, bounds.zMax);

    const center = origin.clone().lerp(end, 0.5);
    const branchLength = origin.distanceTo(end);
    const geo = new THREE.CylinderGeometry(radius * 0.82, radius, branchLength, 8, 1);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(center);

    const branchDir = end.clone().sub(origin).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), branchDir);
    group.add(mesh);

    const childCount = 2;
    for (let i = 0; i < childCount; i += 1) {
      const spread = 0.32 + rng() * 0.26;
      const childDir = new THREE.Vector3(
        direction.x + (rng() - 0.5) * spread,
        direction.y + (rng() - 0.5) * spread,
        direction.z + (rng() - 0.5) * spread,
      ).normalize();
      addBranch(end, childDir, radius * 0.68, length * 0.72, depth - 1);
    }
  };

  const startDir = new THREE.Vector3(side === "left" ? -0.35 : 0.35, -0.08, 0.08).normalize();
  addBranch(hilumPosition.clone(), startDir, 0.028, 0.26, 3);

  return group;
};
