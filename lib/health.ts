import { checkHealth } from "@/lib/api";

export const checkBackendHealth = async () => {
  try {
    const data = await checkHealth();
    const isDegraded = data.status === "degraded";
    return {
      online: data.status === "ok" || isDegraded,
      degraded: isDegraded,
      modelsLoaded: data.models_loaded ?? [],
      corsEnabled: data.cors_enabled ?? false,
      inference: data.inference ?? "local",
    };
  } catch (err) {
    console.error("[health] check failed:", err);
    return { online: false, degraded: false, modelsLoaded: [], corsEnabled: false, inference: "local" };
  }
};
