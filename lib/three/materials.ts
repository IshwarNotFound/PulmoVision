import * as THREE from "three";

export interface LungLights {
  ambient: THREE.AmbientLight;
  keyLight: THREE.DirectionalLight;
  rimLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  baseFill: THREE.DirectionalLight;
  leftInterior: THREE.PointLight;
  rightInterior: THREE.PointLight;
  centralLight: THREE.PointLight;
}

// Lung base: warm sage-bone #D5D8D1 — clinical specimen against deep emerald chrome
export const createLungMaterial = (side: "left" | "right") =>
  new THREE.MeshPhysicalMaterial({
    color: 0xCDC8C0,
    emissive: 0x0A2822,       // deep emerald emissive undertone
    emissiveIntensity: side === "left" ? 0.28 : 0.32,
    roughness: 0.78,
    metalness: 0,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
    transparent: true,
    opacity: 0.88,
    side: THREE.FrontSide,
  });

export const createWireframeMaterial = () =>
  new THREE.MeshBasicMaterial({
    color: 0x5A6B65,          // #5A6B65 sage shadow
    wireframe: true,
    transparent: true,
    opacity: 0.07,
  });

export const createLungScene = (
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
): LungLights => {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  // Deep emerald ambient
  const ambient = new THREE.AmbientLight(0x0A2822, 0.65);
  scene.add(ambient);

  // Cool mint-white key light
  const keyLight = new THREE.DirectionalLight(0xD5F5EC, 1.1);
  keyLight.position.set(0.5, 4, 3);
  scene.add(keyLight);

  // Sage rim light
  const rimLight = new THREE.DirectionalLight(0x5E7E72, 0.55);
  rimLight.position.set(-1, 1, -3);
  scene.add(rimLight);

  // Soft emerald fill
  const fillLight = new THREE.DirectionalLight(0x0F4038, 0.38);
  fillLight.position.set(-3, 1, 1);
  scene.add(fillLight);

  // Deeper emerald base fill
  const baseFill = new THREE.DirectionalLight(0x0F3028, 0.42);
  baseFill.position.set(0, -3, 2);
  scene.add(baseFill);

  // Interior glow: #D5D8D1 sage-bone (matches surface)
  const leftInterior = new THREE.PointLight(0xD5D8D1, 0.75, 2.5);
  leftInterior.position.set(-0.6, 0, 0.1);
  scene.add(leftInterior);

  const rightInterior = new THREE.PointLight(0xD5D8D1, 0.75, 2.5);
  rightInterior.position.set(0.6, 0, 0.1);
  scene.add(rightInterior);

  // Central highlight: warm bone #F5F5F4
  const centralLight = new THREE.PointLight(0xF5F5F4, 0.42, 1.5);
  centralLight.position.set(0, 1.5, 0.5);
  scene.add(centralLight);

  return {
    ambient,
    keyLight,
    rimLight,
    fillLight,
    baseFill,
    leftInterior,
    rightInterior,
    centralLight,
  };
};
