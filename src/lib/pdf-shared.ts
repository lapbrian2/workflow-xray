"use client";

import { SEVERITY_COLORS, LAYER_COLORS } from "./types";
import type { Severity, Layer } from "./types";
import type { jsPDF } from "jspdf";

// ── Shared Color Palette ──
// Used across all 4 PDF export files for consistent branding

export const PDF_COLORS = {
  dark: [28, 37, 54] as [number, number, number],
  bodyText: [64, 75, 94] as [number, number, number],
  muted: [136, 149, 167] as [number, number, number],
  accent: [45, 125, 210] as [number, number, number],
  border: [222, 226, 231] as [number, number, number],
  bgLight: [247, 248, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  blue: [45, 125, 210] as [number, number, number],
  red: [220, 68, 55] as [number, number, number],
  green: [23, 165, 137] as [number, number, number],
  purple: [142, 68, 173] as [number, number, number],
  orange: [232, 85, 58] as [number, number, number],
} as const;

// ── PdfContext type ──
// Encapsulates document state for shared helper functions

export interface PdfContext {
  doc: jsPDF;
  y: number;
  margin: number;
  contentWidth: number;
  pageWidth: number;
  pageHeight: number;
}

// ── Factory ──

export function createPdfContext(doc: jsPDF): PdfContext {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  return { doc, y: margin, margin, contentWidth, pageWidth, pageHeight };
}

// ── Shared helpers (return updated PdfContext) ──

export function checkPageBreak(ctx: PdfContext, needed: number): PdfContext {
  if (ctx.y + needed > ctx.pageHeight - 25) {
    ctx.doc.addPage();
    return { ...ctx, y: ctx.margin };
  }
  return ctx;
}

export function drawSectionHeader(ctx: PdfContext, title: string): PdfContext {
  let updated = checkPageBreak(ctx, 16);
  const { doc, margin } = updated;
  let { y } = updated;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(title, margin, y);
  y += 2;
  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.6);
  doc.line(margin, y, margin + 30, y);
  y += 6;

  return { ...updated, y };
}

export function drawHorizontalRule(ctx: PdfContext): PdfContext {
  const { doc, margin, pageWidth } = ctx;
  let { y } = ctx;

  doc.setDrawColor(...PDF_COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 6;

  return { ...ctx, y };
}

// ── Color parsing utilities ──

export function parseHexColor(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b] as [number, number, number];
}

export function parseSeverityColor(severity: Severity): [number, number, number] {
  return parseHexColor(SEVERITY_COLORS[severity]);
}

export function parseLayerColor(layer: Layer): [number, number, number] {
  return parseHexColor(LAYER_COLORS[layer]);
}
