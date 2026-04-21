import { Suspense } from "react";

import { ResultsPageClient } from "./results-page-client";

function ResultsLoadingFallback() {
  return (
    <section className="min-h-screen px-6 pb-12 pt-24">
      <div className="glass-card mx-auto grid max-w-[720px] gap-4 p-8 text-center">
        <p className="label">Preparing results</p>
        <h1 className="headline" style={{ fontSize: "clamp(30px,3.6vw,44px)" }}>
          Loading analysis workspace
        </h1>
        <p className="body-serif" style={{ fontSize: "22px" }}>
          Syncing prediction data and visual overlays.
        </p>
      </div>
    </section>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<ResultsLoadingFallback />}>
      <ResultsPageClient />
    </Suspense>
  );
}
