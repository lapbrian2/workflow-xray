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
  };
}

export default function FlowNode({ data }: FlowNodeProps) {
  const { step, selected, onClick } = data;
  const color = LAYER_COLORS[step.layer];
  const [hovered, setHovered] = useState(false);

  const descriptionPreview =
    step.description && step.description.length > 60
      ? step.description.slice(0, 60) + "\u2026"
      : step.description || "";

  return (
    <div
      onClick={() => onClick(step.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: "12px 16px",
        borderRadius: "var(--radius-sm)",
        background: selected ? `${color}12` : "#fff",
        border: `2px solid ${selected ? color : color + "40"}`,
        minWidth: 180,
        maxWidth: 240,
        cursor: "pointer",
        transition: "all 0.2s",
        transform: hovered ? "scale(1.02)" : "scale(1)",
        boxShadow: selected
          ? `0 0 0 3px ${color}20`
          : hovered
            ? `0 4px 12px rgba(0,0,0,0.12)`
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

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: color, width: 8, height: 8, border: "2px solid #fff" }}
      />
    </div>
  );
}
