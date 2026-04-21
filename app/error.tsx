"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[pulmovision] unhandled error:", error);
  }, [error]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--color-bg, #0A0E0C)",
        color: "var(--color-text-primary, #F5F5F4)",
      }}
    >
      <div style={{ maxWidth: "420px", textAlign: "center" }}>
        <p
          className="label"
          style={{ color: "var(--color-attention, #FBBF24)", marginBottom: "0.5rem" }}
        >
          Unexpected Error
        </p>
        <h1 style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>
          Something went wrong.
        </h1>
        <p style={{ color: "var(--color-text-secondary, #8BA399)", marginBottom: "1.5rem" }}>
          PulmoVision hit an unexpected problem. Try again, and if it persists, refresh the page.
        </p>
        <button
          onClick={reset}
          className="primary-button"
          style={{
            padding: "0.75rem 1.5rem",
            fontSize: "12px",
            letterSpacing: "0.14em",
          }}
        >
          Try again
        </button>
      </div>
    </div>
  );
}
