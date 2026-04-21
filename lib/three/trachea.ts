import * as THREE from "three";

export const createTrachea = () => {
  const group = new THREE.Group();

  const createAnchoredBronchusGeometry = (
    radiusTop: number,
    radiusBottom: number,
    height: number,
    radialSegments: number,
  ) => {
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1);
    geometry.translate(0, -height / 2, 0);
    return geometry;
  };

  const tracheaGeo = new THREE.CylinderGeometry(0.055, 0.048, 0.85, 16, 1, false);
  const tracheaMat = new THREE.MeshPhysicalMaterial({
    color: 0x8FD4C5,
    emissive: 0x153A35,
    roughness: 0.68,
    metalness: 0,
    clearcoat: 0.08,
    clearcoatRoughness: 0.6,
    transparent: true,
    opacity: 0.75,
  });

  const trachea = new THREE.Mesh(tracheaGeo, tracheaMat);
  trachea.position.set(0, 1.55, 0);
  group.add(trachea);

  const carinaGeo = new THREE.SphereGeometry(0.038, 12, 12);
  const carina = new THREE.Mesh(carinaGeo, tracheaMat);
  carina.position.set(0, 1.1, 0);
  group.add(carina);

  const rightBronchusGeo = createAnchoredBronchusGeometry(0.048, 0.038, 0.65, 12);
  const rightBronchus = new THREE.Mesh(rightBronchusGeo, tracheaMat);
  rightBronchus.position.set(0, 1.1, 0);
  rightBronchus.rotation.z = -Math.PI * 0.14;
  rightBronchus.rotation.x = Math.PI * 0.04;
  group.add(rightBronchus);

  const leftBronchusGeo = createAnchoredBronchusGeometry(0.042, 0.034, 0.72, 12);
  const leftBronchus = new THREE.Mesh(leftBronchusGeo, tracheaMat);
  leftBronchus.position.set(0, 1.1, 0);
  leftBronchus.rotation.z = Math.PI * 0.22;
  leftBronchus.rotation.x = Math.PI * 0.04;
  group.add(leftBronchus);

  return group;
};
