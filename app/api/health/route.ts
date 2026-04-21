import { access } from "fs/promises";
import path from "path";

export const runtime = "nodejs";

const MODELS = [
  { key: "densenet", file: "DenseNet121_best.h5", label: "DenseNet121" },
  { key: "efficientnet", file: "EfficientNetB3_best.h5", label: "EfficientNetB3" },
];

let cached: { loaded: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 30_000;

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getLoadedModels(): Promise<string[]> {
  if (cached && cached.expiresAt > Date.now()) {
    return cached.loaded;
  }

  const modelsDir = path.join(process.cwd(), "models");
  const results = await Promise.all(
    MODELS.map(async (m) => ({
      label: m.label,
      present: await fileExists(path.join(modelsDir, m.file)),
    })),
  );
  const loaded = results.filter((r) => r.present).map((r) => r.label);

  cached = { loaded, expiresAt: Date.now() + CACHE_TTL_MS };
  return loaded;
}

export async function GET() {
  const loaded = await getLoadedModels();
  const degraded = loaded.length < MODELS.length;
  const offline = loaded.length === 0;

  return Response.json({
    status: offline ? "offline" : degraded ? "degraded" : "ok",
    models_loaded: loaded,
    cors_enabled: false,
    inference: "local",
    message: offline
      ? "No model files detected in models/"
      : degraded
        ? `Partial: ${loaded.length}/${MODELS.length} models loaded`
        : "Local inference ready",
  });
}
