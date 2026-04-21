import * as THREE from "three";

export interface ClipController {
  setClipY: (y: number) => void;
  setEnabled: (enabled: boolean) => void;
  readonly currentClipY: number;
  readonly clipPlane: THREE.Plane;
  attachClipToSprites: (sprites: THREE.Sprite[]) => void;
  detachClipFromSprites: (sprites: THREE.Sprite[]) => void;
  dispose: () => void;
}

export const createClipController = (
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  leftGroup: THREE.Group,
  rightGroup: THREE.Group,
  leftInterior: THREE.Mesh,
  rightInterior: THREE.Mesh,
  leftParenchyma: THREE.Points,
  rightParenchyma: THREE.Points,
): ClipController => {
  // With normal (0,-1,0), points with y > constant are clipped.
  const clipPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 999);

  const ringGeo = new THREE.RingGeometry(1.8, 1.85, 64);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x10b981,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  scene.add(ring);

  const setMaterialClip = (material: THREE.Material | THREE.Material[], planes: THREE.Plane[]) => {
    const mats = Array.isArray(material) ? material : [material];
    mats.forEach((mat) => {
      mat.clippingPlanes = planes;
      mat.needsUpdate = true;
    });
  };

  const applyClipToGroup = (group: THREE.Group) => {
    group.traverse((obj) => {
      if ((obj as THREE.Points).isPoints) {
        return;
      }
      const withMaterial = obj as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
      if (withMaterial.material) {
        setMaterialClip(withMaterial.material, [clipPlane]);
      }
    });
  };

  const removeClipFromGroup = (group: THREE.Group) => {
    group.traverse((obj) => {
      if ((obj as THREE.Points).isPoints) {
        return;
      }
      const withMaterial = obj as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
      if (withMaterial.material) {
        setMaterialClip(withMaterial.material, []);
      }
    });
  };

  const setClipY = (y: number) => {
    clipPlane.constant = y;
    ring.position.y = y;
    (leftParenchyma.material as THREE.ShaderMaterial).uniforms.u_clipY.value = y;
    (rightParenchyma.material as THREE.ShaderMaterial).uniforms.u_clipY.value = y;
  };

  const setEnabled = (enabled: boolean) => {
    if (enabled) {
      renderer.localClippingEnabled = true;
      applyClipToGroup(leftGroup);
      applyClipToGroup(rightGroup);
      ringMat.opacity = 0.45;
      leftInterior.visible = true;
      rightInterior.visible = true;
      leftParenchyma.visible = true;
      rightParenchyma.visible = true;
      return;
    }

    removeClipFromGroup(leftGroup);
    removeClipFromGroup(rightGroup);
    renderer.localClippingEnabled = false;
    clipPlane.constant = 999;
    ring.position.y = 999;
    ringMat.opacity = 0;
    leftInterior.visible = false;
    rightInterior.visible = false;
    leftParenchyma.visible = false;
    rightParenchyma.visible = false;
    (leftParenchyma.material as THREE.ShaderMaterial).uniforms.u_clipY.value = 999;
    (rightParenchyma.material as THREE.ShaderMaterial).uniforms.u_clipY.value = 999;
  };

  const attachClipToSprites = (sprites: THREE.Sprite[]) => {
    sprites.forEach((sprite) => {
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.clippingPlanes = [clipPlane];
      mat.needsUpdate = true;
    });
  };

  const detachClipFromSprites = (sprites: THREE.Sprite[]) => {
    sprites.forEach((sprite) => {
      const mat = sprite.material as THREE.SpriteMaterial;
      mat.clippingPlanes = [];
      mat.needsUpdate = true;
    });
  };

  const dispose = () => {
    scene.remove(ring);
    ringGeo.dispose();
    ringMat.dispose();
  };

  return {
    setClipY,
    setEnabled,
    get currentClipY() {
      return clipPlane.constant;
    },
    get clipPlane() {
      return clipPlane;
    },
    attachClipToSprites,
    detachClipFromSprites,
    dispose,
  };
};
