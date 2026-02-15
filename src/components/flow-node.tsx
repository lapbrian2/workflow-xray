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
    dimmed?: boolean;
    onHoverStart?: (id: string) => void;
    onHoverEnd?: () => void;
  };
}

const CRITICAL_HEX = "#DC143C";
const GAP_COLOR = "#D4A017";

export default function FlowNode({ data }: FlowNodeProps) {
  const {
    step,
    selected,
    onClick,
    isCriticalPath = false,
    gapCount = 0,
    dimmed = false,
    onHoverStart,
    onHoverEnd,
  } = data;
  const color = LAYER_COLORS[step.layer];
  const [hovered, setHovered] = useState(false);

  const criticalBorder = isCriticalPath
    ? `2px solid ${CRITICAL_HEX}`
    : `2px solid ${selected ? color : color + "40"}`;

  const criticalShadow = isCriticalPath
    ? selected
      ? `0 0 0 3px ${CRITICAL_HEX}30, 0 0 12px ${CRITICAL_HEX}20`
      : hovered
        ? `0 0 12px ${CRITICAL_HEX}25, 0 4px 12px rgba(0,0,0,0.12)`
        : `0 0 8px ${CRITICAL_HEX}18, 0 1px 3px rgba(0,0,0,0.06)`
    : selected
      ? `0 0 0 3px ${color}20`
      : hovered
        ? `0 4px 12px rgba(0,0,0,0.12)`
        : "0 1px 3px rgba(0,0,0,0.06)";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Step: ${step.name}, ${LAYER_LABELS[step.layer]} layer, ${step.automationScore}% automation`}
      onClick={() => onClick(step.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick(step.id);
        }
      }}
      onMouseEnter={() => {
        setHovered(true);
        onHoverStart?.(step.id);
      }}
      onMouseLeave={() => {
        setHovered(false);
        onHoverEnd?.();
      }}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        position: "relative",
        padding: "10px 14px",
        borderRadius: "var(--radius-sm)",
        background: isCriticalPath
          ? selected
            ? `${CRITICAL_HEX}10`
            : "var(--color-surface, #fff)"
          : selected
            ? `${color}12`
            : "var(--color-surface, #fff)",
        border: criticalBorder,
        minWidth: 160,
        maxWidth: 200,
        cursor: "pointer",
        transition: "all 0.2s ease",
        transform: hovered ? "scale(1.03)" : "scale(1)",
        boxShadow: criticalShadow,
        opacity: dimmed ? 0.25 : 1,
        animation: isCriticalPath ? "criticalPulse 3s ease-in-out infinite" : undefined,
      }}
    >
      {/* Injected keyframes for critical path pulse */}
      {isCriticalPath && (
        <style>{`
          @keyframes criticalPulse {
            0%, 100% { box-shadow: ${criticalShadow}; }
            50% { box-shadow: 0 0 14px ${CRITICAL_HEX}30, 0 1px 3px rgba(0,0,0,0.06); }
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
            color: "var(--color-light, #fff)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: 8,
            boxShadow: "0 1px 4px rgba(212,160,23,0.5)",
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
        style={{ background: isCriticalPath ? CRITICAL_HEX : color, width: 8, height: 8, border: "2px solid var(--color-surface, #fff)" }}
      />

      {/* Layer badge + thin automation bar */}
      <div style={{ marginBottom: 6 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
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
              fontSize: 9,
              fontWeight: 600,
              color,
              opacity: 0.8,
            }}
          >
            {step.automationScore}%
          </span>
        </div>
        <div
          style={{
            height: 3,
            borderRadius: 2,
            background: `${color}20`,
            marginTop: 3,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${step.automationScore}%`,
              height: "100%",
              background: color,
              borderRadius: 2,
              transition: "width 0.4s ease",
            }}
          />
        </div>
      </div>

      {/* Step name */}
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: "var(--color-dark)",
          fontFamily: "var(--font-mono)",
          lineHeight: 1.3,
          marginBottom: 6,
        }}
      >
        {step.name}
      </div>

      {/* Compact metadata row: tools + I/O */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 9,
          fontFamily: "var(--font-mono)",
          color: "var(--color-muted)",
        }}
      >
        <span>
          {step.inputs.length} in / {step.outputs.length} out
        </span>
        {step.tools.length > 0 && (
          <span style={{ opacity: 0.7 }}>
            {step.tools.length} tool{step.tools.length !== 1 ? "s" : ""}
          </span>
        )}
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
              color: CRITICAL_HEX,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              background: `${CRITICAL_HEX}10`,
              padding: "2px 8px",
              borderRadius: 4,
              border: `1px solid ${CRITICAL_HEX}30`,
            }}
          >
            CRITICAL PATH
          </span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: isCriticalPath ? CRITICAL_HEX : color, width: 8, height: 8, border: "2px solid var(--color-surface, #fff)" }}
      />
    </div>
  );
}
