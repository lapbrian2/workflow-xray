"use client";

import type { Gap } from "@/lib/types";
import GapCard from "./gap-card";

interface GapAnalysisProps {
  gaps: Gap[];
  teamSize?: number;
  teamContext?: string;
}

export default function GapAnalysis({ gaps, teamSize, teamContext }: GapAnalysisProps) {
  if (gaps.length === 0) {
    return (
      <div className="empty-state">
        <div
          className="empty-state-icon"
          style={{
            background: "linear-gradient(135deg, var(--success-bg), #D5F5F0)",
            color: "var(--color-success)",
          }}
        >
          &#x2713;
        </div>
        <div className="empty-state-title" style={{ color: "var(--color-success)" }}>
          No gaps detected
        </div>
        <div className="empty-state-desc">
          This workflow looks well-structured with no significant gaps identified.
          Great job designing a robust process!
        </div>
      </div>
    );
  }

  const highGaps = gaps.filter((g) => g.severity === "high");
  const mediumGaps = gaps.filter((g) => g.severity === "medium");
  const lowGaps = gaps.filter((g) => g.severity === "low");

  return (
    <div>
      {teamSize && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 14px",
          background: "rgba(45,125,210,0.04)",
          border: "1px solid rgba(45,125,210,0.12)",
          borderRadius: "var(--radius-sm)",
          marginBottom: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
        }}>
          <span style={{ fontWeight: 600, color: "var(--color-info)" }}>
            Gap severity calibrated for {teamSize}-person team
          </span>
          {teamContext && (
            <span style={{ color: "var(--color-muted)", fontFamily: "var(--font-body)" }}>
              ({teamContext})
            </span>
          )}
        </div>
      )}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {highGaps.length > 0 && (
          <Badge count={highGaps.length} label="high" color="var(--color-accent)" />
        )}
        {mediumGaps.length > 0 && (
          <Badge count={mediumGaps.length} label="medium" color="var(--color-warning)" />
        )}
        {lowGaps.length > 0 && (
          <Badge count={lowGaps.length} label="low" color="var(--color-success)" />
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}
      >
        {gaps.map((gap, i) => (
          <GapCard key={i} gap={gap} index={i} />
        ))}
      </div>
    </div>
  );
}

function Badge({
  count,
  label,
  color,
}: {
  count: number;
  label: string;
  color: string;
}) {
  return (
    <span
      className="badge"
      style={{
        background: `${color}12`,
        color,
        border: `1px solid ${color}20`,
      }}
    >
      <span style={{ fontWeight: 800 }}>{count}</span> {label}
    </span>
  );
}
