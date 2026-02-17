"use client";

import type { RemediationPlan, Decomposition } from "./types";
import {
  TASK_PRIORITY_LABELS,
  TASK_EFFORT_LABELS,
  GAP_LABELS,
} from "./types";
import { PDF_COLORS } from "./pdf-shared";

export async function exportRemediationPdf(
  plan: RemediationPlan,
  decomposition: Decomposition
): Promise<void> {
  let jsPDF;
  try {
    ({ jsPDF } = await import("jspdf"));
  } catch {
    throw new Error("Failed to load PDF library. Please try again.");
  }

  try {
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

    // ── Color Palette (from shared module, with orange accent override) ──
    const { dark, bodyText, muted, border, bgLight, white } = PDF_COLORS;
    const accent = PDF_COLORS.orange; // Remediation uses orange accent
    const green = PDF_COLORS.green;
    const blue = PDF_COLORS.blue;

    const priorityColors: Record<string, [number, number, number]> = {
      critical: [232, 85, 58],
      high: [212, 160, 23],
      medium: [45, 125, 210],
      low: [23, 165, 137],
    };

    const confidenceColors: Record<string, [number, number, number]> = {
      high: [23, 165, 137],
      medium: [212, 160, 23],
      low: [232, 85, 58],
    };

    // ── Helpers ──
    function checkPageBreak(needed: number) {
      if (y + needed > pageHeight - 25) {
        doc.addPage();
        y = margin;
      }
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

    function drawHorizontalRule() {
      doc.setDrawColor(...border);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    }

    // Filter out empty phases (no tasks)
    const validPhases = plan.phases.filter((p) => p.tasks && p.tasks.length > 0);
    if (validPhases.length === 0) {
      throw new Error("No phases with tasks found in the remediation plan.");
    }
    const totalTasks = validPhases.reduce((sum, p) => sum + p.tasks.length, 0);

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

    const coverY = pageHeight * 0.32;

    // Label
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...accent);
    doc.text("WORKFLOW X-RAY", pageWidth / 2, coverY - 20, { align: "center" });

    // Decorative line
    doc.setDrawColor(...accent);
    doc.setLineWidth(0.8);
    doc.line(pageWidth / 2 - 25, coverY - 16, pageWidth / 2 + 25, coverY - 16);

    // Title
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text("Remediation Plan", pageWidth / 2, coverY, { align: "center" });

    // Workflow name
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    const titleLines = doc.splitTextToSize(decomposition.title, contentWidth - 20);
    doc.text(titleLines, pageWidth / 2, coverY + 14, { align: "center" });

    const titleBlockEnd = coverY + 14 + titleLines.length * 6;

    // Stats badges
    const statsY = titleBlockEnd + 12;
    const badges = [
      { label: `${validPhases.length} Phases`, color: blue },
      { label: `${totalTasks} Tasks`, color: accent },
      { label: `${plan.projectedImpact.length} Impact Metrics`, color: green },
    ];

    let badgeX = pageWidth / 2 - (badges.length * 38 + (badges.length - 1) * 6) / 2;
    badges.forEach((badge) => {
      const bw = 38;
      doc.setFillColor(...badge.color);
      doc.roundedRect(badgeX, statsY, bw, 10, 2, 2, "F");
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text(badge.label, badgeX + bw / 2, statsY + 6.5, { align: "center" });
      badgeX += bw + 6;
    });

    // Date
    const reportDate = new Date().toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
    doc.setFontSize(10);
    doc.setTextColor(...muted);
    doc.text(reportDate, pageWidth / 2, statsY + 22, { align: "center" });

    // Bottom accent
    doc.setFillColor(...accent);
    doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text("This document contains confidential information.", pageWidth / 2, pageHeight - 10, { align: "center" });

    // ════════════════════════════════════════════════════════════════
    // PAGE 2: EXECUTIVE SUMMARY
    // ════════════════════════════════════════════════════════════════
    doc.addPage();
    y = margin;

    drawSectionHeader("Executive Summary");

    // Summary box
    doc.setFillColor(...bgLight);
    const summaryLines = doc.splitTextToSize(plan.summary, contentWidth - 16);
    const summaryBoxHeight = summaryLines.length * 4.5 + 10;
    doc.roundedRect(margin, y, contentWidth, summaryBoxHeight, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...bodyText);
    doc.text(summaryLines, margin + 8, y + 7);
    y += summaryBoxHeight + 10;

    // Overview stats
    drawHorizontalRule();
    drawSectionHeader("Plan Overview");

    const overviewStats = [
      { label: "PHASES", value: String(validPhases.length), color: blue },
      { label: "TOTAL TASKS", value: String(totalTasks), color: accent },
      {
        label: "CRITICAL",
        value: String(validPhases.reduce((s, p) => s + p.tasks.filter((t) => t.priority === "critical").length, 0)),
        color: [232, 85, 58] as [number, number, number],
      },
      { label: "IMPACTS", value: String(plan.projectedImpact.length), color: green },
    ];

    const statBoxWidth = (contentWidth - 9) / 4;
    const statBoxHeight = 22;
    overviewStats.forEach((stat, i) => {
      const x = margin + i * (statBoxWidth + 3);
      doc.setFillColor(...bgLight);
      doc.roundedRect(x, y, statBoxWidth, statBoxHeight, 2, 2, "F");
      doc.setFillColor(...stat.color);
      doc.rect(x, y, statBoxWidth, 1.5, "F");
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(stat.value, x + statBoxWidth / 2, y + 11, { align: "center" });
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...muted);
      doc.text(stat.label, x + statBoxWidth / 2, y + 17, { align: "center" });
    });
    y += statBoxHeight + 10;

    // ════════════════════════════════════════════════════════════════
    // PHASE DETAILS
    // ════════════════════════════════════════════════════════════════
    for (const phase of validPhases) {
      drawHorizontalRule();

      // Phase header
      checkPageBreak(16);
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(phase.name, margin, y);

      // Timeframe badge
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      const tfWidth = doc.getTextWidth(phase.timeframe) + 6;
      doc.setFillColor(...accent);
      doc.roundedRect(pageWidth - margin - tfWidth, y - 3.5, tfWidth, 5.5, 1.5, 1.5, "F");
      doc.setTextColor(...white);
      doc.text(phase.timeframe, pageWidth - margin - tfWidth + 3, y - 0.3);
      y += 4;

      if (phase.description) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...bodyText);
        const descLines = doc.splitTextToSize(phase.description, contentWidth);
        doc.text(descLines, margin, y);
        y += descLines.length * 3.8 + 4;
      } else {
        y += 4;
      }

      // Tasks
      for (const task of phase.tasks) {
        const descText = task.description || "No description provided";
        const descLines = doc.splitTextToSize(descText, contentWidth - 14);
        const metricLines = task.successMetric
          ? doc.splitTextToSize(`Success: ${task.successMetric}`, contentWidth - 14)
          : [];
        const taskHeight = 10 + descLines.length * 3.8 + metricLines.length * 3.5 + 10;
        checkPageBreak(taskHeight);

        const pColor = priorityColors[task.priority] || accent;

        // Task card
        doc.setFillColor(...bgLight);
        doc.roundedRect(margin, y, contentWidth, taskHeight - 2, 2, 2, "F");

        // Priority bar
        doc.setFillColor(...pColor);
        doc.rect(margin, y, 2, taskHeight - 2, "F");

        // Priority badge
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        const prioLabel = TASK_PRIORITY_LABELS[task.priority].toUpperCase();
        const prioWidth = doc.getTextWidth(prioLabel) + 5;
        doc.setFillColor(...pColor);
        doc.roundedRect(margin + 6, y + 2, prioWidth, 5, 1.2, 1.2, "F");
        doc.setTextColor(...white);
        doc.text(prioLabel, margin + 8.5, y + 5.3);

        // Task title
        doc.setFontSize(9.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...dark);
        doc.text(task.title, margin + 6 + prioWidth + 4, y + 5.5);

        // Effort on right
        doc.setFontSize(7);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...muted);
        doc.text(
          TASK_EFFORT_LABELS[task.effort],
          pageWidth - margin - 4,
          y + 5.5,
          { align: "right" }
        );

        let ty = y + 10;

        // Description
        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...bodyText);
        doc.text(descLines, margin + 6, ty);
        ty += descLines.length * 3.8;

        // Meta line
        const metaParts: string[] = [];
        if (task.owner) metaParts.push(`Owner: ${task.owner}`);
        if (task.tools.length > 0) metaParts.push(`Tools: ${task.tools.join(", ")}`);

        if (metaParts.length > 0) {
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...muted);
          doc.text(metaParts.join("  |  "), margin + 6, ty);
          ty += 3.5;
        }

        // Success metric
        if (metricLines.length > 0) {
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "italic");
          doc.setTextColor(...green);
          doc.text(metricLines, margin + 6, ty);
        }

        y += taskHeight;
      }

      y += 4;
    }

    // ════════════════════════════════════════════════════════════════
    // PROJECTED IMPACT
    // ════════════════════════════════════════════════════════════════
    if (plan.projectedImpact.length > 0) {
      drawHorizontalRule();
      drawSectionHeader("Projected Impact");

      const validImpacts = plan.projectedImpact.filter(
        (i) => i.metricName && (i.currentValue || i.projectedValue)
      );
      for (const impact of validImpacts) {
        const assumptionText = impact.assumption || "No assumption provided";
        const assumptionLines = doc.splitTextToSize(assumptionText, contentWidth - 14);
        const impactHeight = 18 + assumptionLines.length * 3.5;
        checkPageBreak(impactHeight);

        doc.setFillColor(...bgLight);
        doc.roundedRect(margin, y, contentWidth, impactHeight - 2, 2, 2, "F");

        const cColor = confidenceColors[impact.confidence] || muted;

        // Metric name
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...dark);
        doc.text(impact.metricName, margin + 6, y + 5);

        // Confidence badge
        doc.setFontSize(6.5);
        doc.setFont("helvetica", "bold");
        const confLabel = `${impact.confidence} confidence`;
        const confWidth = doc.getTextWidth(confLabel) + 5;
        doc.setFillColor(...cColor);
        doc.roundedRect(pageWidth - margin - confWidth - 4, y + 2, confWidth, 5, 1.2, 1.2, "F");
        doc.setTextColor(...white);
        doc.text(confLabel, pageWidth - margin - confWidth - 1.5, y + 5.3);

        // Before → After
        const currentVal = impact.currentValue || "N/A";
        const projectedVal = impact.projectedValue || "N/A";
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...muted);
        doc.text(currentVal, margin + 6, y + 12);

        const cvWidth = doc.getTextWidth(currentVal);
        doc.setFontSize(10);
        doc.setTextColor(...accent);
        doc.text(" → ", margin + 6 + cvWidth, y + 12);

        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...green);
        doc.text(projectedVal, margin + 6 + cvWidth + doc.getTextWidth(" → "), y + 12);

        // Assumption
        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(...muted);
        doc.text(assumptionLines, margin + 6, y + 16);

        y += impactHeight;
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
        `Remediation Plan  \u2022  Page ${p} of ${pageCount}  \u2022  Confidential`,
        pageWidth / 2,
        pageHeight - 11,
        { align: "center" }
      );
    }

    // Save
    const filename = `${decomposition.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase()}-remediation-plan.pdf`;
    doc.save(filename);
  } catch (error) {
    console.error("Remediation PDF generation failed:", error);
    throw new Error(
      `Failed to generate PDF: ${error instanceof Error ? error.message : "Unknown error"}`
    );
  }
}
