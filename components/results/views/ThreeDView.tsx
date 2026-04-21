"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import * as THREE from "three";

import { buildLungScene, type BuiltLungScene } from "@/lib/three/lungScene";
import { onHotspotHover, type SyncEvent } from "@/lib/viewSync";
import { pulseHotspot, renderHotspots } from "@/lib/three/hotspots";

import styles from "./Views.module.css";

interface ThreeDViewProps {
  activationMap: number[][];
  gridDims: [number, number];
  threshold: number;
  comparisonMode?: boolean;
  hoveredCell: { i: number; j: number } | null;
  onSync: (event: SyncEvent) => void;
  onClear: () => void;
  isActive?: boolean;
  onRenderUnavailable?: () => void;
  sliceEnabled: boolean;
  sliceY: number;
}

export const ThreeDView = ({
  activationMap,
  gridDims,
  threshold,
  comparisonMode = false,
  hoveredCell,
  onSync,
  onClear,
  isActive = true,
  onRenderUnavailable,
  sliceEnabled,
  sliceY,
}: ThreeDViewProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const builtSceneRef = useRef<BuiltLungScene | null>(null);
  const hotspotsRef = useRef<THREE.Sprite[]>([]);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const resumeTimerRef = useRef<number | null>(null);
  const unavailableReportedRef = useRef(false);
  const [renderUnavailable, setRenderUnavailable] = useState(false);
  const sliceEnabledRef = useRef(sliceEnabled);
  const sliceYRef = useRef(sliceY);
  const frameLastTsRef = useRef<number | null>(null);
  const frameAccumRef = useRef(0);
  const frameCountRef = useRef(0);
  const frameReportTsRef = useRef(0);

  const reportRenderUnavailable = useCallback(() => {
    setRenderUnavailable(true);
    if (!unavailableReportedRef.current) {
      unavailableReportedRef.current = true;
      onRenderUnavailable?.();
    }
  }, [onRenderUnavailable]);

  const clearHotspots = () => {
    hotspotsRef.current.forEach((sprite) => {
      if (sprite.parent) {
        sprite.parent.remove(sprite);
      }
      const material = sprite.material as THREE.SpriteMaterial;
      material.dispose();
    });
    hotspotsRef.current = [];
  };

  useEffect(() => {
    sliceEnabledRef.current = sliceEnabled;
    sliceYRef.current = sliceY;
    const controller = builtSceneRef.current?.clipController;
    if (controller) {
      if (sliceEnabled) {
        controller.setEnabled(true);
        controller.attachClipToSprites(hotspotsRef.current);
        controller.setClipY(sliceY);
      } else {
        controller.detachClipFromSprites(hotspotsRef.current);
        controller.setEnabled(false);
      }
    }
  }, [sliceEnabled, sliceY]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    unavailableReportedRef.current = false;
    setRenderUnavailable(false);

    let built: BuiltLungScene;
    try {
      built = buildLungScene(root, { comparisonMode });
    } catch (error) {
      console.error("[three-d] failed to initialize WebGL scene", error);
      reportRenderUnavailable();
      return;
    }

    builtSceneRef.current = built;
    frameLastTsRef.current = null;
    frameAccumRef.current = 0;
    frameCountRef.current = 0;
    frameReportTsRef.current = performance.now();

    built.setOnBeforeRender(() => {
      const now = performance.now();
      const last = frameLastTsRef.current;
      frameLastTsRef.current = now;

      if (last !== null) {
        frameAccumRef.current += now - last;
        frameCountRef.current += 1;
      }

      if (now - frameReportTsRef.current < 1200 || frameCountRef.current < 10) {
        return;
      }

      const avgFrameMs = frameAccumRef.current / frameCountRef.current;
      const drawCalls = built.renderer.info.render.calls;
      const hotspotCount = hotspotsRef.current.length;

      if (process.env.NODE_ENV !== "production" && (avgFrameMs > 18 || drawCalls > 320 || hotspotCount > 40)) {
        console.warn("[three-d] performance budget warning", {
          avg_frame_ms: Number(avgFrameMs.toFixed(2)),
          draw_calls: drawCalls,
          hotspot_count: hotspotCount,
        });
      }

      frameReportTsRef.current = now;
      frameAccumRef.current = 0;
      frameCountRef.current = 0;
    });

    const handleContextLost = (event: Event) => {
      event.preventDefault();
      built.setPaused(true);
      reportRenderUnavailable();
    };

    const scheduleAutoRotateResume = () => {
      if (comparisonMode) {
        built.setAutoRotate(false);
        return;
      }

      built.setAutoRotate(false);
      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }
      resumeTimerRef.current = window.setTimeout(() => {
        built.setAutoRotate(true);
      }, 3000);
    };

    const handlePointerMove = (event: PointerEvent) => {
      scheduleAutoRotateResume();

      const rect = built.renderer.domElement.getBoundingClientRect();
      pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(pointerRef.current, built.camera);
      const intersections = raycasterRef.current.intersectObjects(hotspotsRef.current, false);
      const clipPlane = builtSceneRef.current?.clipController?.clipPlane;
      const sliceIsActive = sliceEnabledRef.current && !!clipPlane;
      const worldPos = new THREE.Vector3();
      const validIntersections = sliceIsActive
        ? intersections.filter((hit) => {
            hit.object.getWorldPosition(worldPos);
            return clipPlane!.distanceToPoint(worldPos) >= -0.05;
          })
        : intersections;
      const intersected = (validIntersections[0]?.object as THREE.Sprite | undefined) ?? null;

      onHotspotHover(
        intersected,
        (syncEvent) => onSync(syncEvent),
        () => onClear(),
      );

      hotspotsRef.current.forEach((sprite) => {
        pulseHotspot(sprite, sprite === intersected);
      });
    };

    const handlePointerLeave = () => {
      onClear();
      hotspotsRef.current.forEach((sprite) => pulseHotspot(sprite, false));
    };

    const handleDoubleClick = () => {
      scheduleAutoRotateResume();
      gsap.to(built.camera.position, {
        x: 0,
        y: comparisonMode ? 0.05 : 0,
        z: comparisonMode ? 9.5 : 6.0,
        duration: 1,
        onUpdate: () => {
          built.camera.lookAt(0, 0, 0);
        },
      });
    };

    const observer = new ResizeObserver(() => {
      const width = Math.max(1, root.clientWidth);
      const height = Math.max(1, root.clientHeight);
      built.renderer.setSize(width, height);
      built.camera.aspect = width / height;
      built.camera.updateProjectionMatrix();
    });

    // Prevent canvas clicks from bubbling to SplitView's panel expand/collapse handler.
    const stopClick = (e: MouseEvent) => e.stopPropagation();

    observer.observe(root);
    built.renderer.domElement.addEventListener("pointerdown", scheduleAutoRotateResume);
    built.renderer.domElement.addEventListener("pointermove", handlePointerMove);
    built.renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    built.renderer.domElement.addEventListener("dblclick", handleDoubleClick);
    built.renderer.domElement.addEventListener("click", stopClick);
    built.renderer.domElement.addEventListener("webglcontextlost", handleContextLost);

    return () => {
      built.setOnBeforeRender(null);
      observer.disconnect();
      built.renderer.domElement.removeEventListener("pointerdown", scheduleAutoRotateResume);
      built.renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      built.renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      built.renderer.domElement.removeEventListener("dblclick", handleDoubleClick);
      built.renderer.domElement.removeEventListener("click", stopClick);
      built.renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);

      if (resumeTimerRef.current) {
        window.clearTimeout(resumeTimerRef.current);
      }

      clearHotspots();
      built.dispose();
      if (root.contains(built.renderer.domElement)) {
        root.removeChild(built.renderer.domElement);
      }
      builtSceneRef.current = null;
    };
  }, [comparisonMode, onClear, onSync, reportRenderUnavailable]);

  useEffect(() => {
    const built = builtSceneRef.current;
    if (!built) return;

    const rebuild = () => {
      if (sliceEnabledRef.current) {
        built.clipController?.detachClipFromSprites(hotspotsRef.current);
      }

      clearHotspots();
      hotspotsRef.current = renderHotspots({
        activationMap,
        threshold,
        maxHotspots: 24,
        style: comparisonMode ? "diagnostic" : "cinematic",
        leftGroup: built.leftGroup,
        rightGroup: built.rightGroup,
        gridDims,
      });

      if (sliceEnabledRef.current) {
        built.clipController?.attachClipToSprites(hotspotsRef.current);
        built.clipController?.setClipY(sliceYRef.current);
      }
    };

    const timer = window.setTimeout(rebuild, 80);
    return () => window.clearTimeout(timer);
  }, [activationMap, comparisonMode, gridDims, threshold]);

  useEffect(() => {
    if (builtSceneRef.current) {
      builtSceneRef.current.setPaused(!isActive);
    }
  }, [isActive]);

  useEffect(() => {
    hotspotsRef.current.forEach((sprite) => {
      const sameCell = hoveredCell
        ? Number(sprite.userData.i) === hoveredCell.i && Number(sprite.userData.j) === hoveredCell.j
        : false;
      pulseHotspot(sprite, sameCell);
    });
  }, [hoveredCell]);

  return (
    <div className={styles.viewRoot}>
      <div ref={rootRef} className={styles.threeContainer} />
      {renderUnavailable && (
        <div className={styles.fallbackBanner}>
          3D rendering unavailable on this device. Switching to a compatible view.
        </div>
      )}
      <div className={styles.rotateHint}>{comparisonMode ? "Aligned" : "Rotate"}</div>
    </div>
  );
};
