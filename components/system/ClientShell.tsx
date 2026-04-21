"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

import { SpirometryWaveform } from "@/components/animations/SpirometryWaveform";
import { WebGLBackground } from "@/components/animations/WebGLBackground";
import { TopStatusBar } from "@/components/system/TopStatusBar";
import { destroyLenis, initLenis, type LenisController } from "@/lib/animation";
import { EASE } from "@/lib/easing";

export function ClientShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const lenisRef = useRef<LenisController | null>(null);

  useEffect(() => {
    const noScrollScreen = pathname === "/processing" || pathname === "/results";

    if (noScrollScreen) {
      destroyLenis(lenisRef.current);
      lenisRef.current = null;
      return;
    }

    if (!lenisRef.current) {
      lenisRef.current = initLenis();
    }

    return () => {
      destroyLenis(lenisRef.current);
      lenisRef.current = null;
    };
  }, [pathname]);


  const mode = useMemo(() => {
    if (pathname === "/processing") return "processing" as const;
    if (pathname === "/results") return "results" as const;
    if (pathname === "/upload") return "upload" as const;
    if (pathname === "/disclaimer") return "upload" as const;
    return "landing" as const;
  }, [pathname]);

  return (
    <div className="pv-app-root">
      <div className="pv-bg-fallback" aria-hidden="true" />
      <WebGLBackground />
      <div className="pv-dot-grid" aria-hidden="true" />
      <div className="pv-vignette" aria-hidden="true" />

      <TopStatusBar />
      <SpirometryWaveform mode={mode} />

      <motion.main
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: EASE.enter }}
        className="relative z-20 min-h-screen"
      >
        {children}
      </motion.main>
    </div>
  );
}
