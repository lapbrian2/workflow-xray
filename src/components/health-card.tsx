"use client";

import type { HealthMetrics } from "@/lib/types";
import ScoreRing from "./score-ring";
import MetricBar from "./metric-bar";

interface HealthCardProps {
  health: HealthMetrics;
  stepCount: number;
  gapCount: number;
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
        />
        <StatBox label="Complexity" value={health.complexity} />
      </div>

      {/* Score rings */}
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
        <ScoreRing
          value={health.complexity}
          label="Complexity"
          color="#2D7DD2"
        />
        <ScoreRing
          value={health.fragility}
          label="Fragility"
          color="#E8553A"
        />
        <ScoreRing
          value={health.automationPotential}
          label="Automation"
          color="#17A589"
        />
        <ScoreRing
          value={health.teamLoadBalance}
          label="Team Balance"
          color="#8E44AD"
        />
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
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: "var(--color-dark)",
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
