import * as THREE from "three";

export const createFissures = (side: "left" | "right") => {
  const group = new THREE.Group();

  const obliqueFissurePoints: THREE.Vector3[] = [];
  for (let t = 0; t <= 1; t += 0.1) {
    obliqueFissurePoints.push(
      new THREE.Vector3(
        side === "right" ? 0.6 - t * 0.3 : -(0.6 - t * 0.3),
        0.6 - t * 1.4,
        0.2 - t * 0.35,
      ),
    );
  }

  const obliqueCurve = new THREE.CatmullRomCurve3(obliqueFissurePoints);
  const obliquePoints = obliqueCurve.getPoints(20);
  const obliqueGeo = new THREE.BufferGeometry().setFromPoints(obliquePoints);
  const obliqueLine = new THREE.Line(
    obliqueGeo,
    new THREE.LineBasicMaterial({
      color: 0xB5B0A8,
      transparent: true,
      opacity: 0,
    }),
  );
  group.add(obliqueLine);

  if (side === "right") {
    const horizontalFissurePoints: THREE.Vector3[] = [];
    for (let t = 0; t <= 1; t += 0.1) {
      horizontalFissurePoints.push(
        new THREE.Vector3(0.3 + t * 0.35, 0.22, 0.3 - t * 0.55),
      );
    }

    const horizontalCurve = new THREE.CatmullRomCurve3(horizontalFissurePoints);
    const horizontalPoints = horizontalCurve.getPoints(15);
    const horizontalGeo = new THREE.BufferGeometry().setFromPoints(horizontalPoints);
    const horizontalLine = new THREE.Line(
      horizontalGeo,
      new THREE.LineBasicMaterial({
        color: 0xB5B0A8,
        transparent: true,
        opacity: 0,
      }),
    );
    group.add(horizontalLine);
  }

  return group;
};
