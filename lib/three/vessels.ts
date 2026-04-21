import * as THREE from "three";

const mulberry32 = (seed: number) => {
  return (): number => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const createPulmonaryVessels = (side: "left" | "right") => {
  const rng = mulberry32(side === "left" ? 0xdeadbeef : 0xcafebabe);
  const group = new THREE.Group();

  const vesselMat = new THREE.MeshPhysicalMaterial({
    color: 0x3E8F80,
    emissive: 0x0A2620,
    roughness: 0.72,
    metalness: 0,
    clearcoat: 0.12,
    transparent: true,
    opacity: 0.5,
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
    if (depth === 0 || length < 0.04) {
      return;
    }

    const end = origin.clone().addScaledVector(direction, length);
    end.x = THREE.MathUtils.clamp(end.x, bounds.xMin, bounds.xMax);
    end.y = THREE.MathUtils.clamp(end.y, bounds.yMin, bounds.yMax);
    end.z = THREE.MathUtils.clamp(end.z, bounds.zMin, bounds.zMax);

    const center = origin.clone().lerp(end, 0.5);
    const branchLength = origin.distanceTo(end);
    const geometry = new THREE.CylinderGeometry(radius * 0.8, radius, branchLength, 6, 1);
    const mesh = new THREE.Mesh(geometry, vesselMat);
    mesh.position.copy(center);

    const branchDir = end.clone().sub(origin).normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), branchDir);
    group.add(mesh);

    const childCount = 2;
    for (let i = 0; i < childCount; i += 1) {
      const spread = 0.5 + rng() * 0.5;
      const childDir = new THREE.Vector3(
        direction.x + (rng() - 0.5) * spread,
        direction.y + (rng() - 0.5) * spread,
        direction.z + (rng() - 0.5) * spread,
      ).normalize();
      addBranch(end, childDir, radius * 0.65, length * 0.7, depth - 1);
    }
  };

  const startDir = new THREE.Vector3(side === "left" ? -0.4 : 0.4, -0.3, 0.1).normalize();
  addBranch(new THREE.Vector3(side === "left" ? -0.1 : 0.1, 0.4, 0.05), startDir, 0.035, 0.4, 4);

  return group;
};
