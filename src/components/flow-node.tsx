"use client";

import { useState } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Step } from "@/lib/types";
import { LAYER_COLORS, LAYER_LABELS } from "@/lib/types";

interface FlowNodeProps {
  data: {
    step: Step;
    selected: boolean;
    onClick: (id: string) => void;
    isCriticalPath?: boolean;
    gapCount?: number;
  };
}

const CRITICAL_COLOR = "#DC143C";
const GAP_COLOR = "#D4A017";

export default function FlowNode({ data }: FlowNodeProps) {
  const { step, selected, onClick, isCriticalPath = false, gapCount = 0 } = data;
  const color = LAYER_COLORS[step.layer];
  const [hovered, setHovered] = useState(false);

  const descriptionPreview =
    step.description && step.description.length > 60
      ? step.description.slice(0, 60) + "\u2026"
      : step.description || "";

  const criticalBorder = isCriticalPath
    ? `2px solid ${CRITICAL_COLOR}`
    : `2px solid ${selected ? color : color + "40"}`;

  const criticalShadow = isCriticalPath
    ? selected
      ? `0 0 0 3px ${CRITICAL_COLOR}30, 0 0 12px ${CRITICAL_COLOR}20`
      : hovered
        ? `0 0 12px ${CRITICAL_COLOR}25, 0 4px 12px rgba(0,0,0,0.12)`
        : `0 0 8px ${CRITICAL_COLOR}18, 0 1px 3px rgba(0,0,0,0.06)`
    : selected
      ? `0 0 0 3px ${color}20`
      : hovered
        ? `0 4px 12px rgba(0,0,0,0.12)`
        : "0 1px 3px rgba(0,0,0,0.06)";

  return (
    <div
      onClick={() => onClick(step.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "relative",
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        background: isCriticalPath
          ? selected
            ? `${CRITICAL_COLOR}10`
            : "#fff"
          : selected
            ? `${color}12`
            : "#fff",
        border: criticalBorder,
        minWidth: 180,
        maxWidth: 240,
        cursor: "pointer",
        transition: "all 0.2s",
        transform: hovered ? "scale(1.02)" : "scale(1)",
        boxShadow: criticalShadow,
        animation: isCriticalPath ? "criticalPulse 3s ease-in-out infinite" : undefined,
      }}
    >
      {/* Injected keyframes for critical path pulse */}
      {isCriticalPath && (
        <style>{`
          @keyframes criticalPulse {
            0%, 100% { box-shadow: ${criticalShadow}; }
            50% { box-shadow: 0 0 14px ${CRITICAL_COLOR}30, 0 1px 3px rgba(0,0,0,0.06); }
          }
        `}</style>
      )}

      {/* Gap warning badge */}
      {gapCount > 0 && (
        <div
          style={{
            position: "absolute",
            top: -8,
            right: -8,
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: GAP_COLOR,
            color: "#fff",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 8,
            boxShadow: `0 1px 4px ${GAP_COLOR}50`,
            zIndex: 2,
            lineHeight: 1,
          }}
        >
          <span style={{ fontSize: 10 }}>{"\u26A0"}</span>
          {gapCount}
        </div>
      )}

      <Handle
        type="target"
        position={Position.Top}
        style={{ background: isCriticalPath ? CRITICAL_COLOR : color, width: 8, height: 8, border: "2px solid #fff" }}
      />

      {/* Layer badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            color,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {LAYER_LABELS[step.layer]}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "#fff",
            background: color,
            padding: "2px 8px",
            borderRadius: 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
          }}
        >
          <span style={{ fontSize: 9, fontWeight: 500, opacity: 0.85 }}>Auto:</span>
          {step.automationScore}%
        </span>
      </div>

      {/* Step name */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--color-dark)",
          fontFamily: "var(--font-mono)",
          lineHeight: 1.3,
          marginBottom: descriptionPreview ? 2 : 4,
        }}
      >
        {step.name}
      </div>

      {/* Description preview */}
      {descriptionPreview && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.4,
            marginBottom: 4,
          }}
        >
          {descriptionPreview}
        </div>
      )}

      {/* Owner */}
      {step.owner && (
        <div
          style={{
            fontSize: 11,
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          {step.owner}
        </div>
      )}

      {/* Tools */}
      {step.tools.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
          {step.tools.map((tool) => (
            <span
              key={tool}
              style={{
                fontSize: 9,
                fontFamily: "var(--font-mono)",
                padding: "1px 5px",
                borderRadius: 3,
                background: `${color}15`,
                color,
              }}
            >
              {tool}
            </span>
          ))}
        </div>
      )}

      {/* Input / Output indicator */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 4,
          marginTop: 10,
          paddingTop: 8,
          borderTop: `1px solid var(--color-border)`,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--color-muted)",
          }}
        >
          {step.inputs.length}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-muted)",
            opacity: 0.6,
          }}
        >
          {"\u2192"}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            color: "var(--color-muted)",
          }}
        >
          {step.outputs.length}
        </span>
      </div>

      {/* Critical path badge */}
      {isCriticalPath && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 6,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              fontWeight: 700,
              color: CRITICAL_COLOR,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: `${CRITICAL_COLOR}10`,
              padding: "2px 8px",
              borderRadius: 4,
              border: `1px solid ${CRITICAL_COLOR}30`,
            }}
          >
            CRITICAL PATH
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: isCriticalPath ? CRITICAL_COLOR : color, width: 8, height: 8, border: "2px solid #fff" }}
      />
    </div>
  );
}
