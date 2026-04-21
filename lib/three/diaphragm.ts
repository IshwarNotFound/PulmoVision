import * as THREE from "three";

export const createDiaphragmReference = () => {
  const curve = new THREE.EllipseCurve(0, 0, 2.2, 0.45, 0, Math.PI * 2, false, 0);
  const points = curve.getPoints(50);
  const geo = new THREE.BufferGeometry().setFromPoints(
    points.map((point) => new THREE.Vector3(point.x, 0, point.y)),
  );

  const diaphragm = new THREE.Line(
    geo,
    new THREE.LineBasicMaterial({
      color: 0x1F4A42,
      transparent: true,
      opacity: 0.25,
    }),
  );

  diaphragm.rotation.x = -Math.PI / 2;
  diaphragm.position.y = -1.52;

  return diaphragm;
};
