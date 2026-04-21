# PulmoVision Frontend

PulmoVision is a Next.js App Router application for chest X-ray analysis with explainability overlays, 3D visualization, multi-model inference (including ensemble mode), and in-browser clinical PDF report export.

This repository includes:
- full user flow from landing to results,
- local inference proxy routes (`/api/health`, `/api/predict`),
- Python worker orchestration with warm cache,
- single-model and ensemble inference support,
- polished results UI with model-voting transparency,
- themed PDF clinical report generation with placeholders.

## Table Of Contents

- [Key Features](#key-features)
- [Product Flow](#product-flow)
- [Architecture Overview](#architecture-overview)
- [Inference Pipeline (Detailed)](#inference-pipeline-detailed)
- [Prediction Modes](#prediction-modes)
- [API Contract](#api-contract)
- [PDF Clinical Report Export](#pdf-clinical-report-export)
- [Project Structure](#project-structure)
- [Local Setup](#local-setup)
- [Validation Commands](#validation-commands)
- [Troubleshooting](#troubleshooting)
- [Known Limitations](#known-limitations)

### Key Features
 
PulmoVision integrates several advanced clinical imaging capabilities:
 
- **Cinematic "Medical Console" UI**: A clinical-grade aesthetic with hardware-style tactile controls, emerald diagnostic palettes, and monospaced telemetry fonts.
- **Volumetric Parenchyma Rendering**: GPU-optimized 3D tissue shader that authentically mimics the natural translucent mist of lung parenchyma without visual leaking.
- **Interactive Tomography Slicing**: High-precision CT Slice Mode with an animated depth gauge, using hardware-accelerated pointer events for sub-millisecond examination of internal lung structures.
- **Continuous Inference Telemetry**: Real-time, terminal-style readouts for processing transparency and inference pipeline observability.
- **Persistent 3D Context**: Retained WebGL scene preventing memory leaks, preserving camera state across views, and optimized for high-DPI displays.
- **DICOM Intake**: Full upload support for `.dcm`/`.dicom` studies in addition to standard PNG/JPEG formats.
- **Reliability Metadata**: Automated detection of degraded flags, input source type verification, and clinical quality notes.
- **Export Context**: Professional PDF report generation with embedded 3D snapshots and comprehensive session metadata.
- **Codebase Integrity**: Strict TypeScript implementation with verified end-to-end type safety and optimized asset delivery.

## Product Flow

1. `/` Landing page.
2. `/disclaimer` Required disclosure step.
3. `/upload` Scan upload + model selection.
4. `/processing` Inference progress and retries.
5. `/results` Explainable output with multiple views and report export.

## Architecture Overview

### Frontend stack

- Next.js 14 App Router
- React + TypeScript
- Tailwind + modular CSS
- Framer Motion + Three.js
- Zustand for in-memory session state

### Backend bridge (same repo)

- `app/api/health/route.ts` exposes local model availability.
- `app/api/predict/route.ts` handles upload and delegates to Python worker.
- `scripts/infer_worker.py` runs persistent model inference with cache.
- `scripts/infer.py` provides model build/preprocess/Grad-CAM helpers.

### Why this design

It keeps browser UX fast while still supporting Python/TensorFlow locally:
- no browser-side ML runtime burden,
- controlled inference process lifecycle,
- stable API contracts for UI rendering,
- clean fallback behavior for failures.

## Inference Pipeline (Detailed)

1. User uploads image on `/upload`.
2. Client posts `multipart/form-data` to `POST /api/predict` with:
   - `file`
   - `model` (`densenet`, `efficientnet`, `ensemble`)
3. Route validates model, file type, file size, and writes temp file.
4. Route resolves Python executable (including `.venv` candidates).
5. Route ensures persistent worker is alive and warm.
6. Worker executes:
   - single model inference, or
   - ensemble command (runs both models and fuses scores).
7. Route parses worker JSON, validates required keys, and returns payload.
8. Client validates payload shape and renders `/results`.

### Warm worker behavior

- Worker is reused across requests while server process is alive.
- Warmup preloads both model bundles.
- This reduces repeat-scan cold-start penalties.

### Structured error payloads

`/api/predict` returns structured failures with fields such as:
- `error`
- `code` (`timeout`, `cancelled`, `validation`, `server`)
- `request_id`
- optional `detail`

Client maps these into user-facing messages instead of generic timeout wording.

## Prediction Modes

### 1) DenseNet121

- Fastest path.
- Good for quick turnaround.

### 2) EfficientNetB3

- Higher-detail path.
- Usually similar latency or slightly heavier depending on runtime.

### 3) Ensemble (new)

- Runs both models.
- Uses weighted soft-voting fusion.
- Returns consensus prediction and metadata under `ensemble`.

Ensemble metadata includes:
- method,
- agreement flag,
- degraded flag,
- winning model,
- per-model predictions,
- per-model weights and top confidence,
- failed model list (if any).

### Ensemble fallback behavior

If one model fails:
- result can degrade to surviving model,
- `ensemble.degraded = true`,
- failed model reason is retained and shown in UI/report.

## API Contract

## `GET /api/health`

Sample response:

```json
{
  "status": "ok",
  "models_loaded": ["DenseNet121", "EfficientNetB3"],
  "cors_enabled": false,
  "inference": "local",
  "message": "Local inference ready"
}
```

`status` can be `offline` when no model files are found, `degraded` when only partial model availability exists, and `ok` when inference is ready.

## `POST /api/predict`

Form fields:
- `file`: PNG/JPEG/DICOM
- `model`: `densenet` | `efficientnet` | `ensemble`

### Shared success fields

```json
{
  "predicted_class": "COVID",
  "confidence": {
    "COVID": 0.9,
    "Lung_Opacity": 0.05,
    "Normal": 0.03,
    "Viral Pneumonia": 0.02
  },
  "activation_map": [[0.0, 0.2]],
  "activation_map_shape": [10, 10],
  "activation_map_origin": "top_left",
  "activation_map_encoding": "normalized_float32",
  "gradcam_failed": false,
  "confidence_sum": 1.0,
  "confidence_tolerance_ok": true,
  "model": "...",
  "telemetry": {
    "preprocess_ms": 18.3,
    "infer_ms": 52.7,
    "gradcam_ms": 104.5,
    "total_ms": 180.5
  },
  "reliability": {
    "degraded": false,
    "flags": [],
    "source_image": "png"
  }
}
```

### Ensemble-only success field

```json
{
  "ensemble": {
    "method": "weighted_soft_vote_top_confidence",
    "degraded": false,
    "agreement": true,
    "winning_model": "DenseNet121_best.h5",
    "failed_models": [],
    "individual_predictions": [
      {
        "model": "DenseNet121_best.h5",
        "predicted_class": "COVID",
        "confidence": { "COVID": 0.99, "Lung_Opacity": 0.01, "Normal": 0.0, "Viral Pneumonia": 0.0 },
        "confidence_sum": 1.0,
        "gradcam_failed": false,
        "activation_map_shape": [7, 7],
        "weight": 0.50,
        "top_confidence": 0.99
      }
    ]
  }
}
```

### Failure payload

```json
{
  "error": "inference_failed",
  "code": "server",
  "request_id": "...",
  "detail": "..."
}
```

## PDF Clinical Report Export

`/results` provides `Generate Clinical Report PDF`.

Implementation:
- utility: `lib/report-pdf.ts`
- trigger: `components/results/ResultsScreen.tsx`
- libraries: `jspdf`, `jspdf-autotable`

### PDF contents

The exported report includes:
- branded PulmoVision header/theme,
- patient/study placeholders,
- result summary and confidence interpretation,
- condition probability table,
- model metadata,
- reliability notes,
- export context metadata (view mode, threshold, active regions, timeout state),
- embedded 3D snapshot card when available,
- scope and limitations,
- clinical template placeholders (impression/recommendation sections),
- ensemble sections (if mode is ensemble):
  - method/agreement/degraded/winning model,
  - per-model contribution table,
  - failed model table (when present).

### UX behavior

- Button shows loading text while generating.
- Export failure surfaces visible error chip.
- Successful generation updates completion state.

## Project Structure

### App routes

- `app/page.tsx`
- `app/disclaimer/page.tsx`
- `app/upload/page.tsx`
- `app/processing/page.tsx`
- `app/results/page.tsx`
- `app/results/results-page-client.tsx`
- `app/api/health/route.ts`
- `app/api/predict/route.ts`

### Key components

- `components/sections/*` (landing/disclaimer/upload/processing)
- `components/results/*` (results UI, controls, views)
- `components/visualization/*` (lung/heatmap visuals)

### Shared logic

- `lib/api.ts` (request + response validation)
- `lib/types.ts` (contract types, including ensemble)
- `lib/session-store.ts` (upload/model/prediction state)
- `lib/report-pdf.ts` (PDF report generator)

### Python inference

- `scripts/infer.py` (model + Grad-CAM primitives)
- `scripts/infer_worker.py` (persistent worker + ensemble fusion)
- `models/*.h5` (local model artifacts)

## Local Setup

## Prerequisites

- Node.js 18+
- npm
- Python environment with required inference dependencies
- model files:
  - `models/DenseNet121_best.h5`
  - `models/EfficientNetB3_best.h5`

## Environment

Use `.env.local` (see `.env.local.example`), especially if Python path needs override:

- `PYTHON_PATH` (optional)

## Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Production build

```bash
npm run build
npm run start
```

## Validation Commands

```bash
npm run typecheck
npm run build
```

## Troubleshooting

## Windows `EPERM ... .next\trace`

If build fails with locked `.next\trace`:

```powershell
Stop-Process -Name node -Force -ErrorAction SilentlyContinue
npm run build
```

## `No Python executable with required inference dependencies found`

- Activate project virtual environment.
- Set `PYTHON_PATH` in `.env.local` to the correct interpreter.
- Ensure TensorFlow, NumPy, PIL, and h5py are installed.

## `/api/health` returns `degraded`

- Verify model files exist under `models/`.

## Ensemble appears slower

- Expected: ensemble runs two inference passes.
- Use single model mode when lower latency is more important than consensus.

## PDF export button does not download

- Confirm browser allows downloads.
- Check console for blocked blob URL behavior.
- Retry from a stable result payload (supported activation map + confidence fields).

## Known Limitations

- This is a research prototype, not a diagnostic medical device.
- Model scope is limited to four trained classes:
  - COVID
  - Lung Opacity
  - Normal
  - Viral Pneumonia
- Native Windows TensorFlow GPU behavior may be limited depending on TensorFlow version/runtime.
