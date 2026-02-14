"use client";

import type { Decomposition, Gap, Step, CostContext } from "./types";
import { LAYER_LABELS, LAYER_COLORS, GAP_LABELS, SEVERITY_COLORS } from "./types";

/**
 * Estimate ROI using ranges (low–high) with explicit assumptions.
 * When costContext is provided, uses actual hourly rates.
 * Otherwise uses conservative industry defaults and labels them clearly.
 */
function estimateROI(
  gaps: Gap[],
  steps: Step[],
  costContext?: CostContext
): { label: string; value: string; detail: string; assumption: string }[] {
  const estimates: { label: string; value: string; detail: string; assumption: string }[] = [];

  const hasRate = !!costContext?.hourlyRate;
  const rate = costContext?.hourlyRate ?? 50;     // conservative default
  const rateLabel = hasRate ? `$${rate}/hr (provided)` : "$50/hr (industry estimate)";

  // Use Claude's timeWaste estimates if available, otherwise use ranges per gap type
  const bottlenecks = gaps.filter(g => g.type === 'bottleneck');
  if (bottlenecks.length > 0) {
    const lowHrs = bottlenecks.length * 2;
    const highHrs = bottlenecks.length * 6;
    const lowCost = Math.round(lowHrs * 52 * rate / 1000);
    const highCost = Math.round(highHrs * 52 * rate / 1000);
    estimates.push({
      label: "Bottleneck Removal",
      value: `${lowHrs}–${highHrs} hrs/week`,
      detail: `${bottlenecks.length} bottleneck${bottlenecks.length > 1 ? 's' : ''} causing downstream delays. Estimated ${lowHrs}–${highHrs} hrs/week of blocked time, or $${lowCost}K–$${highCost}K/year.`,
      assumption: `Assumes ${lowHrs/bottlenecks.length}–${highHrs/bottlenecks.length} hrs blocked per bottleneck per week at ${rateLabel}.`,
    });
  }

  const manualOverhead = gaps.filter(g => g.type === 'manual_overhead');
  if (manualOverhead.length > 0) {
    const lowHrs = manualOverhead.length * 3;
    const highHrs = manualOverhead.length * 8;
    const lowSavings = Math.round(lowHrs * 52 * rate / 1000);
    const highSavings = Math.round(highHrs * 52 * rate / 1000);
    estimates.push({
      label: "Automation Savings",
      value: `$${lowSavings}K–$${highSavings}K/year`,
      detail: `${manualOverhead.length} manual process${manualOverhead.length > 1 ? 'es' : ''} automatable. ~${lowHrs}–${highHrs} hrs/week recoverable across team.`,
      assumption: `Assumes ${lowHrs/manualOverhead.length}–${highHrs/manualOverhead.length} hrs/week per manual process at ${rateLabel}.`,
    });
  }

  const singleDeps = gaps.filter(g => g.type === 'single_dependency');
  if (singleDeps.length > 0) {
    estimates.push({
      label: "Risk Reduction",
      value: `${singleDeps.length} key-person risk${singleDeps.length > 1 ? 's' : ''}`,
      detail: `${singleDeps.length} critical process${singleDeps.length > 1 ? 'es' : ''} depend on a single person. Cross-training reduces bus-factor risk and unplanned downtime.`,
      assumption: "Qualitative risk — not converted to dollar amount. Impact depends on role criticality and absence frequency.",
    });
  }

  // Automation uplift
  const lowAutoSteps = steps.filter(s => s.automationScore < 40);
  if (lowAutoSteps.length > 0) {
    const hrsPerStep = costContext?.hoursPerStep ?? 2;
    const hrsLabel = costContext?.hoursPerStep ? `${hrsPerStep} hrs/step (provided)` : "2 hrs/step (conservative estimate)";
    const potentialHrs = Math.round(lowAutoSteps.length * hrsPerStep * 0.4); // 40% recoverable
    const potentialHrsHigh = Math.round(lowAutoSteps.length * hrsPerStep * 0.6); // 60% recoverable
    estimates.push({
      label: "Automation Uplift",
      value: `${potentialHrs}–${potentialHrsHigh} hrs/week recoverable`,
      detail: `${lowAutoSteps.length} step${lowAutoSteps.length > 1 ? 's' : ''} below 40% automation. Raising to 60%+ could recover ${potentialHrs}–${potentialHrsHigh} person-hours per week.`,
      assumption: `Assumes ${hrsLabel} with 40–60% of time recoverable through automation.`,
    });
  }

  return estimates;
}

function generateActionPlan(gaps: Gap[], steps: Step[]): { phase: string; items: string[]; timeline: string }[] {
  const plan: { phase: string; items: string[]; timeline: string }[] = [];

  // Phase 1: Quick Wins (from gaps with effortLevel = quick_win, or manual_overhead)
  const quickWins = gaps.filter(g => g.effortLevel === 'quick_win' || (!g.effortLevel && g.type === 'manual_overhead' && g.severity !== 'high'));
  if (quickWins.length > 0) {
    plan.push({
      phase: "Phase 1: Quick Wins",
      timeline: "Week 1-2",
      items: quickWins.map(g => g.suggestion)
    });
  }

  // Phase 2: Incremental (bottlenecks, context_loss)
  const incremental = gaps.filter(g => g.effortLevel === 'incremental' || (!g.effortLevel && (g.type === 'bottleneck' || g.type === 'context_loss')));
  if (incremental.length > 0) {
    plan.push({
      phase: "Phase 2: Process Improvements",
      timeline: "Month 1-2",
      items: incremental.map(g => g.suggestion)
    });
  }

  // Phase 3: Strategic (single_dependency, missing_fallback, high severity)
  const strategic = gaps.filter(g => g.effortLevel === 'strategic' || (!g.effortLevel && (g.type === 'single_dependency' || g.type === 'missing_fallback' || g.severity === 'high')));
  if (strategic.length > 0) {
    plan.push({
      phase: "Phase 3: Structural Changes",
      timeline: "Month 2-4",
      items: strategic.map(g => g.suggestion)
    });
  }

  return plan;
}

export async function exportToPdf(decomposition: Decomposition, costContext?: CostContext): Promise<void> {
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

  // ── Color Palette ──
  const dark: [number, number, number] = [28, 37, 54];
  const bodyText: [number, number, number] = [64, 75, 94];
  const muted: [number, number, number] = [136, 149, 167];
  const accent: [number, number, number] = [45, 125, 210];
  const border: [number, number, number] = [222, 226, 231];
  const bgLight: [number, number, number] = [247, 248, 250];
  const white: [number, number, number] = [255, 255, 255];

  // Health metric colors
  const colorBlue: [number, number, number] = [45, 125, 210];
  const colorRed: [number, number, number] = [220, 68, 55];
  const colorGreen: [number, number, number] = [23, 165, 137];
  const colorPurple: [number, number, number] = [142, 68, 173];

  // Severity colors parsed
  function parseSeverityColor(severity: "low" | "medium" | "high"): [number, number, number] {
    const hex = SEVERITY_COLORS[severity];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b] as [number, number, number];
  }

  // Layer color parser
  function parseLayerColor(layer: keyof typeof LAYER_COLORS): [number, number, number] {
    const hex = LAYER_COLORS[layer];
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b] as [number, number, number];
  }

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

  // ── Compute derived data ──
  const totalSteps = decomposition.steps.length;
  const totalGaps = decomposition.gaps.length;
  const health = decomposition.health;
  const avgHealth = Math.round(
    (health.complexity + (100 - health.fragility) + health.automationPotential + health.teamLoadBalance) / 4
  );

  let overallAssessment: string;
  let assessmentColor: [number, number, number];
  if (avgHealth >= 70) {
    overallAssessment = "Good";
    assessmentColor = colorGreen;
  } else if (avgHealth >= 45) {
    overallAssessment = "Needs Attention";
    assessmentColor = [212, 160, 23] as [number, number, number];
  } else {
    overallAssessment = "Critical";
    assessmentColor = colorRed;
  }

  // Generate recommendations from gaps and health
  function generateRecommendations(): string[] {
    const recs: string[] = [];

    // Health-based recommendations
    if (health.fragility > 70) {
      recs.push("Reduce workflow fragility by adding fallback paths and error handling at critical handoff points.");
    }
    if (health.automationPotential < 50) {
      recs.push("Increase automation coverage by identifying repetitive manual tasks that can be scripted or tool-assisted.");
    }
    if (health.teamLoadBalance < 50) {
      recs.push("Rebalance team workload distribution to reduce single-person dependencies and improve bus factor.");
    }
    if (health.complexity > 75) {
      recs.push("Simplify the workflow by breaking complex orchestration steps into smaller, composable units.");
    }

    // Gap-based recommendations
    const highGaps = decomposition.gaps.filter((g: Gap) => g.severity === "high");
    const mediumGaps = decomposition.gaps.filter((g: Gap) => g.severity === "medium");

    if (highGaps.length > 0) {
      recs.push(
        `Address ${highGaps.length} high-severity gap${highGaps.length > 1 ? "s" : ""} immediately: ${highGaps
          .slice(0, 2)
          .map((g: Gap) => GAP_LABELS[g.type])
          .join(", ")}.`
      );
    }
    if (mediumGaps.length > 2) {
      recs.push(
        `Plan remediation for ${mediumGaps.length} medium-severity gaps to prevent escalation.`
      );
    }

    const bottlenecks = decomposition.gaps.filter((g: Gap) => g.type === "bottleneck");
    if (bottlenecks.length > 0) {
      recs.push("Eliminate manual bottlenecks by parallelizing tasks or introducing asynchronous handoffs.");
    }

    const contextLoss = decomposition.gaps.filter((g: Gap) => g.type === "context_loss");
    if (contextLoss.length > 0) {
      recs.push("Implement structured knowledge transfer mechanisms to prevent context loss between steps.");
    }

    // Deduplicate and limit
    const unique = [...new Set(recs)];
    return unique.slice(0, 5);
  }

  const recommendations = generateRecommendations();

  // Top recommendation for executive summary
  const topRecommendation = recommendations.length > 0
    ? recommendations[0]
    : "Continue monitoring workflow health metrics and address gaps as they arise.";

  // ════════════════════════════════════════════════════════════════
  // PAGE 1: COVER PAGE
  // ════════════════════════════════════════════════════════════════

  // Background accent bar at top
  doc.setFillColor(...accent);
  doc.rect(0, 0, pageWidth, 4, "F");

  // Confidential watermark (diagonal, light)
  doc.setFontSize(60);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(230, 230, 235);
  doc.text("CONFIDENTIAL", pageWidth / 2, pageHeight / 2, {
    align: "center",
    angle: 45,
  });

  // Title block centered vertically
  const coverY = pageHeight * 0.35;

  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...accent);
  doc.text("WORKFLOW X-RAY", pageWidth / 2, coverY - 16, { align: "center" });

  // Decorative line
  doc.setDrawColor(...accent);
  doc.setLineWidth(0.8);
  doc.line(pageWidth / 2 - 25, coverY - 12, pageWidth / 2 + 25, coverY - 12);

  // Workflow title
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...dark);
  const titleLines = doc.splitTextToSize(decomposition.title, contentWidth - 20);
  doc.text(titleLines, pageWidth / 2, coverY, { align: "center" });

  const titleBlockHeight = titleLines.length * 12;

  // Subtitle
  doc.setFontSize(13);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("Comprehensive Workflow Analysis Report", pageWidth / 2, coverY + titleBlockHeight + 4, {
    align: "center",
  });

  // Date
  const reportDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  doc.setFontSize(10);
  doc.setTextColor(...muted);
  doc.text(reportDate, pageWidth / 2, coverY + titleBlockHeight + 14, { align: "center" });

  // Health badge on cover
  const badgeY = coverY + titleBlockHeight + 28;
  const badgeWidth = 50;
  const badgeHeight = 12;
  doc.setFillColor(...assessmentColor);
  doc.roundedRect(pageWidth / 2 - badgeWidth / 2, badgeY, badgeWidth, badgeHeight, 3, 3, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...white);
  doc.text(`Status: ${overallAssessment}`, pageWidth / 2, badgeY + 8, { align: "center" });

  // Bottom accent bar
  doc.setFillColor(...accent);
  doc.rect(0, pageHeight - 4, pageWidth, 4, "F");

  // Confidential footer on cover
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...muted);
  doc.text("This document contains confidential information. Distribution is restricted.", pageWidth / 2, pageHeight - 10, {
    align: "center",
  });

  // ════════════════════════════════════════════════════════════════
  // PAGE 2+: EXECUTIVE SUMMARY
  // ════════════════════════════════════════════════════════════════
  doc.addPage();
  y = margin;

  drawSectionHeader("Executive Summary");

  // Executive summary box
  const highGapCount = decomposition.gaps.filter((g: Gap) => g.severity === "high").length;
  const summaryText =
    `This report analyzes the "${decomposition.title}" workflow comprising ${totalSteps} discrete steps across ${new Set(decomposition.steps.map((s) => s.layer)).size} operational layers. ` +
    `The analysis identified ${totalGaps} gap${totalGaps !== 1 ? "s" : ""} in the workflow` +
    (highGapCount > 0 ? `, including ${highGapCount} high-severity issue${highGapCount !== 1 ? "s" : ""} requiring immediate attention` : "") +
    `. The overall workflow health is assessed as "${overallAssessment}" with an aggregate score of ${avgHealth}/100. ` +
    `Primary recommendation: ${topRecommendation}`;

  doc.setFillColor(...bgLight);
  const summaryLines = doc.splitTextToSize(summaryText, contentWidth - 16);
  const summaryBoxHeight = summaryLines.length * 4.5 + 10;
  doc.roundedRect(margin, y, contentWidth, summaryBoxHeight, 2, 2, "F");

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...bodyText);
  doc.text(summaryLines, margin + 8, y + 7);
  y += summaryBoxHeight + 10;

  // ── Summary Stats ──
  drawHorizontalRule();
  drawSectionHeader("Key Metrics");

  const stats = [
    { label: "TOTAL STEPS", value: String(totalSteps), color: colorBlue },
    { label: "GAPS FOUND", value: String(totalGaps), color: totalGaps > 0 ? colorRed : colorGreen },
    { label: "AUTOMATION", value: `${health.automationPotential}%`, color: colorGreen },
    { label: "COMPLEXITY", value: String(health.complexity), color: colorBlue },
  ];

  const statBoxWidth = (contentWidth - 9) / 4;
  const statBoxHeight = 22;
  stats.forEach((stat, i) => {
    const x = margin + i * (statBoxWidth + 3);

    // Box with colored top border
    doc.setFillColor(...bgLight);
    doc.roundedRect(x, y, statBoxWidth, statBoxHeight, 2, 2, "F");

    // Colored top accent
    doc.setFillColor(...stat.color);
    doc.rect(x, y, statBoxWidth, 1.5, "F");

    // Value
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(stat.value, x + statBoxWidth / 2, y + 11, { align: "center" });

    // Label
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(stat.label, x + statBoxWidth / 2, y + 17, { align: "center" });
  });
  y += statBoxHeight + 10;

  // ── Health Score Dashboard ──
  drawHorizontalRule();
  drawSectionHeader("Health Score Dashboard");

  const healthMetrics = [
    { label: "Complexity", value: health.complexity, color: colorBlue, description: "Structural intricacy of the workflow" },
    { label: "Fragility", value: health.fragility, color: colorRed, description: "Risk of failure from single-point dependencies" },
    { label: "Automation Potential", value: health.automationPotential, color: colorGreen, description: "Percentage of steps that can be automated" },
    { label: "Team Load Balance", value: health.teamLoadBalance, color: colorPurple, description: "Distribution of work across team members" },
  ];

  healthMetrics.forEach((metric) => {
    checkPageBreak(14);

    // Label row
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(metric.label, margin, y);

    // Score on right
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...metric.color);
    doc.text(`${metric.value}/100`, pageWidth - margin, y, { align: "right" });

    y += 2;

    // Description
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    doc.text(metric.description, margin, y + 1);
    y += 4;

    // Bar background
    const barHeight = 4;
    doc.setFillColor(...border);
    doc.roundedRect(margin, y, contentWidth, barHeight, 1.5, 1.5, "F");

    // Bar fill
    const fillWidth = Math.max(2, (metric.value / 100) * contentWidth);
    doc.setFillColor(...metric.color);
    doc.roundedRect(margin, y, fillWidth, barHeight, 1.5, 1.5, "F");

    y += barHeight + 6;
  });

  y += 4;

  // ── Workflow Steps ──
  drawHorizontalRule();
  drawSectionHeader("Workflow Steps");

  decomposition.steps.forEach((step, i) => {
    checkPageBreak(32);

    // Step number circle
    const circleR = 3.5;
    doc.setFillColor(...accent);
    doc.circle(margin + circleR, y - 1, circleR, "F");
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...white);
    doc.text(String(i + 1), margin + circleR, y + 0.5, { align: "center" });

    // Step name
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...dark);
    doc.text(step.name, margin + circleR * 2 + 3, y);

    // Layer badge
    const layerLabel = LAYER_LABELS[step.layer];
    const layerColor = parseLayerColor(step.layer);
    doc.setFontSize(6.5);
    doc.setFont("helvetica", "bold");
    const layerTextWidth = doc.getTextWidth(layerLabel) + 6;
    const badgeX = pageWidth - margin - layerTextWidth;
    const badgeYPos = y - 3.5;
    doc.setFillColor(layerColor[0], layerColor[1], layerColor[2]);
    doc.roundedRect(badgeX, badgeYPos, layerTextWidth, 5.5, 1.5, 1.5, "F");
    doc.setTextColor(...white);
    doc.text(layerLabel, badgeX + 3, y);

    y += 5;

    // Description
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...bodyText);
    const descLines = doc.splitTextToSize(step.description, contentWidth - 12);
    doc.text(descLines, margin + 10, y);
    y += descLines.length * 4;

    // Metadata line
    const metaParts: string[] = [];
    if (step.owner) metaParts.push(`Owner: ${step.owner}`);
    if (step.tools.length > 0) metaParts.push(`Tools: ${step.tools.join(", ")}`);
    metaParts.push(`Automation: ${step.automationScore}%`);

    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...muted);
    const metaText = metaParts.join("   |   ");
    doc.text(metaText, margin + 10, y);
    y += 4;

    // Inputs
    if (step.inputs.length > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...colorGreen);
      doc.text("IN", margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      doc.text(step.inputs.join(", "), margin + 17, y);
      y += 3.5;
    }

    // Outputs
    if (step.outputs.length > 0) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...accent);
      doc.text("OUT", margin + 10, y);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      doc.text(step.outputs.join(", "), margin + 19, y);
      y += 3.5;
    }

    // Separator between steps
    if (i < decomposition.steps.length - 1) {
      y += 2;
      doc.setDrawColor(...border);
      doc.setLineWidth(0.15);
      doc.line(margin + 10, y, pageWidth - margin, y);
      y += 4;
    } else {
      y += 4;
    }
  });

  // ── Gap Analysis ──
  if (decomposition.gaps.length > 0) {
    drawHorizontalRule();
    drawSectionHeader("Gap Analysis");

    // Summary line
    const highCount = decomposition.gaps.filter((g: Gap) => g.severity === "high").length;
    const medCount = decomposition.gaps.filter((g: Gap) => g.severity === "medium").length;
    const lowCount = decomposition.gaps.filter((g: Gap) => g.severity === "low").length;

    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...bodyText);
    doc.text(
      `${totalGaps} gaps identified:  ${highCount} High  |  ${medCount} Medium  |  ${lowCount} Low`,
      margin,
      y
    );
    y += 8;

    decomposition.gaps.forEach((gap, i) => {
      checkPageBreak(28);

      const sevColor = parseSeverityColor(gap.severity);

      // Severity dot
      doc.setFillColor(...sevColor);
      doc.circle(margin + 2, y - 1.2, 2, "F");

      // Type label
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      const gapLabel = GAP_LABELS[gap.type] || gap.type;
      doc.text(gapLabel, margin + 7, y);

      // Severity badge
      const sevLabel = gap.severity.toUpperCase();
      const sevTextWidth = doc.getTextWidth(sevLabel) + 5;
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "bold");
      const sevBadgeX = margin + 7 + doc.getTextWidth(gapLabel) + 4;
      // Restore font size for measuring after gapLabel width
      doc.setFontSize(9);
      const gapLabelMeasured = doc.getTextWidth(gapLabel);
      doc.setFontSize(6.5);
      const sevBadgeXFixed = margin + 7 + gapLabelMeasured + 4;
      doc.setFillColor(sevColor[0], sevColor[1], sevColor[2]);
      doc.roundedRect(sevBadgeXFixed, y - 3.5, sevTextWidth, 5, 1.2, 1.2, "F");
      doc.setTextColor(...white);
      doc.text(sevLabel, sevBadgeXFixed + 2.5, y - 0.3);

      y += 5;

      // Description
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      const gapDescLines = doc.splitTextToSize(gap.description, contentWidth - 10);
      doc.text(gapDescLines, margin + 7, y);
      y += gapDescLines.length * 3.8;

      // Suggestion
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...colorGreen);
      const sugLines = doc.splitTextToSize(`Suggestion: ${gap.suggestion}`, contentWidth - 10);
      doc.text(sugLines, margin + 7, y);
      y += sugLines.length * 3.8;

      // Separator
      if (i < decomposition.gaps.length - 1) {
        y += 2;
        doc.setDrawColor(...border);
        doc.setLineWidth(0.15);
        doc.line(margin + 7, y, pageWidth - margin, y);
        y += 4;
      } else {
        y += 4;
      }
    });
  }

  // ── Recommendations ──
  if (recommendations.length > 0) {
    drawHorizontalRule();
    drawSectionHeader("Recommendations");

    doc.setFillColor(...bgLight);
    // Calculate box height
    let tempHeight = 6;
    recommendations.forEach((rec) => {
      const recLines = doc.splitTextToSize(rec, contentWidth - 20);
      tempHeight += recLines.length * 4 + 4;
    });

    checkPageBreak(tempHeight + 4);
    doc.roundedRect(margin, y, contentWidth, tempHeight, 2, 2, "F");

    let recY = y + 5;
    recommendations.forEach((rec, i) => {
      // Number badge
      doc.setFillColor(...accent);
      doc.circle(margin + 6, recY - 0.8, 2.5, "F");
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...white);
      doc.text(String(i + 1), margin + 6, recY + 0.5, { align: "center" });

      // Text
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      const recLines = doc.splitTextToSize(rec, contentWidth - 20);
      doc.text(recLines, margin + 12, recY);
      recY += recLines.length * 4 + 4;
    });

    y = recY + 4;
  }

  // ════════════════════════════════════════════════════════════════
  // ESTIMATED IMPACT (ROI)
  // ════════════════════════════════════════════════════════════════
  const roiEstimates = estimateROI(decomposition.gaps, decomposition.steps, costContext);
  if (roiEstimates.length > 0) {
    drawHorizontalRule();
    drawSectionHeader("Estimated Impact");

    // Disclaimer
    checkPageBreak(14);
    doc.setFillColor(255, 248, 240); // warm cream
    doc.roundedRect(margin, y, contentWidth, 10, 2, 2, "F");
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...muted);
    const disclaimerText = costContext?.hourlyRate
      ? "Estimates below use the hourly rate you provided. Ranges reflect uncertainty in time savings. Validate with your team before making investment decisions."
      : "Estimates below use conservative industry defaults. All figures are approximate ranges, not guarantees. Provide team cost data for more accurate projections.";
    const disclaimerLines = doc.splitTextToSize(disclaimerText, contentWidth - 12);
    doc.text(disclaimerLines, margin + 6, y + 5);
    y += 12;

    const accentOrange: [number, number, number] = [232, 85, 58]; // #E8553A

    roiEstimates.forEach((est) => {
      // Estimate height: label + value line (~6mm) + detail text + assumption text + spacing
      const detailLines = doc.splitTextToSize(est.detail, contentWidth - 14);
      const assumptionLines = doc.splitTextToSize(est.assumption, contentWidth - 14);
      const estHeight = 8 + detailLines.length * 3.8 + assumptionLines.length * 3.5 + 10;
      checkPageBreak(estHeight);

      // Card background
      doc.setFillColor(...bgLight);
      doc.roundedRect(margin, y, contentWidth, estHeight - 2, 2, 2, "F");

      // Left accent bar
      doc.setFillColor(...accentOrange);
      doc.rect(margin, y, 2, estHeight - 2, "F");

      // Label in accent color
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...accentOrange);
      doc.text(est.label, margin + 6, y + 5);

      // Value in bold dark
      const labelWidth = doc.getTextWidth(est.label);
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(est.value, margin + 6 + labelWidth + 6, y + 5);

      // Detail text
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...bodyText);
      doc.text(detailLines, margin + 6, y + 10);

      // Assumption text (italic, muted)
      const assumptionY = y + 10 + detailLines.length * 3.8 + 2;
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(...muted);
      doc.text(assumptionLines, margin + 6, assumptionY);

      y += estHeight;
    });

    y += 4;
  }

  // ════════════════════════════════════════════════════════════════
  // IMPLEMENTATION ROADMAP (Action Plan)
  // ════════════════════════════════════════════════════════════════
  const actionPlan = generateActionPlan(decomposition.gaps, decomposition.steps);
  if (actionPlan.length > 0) {
    drawHorizontalRule();
    drawSectionHeader("Implementation Roadmap");

    const accentOrange: [number, number, number] = [232, 85, 58]; // #E8553A

    actionPlan.forEach((phase) => {
      // Calculate height needed for this phase
      let phaseHeight = 10; // header + timeline badge
      phase.items.forEach((item) => {
        const itemLines = doc.splitTextToSize(item, contentWidth - 18);
        phaseHeight += itemLines.length * 3.8 + 3;
      });
      phaseHeight += 4; // bottom spacing

      checkPageBreak(phaseHeight);

      // Phase header
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...dark);
      doc.text(phase.phase, margin, y);

      // Timeline badge
      doc.setFontSize(7);
      doc.setFont("helvetica", "bold");
      const timelineTextWidth = doc.getTextWidth(phase.timeline) + 6;
      const timelineBadgeX = pageWidth - margin - timelineTextWidth;
      doc.setFillColor(...accentOrange);
      doc.roundedRect(timelineBadgeX, y - 3.5, timelineTextWidth, 5.5, 1.5, 1.5, "F");
      doc.setTextColor(...white);
      doc.text(phase.timeline, timelineBadgeX + 3, y - 0.3);

      y += 6;

      // Bulleted items
      phase.items.forEach((item) => {
        const itemLines = doc.splitTextToSize(item, contentWidth - 18);
        const itemHeight = itemLines.length * 3.8 + 3;
        checkPageBreak(itemHeight);

        // Bullet dot
        doc.setFillColor(...accentOrange);
        doc.circle(margin + 4, y - 1, 1, "F");

        // Item text
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...bodyText);
        doc.text(itemLines, margin + 8, y);
        y += itemLines.length * 3.8 + 3;
      });

      y += 4;
    });
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
      `Workflow X-Ray Report  \u2022  Page ${p} of ${pageCount}  \u2022  Confidential`,
      pageWidth / 2,
      pageHeight - 11,
      { align: "center" }
    );
  }

  // ── Save ──
  const filename = `${decomposition.title.replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase()}-xray-report.pdf`;
  doc.save(filename);
}
