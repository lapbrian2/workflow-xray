"use client";

import type { StageInput } from "@/lib/types";

interface StageCardProps {
  stage: StageInput;
  index: number;
  onChange: (index: number, field: keyof StageInput, value: string) => void;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

export default function StageCard({
  stage,
  index,
  onChange,
  onRemove,
  disabled,
}: StageCardProps) {
  const inputStyle = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--color-border)",
    fontFamily: "var(--font-body)",
    fontSize: 13,
    color: "var(--color-dark)",
    outline: "none",
    background: "var(--color-surface)",
  };

  const labelStyle = {
    fontFamily: "var(--font-mono)",
    fontSize: 10,
    fontWeight: 600 as const,
    color: "var(--color-muted)",
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
    marginBottom: 4,
    display: "block" as const,
  };

  return (
    <div
      style={{
        padding: 16,
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        animation: `slideUp 0.3s ease ${index * 0.05}s both`,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-accent)",
          }}
        >
          Stage {index + 1}
        </span>
        <button
          onClick={() => onRemove(index)}
          disabled={disabled}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 16,
            color: "var(--color-muted)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        >
          &times;
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Step Name</label>
          <input
            type="text"
            value={stage.name}
            onChange={(e) => onChange(index, "name", e.target.value)}
            disabled={disabled}
            placeholder="e.g., Review proposal"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Owner</label>
          <input
            type="text"
            value={stage.owner}
            onChange={(e) => onChange(index, "owner", e.target.value)}
            disabled={disabled}
            placeholder="e.g., Sarah"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Tools</label>
          <input
            type="text"
            value={stage.tools}
            onChange={(e) => onChange(index, "tools", e.target.value)}
            disabled={disabled}
            placeholder="e.g., Notion, Slack"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Inputs</label>
          <input
            type="text"
            value={stage.inputs}
            onChange={(e) => onChange(index, "inputs", e.target.value)}
            disabled={disabled}
            placeholder="e.g., Draft document"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>Outputs</label>
          <input
            type="text"
            value={stage.outputs}
            onChange={(e) => onChange(index, "outputs", e.target.value)}
            disabled={disabled}
            placeholder="e.g., Approved document"
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
