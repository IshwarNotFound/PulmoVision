"use client";

import { useEffect, useRef } from "react";

import { buildLungScene } from "@/lib/three/lungScene";
import { cn } from "@/lib/utils";

interface LandingLungProps {
  className?: string;
  opacity?: number;
  cameraDistance?: number;
}

export function LandingLung({ className, opacity = 1, cameraDistance = 6.2 }: LandingLungProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const built = buildLungScene(host);
    built.camera.position.z = cameraDistance;
    built.camera.updateProjectionMatrix();
    built.setAutoRotate(false);

    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    const lerp = 0.06;

    const handleMouseMove = (e: MouseEvent) => {
      target.y = ((e.clientX / window.innerWidth) - 0.5) * 0.5;
      target.x = ((e.clientY / window.innerHeight) - 0.5) * 0.25;
    };

    window.addEventListener("mousemove", handleMouseMove);

    built.setOnBeforeRender((t) => {
      const breath = Math.sin(t * 0.52) * 0.013;
      built.leftGroup.scale.setScalar(1 + breath);
      built.rightGroup.scale.setScalar(1 + breath);

      current.x += (target.x - current.x) * lerp;
      current.y += (target.y - current.y) * lerp;
      built.leftGroup.rotation.x = current.x;
      built.leftGroup.rotation.y = current.y;
      built.rightGroup.rotation.x = current.x;
      built.rightGroup.rotation.y = current.y;
    });

    const observer = new ResizeObserver(() => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      built.renderer.setSize(width, height);
      built.camera.aspect = width / height;
      built.camera.updateProjectionMatrix();
    });

    observer.observe(host);

    return () => {
      built.setOnBeforeRender(null);
      window.removeEventListener("mousemove", handleMouseMove);
      observer.disconnect();
      built.dispose();
      if (host.contains(built.renderer.domElement)) {
        host.removeChild(built.renderer.domElement);
      }
    };
  }, [cameraDistance]);

  return <div ref={hostRef} className={cn("h-full w-full", className)} style={{ opacity }} />;
}
