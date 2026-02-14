"use client";

import type { Gap } from "@/lib/types";
import GapCard from "./gap-card";

interface GapAnalysisProps {
  gaps: Gap[];
}

export default function GapAnalysis({ gaps }: GapAnalysisProps) {
  if (gaps.length === 0) {
    return (
      <div
        style={{
          textAlign: "center",
          padding: "40px 20px",
          color: "var(--color-muted)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
        }}
      >
        No gaps detected in this workflow. Looking good!
      </div>
    );
  }

  const highGaps = gaps.filter((g) => g.severity === "high");
  const mediumGaps = gaps.filter((g) => g.severity === "medium");
  const lowGaps = gaps.filter((g) => g.severity === "low");

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 8,
          marginBottom: 16,
          flexWrap: "wrap",
        }}
      >
        {highGaps.length > 0 && (
          <Badge count={highGaps.length} label="high" color="#E8553A" />
        )}
        {mediumGaps.length > 0 && (
          <Badge count={mediumGaps.length} label="medium" color="#D4A017" />
        )}
        {lowGaps.length > 0 && (
          <Badge count={lowGaps.length} label="low" color="#17A589" />
        )}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 12,
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
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        padding: "4px 10px",
        borderRadius: 5,
        background: `${color}12`,
        color,
      }}
    >
      {count} {label}
    </span>
  );
}
