"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ResultsScreen } from "@/components/results/ResultsScreen";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { useSessionStore } from "@/lib/session-store";

export function ResultsPageClient() {
  const router = useRouter();
  const prediction = useSessionStore((state) => state.prediction);
  const previewUrl = useSessionStore((state) => state.previewUrl);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!prediction) {
      setRedirecting(true);
      const timer = window.setTimeout(() => router.replace("/upload"), 600);
      return () => window.clearTimeout(timer);
    }

    setRedirecting(false);
  }, [prediction, router]);

  if (!prediction) {
    return (
      <section className="min-h-screen px-6 pb-12 pt-24">
        <div className="glass-card mx-auto grid max-w-[720px] gap-5 p-8 text-center">
          <p className="label">Session check</p>
          <h1 className="headline" style={{ fontSize: "clamp(30px,3.6vw,44px)" }}>
            No active analysis found
          </h1>
          <p className="body-serif" style={{ fontSize: "22px" }}>
            Results require an active prediction session. Start a new upload to continue.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <PrimaryButton onClick={() => router.replace("/upload")}>Go to Upload</PrimaryButton>
            {redirecting && (
              <span className="reading text-xs" style={{ color: "var(--color-text-secondary)" }}>
                Redirecting...
              </span>
            )}
          </div>
        </div>
      </section>
    );
  }

  return <ResultsScreen result={prediction} imageSrc={previewUrl} />;
}