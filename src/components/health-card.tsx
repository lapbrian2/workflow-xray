"use client";

import type { HealthMetrics } from "@/lib/types";
import ScoreRing from "./score-ring";
import MetricBar from "./metric-bar";

interface HealthCardProps {
  health: HealthMetrics;
  stepCount: number;
  gapCount: number;
}

function scoreLabel(value: number): string {
  if (value >= 80) return "Excellent";
  if (value >= 60) return "Good";
  if (value >= 40) return "Fair";
  return "Poor";
}

function scoreColor(value: number): string {
  if (value >= 80) return "#17A589";
  if (value >= 60) return "#2D7DD2";
  if (value >= 40) return "#D4A017";
  return "#E8553A";
}

/** For metrics where high = bad (complexity, fragility), invert the color logic */
function invertedScoreColor(value: number): string {
  if (value <= 20) return "#17A589";
  if (value <= 40) return "#2D7DD2";
  if (value <= 60) return "#D4A017";
  return "#E8553A";
}

function invertedScoreLabel(value: number): string {
  if (value <= 20) return "Excellent";
  if (value <= 40) return "Good";
  if (value <= 60) return "Fair";
  return "Poor";
}

function statBoxColor(label: string, value: number): string {
  if (label === "Steps" || label === "Gaps") return "var(--color-dark)";
  if (label === "Complexity") return invertedScoreColor(value as number);
  if (label === "Avg Automation") return scoreColor(value as number);
  return "var(--color-dark)";
}

function statBoxBorderColor(label: string, value: number): string {
  if (label === "Complexity") return invertedScoreColor(value as number) + "40";
  if (label === "Avg Automation") return scoreColor(value as number) + "40";
  return "var(--color-border)";
}

function generateInterpretation(health: HealthMetrics): string {
  const issues: string[] = [];
  if (health.fragility >= 60) {
    issues.push("high fragility -- consider adding fallback mechanisms");
  }
  if (health.complexity >= 70) {
    issues.push("high complexity -- look for steps that can be merged or simplified");
  }
  if (health.automationPotential < 40) {
    issues.push("low automation potential -- identify manual steps that could be tooled");
  }
  if (health.teamLoadBalance < 40) {
    issues.push("uneven team load -- redistribute ownership across team members");
  }

  if (issues.length === 0) {
    return "This workflow is well-balanced with healthy scores across all dimensions.";
  }
  return "This workflow has " + issues.join("; ") + ".";
}

export default function HealthCard({
  health,
  stepCount,
  gapCount,
}: HealthCardProps) {
  return (
    <div>
      {/* Summary stats */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatBox label="Steps" value={stepCount} />
        <StatBox label="Gaps" value={gapCount} />
        <StatBox
          label="Avg Automation"
          value={`${health.automationPotential}%`}
          numericValue={health.automationPotential}
        />
        <StatBox
          label="Complexity"
          value={health.complexity}
          numericValue={health.complexity}
        />
      </div>

      {/* Score rings with interpretive labels */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          padding: "24px",
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          marginBottom: 24,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <ScoreRing
            value={health.complexity}
            label="Complexity"
            color="#2D7DD2"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: invertedScoreColor(health.complexity),
              marginTop: 6,
            }}
          >
            {invertedScoreLabel(health.complexity)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <ScoreRing
            value={health.fragility}
            label="Fragility"
            color="#E8553A"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: invertedScoreColor(health.fragility),
              marginTop: 6,
            }}
          >
            {invertedScoreLabel(health.fragility)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <ScoreRing
            value={health.automationPotential}
            label="Automation"
            color="#17A589"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: scoreColor(health.automationPotential),
              marginTop: 6,
            }}
          >
            {scoreLabel(health.automationPotential)}
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <ScoreRing
            value={health.teamLoadBalance}
            label="Team Balance"
            color="#8E44AD"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: scoreColor(health.teamLoadBalance),
              marginTop: 6,
            }}
          >
            {scoreLabel(health.teamLoadBalance)}
          </div>
        </div>
      </div>

      {/* Detailed bars */}
      <div
        style={{
          padding: 24,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Health Breakdown
        </div>
        <MetricBar
          label="Complexity"
          value={health.complexity}
          color="#2D7DD2"
        />
        <MetricBar
          label="Fragility"
          value={health.fragility}
          color="#E8553A"
        />
        <MetricBar
          label="Automation Potential"
          value={health.automationPotential}
          color="#17A589"
        />
        <MetricBar
          label="Team Load Balance"
          value={health.teamLoadBalance}
          color="#8E44AD"
        />

        {/* Interpretation line */}
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "#F7F8FA",
            borderRadius: "var(--radius-sm)",
            borderLeft: "3px solid var(--color-accent)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--color-accent)",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            INTERPRETATION
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text)",
              lineHeight: 1.55,
              fontFamily: "var(--font-body)",
            }}
          >
            {generateInterpretation(health)}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  numericValue,
}: {
  label: string;
  value: string | number;
  numericValue?: number;
}) {
  const nv = numericValue ?? (typeof value === "number" ? value : undefined);
  const accentColor = nv !== undefined ? statBoxColor(label, nv) : "var(--color-dark)";
  const borderColor = nv !== undefined ? statBoxBorderColor(label, nv) : "var(--color-border)";

  return (
    <div
      style={{
        padding: 16,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${borderColor}`,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: accentColor,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          fontWeight: 500,
          letterSpacing: "0.04em",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
