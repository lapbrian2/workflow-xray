"use client";

import type { Gap } from "@/lib/types";
import { GAP_LABELS, SEVERITY_COLORS } from "@/lib/types";

interface GapCardProps {
  gap: Gap;
  index: number;
}

const GAP_ICONS: Record<string, string> = {
  bottleneck: "\u26A0",
  context_loss: "\u21C4",
  single_dependency: "\u26D4",
  manual_overhead: "\u23F1",
};

export default function GapCard({ gap, index }: GapCardProps) {
  const sevColor = SEVERITY_COLORS[gap.severity];

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "16px 20px",
        animation: `slideUp 0.3s ease ${index * 0.06}s both`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>{GAP_ICONS[gap.type]}</span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: "var(--color-dark)",
              letterSpacing: "0.03em",
            }}
          >
            {GAP_LABELS[gap.type]}
          </span>
        </div>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: sevColor,
            background: `${sevColor}15`,
            padding: "3px 8px",
            borderRadius: 4,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {gap.severity}
        </span>
      </div>

      {/* Description */}
      <p
        style={{
          fontSize: 13.5,
          color: "var(--color-text)",
          lineHeight: 1.6,
          marginBottom: 12,
        }}
      >
        {gap.description}
      </p>

      {/* Suggestion */}
      <div
        style={{
          padding: "10px 14px",
          background: "#E9F7EF",
          borderRadius: 7,
          borderLeft: "3px solid #17A589",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "#17A589",
            letterSpacing: "0.06em",
            marginBottom: 4,
          }}
        >
          SUGGESTION
        </div>
        <div
          style={{
            fontSize: 13,
            color: "#1E5631",
            lineHeight: 1.55,
          }}
        >
          {gap.suggestion}
        </div>
      </div>

      {/* Affected steps */}
      {gap.stepIds.length > 0 && (
        <div
          style={{
            marginTop: 10,
            display: "flex",
            gap: 4,
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-muted)",
              marginRight: 4,
            }}
          >
            Affects:
          </span>
          {gap.stepIds.map((id) => (
            <span
              key={id}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                padding: "1px 6px",
                borderRadius: 3,
                background: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              {id}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
