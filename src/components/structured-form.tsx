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

  const canSubmit = stages.length >= 2 && stages.every((s) => s.name.trim());

  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
          marginTop: 12,
        }}
      >
        <button
          onClick={handleAdd}
          disabled={disabled}
          style={{
            padding: "8px 16px",
            borderRadius: 7,
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
            padding: "10px 24px",
            borderRadius: 8,
            border: "none",
            background:
              disabled || !canSubmit
                ? "var(--color-border)"
                : "var(--color-dark)",
            color:
              disabled || !canSubmit ? "var(--color-muted)" : "#F0F2F5",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            cursor: disabled || !canSubmit ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          {disabled ? "Analyzing..." : "Decompose Workflow"}
        </button>
      </div>
    </div>
  );
}
