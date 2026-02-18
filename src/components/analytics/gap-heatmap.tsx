"use client";

import type { GapPatternData } from "@/lib/analytics";
import { SEVERITY_COLORS } from "@/lib/types";

interface GapHeatmapProps {
  data: GapPatternData[];
  totalWorkflows: number;
}

export default function GapHeatmap({ data, totalWorkflows }: GapHeatmapProps) {
  if (data.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "32px 16px",
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--color-muted)",
          textAlign: "center",
        }}
      >
        <span style={{ color: "#17A589", fontSize: 18, fontWeight: 700 }}>&#x2713;</span>
        No gaps detected across your workflows
      </div>
    );
  }

  const MAX_BLOCKS = 20;

  return (
    <div>
      {/* Heatmap grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {/* Header row */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "160px 1fr 60px 80px",
            gap: 12,
            padding: "8px 12px",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <div>Gap Type</div>
          <div>Severity</div>
          <div style={{ textAlign: "right" }}>Count</div>
          <div style={{ textAlign: "right" }}>% Affected</div>
        </div>

        {/* Data rows */}
        {data.map((gap, index) => {
          // Build severity blocks array
          const blocks: Array<{ color: string; severity: string }> = [];
          for (let i = 0; i < gap.severities.high; i++) {
            blocks.push({ color: SEVERITY_COLORS.high, severity: "high" });
          }
          for (let i = 0; i < gap.severities.medium; i++) {
            blocks.push({ color: SEVERITY_COLORS.medium, severity: "medium" });
          }
          for (let i = 0; i < gap.severities.low; i++) {
            blocks.push({ color: SEVERITY_COLORS.low, severity: "low" });
          }

          const displayBlocks = blocks.slice(0, MAX_BLOCKS);
          const overflow = blocks.length - MAX_BLOCKS;

          return (
            <div
              key={gap.type}
              style={{
                display: "grid",
                gridTemplateColumns: "160px 1fr 60px 80px",
                gap: 12,
                padding: "10px 12px",
                alignItems: "center",
                background:
                  index % 2 === 0
                    ? "var(--color-surface)"
                    : "var(--color-surface-alt)",
                borderRadius: "var(--radius-sm)",
              }}
            >
              {/* Gap Type Label */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--color-dark)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {gap.label}
              </div>

              {/* Severity Blocks */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  flexWrap: "wrap",
                }}
              >
                {displayBlocks.map((block, i) => (
                  <div
                    key={i}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 2,
                      background: block.color,
                      opacity: 0.85,
                      flexShrink: 0,
                    }}
                  />
                ))}
                {overflow > 0 && (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      color: "var(--color-muted)",
                      marginLeft: 4,
                    }}
                  >
                    +{overflow} more
                  </span>
                )}
              </div>

              {/* Count */}
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  fontWeight: 700,
                  color: "var(--color-dark)",
                  textAlign: "right",
                }}
              >
                {gap.total}
              </div>

              {/* % Affected bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: 8,
                    background: "var(--color-border)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${gap.percentAffected}%`,
                      height: "100%",
                      background:
                        gap.percentAffected > 60
                          ? SEVERITY_COLORS.high
                          : gap.percentAffected > 30
                            ? SEVERITY_COLORS.medium
                            : SEVERITY_COLORS.low,
                      borderRadius: 4,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-muted)",
                    minWidth: 28,
                    textAlign: "right",
                  }}
                >
                  {gap.percentAffected}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginTop: 16,
          paddingTop: 12,
          borderTop: "1px solid var(--color-border)",
          justifyContent: "center",
        }}
      >
        {(["high", "medium", "low"] as const).map((severity) => (
          <div
            key={severity}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: SEVERITY_COLORS[severity],
                opacity: 0.85,
              }}
            />
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-muted)",
                textTransform: "capitalize",
              }}
            >
              {severity}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
