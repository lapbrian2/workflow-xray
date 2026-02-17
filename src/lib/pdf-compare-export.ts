"use client";

import type { Decomposition, CompareResult, Step } from "./types";
import { LAYER_LABELS, LAYER_COLORS, GAP_LABELS, SEVERITY_COLORS } from "./types";
import { PDF_COLORS, parseHexColor } from "./pdf-shared";

export async function exportComparePdf(
  before: Decomposition,
  after: Decomposition,
  result: CompareResult
): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ── Color Palette (from shared module) ──
  const { dark, bodyText, muted, accent, border, bgLight, white } = PDF_COLORS;

  // Diff colors (unique to compare export)
  const addedGreen: [number, number, number] = [23, 165, 137];
  const addedBg: [number, number, number] = [232, 250, 244];
  const removedRed: [number, number, number] = [220, 68, 55];
  const removedBg: [number, number, number] = [253, 237, 235];
  const modifiedAmber: [number, number, number] = [212, 160, 23];
  const modifiedBg: [number, number, number] = [255, 248, 225];

  // Metric colors
  const colorBlue = PDF_COLORS.blue;
  const colorRed = PDF_COLORS.red;
  const colorGreen = PDF_COLORS.green;
  const colorPurple = PDF_COLORS.purple;

  // ── Helpers ──
  function checkPageBreak(needed: number) {
    if (y + needed > pageHeight - 25) {
      doc.addPage();
      y = margin;
    }
  }

  function drawHorizontalRule() {
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  }

  function drawSectionHeader(title: string) {
    checkPageBreak(16);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(title, margin, y);
    y += 2;
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.6);
    doc.line(margin, y, margin + 30, y);
    y += 6;
  }

  function formatDelta(value: number): string {
    if (value > 0) return `+${value}`;
    if (value < 0) return `${value}`;
    return "0";
  }

  function deltaColor(value: number, invertGood: boolean = false): [number, number, number] {
    if (value === 0) return muted;
    const isPositive = value > 0;
    const isGood = invertGood ? !isPositive : isPositive;
    return isGood ? addedGreen : removedRed;
  }

  // ── Compute diff stats ──
  // Resolved gaps: gaps in before that are not in after (by type + description match)
  const resolvedGaps = before.gaps.filter(
    (bg) => !after.gaps.some((ag) => ag.type === bg.type && ag.description === bg.description)
  );
  // New gaps: gaps in after that are not in before
  const newGaps = after.gaps.filter(
    (ag) => !before.gaps.some((bg) => bg.type === ag.type && bg.description === ag.description)
  );
  // Persistent gaps: gaps that exist in both
  const persistentGaps = after.gaps.filter(
    (ag) => before.gaps.some((bg) => bg.type === ag.type && bg.description === ag.description)
  );

  const automationDelta = result.healthDelta.automationPotential;
  const fragilityDelta = result.healthDelta.fragility;

  // ════════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE
  // ════════════════════════════════════════════════════════════════

  // Top accent bar
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Confidential watermark
  doc.setFontSize(60);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(230, 230, 235);
  doc.text("CONFIDENTIAL", pageWidth / 2, pageHeight / 2, {
    align: "center",
    angle: 45,
  });

  const coverY = pageHeight * 0.28;

  // Label
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accent);
  doc.text("WORKFLOW X-RAY", pageWidth / 2, coverY - 16, { align: "center" });

  // Decorative line
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 25, coverY - 12, pageWidth / 2 + 25, coverY - 12);

  // Title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Workflow Comparison", pageWidth / 2, coverY, { align: "center" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("Report", pageWidth / 2, coverY + 10, { align: "center" });

  // VS block with workflow names
  const vsY = coverY + 30;

  // Before workflow
  doc.setFillColor(...bgLight);
  doc.roundedRect(margin, vsY, contentWidth, 14, 2, 2, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...muted);
  doc.text("BEFORE", margin + 6, vsY + 5);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  const beforeTitleLines = doc.splitTextToSize(before.title, contentWidth - 30);
  doc.text(beforeTitleLines[0], margin + 6, vsY + 10);

  // VS divider
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...accent);
  doc.text("VS", pageWidth / 2, vsY + 19, { align: "center" });

  // After workflow
  doc.setFillColor(...bgLight);
  doc.roundedRect(margin, vsY + 22, contentWidth, 14, 2, 2, "F");

  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...muted);
  doc.text("AFTER", margin + 6, vsY + 27);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...dark);
  const afterTitleLines = doc.splitTextToSize(after.title, contentWidth - 30);
  doc.text(afterTitleLines[0], margin + 6, vsY + 32);

  // Date
  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text(reportDate, pageWidth / 2, vsY + 50, { align: "center" });

  // Bottom accent bar
  doc.setFillColor(...accent);
  doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("This document contains confidential information. Distribution is restricted.", pageWidth / 2, pageHeight - 10, {
    align: "center",
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 2: SUMMARY CARD
  // ════════════════════════════════════════════════════════════════
  doc.addPage();
  y = margin;

  drawSectionHeader("Comparison Summary");

  // Summary card
  const summaryItems = [
    {
      label: "Gaps Resolved",
      value: String(resolvedGaps.length),
      color: addedGreen,
      bg: addedBg,
    },
    {
      label: "New Gaps Introduced",
      value: String(newGaps.length),
      color: removedRed,
      bg: removedBg,
    },
    {
      label: "Automation Change",
      value: formatDelta(automationDelta) + "%",
      color: deltaColor(automationDelta) as [number, number, number],
      bg: automationDelta >= 0 ? addedBg : removedBg,
    },
    {
      label: "Fragility Change",
      value: formatDelta(fragilityDelta) + " pts",
      color: deltaColor(fragilityDelta, true) as [number, number, number],
      bg: fragilityDelta <= 0 ? addedBg : removedBg,
    },
  ];

  const cardWidth = (contentWidth - 9) / 4;
  const cardHeight = 26;
  summaryItems.forEach((item, i) => {
    const x = margin + i * (cardWidth + 3);

    doc.setFillColor(...item.bg);
    doc.roundedRect(x, y, cardWidth, cardHeight, 2, 2, "F");

    // Colored top accent
    doc.setFillColor(...item.color);
    doc.rect(x, y, cardWidth, 1.5, "F");

    // Value
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...item.color);
    doc.text(item.value, x + cardWidth / 2, y + 12, { align: "center" });

    // Label
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...bodyText);
    doc.text(item.label.toUpperCase(), x + cardWidth / 2, y + 19, { align: "center" });
  });
  y += cardHeight + 8;

  // Summary narrative
  if (result.summary) {
    doc.setFillColor(...bgLight);
    const narrativeLines = doc.splitTextToSize(result.summary, contentWidth - 16);
    const narrativeHeight = narrativeLines.length * 4 + 10;
    doc.roundedRect(margin, y, contentWidth, narrativeHeight, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...bodyText);
    doc.text(narrativeLines, margin + 8, y + 7);
    y += narrativeHeight + 10;
  }

  // ── Health Metrics Table ──
  drawHorizontalRule();
  drawSectionHeader("Health Metrics Comparison");

  // Table header
  const colBeforeX = margin + 55;
  const colAfterX = margin + 95;
  const colDeltaX = margin + 135;
  const rowHeight = 8;

  doc.setFillColor(...dark);
  doc.roundedRect(margin, y, contentWidth, rowHeight, 1.5, 1.5, "F");

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text("METRIC", margin + 4, y + 5.5);
  doc.text("BEFORE", colBeforeX, y + 5.5, { align: "center" });
  doc.text("AFTER", colAfterX, y + 5.5, { align: "center" });
  doc.text("DELTA", colDeltaX, y + 5.5, { align: "center" });
  y += rowHeight;

  const metrics = [
    {
      label: "Complexity",
      before: before.health.complexity,
      after: after.health.complexity,
      delta: result.healthDelta.complexity,
      invertGood: true,
      color: colorBlue,
    },
    {
      label: "Fragility",
      before: before.health.fragility,
      after: after.health.fragility,
      delta: result.healthDelta.fragility,
      invertGood: true,
      color: colorRed,
    },
    {
      label: "Automation Potential",
      before: before.health.automationPotential,
      after: after.health.automationPotential,
      delta: result.healthDelta.automationPotential,
      invertGood: false,
      color: colorGreen,
    },
    {
      label: "Team Load Balance",
      before: before.health.teamLoadBalance,
      after: after.health.teamLoadBalance,
      delta: result.healthDelta.teamLoadBalance,
      invertGood: false,
      color: colorPurple,
    },
  ];

  metrics.forEach((metric, i) => {
    checkPageBreak(rowHeight + 2);

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(...bgLight);
      doc.rect(margin, y, contentWidth, rowHeight, "F");
    }

    // Metric label
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...dark);
    doc.text(metric.label, margin + 4, y + 5.5);

    // Before value
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...bodyText);
    doc.text(String(metric.before), colBeforeX, y + 5.5, { align: "center" });

    // After value
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(String(metric.after), colAfterX, y + 5.5, { align: "center" });

    // Delta
    const dColor = deltaColor(metric.delta, metric.invertGood);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dColor);
    doc.text(formatDelta(metric.delta), colDeltaX, y + 5.5, { align: "center" });

    y += rowHeight;
  });

  // Table bottom border
  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // ── Steps Diff ──
  drawHorizontalRule();
  drawSectionHeader("Steps Comparison");

  // Added steps
  if (result.added.length > 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...addedGreen);
    doc.text(`Added Steps (${result.added.length})`, margin, y);
    y += 6;

    result.added.forEach((step: Step) => {
      checkPageBreak(18);

      // Green highlight background
      doc.setFillColor(...addedBg);
      const descLinesPreview = doc.splitTextToSize(step.description, contentWidth - 16);
      const blockHeight = 10 + descLinesPreview.length * 3.5;
      doc.roundedRect(margin, y - 2, contentWidth, blockHeight, 1.5, 1.5, "F");

      // "+" indicator
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...addedGreen);
      doc.text("+", margin + 3, y + 2);

      // Step name
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(step.name, margin + 10, y + 2);

      // Layer badge
      const layerLabel = LAYER_LABELS[step.layer];
      const layerColor = parseHexColor(LAYER_COLORS[step.layer]);
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      const layerBadgeW = doc.getTextWidth(layerLabel) + 5;
      doc.setFillColor(...layerColor);
      doc.roundedRect(pageWidth - margin - layerBadgeW, y - 1, layerBadgeW, 5, 1, 1, "F");
      doc.setTextColor(...white);
      doc.text(layerLabel, pageWidth - margin - layerBadgeW + 2.5, y + 2);

      y += 6;

      // Description
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      const descLines = doc.splitTextToSize(step.description, contentWidth - 16);
      doc.text(descLines, margin + 10, y);
      y += descLines.length * 3.5 + 5;
    });
    y += 4;
  }

  // Removed steps
  if (result.removed.length > 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...removedRed);
    doc.text(`Removed Steps (${result.removed.length})`, margin, y);
    y += 6;

    result.removed.forEach((step: Step) => {
      checkPageBreak(18);

      // Red highlight background
      doc.setFillColor(...removedBg);
      const descLinesPreview = doc.splitTextToSize(step.description, contentWidth - 16);
      const blockHeight = 10 + descLinesPreview.length * 3.5;
      doc.roundedRect(margin, y - 2, contentWidth, blockHeight, 1.5, 1.5, "F");

      // "-" indicator
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...removedRed);
      doc.text("\u2013", margin + 3, y + 2);

      // Step name with strikethrough effect
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...removedRed);
      doc.text(step.name, margin + 10, y + 2);
      // Strikethrough line
      const nameWidth = doc.getTextWidth(step.name);
      doc.setDrawColor(...removedRed);
      doc.setLineWidth(0.3);
      doc.line(margin + 10, y + 1, margin + 10 + nameWidth, y + 1);

      y += 6;

      // Description
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      const descLines = doc.splitTextToSize(step.description, contentWidth - 16);
      doc.text(descLines, margin + 10, y);
      y += descLines.length * 3.5 + 5;
    });
    y += 4;
  }

  // Modified steps
  if (result.modified.length > 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...modifiedAmber);
    doc.text(`Modified Steps (${result.modified.length})`, margin, y);
    y += 6;

    result.modified.forEach((mod: { step: Step; changes: string[] }) => {
      checkPageBreak(22);

      // Yellow highlight background
      const changesHeight = mod.changes.length * 3.5 + 4;
      const modBlockHeight = 10 + changesHeight;
      doc.setFillColor(...modifiedBg);
      doc.roundedRect(margin, y - 2, contentWidth, modBlockHeight, 1.5, 1.5, "F");

      // "~" indicator
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...modifiedAmber);
      doc.text("~", margin + 3, y + 2);

      // Step name
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(mod.step.name, margin + 10, y + 2);

      y += 6;

      // Change details
      mod.changes.forEach((change: string) => {
        checkPageBreak(6);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...modifiedAmber);
        doc.text("\u2192", margin + 10, y);
        doc.setTextColor(...bodyText);
        const changeLines = doc.splitTextToSize(change, contentWidth - 22);
        doc.text(changeLines[0], margin + 15, y);
        y += 3.5;
      });

      y += 5;
    });
    y += 4;
  }

  // No changes fallback
  if (result.added.length === 0 && result.removed.length === 0 && result.modified.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...muted);
    doc.text("No structural changes detected between workflow versions.", margin, y);
    y += 8;
  }

  // ── Gaps Diff ──
  drawHorizontalRule();
  drawSectionHeader("Gap Analysis Comparison");

  // Resolved gaps
  if (resolvedGaps.length > 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...addedGreen);
    doc.text(`Resolved Gaps (${resolvedGaps.length})`, margin, y);
    y += 6;

    resolvedGaps.forEach((gap) => {
      checkPageBreak(14);

      const gapLabel = GAP_LABELS[gap.type] || gap.type;

      // Strikethrough label
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      doc.text(gapLabel, margin + 5, y);
      const labelW = doc.getTextWidth(gapLabel);
      doc.setDrawColor(...muted);
      doc.setLineWidth(0.25);
      doc.line(margin + 5, y - 0.5, margin + 5 + labelW, y - 0.5);

      // RESOLVED badge
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      const resolvedBadgeW = doc.getTextWidth("RESOLVED") + 5;
      doc.setFillColor(...addedGreen);
      doc.roundedRect(margin + 5 + labelW + 4, y - 3, resolvedBadgeW, 4.5, 1, 1, "F");
      doc.text("RESOLVED", margin + 5 + labelW + 6.5, y);

      y += 4;

      // Description
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      const descLines = doc.splitTextToSize(gap.description, contentWidth - 10);
      doc.text(descLines, margin + 5, y);
      y += descLines.length * 3.5 + 3;
    });
    y += 4;
  }

  // New gaps
  if (newGaps.length > 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...removedRed);
    doc.text(`New Gaps (${newGaps.length})`, margin, y);
    y += 6;

    newGaps.forEach((gap) => {
      checkPageBreak(16);

      const sevColor = parseHexColor(SEVERITY_COLORS[gap.severity]);
      const gapLabel = GAP_LABELS[gap.type] || gap.type;

      // Severity dot
      doc.setFillColor(...sevColor);
      doc.circle(margin + 2, y - 1, 1.5, "F");

      // Label
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(gapLabel, margin + 7, y);

      // NEW badge
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.setFontSize(8.5);
      const gapLabelW = doc.getTextWidth(gapLabel);
      doc.setFontSize(6);
      const newBadgeW = doc.getTextWidth("NEW") + 4;
      doc.setFillColor(...removedRed);
      doc.roundedRect(margin + 7 + gapLabelW + 4, y - 3, newBadgeW, 4.5, 1, 1, "F");
      doc.text("NEW", margin + 7 + gapLabelW + 6, y);

      y += 5;

      // Description
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      const descLines = doc.splitTextToSize(gap.description, contentWidth - 10);
      doc.text(descLines, margin + 7, y);
      y += descLines.length * 3.5;

      // Suggestion
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...addedGreen);
      const sugLines = doc.splitTextToSize(`Suggestion: ${gap.suggestion}`, contentWidth - 10);
      doc.text(sugLines, margin + 7, y);
      y += sugLines.length * 3.5 + 4;
    });
    y += 4;
  }

  // Persistent gaps
  if (persistentGaps.length > 0) {
    checkPageBreak(10);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...bodyText);
    doc.text(`Persistent Gaps (${persistentGaps.length})`, margin, y);
    y += 6;

    persistentGaps.forEach((gap) => {
      checkPageBreak(14);

      const sevColor = parseHexColor(SEVERITY_COLORS[gap.severity]);
      const gapLabel = GAP_LABELS[gap.type] || gap.type;

      // Severity dot
      doc.setFillColor(...sevColor);
      doc.circle(margin + 2, y - 1, 1.5, "F");

      // Label
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      doc.text(gapLabel, margin + 7, y);

      // Severity
      doc.setFontSize(6.5);
      doc.setTextColor(...sevColor);
      doc.setFontSize(8.5);
      const pLabelW = doc.getTextWidth(gapLabel);
      doc.setFontSize(6.5);
      doc.text(gap.severity.toUpperCase(), margin + 7 + pLabelW + 4, y);

      y += 4;

      // Description
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      const descLines = doc.splitTextToSize(gap.description, contentWidth - 10);
      doc.text(descLines, margin + 7, y);
      y += descLines.length * 3.5 + 3;
    });
  }

  // No gaps fallback
  if (resolvedGaps.length === 0 && newGaps.length === 0 && persistentGaps.length === 0) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...muted);
    doc.text("No gaps identified in either workflow version.", margin, y);
    y += 8;
  }

  // ════════════════════════════════════════════════════════════════
  // FOOTER ON EVERY PAGE
  // ════════════════════════════════════════════════════════════════
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);

    // Footer line
    doc.setDrawColor(...border);
    doc.setLineWidth(0.3);
    doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

    // Footer text
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(
      `Workflow Comparison Report  \u2022  Page ${p} of ${pageCount}  \u2022  Confidential`,
      pageWidth / 2,
      pageHeight - 11,
      { align: "center" }
    );
  }

  // ── Save ──
  const beforeSlug = before.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase();
  const afterSlug = after.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase();
  const filename = `${beforeSlug}-vs-${afterSlug}-comparison-report.pdf`;
  doc.save(filename);
}
