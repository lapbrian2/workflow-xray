"use client";

import type { StageInput } from "@/lib/types";
import StageCard from "./stage-card";

interface StructuredFormProps {
  stages: StageInput[];
  onStagesChange: (stages: StageInput[]) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

const emptyStage: StageInput = {
  name: "",
  owner: "",
  tools: "",
  inputs: "",
  outputs: "",
};

export default function StructuredForm({
  stages,
  onStagesChange,
  onSubmit,
  disabled,
}: StructuredFormProps) {
  const handleChange = (
    index: number,
    field: keyof StageInput,
    value: string
  ) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    onStagesChange(updated);
  };

  const handleAdd = () => {
    onStagesChange([...stages, { ...emptyStage }]);
  };

  const handleRemove = (index: number) => {
    onStagesChange(stages.filter((_, i) => i !== index));
  };

  const filledStages = stages.filter((s) => s.name.trim());
  const canSubmit = filledStages.length >= 2;

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {stages.map((stage, i) => (
          <StageCard
            key={i}
            stage={stage}
            index={i}
            onChange={handleChange}
            onRemove={handleRemove}
            disabled={disabled}
          />
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 16,
        }}
      >
        <button
          onClick={handleAdd}
          disabled={disabled}
          style={{
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px dashed var(--color-border)",
            background: "transparent",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-muted)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          + Add Stage
        </button>
        <button
          onClick={onSubmit}
          disabled={disabled || !canSubmit}
          style={{
            padding: "8px 24px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background:
              disabled || !canSubmit
                ? "var(--color-border)"
                : "var(--color-accent)",
            color:
              disabled || !canSubmit ? "var(--color-muted)" : "#fff",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            cursor: disabled || !canSubmit ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {disabled ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid #fff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
              Analyzing...
            </span>
          ) : (
            "Decompose Workflow"
          )}
        </button>
      </div>
    </div>
  );
}
