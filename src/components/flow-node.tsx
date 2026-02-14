"use client";

import { Handle, Position } from "@xyflow/react";
import type { Step } from "@/lib/types";
import { LAYER_COLORS, LAYER_LABELS } from "@/lib/types";

interface FlowNodeProps {
  data: {
    step: Step;
    selected: boolean;
    onClick: (id: string) => void;
  };
}

export default function FlowNode({ data }: FlowNodeProps) {
  const { step, selected, onClick } = data;
  const color = LAYER_COLORS[step.layer];

  return (
    <div
      onClick={() => onClick(step.id)}
      style={{
        padding: "12px 16px",
        borderRadius: 10,
        background: selected ? `${color}12` : "#fff",
        border: `2px solid ${selected ? color : color + "40"}`,
        minWidth: 180,
        maxWidth: 240,
        cursor: "pointer",
        transition: "all 0.2s",
        boxShadow: selected
          ? `0 0 0 3px ${color}20`
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff" }}
      />

      {/* Layer badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
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
            padding: "1px 6px",
            borderRadius: 4,
          }}
        >
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
          marginBottom: 4,
        }}
      >
        {step.name}
      </div>

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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 6 }}>
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

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff" }}
      />
    </div>
  );
}
