import * as THREE from "three";

import { createSecondaryBronchi } from "@/lib/three/bronchi";
import type { ClipController } from "@/lib/three/clipping";
import { createClipController } from "@/lib/three/clipping";
import { createDiaphragmReference } from "@/lib/three/diaphragm";
import { createFissures } from "@/lib/three/fissures";
import { createInteriorMaterial } from "@/lib/three/interiorMaterial";
import { createLungGeometry } from "@/lib/three/lungGeometry";
import { createLungMaterial, createLungScene, createWireframeMaterial, type LungLights } from "@/lib/three/materials";
import { createParenchyma } from "@/lib/three/parenchyma";
import { createTrachea } from "@/lib/three/trachea";
import { createPulmonaryVessels } from "@/lib/three/vessels";

export interface BuiltLungScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  leftLung: THREE.Mesh;
  rightLung: THREE.Mesh;
  leftGroup: THREE.Group;
  rightGroup: THREE.Group;
  lights: LungLights;
  setAutoRotate: (value: boolean) => void;
  setPaused: (paused: boolean) => void;
  setOnBeforeRender: (cb: ((t: number) => void) | null) => void;
  clipController?: ClipController;
  dispose: () => void;
}

interface LungSceneOptions {
  comparisonMode?: boolean;
}

export const buildLungScene = (container: HTMLDivElement, options: LungSceneOptions = {}): BuiltLungScene => {
  const comparisonMode = options.comparisonMode ?? false;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(comparisonMode ? 32 : 35, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, comparisonMode ? 0.05 : 0, comparisonMode ? 9.5 : 6.0);
  camera.lookAt(0, 0, 0);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  container.appendChild(renderer.domElement);

  const lights = createLungScene(renderer, scene);

  const leftGroup = new THREE.Group();
  const leftGeo = createLungGeometry({ side: "left", segments: 64 });
  const leftLung = new THREE.Mesh(leftGeo, createLungMaterial("left"));
  const leftWire = !comparisonMode ? new THREE.Mesh(leftGeo, createWireframeMaterial()) : null;
  leftGroup.add(leftLung);
  if (leftWire) {
    leftGroup.add(leftWire);
  }
  if (!comparisonMode) {
    leftGroup.add(createPulmonaryVessels("left"));
    leftGroup.add(
      createSecondaryBronchi({
        side: "left",
        hilumPosition: new THREE.Vector3(-0.65, 0.0, 0.05),
      }),
    );
  }
  leftGroup.position.x = -0.78;
  scene.add(leftGroup);

  const rightGroup = new THREE.Group();
  const rightGeo = createLungGeometry({ side: "right", segments: 64 });
  const rightLung = new THREE.Mesh(rightGeo, createLungMaterial("right"));
  const rightWire = !comparisonMode ? new THREE.Mesh(rightGeo, createWireframeMaterial()) : null;
  rightGroup.add(rightLung);
  if (rightWire) {
    rightGroup.add(rightWire);
  }
  if (!comparisonMode) {
    rightGroup.add(createPulmonaryVessels("right"));
    rightGroup.add(
      createSecondaryBronchi({
        side: "right",
        hilumPosition: new THREE.Vector3(0.65, 0.0, 0.05),
      }),
    );
  }
  rightGroup.position.x = 0.78;
  scene.add(rightGroup);

  const airway = !comparisonMode ? createTrachea() : null;
  if (airway) {
    scene.add(airway);
  }
  // diaphragm reference removed — visual noise

  const leftInterior = !comparisonMode ? new THREE.Mesh(leftGeo, createInteriorMaterial()) : null;
  if (leftInterior) {
    leftInterior.visible = false;
    leftGroup.add(leftInterior);
  }

  const rightInterior = !comparisonMode ? new THREE.Mesh(rightGeo, createInteriorMaterial()) : null;
  if (rightInterior) {
    rightInterior.visible = false;
    rightGroup.add(rightInterior);
  }

  const leftParenchyma = !comparisonMode ? createParenchyma("left") : null;
  if (leftParenchyma) {
    leftGroup.add(leftParenchyma);
  }

  const rightParenchyma = !comparisonMode ? createParenchyma("right") : null;
  if (rightParenchyma) {
    rightGroup.add(rightParenchyma);
  }

  const clipController: ClipController | undefined =
    !comparisonMode && leftInterior && rightInterior && leftParenchyma && rightParenchyma
      ? createClipController(
          scene,
          renderer,
          leftGroup,
          rightGroup,
          leftInterior,
          rightInterior,
          leftParenchyma,
          rightParenchyma,
        )
      : undefined;

  let frameId = 0;
  let rotationAngle = 0;
  let isAutoRotating = !comparisonMode;
  let isPaused = false;
  let onBeforeRenderCb: ((t: number) => void) | null = null;
  const clock = new THREE.Clock();

  const animate = () => {
    frameId = window.requestAnimationFrame(animate);

    if (isPaused) {
      return;
    }

    const t = clock.getElapsedTime();
    if (onBeforeRenderCb) {
      onBeforeRenderCb(t);
    }

    if (isAutoRotating) {
      rotationAngle += 0.003;
      const oscillation = Math.sin(rotationAngle) * 0.25;
      leftGroup.rotation.y = oscillation;
      rightGroup.rotation.y = oscillation;
      if (airway) {
        airway.rotation.y = oscillation;
      }
    }

    if (comparisonMode) {
      lights.leftInterior.intensity = 0.68;
      lights.rightInterior.intensity = 0.68;
    } else {
      // Breathing: ~6s inhale/exhale cycle, subtle expansion
      const breathPhase = (Math.sin(t * 1.1) + 1) / 2; // 0 → 1 → 0
      const breathScale = 1 + breathPhase * 0.018;
      leftGroup.scale.set(breathScale, breathScale * 1.01, breathScale);
      rightGroup.scale.set(breathScale, breathScale * 1.01, breathScale);
      leftGroup.position.x = -0.78 - breathPhase * 0.012;
      rightGroup.position.x = 0.78 + breathPhase * 0.012;
      if (airway) {
        airway.position.y = breathPhase * 0.015;
      }
      lights.leftInterior.intensity = breathPhase * 0.18 + 0.62;
      lights.rightInterior.intensity = breathPhase * 0.18 + 0.62;
    }

    renderer.render(scene, camera);
  };

  animate();

  const dispose = () => {
    window.cancelAnimationFrame(frameId);

    clipController?.dispose();

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();

    scene.traverse((obj) => {
      const withResources = obj as THREE.Object3D & {
        geometry?: THREE.BufferGeometry;
        material?: THREE.Material | THREE.Material[];
      };

      if (withResources.geometry) {
        geometries.add(withResources.geometry);
      }

      if (withResources.material) {
        const matList = Array.isArray(withResources.material)
          ? withResources.material
          : [withResources.material];
        matList.forEach((mat) => materials.add(mat));
      }
    });

    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    scene.clear();

    renderer.forceContextLoss();
    renderer.dispose();
  };

  return {
    scene,
    camera,
    renderer,
    leftLung,
    rightLung,
    leftGroup,
    rightGroup,
    lights,
    clipController,
    setAutoRotate: (value: boolean) => {
      isAutoRotating = value;
    },
    setPaused: (paused: boolean) => {
      isPaused = paused;
    },
    setOnBeforeRender: (cb: ((t: number) => void) | null) => {
      onBeforeRenderCb = cb;
    },
    dispose,
  };
};
