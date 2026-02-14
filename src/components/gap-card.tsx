"use client";

import { useState } from "react";
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
  missing_feedback: "\u21BA",
  missing_fallback: "\u26A1",
  scope_ambiguity: "\u2753",
};

/** Subtle background tint based on severity */
function severityBg(severity: string): string {
  if (severity === "high") return "linear-gradient(135deg, rgba(232,85,58,0.03) 0%, rgba(232,85,58,0.01) 100%)";
  if (severity === "medium") return "linear-gradient(135deg, rgba(212,160,23,0.03) 0%, rgba(212,160,23,0.01) 100%)";
  return "linear-gradient(135deg, rgba(23,165,137,0.03) 0%, rgba(23,165,137,0.01) 100%)";
}

/** Hover background tint based on severity */
function severityBgHover(severity: string): string {
  if (severity === "high") return "linear-gradient(135deg, rgba(232,85,58,0.06) 0%, rgba(232,85,58,0.02) 100%)";
  if (severity === "medium") return "linear-gradient(135deg, rgba(212,160,23,0.06) 0%, rgba(212,160,23,0.02) 100%)";
  return "linear-gradient(135deg, rgba(23,165,137,0.06) 0%, rgba(23,165,137,0.02) 100%)";
}

export default function GapCard({ gap, index }: GapCardProps) {
  const sevColor = SEVERITY_COLORS[gap.severity];
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(true);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? severityBgHover(gap.severity) : severityBg(gap.severity),
        border: `1px solid ${hovered ? sevColor + "40" : "var(--color-border)"}`,
        borderLeft: `3px solid ${sevColor}`,
        borderRadius: "var(--radius-lg)",
        padding: 0,
        animation: `staggerFadeIn 0.4s ease ${index * 0.07}s both`,
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered
          ? `0 16px 32px rgba(0,0,0,0.08), 0 0 0 1px ${sevColor}10`
          : "0 1px 3px rgba(0,0,0,0.03)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Animated severity bar for high severity */}
      {gap.severity === "high" && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 3,
            height: "100%",
            background: sevColor,
            animation: "severityPulseHigh 2s ease-in-out infinite",
            borderRadius: "var(--radius-lg) 0 0 var(--radius-lg)",
          }}
        />
      )}

      {/* Header - always visible, click to toggle */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          borderBottom: expanded ? `1px solid ${sevColor}12` : "none",
          transition: "border-bottom 0.2s ease",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 18,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              background: `${sevColor}10`,
              transition: "all 0.3s ease",
              transform: hovered ? "scale(1.1)" : "scale(1)",
            }}
          >
            {GAP_ICONS[gap.type]}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-dark)",
              letterSpacing: "0.03em",
            }}
          >
            {GAP_LABELS[gap.type]}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              color: "#fff",
              background: `linear-gradient(135deg, ${sevColor} 0%, ${sevColor}CC 100%)`,
              padding: "3px 10px",
              borderRadius: 12,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              boxShadow: `0 2px 8px ${sevColor}30`,
              transition: "all 0.3s ease",
              transform: hovered ? "scale(1.05)" : "scale(1)",
            }}
          >
            {gap.severity}
          </span>
          {/* Expand/collapse chevron */}
          <span
            style={{
              fontSize: 12,
              color: "var(--color-muted)",
              transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              display: "inline-block",
              lineHeight: 1,
            }}
          >
            &#9660;
          </span>
        </div>
      </div>

      {/* Collapsible body */}
      <div
        style={{
          overflow: "hidden",
          maxHeight: expanded ? 500 : 0,
          opacity: expanded ? 1 : 0,
          transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
          padding: expanded ? "12px 16px 16px" : "0 16px",
        }}
      >
        {/* Description */}
        <p
          style={{
            fontSize: 13,
            color: "var(--color-text)",
            lineHeight: 1.6,
            marginBottom: 14,
          }}
        >
          {gap.description}
        </p>

        {/* Suggestion */}
        <div
          style={{
            padding: "10px 16px",
            background: "linear-gradient(135deg, rgba(23,165,137,0.06) 0%, rgba(23,165,137,0.02) 100%)",
            borderRadius: "var(--radius-sm)",
            borderLeft: "3px solid #17A589",
            transition: "all 0.3s ease",
            transform: hovered ? "translateX(2px)" : "translateX(0)",
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
              textTransform: "uppercase",
            }}
          >
            Suggestion
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
              marginTop: 12,
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
            }}
          >
            {/* Step count badge */}
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--color-dark)",
                background: `${sevColor}12`,
                border: `1px solid ${sevColor}25`,
                padding: "3px 10px",
                borderRadius: 10,
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              Affects
              <span
                style={{
                  fontWeight: 700,
                  color: sevColor,
                }}
              >
                {gap.stepIds.length}
              </span>
              {gap.stepIds.length === 1 ? "step" : "steps"}
            </span>

            {/* Step ID tags */}
            {gap.stepIds.map((id) => (
              <span
                key={id}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  padding: "2px 8px",
                  borderRadius: 4,
                  background: "var(--color-border)",
                  color: "var(--color-text)",
                  transition: "all 0.2s ease",
                }}
              >
                {id}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
