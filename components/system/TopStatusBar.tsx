"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { checkBackendHealth } from "@/lib/health";

interface HealthState {
  status: "checking" | "online" | "degraded" | "offline";
  modelsLoaded: string[];
}

export function TopStatusBar() {
  const [health, setHealth] = useState<HealthState>({ status: "checking", modelsLoaded: [] });

  useEffect(() => {
    let mounted = true;
    let timer: number | null = null;
    let hasSucceeded = false;

    const INITIAL_INTERVAL_MS = 15_000;
    const STEADY_INTERVAL_MS = 60_000;

    const schedule = () => {
      if (timer !== null) window.clearTimeout(timer);
      const delay = hasSucceeded ? STEADY_INTERVAL_MS : INITIAL_INTERVAL_MS;
      timer = window.setTimeout(runCheck, delay);
    };

    const runCheck = async () => {
      const nextHealth = await checkBackendHealth();
      if (!mounted) return;
      if (nextHealth.online) hasSucceeded = true;
      setHealth({
        status: nextHealth.online ? (nextHealth.degraded ? "degraded" : "online") : "offline",
        modelsLoaded: nextHealth.modelsLoaded,
      });
      if (mounted && !document.hidden) schedule();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      } else if (timer === null) {
        runCheck();
      }
    };

    runCheck();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return (
    <header className="pointer-events-none fixed left-0 right-0 top-0 z-40 flex h-16 items-center justify-between px-4 md:px-8">
      <Link href="/" className="pointer-events-auto flex items-center gap-2 transition-opacity hover:opacity-90" aria-label="Go to PulmoVision home">
        <div className="relative flex items-center justify-center mr-1">
          {/* Ambient glow behind logo */}
          <div className="absolute inset-0 rounded-full blur-[8px] bg-[#10B981] opacity-20 hidden md:block"></div>
          
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7 flex-shrink-0 relative z-10" aria-hidden="true" style={{ filter: "drop-shadow(0 0 8px rgba(16, 185, 129, 0.3))" }}>
            {/* Outer network ring */}
            <circle cx="14" cy="14" r="13" stroke="var(--color-lightbox)" strokeWidth="0.5" strokeDasharray="1 4" strokeLinecap="round" strokeOpacity="0.5" />
            <circle cx="14" cy="14" r="10" stroke="var(--color-lightbox)" strokeWidth="0.5" strokeOpacity="0.2" />

            {/* Neural network nodes / geometry representing lungs */}
            <path d="M14 6L10 10V16L14 20L18 16V10L14 6Z" stroke="var(--color-lightbox)" strokeWidth="1.2" strokeOpacity="0.15" fill="var(--color-lightbox)" fillOpacity="0.05" />
            
            {/* Left Lobes */}
            <path d="M12.5 8.5C10 8.5 7 11 7 15C7 18 9 20 11 20C12.5 20 13.5 17.5 13.5 15.5" stroke="url(#lungGradLeft)" strokeWidth="1.5" strokeLinecap="round" />
            
            {/* Right Lobes */}
            <path d="M15.5 8.5C18 8.5 21 11 21 15C21 18 19 20 17 20C15.5 20 14.5 17.5 14.5 15.5" stroke="url(#lungGradRight)" strokeWidth="1.5" strokeLinecap="round" />
            
            {/* Diagnostic Nodes */}
            <circle cx="9.5" cy="13.5" r="1.2" fill="var(--color-lightbox)" />
            <circle cx="18.5" cy="13.5" r="1.2" fill="var(--color-lightbox)" />
            <circle cx="11.5" cy="17.5" r="1.2" fill="var(--color-lightbox)" fillOpacity="0.8" />
            <circle cx="16.5" cy="17.5" r="1.2" fill="var(--color-lightbox)" fillOpacity="0.8" />
            
            {/* Connecting Synapses */}
            <line x1="9.5" y1="13.5" x2="11.5" y2="17.5" stroke="var(--color-lightbox)" strokeWidth="0.5" strokeOpacity="0.5" />
            <line x1="18.5" y1="13.5" x2="16.5" y2="17.5" stroke="var(--color-lightbox)" strokeWidth="0.5" strokeOpacity="0.5" />
            
            {/* Central Core */}
            <circle cx="14" cy="11" r="1.8" fill="#fff" fillOpacity="0.9" style={{ filter: "drop-shadow(0 0 4px #10B981)" }} />
            <line x1="14" y1="11" x2="12.5" y2="14" stroke="var(--color-lightbox)" strokeWidth="0.75" strokeOpacity="0.7" />
            <line x1="14" y1="11" x2="15.5" y2="14" stroke="var(--color-lightbox)" strokeWidth="0.75" strokeOpacity="0.7" />

            <defs>
              <linearGradient id="lungGradLeft" x1="10" y1="8.5" x2="11" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--color-lightbox)" stopOpacity="1" />
                <stop offset="1" stopColor="var(--color-lightbox)" stopOpacity="0.2" />
              </linearGradient>
              <linearGradient id="lungGradRight" x1="18" y1="8.5" x2="17" y2="20" gradientUnits="userSpaceOnUse">
                <stop stopColor="var(--color-lightbox)" stopOpacity="1" />
                <stop offset="1" stopColor="var(--color-lightbox)" stopOpacity="0.2" />
              </linearGradient>
            </defs>
          </svg>
        </div>
        
        <div className="flex flex-col justify-center" style={{ lineHeight: 1 }}>
          <div className="flex items-baseline">
            <span
              style={{
                fontFamily: "var(--font-space-grotesk), 'Plus Jakarta Sans', sans-serif",
                fontWeight: 600,
                fontSize: "16px",
                letterSpacing: "0.02em",
                color: "var(--color-text-primary)",
              }}
            >
              Pulmo
            </span>
            <span
              style={{
                fontFamily: "var(--font-space-grotesk), 'Plus Jakarta Sans', sans-serif",
                fontWeight: 700,
                letterSpacing: "0.02em",
                fontSize: "16px",
                color: "var(--color-lightbox)",
                textShadow: "0 0 12px rgba(16, 185, 129, 0.4)",
              }}
            >
              Vision
            </span>
          </div>
        </div>
      </Link>

      <div className="pointer-events-auto flex items-center gap-2 md:gap-3">
        <span className="badge" style={{ color: "var(--color-attention)" }}>
          <span className="badge-dot" style={{ background: "var(--color-attention)" }} />
          RESEARCH PROTOTYPE
        </span>

        {health.status === "checking" ? (
          <span className="badge" style={{ color: "var(--color-text-secondary)" }}>
            <span className="badge-dot" style={{ background: "var(--color-text-secondary)" }} />
            SYSTEM CHECKING
          </span>
        ) : health.status === "degraded" ? (
          <span className="badge" style={{ color: "var(--color-attention)" }}>
            <span className="badge-dot" style={{ background: "var(--color-attention)" }} />
            {health.modelsLoaded.length === 0
              ? "NO MODELS LOADED"
              : `DEGRADED: ${health.modelsLoaded.length} MODELS ACTIVE`}
          </span>
        ) : health.status === "online" ? (
          <span className="badge" style={{ color: "var(--color-normal)" }}>
            <span className="badge-dot" style={{ background: "var(--color-normal)" }} />
            {` ${health.modelsLoaded.length} MODELS ACTIVE`}
          </span>
        ) : (
          <span className="badge" style={{ color: "var(--color-attention)" }}>
            <span className="badge-dot" style={{ background: "var(--color-attention)" }} />
            INFERENCE OFFLINE
          </span>
        )}
      </div>
    </header>
  );
}
