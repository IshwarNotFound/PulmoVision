"use client";

import { useEffect } from "react";

export function LoadingShellController() {
  useEffect(() => {
    let cancelled = false;
    let hideTimer: number | null = null;

    const hideShell = () => {
      if (cancelled) return;

      const shell = document.getElementById("loading-shell");
      if (!shell) {
        window.dispatchEvent(new CustomEvent("pulmovision:shell-ready"));
        return;
      }

      shell.style.opacity = "0";
      hideTimer = window.setTimeout(() => {
        if (cancelled) return;
        shell.style.visibility = "hidden";
        shell.style.pointerEvents = "none";
        window.dispatchEvent(new CustomEvent("pulmovision:shell-ready"));
      }, 400);
    };

    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) {
          hideShell();
        }
      });
    } else {
      hideShell();
    }

    return () => {
      cancelled = true;
      if (hideTimer !== null) {
        window.clearTimeout(hideTimer);
      }
    };
  }, []);

  return null;
}
