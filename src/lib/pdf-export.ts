"use client";

import type { Decomposition } from "./types";
import { LAYER_LABELS, GAP_LABELS, SEVERITY_COLORS } from "./types";

export async function exportToPdf(decomposition: Decomposition): Promise<void> {
  const { jsPDF } = await import("jspdf");

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // Colors (tuples for jsPDF)
  const dark: [number, number, number] = [28, 37, 54];
  const text: [number, number, number] = [74, 85, 104];
  const muted: [number, number, number] = [136, 149, 167];
  const accent: [number, number, number] = [232, 85, 58];
  const border: [number, number, number] = [232, 236, 241];

  // Helper: check if we need a new page
  function checkPageBreak(needed: number) {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  }

  // ── Title ──
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text(decomposition.title, margin, y);
  y += 10;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text(`Generated ${new Date().toLocaleDateString()} • Workflow X-Ray`, margin, y);
  y += 4;

  // Divider
  doc.setDrawColor(...border);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  // ── Summary Stats ──
  const stats = [
    { label: "Steps", value: String(decomposition.steps.length) },
    { label: "Gaps", value: String(decomposition.gaps.length) },
    { label: "Automation", value: `${decomposition.health.automationPotential}%` },
    { label: "Complexity", value: String(decomposition.health.complexity) },
  ];

  const statBoxWidth = contentWidth / 4;
  stats.forEach((stat, i) => {
    const x = margin + i * statBoxWidth;

    doc.setFillColor(247, 248, 250); // #F7F8FA
    doc.roundedRect(x, y, statBoxWidth - 4, 18, 2, 2, "F");

    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(stat.value, x + (statBoxWidth - 4) / 2, y + 9, { align: "center" });

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(stat.label.toUpperCase(), x + (statBoxWidth - 4) / 2, y + 14, { align: "center" });
  });
  y += 26;

  // ── Health Scores ──
  checkPageBreak(30);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Health Scores", margin, y);
  y += 6;

  const healthMetrics = [
    { label: "Complexity", value: decomposition.health.complexity, color: [45, 125, 210] as [number, number, number] },
    { label: "Fragility", value: decomposition.health.fragility, color: [232, 85, 58] as [number, number, number] },
    { label: "Automation Potential", value: decomposition.health.automationPotential, color: [23, 165, 137] as [number, number, number] },
    { label: "Team Balance", value: decomposition.health.teamLoadBalance, color: [142, 68, 173] as [number, number, number] },
  ];

  healthMetrics.forEach((metric) => {
    checkPageBreak(10);
    // Label
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...text);
    doc.text(`${metric.label}`, margin, y);
    doc.text(`${metric.value}/100`, pageWidth - margin, y, { align: "right" });

    y += 2;

    // Bar background
    const barHeight = 3;
    doc.setFillColor(...border);
    doc.roundedRect(margin, y, contentWidth, barHeight, 1, 1, "F");

    // Bar fill
    const fillWidth = (metric.value / 100) * contentWidth;
    doc.setFillColor(...metric.color);
    doc.roundedRect(margin, y, fillWidth, barHeight, 1, 1, "F");

    y += 8;
  });

  y += 4;

  // ── Steps ──
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  doc.text("Workflow Steps", margin, y);
  y += 8;

  decomposition.steps.forEach((step, i) => {
    checkPageBreak(28);

    // Step number + name
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...accent);
    doc.text(`${i + 1}`, margin, y);

    doc.setTextColor(...dark);
    doc.text(step.name, margin + 6, y);

    // Layer badge
    const layerLabel = LAYER_LABELS[step.layer];
    doc.setFontSize(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    const layerWidth = doc.getTextWidth(layerLabel) + 4;
    doc.setFillColor(247, 248, 250);
    doc.roundedRect(pageWidth - margin - layerWidth, y - 3, layerWidth, 5, 1, 1, "F");
    doc.text(layerLabel, pageWidth - margin - layerWidth + 2, y);

    y += 4;

    // Description
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...text);
    const descLines = doc.splitTextToSize(step.description, contentWidth - 6);
    doc.text(descLines, margin + 6, y);
    y += descLines.length * 3.5;

    // Metadata row
    const metaParts: string[] = [];
    if (step.owner) metaParts.push(`Owner: ${step.owner}`);
    if (step.tools.length > 0) metaParts.push(`Tools: ${step.tools.join(", ")}`);
    metaParts.push(`Automation: ${step.automationScore}%`);

    doc.setFontSize(7);
    doc.setTextColor(...muted);
    doc.text(metaParts.join("  •  "), margin + 6, y);
    y += 3;

    // Inputs/Outputs
    if (step.inputs.length > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(...muted);
      doc.text(`In: ${step.inputs.join(", ")}`, margin + 6, y);
      y += 3;
    }
    if (step.outputs.length > 0) {
      doc.setFontSize(6.5);
      doc.setTextColor(...muted);
      doc.text(`Out: ${step.outputs.join(", ")}`, margin + 6, y);
      y += 3;
    }

    y += 3;
  });

  // ── Gaps ──
  if (decomposition.gaps.length > 0) {
    checkPageBreak(20);
    y += 4;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Gap Analysis", margin, y);
    y += 8;

    decomposition.gaps.forEach((gap) => {
      checkPageBreak(24);

      // Severity indicator
      const sevColor = SEVERITY_COLORS[gap.severity];
      const r = parseInt(sevColor.slice(1, 3), 16);
      const g = parseInt(sevColor.slice(3, 5), 16);
      const b = parseInt(sevColor.slice(5, 7), 16);
      doc.setFillColor(r, g, b);
      doc.circle(margin + 1.5, y - 1, 1.5, "F");

      // Type + severity
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      const gapLabel = GAP_LABELS[gap.type] || gap.type;
      doc.text(gapLabel, margin + 6, y);

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(r, g, b);
      doc.text(gap.severity.toUpperCase(), margin + 6 + doc.getTextWidth(gapLabel) + 3, y);

      y += 4;

      // Description
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...text);
      const gapDescLines = doc.splitTextToSize(gap.description, contentWidth - 6);
      doc.text(gapDescLines, margin + 6, y);
      y += gapDescLines.length * 3.5;

      // Suggestion
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(23, 165, 137); // green for suggestion
      const sugLines = doc.splitTextToSize(`Suggestion: ${gap.suggestion}`, contentWidth - 6);
      doc.text(sugLines, margin + 6, y);
      y += sugLines.length * 3.5;

      y += 4;
    });
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(
      `Workflow X-Ray Report • Page ${p} of ${pageCount}`,
      pageWidth / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: "center" }
    );
  }

  // Save
  const filename = `${decomposition.title.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}-xray.pdf`;
  doc.save(filename);
}
