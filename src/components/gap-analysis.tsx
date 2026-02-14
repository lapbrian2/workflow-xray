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
          padding: "64px 24px",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "#E8F8F5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: 20,
            color: "#17A589",
          }}
        >
          &#x2713;
        </div>
        <div
          style={{
            fontSize: 15,
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            marginBottom: 4,
          }}
        >
          No gaps detected
        </div>
        <div
          style={{
            fontSize: 13,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          This workflow looks well-structured. Nice work!
        </div>
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
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 11,
        fontWeight: 600,
        padding: "4px 8px",
        borderRadius: 4,
        background: `${color}12`,
        color,
      }}
    >
      {count} {label}
    </span>
  );
}
