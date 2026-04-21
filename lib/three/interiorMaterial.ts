import * as THREE from "three";

export const createInteriorMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    color: 0xc4877a,
    emissive: 0x3d0a08,
    emissiveIntensity: 0.22,
    roughness: 0.85,
    metalness: 0,
    clearcoat: 0.04,
    side: THREE.BackSide,
    transparent: true,
    opacity: 0.72,
  });
