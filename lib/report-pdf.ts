import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { CLASS_DISPLAY, MODEL_LIMITATIONS, RESULTS_SCOPE_NOTE } from "@/lib/classMap";
import { interpretConfidence } from "@/lib/confidence";
import type { PredictResponse } from "@/lib/types";
import { formatModelName } from "@/lib/utils";

type ReportExportOptions = {
  result: PredictResponse;
  imageSrc?: string | null;
  threeSnapshotSrc?: string | null;
  context?: {
    view_mode?: string;
    zoom?: number;
    overlay_opacity?: number;
    threshold?: number;
    active_regions?: number;
    three_unavailable?: boolean;
  };
  reliabilityNotes?: string[];
  generatedAt?: Date;
};

type JsPdfWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

const M = 34; // page margin

// ── Theme palette (site-matched RGB tuples) ───────────────────────────────────
const T = {
  bg:          [ 10,  14,  12] as [number, number, number],
  bgDeep:      [  6,  10,   8] as [number, number, number],
  surface1:    [ 14,  26,  20] as [number, number, number],
  surface2:    [ 18,  32,  26] as [number, number, number],
  surface3:    [ 24,  40,  32] as [number, number, number],
  emerald:     [ 16, 185, 129] as [number, number, number],
  emeraldMid:  [ 12, 150, 100] as [number, number, number],
  emeraldDark: [  8,  80,  60] as [number, number, number],
  textPri:     [245, 245, 244] as [number, number, number],
  textSec:     [193, 209, 201] as [number, number, number],
  textTert:    [107, 122, 116] as [number, number, number],
  green:       [ 52, 211, 153] as [number, number, number],
  amber:       [251, 191,  36] as [number, number, number],
  border:      [ 30,  58,  50] as [number, number, number],
  warnHead:    [ 70,  50,  10] as [number, number, number],
  warnBody:    [ 32,  24,   8] as [number, number, number],
  warnText:    [253, 224, 138] as [number, number, number],
};

// ── Tiny helpers ──────────────────────────────────────────────────────────────
const sf  = (doc: jsPDF, c: [number, number, number]) => doc.setFillColor(c[0], c[1], c[2]);
const ss  = (doc: jsPDF, c: [number, number, number]) => doc.setDrawColor(c[0], c[1], c[2]);
const st  = (doc: jsPDF, c: [number, number, number]) => doc.setTextColor(c[0], c[1], c[2]);

const fillPage = (doc: jsPDF) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  sf(doc, T.bg);
  doc.rect(0, 0, w, h, "F");
};

const pct = (v: number, d = 1) =>
  `${(Math.max(0, Math.min(1, v)) * 100).toFixed(d)}%`;

const toDataUrl = async (src: string): Promise<string | null> => {
  if (!src) return null;
  if (src.startsWith("data:")) return src;

  // Blob URLs (from URL.createObjectURL) must go through canvas — fetch cache options
  // are not supported for blob scheme and can silently fail in some browsers.
  if (src.startsWith("blob:")) {
    return new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const MAX = 1024;
          const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width  = Math.round(img.naturalWidth  * scale);
          canvas.height = Math.round(img.naturalHeight * scale);
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.crossOrigin = "anonymous";
      img.src = src;
    });
  }

  try {
    const r = await fetch(src, { cache: "no-store" });
    if (!r.ok) return null;
    const blob = await r.blob();
    return await new Promise<string>((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result));
      fr.onerror = () => rej(fr.error);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
};

// ── Header (every page) ───────────────────────────────────────────────────────
const drawHeader = (doc: jsPDF, date: Date, id: string) => {
  const w = doc.internal.pageSize.getWidth();

  sf(doc, T.surface1);
  doc.rect(0, 0, w, 40, "F");

  ss(doc, T.emerald);
  doc.setLineWidth(0.6);
  doc.line(0, 40, w, 40);

  st(doc, T.emerald);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("PulmoVision", M, 26);

  st(doc, T.textTert);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `${date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}   ${id}`,
    w - M, 26, { align: "right" }
  );
};

// ── Footer (every page) ───────────────────────────────────────────────────────
const drawFooter = (doc: jsPDF, page: number, total: number, metadata?: string) => {
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  ss(doc, T.border);
  doc.setLineWidth(0.5);
  doc.line(M, h - 26, w - M, h - 26);

  st(doc, T.textTert);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("PulmoVision - research prototype, not a clinical diagnostic tool", M, h - 14);
  doc.text(`${page} / ${total}`, w - M, h - 14, { align: "right" });
  if (metadata) {
    doc.setFontSize(6.8);
    doc.text(metadata, M, h - 5);
  }
};

// ── Dark card with cyan top accent line ───────────────────────────────────────
const card = (doc: jsPDF, x: number, y: number, w: number, h: number, label: string) => {
  sf(doc, T.surface2);
  ss(doc, T.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(x, y, w, h, 8, 8, "FD");

  ss(doc, T.emerald);
  doc.setLineWidth(1.8);
  doc.line(x + 8, y + 0.9, x + w - 8, y + 0.9);

  st(doc, T.emerald);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(label, x + 14, y + 15);
};

// ── Confidence bar ────────────────────────────────────────────────────────────
const bar = (
  doc: jsPDF, x: number, y: number, totalW: number, bh: number,
  value: number, color: [number, number, number]
) => {
  sf(doc, T.surface3);
  doc.roundedRect(x, y, totalW, bh, bh / 2, bh / 2, "F");
  const rawFill = totalW * Math.max(0, Math.min(1, value));
  if (rawFill <= 0) return;
  const fill = Math.max(bh, rawFill);
  sf(doc, color);
  doc.roundedRect(x, y, fill, bh, bh / 2, bh / 2, "F");
};

const wrapped = (
  doc: jsPDF, text: string, x: number, y: number, maxW: number, lh = 12
) => {
  const lines = doc.splitTextToSize(text, maxW) as string[];
  doc.text(lines, x, y);
  return y + lines.length * lh;
};

// ── Corner marks ──────────────────────────────────────────────────────────────
const corners = (doc: jsPDF, x: number, y: number, w: number, h: number, len = 12) => {
  ss(doc, T.emerald);
  doc.setLineWidth(1.5);
  const pad = 5;
  const x0 = x - pad, y0 = y - pad, x1 = x + w + pad, y1 = y + h + pad;
  doc.line(x0, y0, x0 + len, y0);   doc.line(x0, y0, x0, y0 + len);
  doc.line(x1, y0, x1 - len, y0);   doc.line(x1, y0, x1, y0 + len);
  doc.line(x0, y1, x0 + len, y1);   doc.line(x0, y1, x0, y1 - len);
  doc.line(x1, y1, x1 - len, y1);   doc.line(x1, y1, x1, y1 - len);
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export const exportClinicalReportPdf = async ({
  result,
  imageSrc,
  threeSnapshotSrc,
  context,
  reliabilityNotes,
  generatedAt = new Date(),
}: ReportExportOptions) => {
  const doc  = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const pdoc = doc as JsPdfWithAutoTable;
  const PW   = doc.internal.pageSize.getWidth();   // 595
  const PH   = doc.internal.pageSize.getHeight();  // 842
  const CW   = PW - M * 2;                         // content width

  const reportId  = `PV-${generatedAt.getTime().toString().slice(-8)}`;
  const mapped    = CLASS_DISPLAY[result.predicted_class];
  const conf      = Math.max(0, Math.min(1, result.confidence[result.predicted_class] ?? 0));
  const interp    = interpretConfidence(conf);
  const isHealthy = result.predicted_class === "Normal";

  const reliabilityLines = reliabilityNotes && reliabilityNotes.length > 0
    ? reliabilityNotes
    : [
        result.gradcam_failed
          ? "Grad-CAM fallback map was used - attention region is approximate."
          : "Grad-CAM generated directly from model attention weights.",
        result.confidence_tolerance_ok
          ? "Confidence distribution passed tolerance checks."
          : `Confidence distribution drift detected (sum: ${result.confidence_sum.toFixed(4)}).`,
      ];

  const imgData = imageSrc ? await toDataUrl(imageSrc) : null;
  const threeSnapshotData = threeSnapshotSrc ? await toDataUrl(threeSnapshotSrc) : null;

  // ── Helper: new page ────────────────────────────────────────────────────────
  let y = 58;
  const newPage = () => {
    doc.addPage();
    fillPage(doc);
    drawHeader(doc, generatedAt, reportId);
    y = 58;
  };
  const need = (h: number) => { if (y + h > PH - 40) newPage(); };

  // ── PAGE 1 SETUP ────────────────────────────────────────────────────────────
  fillPage(doc);
  drawHeader(doc, generatedAt, reportId);

  // ── REPORT HERO ────────────────────────────────────────────────────────────
  const heroH = 260;
  need(heroH);
  card(doc, M, y, CW, heroH, "REPORT SUMMARY");

  const heroPad = 16;
  const heroImgSz = 216;
  const heroImgX = M + heroPad;
  const heroImgY = y + 30;
  const heroTextX = heroImgX + heroImgSz + 24;
  const heroTextW = CW - heroImgSz - heroPad * 3;

  if (imgData) {
    try {
      ss(doc, T.emeraldMid);
      doc.setLineWidth(1.2);
      doc.roundedRect(heroImgX - 8, heroImgY - 8, heroImgSz + 16, heroImgSz + 16, 14, 14, "S");
      sf(doc, T.bgDeep);
      doc.roundedRect(heroImgX - 4, heroImgY - 4, heroImgSz + 8, heroImgSz + 8, 12, 12, "F");
      const fmt = imgData.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(imgData, fmt, heroImgX, heroImgY, heroImgSz, heroImgSz);
      corners(doc, heroImgX, heroImgY, heroImgSz, heroImgSz);
    } catch {
      sf(doc, T.surface1);
      ss(doc, T.border);
      doc.setLineWidth(0.5);
      doc.roundedRect(heroImgX, heroImgY, heroImgSz, heroImgSz, 12, 12, "FD");
      st(doc, T.textTert);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("Scan preview unavailable", heroImgX + heroImgSz / 2, heroImgY + heroImgSz / 2, { align: "center" });
    }
  } else {
    sf(doc, T.surface1);
    ss(doc, T.border);
    doc.setLineWidth(0.5);
    doc.roundedRect(heroImgX, heroImgY, heroImgSz, heroImgSz, 12, 12, "FD");
    st(doc, T.textTert);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("No scan preview", heroImgX + heroImgSz / 2, heroImgY + heroImgSz / 2, { align: "center" });
  }

  st(doc, T.textPri);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Key finding", heroTextX, heroImgY);

  const confColor: [number, number, number] = isHealthy ? T.green : T.emerald;
  st(doc, confColor);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(34);
  doc.text(pct(conf), heroTextX, heroImgY + 38);

  st(doc, T.textPri);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(mapped.label, heroTextX, heroImgY + 70);

  st(doc, T.textSec);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  wrapped(doc, `${interp.level} — ${interp.note}`, heroTextX, heroImgY + 90, heroTextW, 12);

  const badgeY = heroImgY + 124;
  sf(doc, T.surface3);
  ss(doc, T.emerald);
  doc.roundedRect(heroTextX, badgeY, heroTextW, 24, 12, 12, "FD");
  st(doc, T.emerald);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Scan complete", heroTextX + 14, badgeY + 16);

  let statY = badgeY + 36;
  const stats: Array<[string, string]> = [
    ["Model", formatModelName(result.model)],
    ["Input", result.reliability?.source_image ?? "unknown"],
    ["Active regions", `${context?.active_regions ?? 0}`],
    ["View mode", context?.view_mode ?? "n/a"],
  ];
  for (const [label, value] of stats) {
    st(doc, T.textSec);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${label}:`, heroTextX, statY);
    st(doc, T.textPri);
    doc.setFont("helvetica", "normal");
    doc.text(value, heroTextX + 84, statY);
    statY += 14;
  }

  y += heroH + 18;

  // ── PATIENT DETAILS / 3D SNAPSHOT ROW ───────────────────────────────────────
  const colW = (CW - 14) / 2;
  const rowH = 238;
  need(rowH);
  card(doc, M, y, colW, rowH, "PATIENT DETAILS");
  card(doc, M + colW + 14, y, colW, rowH, "3D SNAPSHOT");

  let pY = y + 32;
  const patRows: [string, string][] = [
    ["Patient Name", "________________________________"],
    ["Patient ID", "________________________________"],
    ["Age / Sex", "________________________________"],
    ["Exam Date", "________________________________"],
    ["Referring Clinician", "________________________________"],
    ["Radiologist", "________________________________"],
  ];
  for (const [lbl, blank] of patRows) {
    st(doc, T.textSec);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(`${lbl}:`, M + 14, pY);
    st(doc, T.textTert);
    doc.setFont("helvetica", "normal");
    doc.text(blank, M + 118, pY);
    pY += 14;
  }

  const snapX = M + colW + 14 + 16;
  const snapY = y + 30;
  const snapW = colW - 32;
  const snapH = rowH - 60;
  sf(doc, T.surface1);
  ss(doc, T.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(snapX, snapY, snapW, snapH, 12, 12, "FD");

  if (threeSnapshotData) {
    try {
      const fmt = threeSnapshotData.startsWith("data:image/png") ? "PNG" : "JPEG";
      doc.addImage(threeSnapshotData, fmt, snapX + 6, snapY + 6, snapW - 12, snapH - 12);
    } catch {
      st(doc, T.textTert);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("3D snapshot unavailable", snapX + snapW / 2, snapY + snapH / 2, { align: "center" });
    }
  } else {
    st(doc, T.textTert);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text("3D snapshot not captured for this report", snapX + snapW / 2, snapY + snapH / 2, { align: "center" });
  }

  y += rowH + 16;

  // ── CONFIDENCE BREAKDOWN card ───────────────────────────────────────────────
  const confCardH = 208;
  need(confCardH);
  card(doc, M, y, CW, confCardH, "CONFIDENCE BREAKDOWN");
  let confY = y + 30;

  st(doc, T.textSec);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(9);
  confY = wrapped(doc, mapped.description, M + 14, confY, CW - 28, 12);
  confY += 16;

  const classes: Array<[keyof typeof CLASS_DISPLAY, string]> = [
    ["COVID", "COVID"],
    ["Lung_Opacity", "Lung Opacity"],
    ["Normal", "Normal"],
    ["Viral Pneumonia", "Viral Pneumonia"],
  ];
  const barW = CW - 170;
  const bh = 10;
  for (const [cls, name] of classes) {
    need(22);
    const v = Math.max(0, Math.min(1, result.confidence[cls] ?? 0));
    const active = cls === result.predicted_class;
    const barCol: [number, number, number] = active ? (isHealthy ? T.green : T.emerald) : T.emeraldDark;

    st(doc, active ? T.textPri : T.textSec);
    doc.setFont("helvetica", active ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(name, M + 18, confY + 7);

    bar(doc, M + 132, confY + 1, barW, bh, v, barCol);

    st(doc, active ? (isHealthy ? T.green : T.emerald) : T.textSec);
    doc.setFont("helvetica", active ? "bold" : "normal");
    doc.setFontSize(9);
    doc.text(pct(v), M + 132 + barW + 8, confY + 7);

    confY += 20;
  }

  y += confCardH + 16;

  // ── UNDER THE HOOD (model metadata) card ────────────────────────────────────
  const metaRows: [string, string, boolean?][] = [
    ["Model", formatModelName(result.model)],
    ["Predicted class", result.predicted_class],
    ["Confidence sum", result.confidence_sum.toFixed(4)],
    ["Tolerance check", result.confidence_tolerance_ok ? "pass" : "fail", !result.confidence_tolerance_ok],
    ["Activation shape", `${result.activation_map_shape[0]} x ${result.activation_map_shape[1]}`],
    ["Grad-CAM", result.gradcam_failed ? "fallback map" : "generated from attention", result.gradcam_failed],
  ];
  const metaH = 26 + metaRows.length * 14 + 10;
  need(metaH);
  card(doc, M, y, CW, metaH, "UNDER THE HOOD");
  let mY = y + 27;
  for (const [lbl, val, warn] of metaRows) {
    st(doc, T.textSec);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(`${lbl}:`, M + 14, mY);
    st(doc, warn ? T.amber : T.textPri);
    doc.setFont("helvetica", "normal");
    doc.text(val, M + 142, mY);
    mY += 14;
  }
  y += metaH + 16;

  // ── ENSEMBLE section ─────────────────────────────────────────────────────────
  if (result.ensemble) {
    need(130);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Ensemble setting", "Value"]],
      body: [
        ["Method",        result.ensemble.method],
        ["Agreement",     result.ensemble.agreement ? "aligned" : "divergent"],
        ["Degraded mode", result.ensemble.degraded ? "yes" : "no"],
        ["Winning model", formatModelName(result.ensemble.winning_model)],
      ],
      headStyles:          { fillColor: T.surface1, textColor: T.emerald, fontStyle: "bold", fontSize: 9 },
      bodyStyles:          { fillColor: T.surface2, textColor: T.textPri, fontSize: 9 },
      alternateRowStyles:  { fillColor: T.surface3 },
      styles:              { cellPadding: 6, lineColor: T.border, lineWidth: 0.4 },
      tableLineColor: T.border,
      tableLineWidth: 0.5,
    });
    y = (pdoc.lastAutoTable?.finalY ?? y) + 12;

    need(150);
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M },
      head: [["Model", "Predicted class", "Vote weight", "Confidence", "Grad-CAM"]],
      body: result.ensemble.individual_predictions.map((item) => [
        formatModelName(item.model),
        CLASS_DISPLAY[item.predicted_class].label,
        pct(item.weight),
        pct(item.top_confidence),
        item.gradcam_failed ? "fallback" : "generated",
      ]),
      headStyles:         { fillColor: T.surface1, textColor: T.emerald, fontStyle: "bold", fontSize: 8 },
      bodyStyles:         { fillColor: T.surface2, textColor: T.textPri, fontSize: 8 },
      alternateRowStyles: { fillColor: T.surface3 },
      styles:             { cellPadding: 5, lineColor: T.border, lineWidth: 0.4 },
      tableLineColor: T.border,
      tableLineWidth: 0.5,
    });
    y = (pdoc.lastAutoTable?.finalY ?? y) + 12;

    if (result.ensemble.failed_models.length > 0) {
      need(90);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Unavailable model", "Reason"]],
        body: result.ensemble.failed_models.map((f) => [formatModelName(f.model), f.error]),
        headStyles:  { fillColor: T.warnHead, textColor: T.warnText, fontStyle: "bold", fontSize: 9 },
        bodyStyles:  { fillColor: T.warnBody, textColor: T.amber, fontSize: 9 },
        styles:      { cellPadding: 5, lineColor: [80, 40, 10] as [number, number, number], lineWidth: 0.4 },
        tableLineColor: [80, 40, 10] as [number, number, number],
        tableLineWidth: 0.5,
      });
      y = (pdoc.lastAutoTable?.finalY ?? y) + 12;
    }
  }

  // ── Export context/telemetry summary ───────────────────────────────────────
  if (context || result.telemetry) {
    const contextRows: Array<[string, string]> = [];
    if (context?.view_mode) contextRows.push(["View mode", context.view_mode]);
    if (typeof context?.zoom === "number") contextRows.push(["Zoom", `${context.zoom}%`]);
    if (typeof context?.overlay_opacity === "number") contextRows.push(["Overlay opacity", `${context.overlay_opacity}%`]);
    if (typeof context?.threshold === "number") contextRows.push(["Threshold", context.threshold.toFixed(2)]);
    if (typeof context?.active_regions === "number") contextRows.push(["Active regions", String(context.active_regions)]);
    if (typeof context?.three_unavailable === "boolean") {
      contextRows.push(["3D availability", context.three_unavailable ? "unavailable" : "available"]);
    }

    if (result.telemetry?.preprocess_ms !== undefined) {
      contextRows.push(["Preprocess", `${result.telemetry.preprocess_ms.toFixed(1)} ms`]);
    }
    if (result.telemetry?.infer_ms !== undefined) {
      contextRows.push(["Infer", `${result.telemetry.infer_ms.toFixed(1)} ms`]);
    }
    if (result.telemetry?.gradcam_ms !== undefined) {
      contextRows.push(["Grad-CAM", `${result.telemetry.gradcam_ms.toFixed(1)} ms`]);
    }
    if (result.telemetry?.ensemble_ms !== undefined) {
      contextRows.push(["Ensemble", `${result.telemetry.ensemble_ms.toFixed(1)} ms`]);
    }
    if (result.telemetry?.total_ms !== undefined) {
      contextRows.push(["Total", `${result.telemetry.total_ms.toFixed(1)} ms`]);
    }

    if (contextRows.length > 0) {
      need(120);
      autoTable(doc, {
        startY: y,
        margin: { left: M, right: M },
        head: [["Export context", "Value"]],
        body: contextRows,
        headStyles: { fillColor: T.surface1, textColor: T.emerald, fontStyle: "bold", fontSize: 9 },
        bodyStyles: { fillColor: T.surface2, textColor: T.textPri, fontSize: 8.6 },
        alternateRowStyles: { fillColor: T.surface3 },
        styles: { cellPadding: 5, lineColor: T.border, lineWidth: 0.4 },
        tableLineColor: T.border,
        tableLineWidth: 0.5,
      });
      y = (pdoc.lastAutoTable?.finalY ?? y) + 12;
    }
  }

  // ── HEADS UP (reliability notes) card ───────────────────────────────────────
  // Estimate card height
  let noteLineCount = 0;
  for (const note of reliabilityLines) {
    noteLineCount += Math.ceil(note.length / 70) + 1;
  }
  const noteH = Math.max(60, 28 + noteLineCount * 12 + 10);
  need(noteH);
  card(doc, M, y, CW, noteH, "HEADS UP");
  let noteY = y + 27;
  for (const note of reliabilityLines) {
    st(doc, T.amber);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    noteY = wrapped(doc, `-- ${note}`, M + 14, noteY, CW - 28, 11);
    noteY += 5;
  }
  y += noteH + 16;

  // ── WHAT THIS MODEL SEES (scope) card ────────────────────────────────────
  const scopeLines  = doc.splitTextToSize(RESULTS_SCOPE_NOTE, CW - 28) as string[];
  const limitLines  = doc.splitTextToSize(MODEL_LIMITATIONS,  CW - 28) as string[];
  const scopeH      = Math.max(80, 26 + (scopeLines.length + limitLines.length) * 11 + 14);
  need(scopeH);
  card(doc, M, y, CW, scopeH, "WHAT THIS MODEL SEES");
  st(doc, T.textSec);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  let scopeY = y + 26;
  scopeY = wrapped(doc, RESULTS_SCOPE_NOTE, M + 14, scopeY, CW - 28, 11);
  scopeY += 5;
  wrapped(doc, MODEL_LIMITATIONS, M + 14, scopeY, CW - 28, 11);

  // ── Footers ─────────────────────────────────────────────────────────────────
  const total = doc.getNumberOfPages();
  const footerMeta = `model=${formatModelName(result.model)} | source=${result.reliability?.source_image ?? "unknown"} | generated=${generatedAt.toISOString()}`;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(doc, p, total, footerMeta);
  }

  const stamp = generatedAt.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const filename = `PulmoVision-Report-${stamp}.pdf`;
  const blob = new Blob([doc.output("arraybuffer")], { type: "application/pdf" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) {
      a.parentNode.removeChild(a);
    }
    window.URL.revokeObjectURL(url);
  }, 60000);
};
