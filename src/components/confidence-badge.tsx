"use client";

import type { ConfidenceLevel } from "@/lib/types";

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  context?: string;
}

export default function ConfidenceBadge({ level, context }: ConfidenceBadgeProps) {
  const isHigh = level === "high";

  return (
    <span
      title={context}
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 9,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        padding: "2px 8px",
        borderRadius: 10,
        background: isHigh ? "var(--success-bg-light)" : "rgba(212,160,23,0.08)",
        color: isHigh ? "var(--color-success)" : "var(--color-warning)",
        border: isHigh
          ? "1px solid rgba(23,165,137,0.2)"
          : "1px solid rgba(212,160,23,0.2)",
        cursor: context ? "help" : "default",
      }}
    >
      {isHigh ? "High Confidence" : "Inferred"}
    </span>
  );
}
