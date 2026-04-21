import { spawn, execFile, type ChildProcessWithoutNullStreams } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdir } from "fs/promises";
import { unlinkSync, readdirSync } from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";

const execFileAsync = promisify(execFile);

export const runtime = "nodejs";

const MODEL_PATHS: Record<string, string> = {
  densenet: path.join(process.cwd(), "models", "DenseNet121_best.h5"),
  efficientnet: path.join(process.cwd(), "models", "EfficientNetB3_best.h5"),
};
const ENSEMBLE_MODEL_KEY = "ensemble" as const;
const ENSEMBLE_MODEL_PATHS = [MODEL_PATHS.densenet, MODEL_PATHS.efficientnet] as const;
const WORKER_SCRIPT_PATH = path.join(process.cwd(), "scripts", "infer_worker.py");
const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const INFERENCE_TIMEOUT_MS = 270_000;
const WORKER_WARMUP_TIMEOUT_MS = 240_000;
const WORKER_IDLE_SHUTDOWN_MS = 120_000;
const PYTHON_DEPENDENCY_CHECK = "import tensorflow, numpy, PIL, h5py";
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const DICOM_MAGIC = Buffer.from([0x44, 0x49, 0x43, 0x4d]); // DICM at offset 128
const DICOM_MAGIC_OFFSET = 128;
const DICOM_FILE_EXTENSIONS = [".dcm", ".dicom"];
const DICOM_MIME_TYPES = ["application/dicom", "application/dicom+json"];
const CLASS_NAMES = ["COVID", "Lung_Opacity", "Normal", "Viral Pneumonia"] as const;
const SHOW_ERROR_DETAIL = process.env.NODE_ENV !== "production";

// ---------------------------------------------------------------------------
// Orphaned temp-file cleanup
// ---------------------------------------------------------------------------
// Tracks temp paths written in this Node process lifetime. On process exit
// (including crashes and SIGINT/SIGTERM), any paths still present are
// synchronously deleted. This covers the gap between writeFile() and the
// unlink() in the finally block when the process exits mid-inference.
// ---------------------------------------------------------------------------
const pendingTmpPaths = new Set<string>();

const cleanupPendingTmpFiles = () => {
  for (const p of pendingTmpPaths) {
    try {
      unlinkSync(p);
    } catch {
      // File may already be deleted – ignore.
    }
  }
  pendingTmpPaths.clear();

  // Also sweep the pulmovision tmp dir for any older orphans from previous
  // process runs that crashed before cleanup could run.
  const tmpDir = path.join(os.tmpdir(), "pulmovision");
  try {
    const entries = readdirSync(tmpDir);
    for (const entry of entries) {
      if (entry.startsWith("pv-")) {
        try {
          unlinkSync(path.join(tmpDir, entry));
        } catch {
          // Ignore races.
        }
      }
    }
  } catch {
    // Dir may not exist yet.
  }
};

// The signal handlers were moved below terminateWorker to avoid TDZ errors

type PredictRouteErrorCode = "timeout" | "cancelled" | "validation" | "server";

type BaseModelKey = keyof typeof MODEL_PATHS;
type ModelKey = BaseModelKey | typeof ENSEMBLE_MODEL_KEY;
type PendingResponse = {
  requestId: string;
  resolve: (line: string) => void;
  reject: (error: Error) => void;
};
type WorkerState = {
  proc: ChildProcessWithoutNullStreams | null;
  starting: Promise<ChildProcessWithoutNullStreams> | null;
  stdoutBuffer: string;
  pendingResponses: Map<string, PendingResponse>;
  writeChain: Promise<void>;
  shutdownHooksAttached: boolean;
  idleShutdownTimer: ReturnType<typeof setTimeout> | null;
};

// Try common Python executable names in order
const PYTHON_CANDIDATES = [
  ...(process.env.PYTHON_PATH ? [process.env.PYTHON_PATH] : []),
  path.join(process.cwd(), ".venv", "Scripts", "python.exe"),
  path.join(process.cwd(), ".venv", "bin", "python"),
  "python3",
  "python",
];

let cachedPython: string | null = null;
let pythonLookupPromise: Promise<string> | null = null;
let workerWarm = false;
let workerWarmupPromise: Promise<void> | null = null;

const globalWorkerState = globalThis as typeof globalThis & {
  __pulmovisionWorkerState?: WorkerState;
};

const workerState: WorkerState =
  globalWorkerState.__pulmovisionWorkerState ??
  (globalWorkerState.__pulmovisionWorkerState = {
    proc: null,
    starting: null,
    stdoutBuffer: "",
    pendingResponses: new Map(),
    writeChain: Promise.resolve(),
    shutdownHooksAttached: false,
    idleShutdownTimer: null,
  });

const isModelKey = (value: string): value is ModelKey =>
  value === ENSEMBLE_MODEL_KEY || Object.prototype.hasOwnProperty.call(MODEL_PATHS, value);

const inferRouteErrorCode = (value: string): PredictRouteErrorCode => {
  const normalized = value.toLowerCase();
  if (normalized.includes("timeout")) {
    return "timeout";
  }
  if (normalized.includes("abort") || normalized.includes("cancel")) {
    return "cancelled";
  }
  if (
    normalized.includes("invalid") ||
    normalized.includes("no_file") ||
    normalized.includes("file_too_large") ||
    normalized.includes("empty_file") ||
    normalized.includes("file_type")
  ) {
    return "validation";
  }
  return "server";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNormalizedScore = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 1;

const getFileExtension = (fileName: string) => {
  const ext = path.extname(fileName || "").toLowerCase();
  return ext.length > 0 ? ext : "";
};

const hasDicomMagic = (buffer: Buffer) =>
  buffer.length >= DICOM_MAGIC_OFFSET + DICOM_MAGIC.length &&
  buffer.subarray(DICOM_MAGIC_OFFSET, DICOM_MAGIC_OFFSET + DICOM_MAGIC.length).equals(DICOM_MAGIC);

const inferUploadKind = (fileType: string, fileName: string): "png" | "jpeg" | "dicom" | null => {
  const normalizedType = fileType.toLowerCase();
  const extension = getFileExtension(fileName);

  if (normalizedType === "image/png") {
    return "png";
  }
  if (normalizedType === "" && extension === ".png") {
    return "png";
  }
  if (normalizedType === "image/jpeg") {
    return "jpeg";
  }
  if (normalizedType === "" && (extension === ".jpg" || extension === ".jpeg")) {
    return "jpeg";
  }

  if (
    DICOM_MIME_TYPES.includes(normalizedType) ||
    (normalizedType === "application/octet-stream" && DICOM_FILE_EXTENSIONS.includes(extension)) ||
    DICOM_FILE_EXTENSIONS.includes(extension) ||
    (normalizedType === "" && DICOM_FILE_EXTENSIONS.includes(extension))
  ) {
    return "dicom";
  }

  return null;
};

const validateConfidencePayload = (value: unknown, context = "confidence"): string | null => {
  if (!isRecord(value)) {
    return `${context} must be an object`;
  }

  for (const className of CLASS_NAMES) {
    if (!isNormalizedScore(value[className])) {
      return `${context}.${className} must be a normalized finite number`;
    }
  }

  return null;
};

const validateTelemetryPayload = (value: unknown): string | null => {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return "telemetry must be an object";
  }

  const keys = ["preprocess_ms", "infer_ms", "gradcam_ms", "ensemble_ms", "total_ms"] as const;
  for (const key of keys) {
    const stageValue = value[key];
    if (stageValue !== undefined && (!isFiniteNumber(stageValue) || stageValue < 0)) {
      return `telemetry.${key} must be a non-negative finite number`;
    }
  }

  return null;
};

const validateReliabilityPayload = (value: unknown): string | null => {
  if (value === undefined) {
    return null;
  }

  if (!isRecord(value)) {
    return "reliability must be an object";
  }

  if (typeof value.degraded !== "boolean") {
    return "reliability.degraded must be boolean";
  }

  if (!Array.isArray(value.flags) || !value.flags.every((flag) => typeof flag === "string")) {
    return "reliability.flags must be a string[]";
  }

  if (!["png", "jpeg", "dicom", "unknown"].includes(String(value.source_image))) {
    return "reliability.source_image must be png|jpeg|dicom|unknown";
  }

  return null;
};

const validateActivationMapPayload = (map: unknown, shape: unknown): string | null => {
  if (!Array.isArray(shape) || shape.length !== 2) {
    return "activation_map_shape must contain two dimensions";
  }

  const rows = shape[0];
  const cols = shape[1];
  if (!Number.isInteger(rows) || !Number.isInteger(cols) || rows <= 0 || cols <= 0) {
    return "activation_map_shape dimensions must be positive integers";
  }

  if (!Array.isArray(map) || map.length !== rows) {
    return "activation_map row count mismatch";
  }

  for (const row of map) {
    if (!Array.isArray(row) || row.length !== cols || !row.every((value) => isNormalizedScore(value))) {
      return "activation_map values must be normalized finite numbers with matching shape";
    }
  }

  return null;
};

const validatePredictResultPayload = (value: unknown): string | null => {
  if (!isRecord(value)) {
    return "inference payload must be an object";
  }

  if (!CLASS_NAMES.includes(value.predicted_class as (typeof CLASS_NAMES)[number])) {
    return "predicted_class is invalid";
  }

  const confidenceError = validateConfidencePayload(value.confidence);
  if (confidenceError) {
    return confidenceError;
  }

  const mapError = validateActivationMapPayload(value.activation_map, value.activation_map_shape);
  if (mapError) {
    return mapError;
  }

  if (value.activation_map_origin !== "top_left") {
    return "activation_map_origin must be top_left";
  }
  if (value.activation_map_encoding !== "normalized_float32") {
    return "activation_map_encoding must be normalized_float32";
  }

  if (typeof value.gradcam_failed !== "boolean") {
    return "gradcam_failed must be boolean";
  }
  if (!isFiniteNumber(value.confidence_sum)) {
    return "confidence_sum must be a finite number";
  }
  if (typeof value.confidence_tolerance_ok !== "boolean") {
    return "confidence_tolerance_ok must be boolean";
  }
  if (typeof value.model !== "string" || value.model.trim().length === 0) {
    return "model must be a non-empty string";
  }

  const telemetryError = validateTelemetryPayload(value.telemetry);
  if (telemetryError) {
    return telemetryError;
  }

  const reliabilityError = validateReliabilityPayload(value.reliability);
  if (reliabilityError) {
    return reliabilityError;
  }

  if (value.ensemble !== undefined) {
    if (!isRecord(value.ensemble)) {
      return "ensemble must be an object";
    }

    if (typeof value.ensemble.method !== "string") {
      return "ensemble.method must be a string";
    }
    if (typeof value.ensemble.degraded !== "boolean") {
      return "ensemble.degraded must be boolean";
    }
    if (typeof value.ensemble.agreement !== "boolean") {
      return "ensemble.agreement must be boolean";
    }
    if (typeof value.ensemble.winning_model !== "string") {
      return "ensemble.winning_model must be a string";
    }

    if (
      !Array.isArray(value.ensemble.failed_models) ||
      !value.ensemble.failed_models.every(
        (entry) => isRecord(entry) && typeof entry.model === "string" && typeof entry.error === "string",
      )
    ) {
      return "ensemble.failed_models must be an array of {model,error}";
    }

    if (!Array.isArray(value.ensemble.individual_predictions)) {
      return "ensemble.individual_predictions must be an array";
    }

    for (const entry of value.ensemble.individual_predictions) {
      if (!isRecord(entry)) {
        return "ensemble.individual_predictions entries must be objects";
      }
      if (typeof entry.model !== "string") {
        return "ensemble individual model must be a string";
      }
      if (!CLASS_NAMES.includes(entry.predicted_class as (typeof CLASS_NAMES)[number])) {
        return "ensemble individual predicted_class is invalid";
      }
      const individualConfidenceError = validateConfidencePayload(entry.confidence, "ensemble_individual.confidence");
      if (individualConfidenceError) {
        return individualConfidenceError;
      }
      if (!isFiniteNumber(entry.confidence_sum)) {
        return "ensemble individual confidence_sum must be a finite number";
      }
      if (typeof entry.gradcam_failed !== "boolean") {
        return "ensemble individual gradcam_failed must be boolean";
      }
      const individualMapShape = entry.activation_map_shape;
      if (
        !Array.isArray(individualMapShape) ||
        individualMapShape.length !== 2 ||
        !Number.isInteger(individualMapShape[0]) ||
        !Number.isInteger(individualMapShape[1]) ||
        individualMapShape[0] <= 0 ||
        individualMapShape[1] <= 0
      ) {
        return "ensemble individual activation_map_shape is invalid";
      }
      if (!isNormalizedScore(entry.weight)) {
        return "ensemble individual weight must be normalized";
      }
      if (!isNormalizedScore(entry.top_confidence)) {
        return "ensemble individual top_confidence must be normalized";
      }
    }
  }

  return null;
};

const clearWorkerIdleShutdown = () => {
  if (workerState.idleShutdownTimer) {
    clearTimeout(workerState.idleShutdownTimer);
    workerState.idleShutdownTimer = null;
  }
};

const scheduleWorkerIdleShutdown = () => {
  clearWorkerIdleShutdown();
  if (workerState.pendingResponses.size > 0 || !workerState.proc) {
    return;
  }

  workerState.idleShutdownTimer = setTimeout(() => {
    if (workerState.pendingResponses.size === 0) {
      terminateWorker("inference_worker_idle_shutdown");
    }
  }, WORKER_IDLE_SHUTDOWN_MS);
};

const rejectPendingResponses = (error: Error) => {
  const entries = Array.from(workerState.pendingResponses.values());
  workerState.pendingResponses.clear();
  for (const pending of entries) {
    pending.reject(error);
  }
};

const terminateWorker = (reason: string) => {
  const proc = workerState.proc;
  workerState.proc = null;
  workerState.starting = null;
  workerState.stdoutBuffer = "";
  workerState.writeChain = Promise.resolve();
  clearWorkerIdleShutdown();
  workerWarm = false;
  workerWarmupPromise = null;
  rejectPendingResponses(new Error(reason));

  if (proc && !proc.killed) {
    try {
      proc.kill();
    } catch {
      // Ignore shutdown races.
    }
  }
};

// Register once per module load. These are synchronous-safe exit hooks.
// NOTE: process.once removes the handler after first fire. We must NOT register
// separate process.once calls for the same signal in attachShutdownHooks and
// this block — only one would fire. Instead this block is the single source of
// truth for all signal cleanup. attachShutdownHooks() only handles 'exit' /
// 'beforeExit' (which do not conflict).
if (!(globalThis as typeof globalThis & { __pvTmpCleanupRegistered?: boolean }).__pvTmpCleanupRegistered) {
  (globalThis as typeof globalThis & { __pvTmpCleanupRegistered?: boolean }).__pvTmpCleanupRegistered = true;

  process.once("exit", cleanupPendingTmpFiles);

  // SIGINT / SIGTERM: run both worker termination AND tmp file cleanup, then
  // exit. Using a single handler per signal avoids the process.once conflict.
  const signalHandler = (signal: string) => {
    terminateWorker(`inference_worker_shutdown_${signal}`);
    cleanupPendingTmpFiles();
    process.exit(0);
  };
  process.once("SIGINT", () => signalHandler("SIGINT"));
  process.once("SIGTERM", () => signalHandler("SIGTERM"));
}

const handleWorkerStdout = (chunk: string) => {
  workerState.stdoutBuffer += chunk;

  while (true) {
    const newlineIndex = workerState.stdoutBuffer.indexOf("\n");
    if (newlineIndex === -1) {
      break;
    }

    const line = workerState.stdoutBuffer.slice(0, newlineIndex).trim();
    workerState.stdoutBuffer = workerState.stdoutBuffer.slice(newlineIndex + 1);

    if (!line) {
      continue;
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      const maybe = JSON.parse(line);
      if (maybe && typeof maybe === "object" && !Array.isArray(maybe)) {
        parsed = maybe as Record<string, unknown>;
      }
    } catch {
      parsed = null;
    }

    const responseId = parsed && typeof parsed.request_id === "string"
      ? (parsed.request_id as string)
      : null;

    let pending: PendingResponse | undefined;
    if (responseId && workerState.pendingResponses.has(responseId)) {
      pending = workerState.pendingResponses.get(responseId);
      workerState.pendingResponses.delete(responseId);
    }

    if (!pending) {
      // No matching pending request. This is a stale response from a request
      // that was cancelled (aborted) while Python was still computing it.
      // Discard it silently — the next legitimate response will carry its own
      // request_id and will be matched correctly.
      if (responseId) {
        console.info("[predict] discarding stale worker response for cancelled request:", responseId);
      } else {
        console.warn("[predict] received worker output with no request_id, discarding");
      }
      continue;
    }

    pending.resolve(line);
  }
};

const writeLineToWorker = (
  proc: ChildProcessWithoutNullStreams,
  payload: string,
): Promise<void> => {
  const next = workerState.writeChain.then(
    () =>
      new Promise<void>((resolve, reject) => {
        proc.stdin.write(`${payload}\n`, (err) => {
          if (err) reject(err);
          else resolve();
        });
      }),
  );
  // Swallow rejection on the chain so one failure doesn't poison later writes.
  workerState.writeChain = next.catch(() => {});
  return next;
};

const attachShutdownHooks = () => {
  if (workerState.shutdownHooksAttached) {
    return;
  }

  workerState.shutdownHooksAttached = true;

  const shutdown = () => {
    terminateWorker("inference_worker_shutdown");
  };

  // Only register beforeExit and exit here. SIGINT / SIGTERM are handled by
  // the module-level unified signal handler above (which also calls
  // terminateWorker) to avoid process.once conflicts.
  process.once("beforeExit", shutdown);
  process.once("exit", shutdown);
};

async function findPython(): Promise<string> {
  if (cachedPython) {
    return cachedPython;
  }

  if (pythonLookupPromise) {
    return pythonLookupPromise;
  }

  pythonLookupPromise = (async () => {
    for (const candidate of PYTHON_CANDIDATES) {
      try {
        await execFileAsync(candidate, ["--version"]);
        await execFileAsync(candidate, ["-c", PYTHON_DEPENDENCY_CHECK]);
        cachedPython = candidate;
        return candidate;
      } catch {
        continue;
      }
    }
    throw new Error("No Python executable with required inference dependencies found");
  })();

  try {
    return await pythonLookupPromise;
  } finally {
    pythonLookupPromise = null;
  }
}

async function ensureWorker(python: string): Promise<ChildProcessWithoutNullStreams> {
  const existing = workerState.proc;
  if (existing && !existing.killed) {
    console.info("[predict] reusing inference worker process");
    clearWorkerIdleShutdown();
    return existing;
  }

  if (workerState.starting) {
    return workerState.starting;
  }

  workerState.starting = new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      TF_ENABLE_ONEDNN_OPTS: "0",
      TF_CPP_MIN_LOG_LEVEL: "3",
    };

    const proc = spawn(python, ["-u", WORKER_SCRIPT_PATH], { env, stdio: ["pipe", "pipe", "pipe"] });
    console.info("[predict] spawned inference worker process");

    let settled = false;

    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve(proc);
    };

    const rejectOnce = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    proc.stdout.on("data", (d: Buffer) => {
      handleWorkerStdout(d.toString());
    });

    proc.stderr.on("data", (d: Buffer) => {
      const message = d.toString().trim();
      if (message) {
        console.warn("[predict:worker]", message);
      }
    });

    proc.on("error", (err) => {
      terminateWorker(`inference_worker_error: ${err.message}`);
      rejectOnce(err);
    });

    proc.on("exit", (code, signal) => {
      const reason = `inference_worker_exited_${code ?? "null"}${signal ? `_${signal}` : ""}`;
      terminateWorker(reason);
      rejectOnce(new Error(reason));
    });

    workerState.proc = proc;
    clearWorkerIdleShutdown();
    attachShutdownHooks();
    
    // Defer resolving until python has had a chance to start processing
    setTimeout(() => resolveOnce(), 500);
  });

  try {
    return await workerState.starting;
  } finally {
    workerState.starting = null;
  }
}

function runWorkerCommand(
  python: string,
  payload: Record<string, unknown>,
  timeoutMs: number,
  timeoutMessage: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  return new Promise((resolve, reject) => {
    clearWorkerIdleShutdown();
    const requestId = crypto.randomUUID();
    let settled = false;

    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const finish = () => {
      clearTimeout(timeoutHandle);
      abortSignal?.removeEventListener("abort", onAbort);
      workerState.pendingResponses.delete(requestId);
      if (workerState.pendingResponses.size === 0) {
        scheduleWorkerIdleShutdown();
      }
    };

    const settleResolve = (line: string) => {
      settle(() => {
        finish();
        resolve(line);
      });
    };

    const settleReject = (error: Error) => {
      settle(() => {
        finish();
        reject(error);
      });
    };

    const onAbort = () => {
      settleReject(new Error("inference_aborted"));
      // Do NOT call terminateWorker here. Killing the worker process on every
      // request cancellation (e.g. navigating away from /processing) would
      // destroy the Python MODEL_CACHE and reset workerWarm, forcing a full
      // model reload (~30-60s) on every subsequent run.
      // The Python worker is a sequential stdin-loop; it will simply process
      // the next request once the current one finishes on its side. The result
      // emitted by Python for the abandoned request is safely discarded because
      // its requestId will no longer be in pendingResponses.
    };

    const timeoutHandle = setTimeout(() => {
      settleReject(new Error(timeoutMessage));
      terminateWorker("inference_worker_timeout");
    }, timeoutMs);

    if (abortSignal?.aborted) {
      onAbort();
      return;
    }

    abortSignal?.addEventListener("abort", onAbort, { once: true });

    const pending: PendingResponse = {
      requestId,
      resolve: settleResolve,
      reject: settleReject,
    };
    workerState.pendingResponses.set(requestId, pending);

    ensureWorker(python)
      .then((proc) => {
        const line = JSON.stringify({ ...payload, request_id: requestId });
        return writeLineToWorker(proc, line);
      })
      .catch((err: unknown) => {
        workerState.pendingResponses.delete(requestId);
        const message = err instanceof Error ? err.message : String(err);
        settleReject(new Error(`inference_worker_write_failed: ${message}`));
        if (err instanceof Error && err.message.includes("write")) {
          terminateWorker("inference_worker_write_failed");
        }
      });
  });
}

async function warmWorkerModels(python: string): Promise<void> {
  const line = await runWorkerCommand(
    python,
    { command: "warmup", model_paths: Object.values(MODEL_PATHS) },
    WORKER_WARMUP_TIMEOUT_MS,
    `inference_worker_warmup_timeout_after_${WORKER_WARMUP_TIMEOUT_MS}ms`,
  );

  let payload: { ok?: boolean; error?: string; warmed_models?: string[] };
  try {
    payload = JSON.parse(line);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`inference_worker_warmup_invalid_response: ${message}`);
  }

  if (payload.error) {
    terminateWorker("inference_worker_warmup_failed");
    throw new Error(`inference_worker_warmup_failed: ${payload.error}`);
  }

  const warmedModels = Array.isArray(payload.warmed_models) ? payload.warmed_models : [];

  if (warmedModels.length === 0) {
    terminateWorker("inference_worker_warmup_failed");
    throw new Error("inference_worker_warmup_failed: no models warmed");
  }

  if (!payload.ok) {
    console.warn(`[predict] Partial warmup failure: some models failed to cache. Warmed: ${warmedModels.join(", ")}`);
  }

  const warmedModelsStr = warmedModels.join(", ") || "unknown";
  console.info(`[predict] worker warmup complete (${warmedModelsStr})`);
}

async function ensureWorkerWarm(python: string): Promise<void> {
  if (workerWarm) {
    return;
  }

  if (workerWarmupPromise) {
    return workerWarmupPromise;
  }

  workerWarmupPromise = warmWorkerModels(python)
    .then(() => {
      workerWarm = true;
    })
    .finally(() => {
      workerWarmupPromise = null;
    });

  return workerWarmupPromise;
}

function runInference(
  python: string,
  modelPath: string,
  imagePath: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  return runWorkerCommand(
    python,
    { model_path: modelPath, image_path: imagePath, timeout_ms: INFERENCE_TIMEOUT_MS },
    INFERENCE_TIMEOUT_MS,
    `infer_worker timeout after ${INFERENCE_TIMEOUT_MS}ms`,
    abortSignal,
  );
}

function runEnsembleInference(
  python: string,
  modelPaths: string[],
  imagePath: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  return runWorkerCommand(
    python,
    { command: "ensemble", model_paths: modelPaths, image_path: imagePath, timeout_ms: INFERENCE_TIMEOUT_MS },
    INFERENCE_TIMEOUT_MS,
    `infer_worker timeout after ${INFERENCE_TIMEOUT_MS}ms`,
    abortSignal,
  );
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const requestStartedAt = Date.now();

  const logRequest = (event: string, details?: Record<string, unknown>) => {
    const elapsedMs = Date.now() - requestStartedAt;
    if (details) {
      console.info(`[predict:${requestId}] ${event}`, { elapsed_ms: elapsedMs, ...details });
      return;
    }
    console.info(`[predict:${requestId}] ${event} elapsed_ms=${elapsedMs}`);
  };

  const errorResponse = (
    error: string,
    status: number,
    code: PredictRouteErrorCode,
    detail?: string,
  ) => {
    const payload: Record<string, unknown> = {
      error,
      code,
      request_id: requestId,
    };

    if (detail && SHOW_ERROR_DETAIL) {
      payload.detail = detail;
    }

    logRequest("response_error", {
      status,
      error,
      code,
      detail: detail ?? null,
    });

    return Response.json(payload, { status });
  };

  logRequest("request_received");

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch (err: unknown) {
    const detail = err instanceof Error ? err.message : String(err);
    console.warn("[predict] invalid multipart request body:", detail);
    return errorResponse("invalid_form_data", 400, "validation", detail);
  }

  const fileEntry = formData.get("file");
  const modelValue = formData.get("model");

  if (typeof modelValue !== "string" || !isModelKey(modelValue)) {
    return errorResponse("invalid_model", 400, "validation");
  }

  const isEnsemble = modelValue === ENSEMBLE_MODEL_KEY;
  const modelPath = isEnsemble ? null : MODEL_PATHS[modelValue];

  if (!(fileEntry instanceof File)) {
    return errorResponse("no_file", 400, "validation");
  }

  const file = fileEntry;
  const uploadKind = inferUploadKind(file.type, file.name);
  const fileExtension = getFileExtension(file.name);

  if (!uploadKind) {
    return errorResponse("invalid_file_type", 400, "validation");
  }

  logRequest("request_validated", {
    model: modelValue,
    ensemble: isEnsemble,
    file_bytes: file.size,
    file_type: file.type,
    file_name: file.name,
    upload_kind: uploadKind,
  });

  if (file.size === 0) {
    return errorResponse("empty_file", 400, "validation");
  }

  if (file.size > MAX_UPLOAD_SIZE_BYTES) {
    const detail = `limit_bytes=${MAX_UPLOAD_SIZE_BYTES}`;
    return errorResponse("file_too_large", 413, "validation", detail);
  }

  const ext = uploadKind === "png" ? ".png" : uploadKind === "jpeg" ? ".jpg" : ".dcm";
  const tmpName = `pv-${crypto.randomUUID()}${ext}`;
  const tmpDir = path.join(os.tmpdir(), "pulmovision");
  const tmpPath = path.join(tmpDir, tmpName);

  try {
    await mkdir(tmpDir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());

    const isPng = uploadKind === "png" && buffer.length >= PNG_MAGIC.length &&
      buffer.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC);
    const isJpeg = uploadKind === "jpeg" && buffer.length >= JPEG_MAGIC.length &&
      buffer.subarray(0, JPEG_MAGIC.length).equals(JPEG_MAGIC);
    const isDicom =
      uploadKind === "dicom" &&
      (
        hasDicomMagic(buffer) ||
        (DICOM_FILE_EXTENSIONS.includes(fileExtension) && buffer.length > 1024)
      );

    if (!isPng && !isJpeg && !isDicom) {
      return errorResponse("invalid_file_type", 400, "validation", "content_mismatch");
    }

    await writeFile(tmpPath, buffer);
    // Register this path for crash-safe cleanup. Removed in the finally block
    // once the normal unlink() has run.
    pendingTmpPaths.add(tmpPath);
    logRequest("temp_file_ready", { tmp_path: tmpPath });

    const python = await findPython();
    logRequest("python_ready", { python });
    await ensureWorkerWarm(python);
    logRequest("worker_warm_ready");

    const inferenceStartedAt = Date.now();
    const raw = isEnsemble
      ? await runEnsembleInference(python, [...ENSEMBLE_MODEL_PATHS], tmpPath, request.signal)
      : await runInference(python, modelPath as string, tmpPath, request.signal);
    logRequest("inference_complete", { inference_ms: Date.now() - inferenceStartedAt });

    let result: Record<string, unknown>;
    try {
      result = JSON.parse(raw);
    } catch {
      console.error("[predict] infer.py returned invalid JSON:", raw.slice(0, 400));
      return errorResponse("inference_invalid_response", 500, "server");
    }

    if (result.error) {
      const workerError = typeof result.error === "string" ? result.error : "inference_worker_error";
      return errorResponse(workerError, 500, inferRouteErrorCode(workerError));
    }

    const requiredKeys = [
      "predicted_class",
      "confidence",
      "activation_map",
      "activation_map_shape",
      "activation_map_origin",
      "activation_map_encoding",
      "confidence_tolerance_ok",
      "confidence_sum",
      "gradcam_failed",
      "model",
    ] as const;

    const missingKeys = requiredKeys.filter((key) => !(key in result));
    if (missingKeys.length > 0) {
      console.error("[predict] infer.py response missing keys:", missingKeys.join(", "));
      return errorResponse("inference_incomplete_response", 500, "server");
    }

    const payloadError = validatePredictResultPayload(result);
    if (payloadError) {
      console.error("[predict] infer.py response failed validation:", payloadError);
      return errorResponse("inference_invalid_response", 500, "server", payloadError);
    }

    const telemetry = isRecord(result.telemetry) ? result.telemetry : null;
    const reliability = isRecord(result.reliability) ? result.reliability : null;

    if (typeof telemetry?.total_ms === "number" && telemetry.total_ms > 180_000) {
      console.warn(`[predict:${requestId}] performance_budget_exceeded`, {
        total_ms: telemetry.total_ms,
        budget_ms: 180_000,
      });
    }

    logRequest("response_ok", {
      status: 200,
      activation_map_rows: Array.isArray(result.activation_map) ? result.activation_map.length : null,
      model: result.model,
      telemetry_total_ms: telemetry?.total_ms ?? null,
      telemetry_preprocess_ms: telemetry?.preprocess_ms ?? null,
      telemetry_infer_ms: telemetry?.infer_ms ?? null,
      telemetry_gradcam_ms: telemetry?.gradcam_ms ?? null,
      telemetry_ensemble_ms: telemetry?.ensemble_ms ?? null,
      reliability_degraded: reliability?.degraded ?? null,
    });
    return Response.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "inference_aborted") {
      return errorResponse("inference_aborted", 499, "cancelled");
    }
    console.error("[predict] error:", message);
    return errorResponse("inference_failed", 500, inferRouteErrorCode(message), message);
  } finally {
    // Always remove from the crash-safe set first — the normal unlink below
    // is the primary cleanup path.
    pendingTmpPaths.delete(tmpPath);
    try {
      await unlink(tmpPath);
    } catch (cleanupErr) {
      const cleanupMessage = cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr);
      console.warn("[predict] temp cleanup failed:", cleanupMessage);
    }
  }
}
