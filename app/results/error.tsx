"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ResultsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[pulmovision:results] error:", error);
  }, [error]);

  return (
    <section
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div className="glass-card" style={{ maxWidth: "460px", padding: "2rem", textAlign: "center" }}>
        <p className="label" style={{ color: "var(--color-attention, #FBBF24)", marginBottom: "0.5rem" }}>
          Results failed to render
        </p>
        <h1 style={{ fontSize: "1.25rem", marginBottom: "1rem" }}>
          Could not display this scan.
        </h1>
        <p style={{ color: "var(--color-text-secondary, #8BA399)", marginBottom: "1.5rem" }}>
          The results view encountered an error. Retry, or upload a different scan.
        </p>
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "center" }}>
          <button
            onClick={reset}
            className="primary-button"
            style={{ padding: "0.75rem 1.25rem", fontSize: "12px", letterSpacing: "0.14em" }}
          >
            Try again
          </button>
          <button
            onClick={() => router.push("/upload")}
            className="ghost-button"
            style={{ padding: "0.75rem 1.25rem", fontSize: "12px", letterSpacing: "0.14em" }}
          >
            New scan
          </button>
        </div>
      </div>
    </section>
  );
}
