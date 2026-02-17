"use client";

import type { Workflow, Gap, Step, CostContext, Decomposition } from "./types";
import { LAYER_LABELS, GAP_LABELS } from "./types";
import { PDF_COLORS, parseSeverityColor, parseLayerColor } from "./pdf-shared";

// ── Color Palette (from shared module) ──
const { dark, bodyText, muted, accent, border, bgLight, white } = PDF_COLORS;
const colorBlue = PDF_COLORS.blue;
const colorRed = PDF_COLORS.red;
const colorGreen = PDF_COLORS.green;
const colorPurple = PDF_COLORS.purple;
const accentOrange = PDF_COLORS.orange;

// ── ROI estimator (same logic as pdf-export.ts) ──
function estimateROI(
  gaps: Gap[],
  steps: Step[],
  costContext?: CostContext
): { label: string; value: string }[] {
  const estimates: { label: string; value: string }[] = [];
  const rate = costContext?.hourlyRate ?? 50;

  const bottlenecks = gaps.filter(g => g.type === "bottleneck");
  if (bottlenecks.length > 0) {
    const lowHrs = bottlenecks.length * 2;
    const highHrs = bottlenecks.length * 6;
    const lowCost = Math.round(lowHrs * 52 * rate / 1000);
    const highCost = Math.round(highHrs * 52 * rate / 1000);
    estimates.push({ label: "Bottleneck Removal", value: `$${lowCost}K-$${highCost}K/year` });
  }

  const manualOverhead = gaps.filter(g => g.type === "manual_overhead");
  if (manualOverhead.length > 0) {
    const lowHrs = manualOverhead.length * 3;
    const highHrs = manualOverhead.length * 8;
    const lowSavings = Math.round(lowHrs * 52 * rate / 1000);
    const highSavings = Math.round(highHrs * 52 * rate / 1000);
    estimates.push({ label: "Automation Savings", value: `$${lowSavings}K-$${highSavings}K/year` });
  }

  const singleDeps = gaps.filter(g => g.type === "single_dependency");
  if (singleDeps.length > 0) {
    estimates.push({ label: "Key-Person Risks", value: `${singleDeps.length} identified` });
  }

  const lowAutoSteps = steps.filter(s => s.automationScore < 40);
  if (lowAutoSteps.length > 0) {
    const hrsPerStep = costContext?.hoursPerStep ?? 2;
    const potentialHrs = Math.round(lowAutoSteps.length * hrsPerStep * 0.4);
    const potentialHrsHigh = Math.round(lowAutoSteps.length * hrsPerStep * 0.6);
    estimates.push({ label: "Automation Uplift", value: `${potentialHrs}-${potentialHrsHigh} hrs/week` });
  }

  return estimates;
}

// ── Action plan generator (same logic as pdf-export.ts) ──
function generateActionPlan(gaps: Gap[]): { phase: string; items: string[]; timeline: string }[] {
  const plan: { phase: string; items: string[]; timeline: string }[] = [];

  const quickWins = gaps.filter(g => g.effortLevel === "quick_win" || (!g.effortLevel && g.type === "manual_overhead" && g.severity !== "high"));
  if (quickWins.length > 0) {
    plan.push({ phase: "Phase 1: Quick Wins", timeline: "Week 1-2", items: quickWins.map(g => g.suggestion) });
  }

  const incremental = gaps.filter(g => g.effortLevel === "incremental" || (!g.effortLevel && (g.type === "bottleneck" || g.type === "context_loss")));
  if (incremental.length > 0) {
    plan.push({ phase: "Phase 2: Process Improvements", timeline: "Month 1-2", items: incremental.map(g => g.suggestion) });
  }

  const strategic = gaps.filter(g => g.effortLevel === "strategic" || (!g.effortLevel && (g.type === "single_dependency" || g.type === "missing_fallback" || g.severity === "high")));
  if (strategic.length > 0) {
    plan.push({ phase: "Phase 3: Structural Changes", timeline: "Month 2-4", items: strategic.map(g => g.suggestion) });
  }

  return plan;
}

/**
 * Export a batch of workflows as a single combined PDF report.
 * Produces: Cover → Executive Summary → Per-Workflow Sections → Aggregate Roadmap → Footer
 */
export async function exportBatchToPdf(workflows: Workflow[], batchTitle?: string): Promise<void> {
  let jsPDF;
  try {
    ({ jsPDF } = await import("jspdf"));
  } catch {
    throw new Error("Failed to load PDF library. Please try again.");
  }

  if (!workflows || workflows.length === 0) {
    throw new Error("No workflows to export.");
  }

  try {
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = margin;

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

    // ── Aggregate stats ──
    const totalWorkflows = workflows.length;
    let totalSteps = 0;
    let totalGaps = 0;
    let totalHighGaps = 0;
    let automationSum = 0;
    let healthSum = 0;

    workflows.forEach((w) => {
      const d = w.decomposition;
      totalSteps += d.steps.length;
      totalGaps += d.gaps.length;
      totalHighGaps += d.gaps.filter(g => g.severity === "high").length;
      automationSum += d.health.automationPotential;
      const avgH = Math.round(
        (d.health.complexity + (100 - d.health.fragility) + d.health.automationPotential + d.health.teamLoadBalance) / 4
      );
      healthSum += avgH;
    });

    const avgAutomation = Math.round(automationSum / totalWorkflows);
    const avgHealth = Math.round(healthSum / totalWorkflows);

    let overallAssessment: string;
    let assessmentColor: [number, number, number];
    if (avgHealth >= 70) {
      overallAssessment = "Good";
      assessmentColor = colorGreen;
    } else if (avgHealth >= 45) {
      overallAssessment = "Needs Attention";
      assessmentColor = [212, 160, 23];
    } else {
      overallAssessment = "Critical";
      assessmentColor = colorRed;
    }

    const title = batchTitle || "Batch Workflow Analysis";

    // ════════════════════════════════════════════════════════════════
    // COVER PAGE
    // ════════════════════════════════════════════════════════════════

    // Top accent bar
    doc.setFillColor(...accent);
    doc.rect(0, 0, pageWidth, 4, "F");

    // Confidential watermark
    doc.setFontSize(60);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(230, 230, 235);
    doc.text("CONFIDENTIAL", pageWidth / 2, pageHeight / 2, { align: "center", angle: 45 });

    // Title block
    const coverY = pageHeight * 0.3;

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...accent);
    doc.text("WORKFLOW X-RAY", pageWidth / 2, coverY - 16, { align: "center" });

    doc.setDrawColor(...accent);
    doc.setLineWidth(0.8);
    doc.line(pageWidth / 2 - 25, coverY - 12, pageWidth / 2 + 25, coverY - 12);

    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    const titleLines = doc.splitTextToSize(title, contentWidth - 20);
    doc.text(titleLines, pageWidth / 2, coverY, { align: "center" });

    const titleBlockH = titleLines.length * 11;

    // Subtitle: "N Workflows Analyzed"
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(`${totalWorkflows} Workflow${totalWorkflows > 1 ? "s" : ""} Analyzed`, pageWidth / 2, coverY + titleBlockH + 4, { align: "center" });

    // Date
    const reportDate = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(reportDate, pageWidth / 2, coverY + titleBlockH + 14, { align: "center" });

    // Health badge
    const badgeY = coverY + titleBlockH + 28;
    const badgeW = 54;
    const badgeH = 12;
    doc.setFillColor(...assessmentColor);
    doc.roundedRect(pageWidth / 2 - badgeW / 2, badgeY, badgeW, badgeH, 3, 3, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(`Status: ${overallAssessment}`, pageWidth / 2, badgeY + 8, { align: "center" });

    // Bottom accent bar
    doc.setFillColor(...accent);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text("This document contains confidential information. Distribution is restricted.", pageWidth / 2, pageHeight - 10, { align: "center" });

    // ════════════════════════════════════════════════════════════════
    // EXECUTIVE SUMMARY
    // ════════════════════════════════════════════════════════════════
    doc.addPage();
    y = margin;

    drawSectionHeader("Batch Executive Summary");

    // Aggregate stats grid (6 stats in 2 rows of 3)
    const statsRow1 = [
      { label: "WORKFLOWS", value: String(totalWorkflows), color: colorBlue },
      { label: "TOTAL STEPS", value: String(totalSteps), color: colorBlue },
      { label: "TOTAL GAPS", value: String(totalGaps), color: totalGaps > 0 ? colorRed : colorGreen },
    ];
    const statsRow2 = [
      { label: "HIGH SEVERITY", value: String(totalHighGaps), color: totalHighGaps > 0 ? colorRed : colorGreen },
      { label: "AVG AUTOMATION", value: `${avgAutomation}%`, color: colorGreen },
      { label: "AVG HEALTH", value: `${avgHealth}/100`, color: avgHealth >= 60 ? colorGreen : avgHealth >= 40 ? [212, 160, 23] as [number, number, number] : colorRed },
    ];

    function drawStatsRow(stats: { label: string; value: string; color: [number, number, number] }[]) {
      const boxW = (contentWidth - 6) / 3;
      const boxH = 22;
      stats.forEach((stat, i) => {
        const x = margin + i * (boxW + 3);
        doc.setFillColor(...bgLight);
        doc.roundedRect(x, y, boxW, boxH, 2, 2, "F");
        doc.setFillColor(...stat.color);
        doc.rect(x, y, boxW, 1.5, "F");

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...dark);
        doc.text(stat.value, x + boxW / 2, y + 11, { align: "center" });

        doc.setFontSize(6.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...muted);
        doc.text(stat.label, x + boxW / 2, y + 17, { align: "center" });
      });
      y += boxH + 4;
    }

    drawStatsRow(statsRow1);
    drawStatsRow(statsRow2);
    y += 4;

    // ── Workflow Index Table ──
    drawHorizontalRule();

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Workflow Index", margin, y);
    y += 6;

    // Table header
    const colWidths = [contentWidth * 0.4, contentWidth * 0.12, contentWidth * 0.12, contentWidth * 0.18, contentWidth * 0.18];
    const colHeaders = ["Workflow", "Steps", "Gaps", "Health", "Automation"];
    const colX = [margin];
    for (let i = 1; i < colWidths.length; i++) {
      colX.push(colX[i - 1] + colWidths[i - 1]);
    }

    doc.setFillColor(...accent);
    doc.roundedRect(margin, y - 3, contentWidth, 7, 1, 1, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    colHeaders.forEach((h, i) => {
      doc.text(h, colX[i] + 3, y + 1);
    });
    y += 6;

    // Table rows
    workflows.forEach((w, idx) => {
      checkPageBreak(8);
      const d = w.decomposition;
      const wfHealth = Math.round(
        (d.health.complexity + (100 - d.health.fragility) + d.health.automationPotential + d.health.teamLoadBalance) / 4
      );

      // Alternating row background
      if (idx % 2 === 0) {
        doc.setFillColor(...bgLight);
        doc.rect(margin, y - 3, contentWidth, 6, "F");
      }

      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);

      // Truncate long titles
      const maxTitleW = colWidths[0] - 6;
      let titleText = d.title;
      while (doc.getTextWidth(titleText) > maxTitleW && titleText.length > 3) {
        titleText = titleText.slice(0, -4) + "...";
      }
      doc.text(titleText, colX[0] + 3, y);
      doc.text(String(d.steps.length), colX[1] + 3, y);

      // Gaps count with color
      const gapCount = d.gaps.length;
      doc.setTextColor(gapCount > 0 ? colorRed[0] : bodyText[0], gapCount > 0 ? colorRed[1] : bodyText[1], gapCount > 0 ? colorRed[2] : bodyText[2]);
      doc.text(String(gapCount), colX[2] + 3, y);

      // Health with color
      const healthColor = wfHealth >= 60 ? colorGreen : wfHealth >= 40 ? [212, 160, 23] as [number, number, number] : colorRed;
      doc.setTextColor(...healthColor);
      doc.text(`${wfHealth}/100`, colX[3] + 3, y);

      // Automation
      doc.setTextColor(...colorGreen);
      doc.text(`${d.health.automationPotential}%`, colX[4] + 3, y);

      y += 6;
    });

    y += 6;

    // ── Gap Distribution ──
    const gapTypeCounts: Record<string, number> = {};
    workflows.forEach((w) => {
      w.decomposition.gaps.forEach((g) => {
        const label = GAP_LABELS[g.type] || g.type;
        gapTypeCounts[label] = (gapTypeCounts[label] || 0) + 1;
      });
    });

    if (Object.keys(gapTypeCounts).length > 0) {
      drawHorizontalRule();

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text("Cross-Workflow Gap Distribution", margin, y);
      y += 6;

      const sorted = Object.entries(gapTypeCounts).sort((a, b) => b[1] - a[1]);
      const maxCount = sorted[0][1];

      sorted.forEach(([label, count]) => {
        checkPageBreak(10);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...bodyText);
        doc.text(label, margin, y);

        doc.setFont("helvetica", "bold");
        doc.text(String(count), pageWidth - margin, y, { align: "right" });

        y += 2;

        // Bar
        const barW = contentWidth - 4;
        const barH = 3;
        doc.setFillColor(...border);
        doc.roundedRect(margin, y, barW, barH, 1, 1, "F");

        const fillW = Math.max(2, (count / maxCount) * barW);
        doc.setFillColor(...accentOrange);
        doc.roundedRect(margin, y, fillW, barH, 1, 1, "F");

        y += barH + 4;
      });

      y += 4;
    }

    // ════════════════════════════════════════════════════════════════
    // PER-WORKFLOW SECTIONS (compact)
    // ════════════════════════════════════════════════════════════════
    workflows.forEach((w, wIdx) => {
      const d = w.decomposition;
      const wfHealth = Math.round(
        (d.health.complexity + (100 - d.health.fragility) + d.health.automationPotential + d.health.teamLoadBalance) / 4
      );

      // Start each workflow on a new page
      doc.addPage();
      y = margin;

      // ── Workflow header ──
      // Accent bar at top
      doc.setFillColor(...accent);
      doc.rect(margin, y, contentWidth, 1.5, "F");
      y += 5;

      // Number badge
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...muted);
      doc.text(`WORKFLOW ${wIdx + 1} OF ${totalWorkflows}`, margin, y);
      y += 5;

      // Title
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      const wfTitleLines = doc.splitTextToSize(d.title, contentWidth);
      doc.text(wfTitleLines, margin, y);
      y += wfTitleLines.length * 7 + 2;

      // Source badge (if extraction source exists)
      if (w.extractionSource) {
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        const srcLabel = `Source: ${w.extractionSource.type}`;
        const srcW = doc.getTextWidth(srcLabel) + 8;
        doc.setFillColor(...bgLight);
        doc.roundedRect(margin, y - 3, srcW, 5.5, 1.5, 1.5, "F");
        doc.setTextColor(...muted);
        doc.text(srcLabel, margin + 4, y);
        y += 5;
      }

      y += 2;

      // ── Compact Health Dashboard ──
      const healthMetrics = [
        { label: "Complexity", value: d.health.complexity, color: colorBlue },
        { label: "Fragility", value: d.health.fragility, color: colorRed },
        { label: "Automation", value: d.health.automationPotential, color: colorGreen },
        { label: "Load Balance", value: d.health.teamLoadBalance, color: colorPurple },
      ];

      healthMetrics.forEach((metric) => {
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...dark);
        doc.text(metric.label, margin, y);

        doc.setTextColor(...metric.color);
        doc.text(`${metric.value}/100`, margin + 38, y);

        // Bar
        const barX = margin + 52;
        const barW = contentWidth - 52;
        const barH = 3;
        doc.setFillColor(...border);
        doc.roundedRect(barX, y - 2.5, barW, barH, 1, 1, "F");
        const fillW = Math.max(2, (metric.value / 100) * barW);
        doc.setFillColor(...metric.color);
        doc.roundedRect(barX, y - 2.5, fillW, barH, 1, 1, "F");

        y += 5;
      });

      y += 4;

      // ── Compact Step Table ──
      drawHorizontalRule();
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text("Steps", margin, y);
      y += 5;

      // Step table header
      const stepColW = [8, contentWidth * 0.45, contentWidth * 0.25, contentWidth * 0.2];
      const stepColX = [margin];
      for (let i = 1; i < stepColW.length; i++) {
        stepColX.push(stepColX[i - 1] + stepColW[i - 1]);
      }

      doc.setFillColor(...accent);
      doc.roundedRect(margin, y - 3, contentWidth, 7, 1, 1, "F");
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text("#", stepColX[0] + 2, y + 0.5);
      doc.text("Step Name", stepColX[1] + 2, y + 0.5);
      doc.text("Layer", stepColX[2] + 2, y + 0.5);
      doc.text("Auto %", stepColX[3] + 2, y + 0.5);
      y += 6;

      d.steps.forEach((step, sIdx) => {
        checkPageBreak(7);

        if (sIdx % 2 === 0) {
          doc.setFillColor(...bgLight);
          doc.rect(margin, y - 3, contentWidth, 5.5, "F");
        }

        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...bodyText);
        doc.text(String(sIdx + 1), stepColX[0] + 2, y);

        // Truncate step name
        let stepName = step.name;
        const maxStepW = stepColW[1] - 6;
        while (doc.getTextWidth(stepName) > maxStepW && stepName.length > 3) {
          stepName = stepName.slice(0, -4) + "...";
        }
        doc.text(stepName, stepColX[1] + 2, y);

        // Layer badge
        const layerLabel = LAYER_LABELS[step.layer];
        const layerColor = parseLayerColor(step.layer);
        doc.setFontSize(6);
        doc.setFont("helvetica", "bold");
        const layerW = doc.getTextWidth(layerLabel) + 5;
        doc.setFillColor(...layerColor);
        doc.roundedRect(stepColX[2] + 2, y - 3, layerW, 4.5, 1, 1, "F");
        doc.setTextColor(...white);
        doc.text(layerLabel, stepColX[2] + 4.5, y - 0.3);

        // Automation score with color coding
        const autoColor = step.automationScore >= 60 ? colorGreen : step.automationScore >= 30 ? [212, 160, 23] as [number, number, number] : colorRed;
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...autoColor);
        doc.text(`${step.automationScore}%`, stepColX[3] + 2, y);

        y += 5.5;
      });

      y += 4;

      // ── Top 5 Gaps (by severity) ──
      if (d.gaps.length > 0) {
        drawHorizontalRule();
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...dark);
        doc.text(`Gaps (${d.gaps.length})`, margin, y);
        y += 5;

        // Sort by severity: high > medium > low
        const sevOrder = { high: 0, medium: 1, low: 2 };
        const sortedGaps = [...d.gaps].sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]);
        const topGaps = sortedGaps.slice(0, 5);

        topGaps.forEach((gap) => {
          checkPageBreak(18);

          const sevColor = parseSeverityColor(gap.severity);

          // Severity dot
          doc.setFillColor(...sevColor);
          doc.circle(margin + 2, y - 1, 1.5, "F");

          // Type + severity badge
          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...dark);
          const gapLabel = GAP_LABELS[gap.type] || gap.type;
          doc.text(gapLabel, margin + 6, y);

          doc.setFontSize(6);
          doc.setFont("helvetica", "bold");
          const sevLabel = gap.severity.toUpperCase();
          const sevW = doc.getTextWidth(sevLabel) + 4;
          doc.setFontSize(8);
          const gapLabelW = doc.getTextWidth(gapLabel);
          doc.setFontSize(6);
          const sevBadgeX = margin + 6 + gapLabelW + 3;
          doc.setFillColor(...sevColor);
          doc.roundedRect(sevBadgeX, y - 3, sevW, 4.5, 1, 1, "F");
          doc.setTextColor(...white);
          doc.text(sevLabel, sevBadgeX + 2, y - 0.5);

          y += 4;

          // Description (truncated to 2 lines)
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...bodyText);
          const descLines = doc.splitTextToSize(gap.description, contentWidth - 8);
          const truncated = descLines.slice(0, 2);
          doc.text(truncated, margin + 6, y);
          y += truncated.length * 3.5;

          // Suggestion (truncated to 2 lines)
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...colorGreen);
          const sugLines = doc.splitTextToSize(gap.suggestion, contentWidth - 8);
          const sugTruncated = sugLines.slice(0, 2);
          doc.text(sugTruncated, margin + 6, y);
          y += sugTruncated.length * 3.5 + 3;
        });

        if (d.gaps.length > 5) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...muted);
          doc.text(`+ ${d.gaps.length - 5} more gap${d.gaps.length - 5 > 1 ? "s" : ""} (see full single-workflow report)`, margin + 6, y);
          y += 5;
        }
      }

      // ── Condensed ROI ──
      const roi = estimateROI(d.gaps, d.steps, w.costContext);
      if (roi.length > 0) {
        checkPageBreak(roi.length * 6 + 10);
        drawHorizontalRule();

        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...dark);
        doc.text("Estimated Impact", margin, y);
        y += 5;

        roi.forEach((est) => {
          checkPageBreak(6);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...accentOrange);
          doc.text(est.label, margin + 4, y);

          doc.setFont("helvetica", "bold");
          doc.setTextColor(...dark);
          doc.text(est.value, margin + 48, y);
          y += 5;
        });

        y += 2;
      }
    });

    // ════════════════════════════════════════════════════════════════
    // AGGREGATE ROADMAP
    // ════════════════════════════════════════════════════════════════
    const allGaps = workflows.flatMap((w) => w.decomposition.gaps);

    if (allGaps.length > 0) {
      const aggregatePlan = generateActionPlan(allGaps);

      if (aggregatePlan.length > 0) {
        doc.addPage();
        y = margin;

        drawSectionHeader("Aggregate Implementation Roadmap");

        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...muted);
        doc.text("Consolidated recommendations across all analyzed workflows, deduplicated by phase.", margin, y);
        y += 6;

        aggregatePlan.forEach((phase) => {
          // Deduplicate items
          const uniqueItems = [...new Set(phase.items)];

          let phaseHeight = 10;
          uniqueItems.forEach((item) => {
            const itemLines = doc.splitTextToSize(item, contentWidth - 18);
            phaseHeight += itemLines.length * 3.8 + 3;
          });
          phaseHeight += 4;

          checkPageBreak(phaseHeight);

          // Phase header
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...dark);
          doc.text(phase.phase, margin, y);

          // Timeline badge
          doc.setFontSize(7);
          doc.setFont("helvetica", "bold");
          const tlW = doc.getTextWidth(phase.timeline) + 6;
          const tlX = pageWidth - margin - tlW;
          doc.setFillColor(...accentOrange);
          doc.roundedRect(tlX, y - 3.5, tlW, 5.5, 1.5, 1.5, "F");
          doc.setTextColor(...white);
          doc.text(phase.timeline, tlX + 3, y - 0.3);
          y += 6;

          // Items
          uniqueItems.forEach((item) => {
            const itemLines = doc.splitTextToSize(item, contentWidth - 18);
            const itemH = itemLines.length * 3.8 + 3;
            checkPageBreak(itemH);

            doc.setFillColor(...accentOrange);
            doc.circle(margin + 4, y - 1, 1, "F");

            doc.setFontSize(8.5);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(...bodyText);
            doc.text(itemLines, margin + 8, y);
            y += itemLines.length * 3.8 + 3;
          });

          y += 4;
        });
      }
    }

    // ════════════════════════════════════════════════════════════════
    // FOOTER ON EVERY PAGE
    // ════════════════════════════════════════════════════════════════
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);

      doc.setDrawColor(...border);
      doc.setLineWidth(0.3);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      doc.text(
        `Workflow X-Ray Batch Report  \u2022  Page ${p} of ${pageCount}  \u2022  Confidential`,
        pageWidth / 2,
        pageHeight - 11,
        { align: "center" }
      );
    }

    // ── Save ──
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `batch-xray-report-${dateStr}.pdf`;
    doc.save(filename);

  } catch (error) {
    console.error("Batch PDF generation failed:", error);
    throw new Error(
      `Failed to generate batch PDF report: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
