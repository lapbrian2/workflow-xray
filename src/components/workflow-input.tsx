"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { saveWorkflowLocal } from "@/lib/client-db";
import type { StageInput, CostContext } from "@/lib/types";
import FreeformInput from "./freeform-input";
import StructuredForm from "./structured-form";

interface WorkflowInputProps {
  initialText?: string;
  reanalyzeParentId?: string;
}

export default function WorkflowInput({
  initialText,
  reanalyzeParentId,
}: WorkflowInputProps = {}) {
  const router = useRouter();
  const { inputMode, setInputMode, isDecomposing, setIsDecomposing, setError } =
    useStore();

  const [text, setText] = useState(initialText || "");
  const [stages, setStages] = useState<StageInput[]>([
    { name: "", owner: "", tools: "", inputs: "", outputs: "" },
    { name: "", owner: "", tools: "", inputs: "", outputs: "" },
  ]);
  const [showCostContext, setShowCostContext] = useState(false);
  const [costContext, setCostContext] = useState<CostContext>({});

  const handleSubmit = async () => {
    setIsDecomposing(true);
    setError(null);

    try {
      const description =
        inputMode === "freeform"
          ? text
          : stages
              .filter((s) => s.name.trim())
              .map(
                (s, i) =>
                  `Step ${i + 1}: ${s.name}${s.owner ? ` (owner: ${s.owner})` : ""}${s.tools ? ` [tools: ${s.tools}]` : ""}${s.inputs ? ` — inputs: ${s.inputs}` : ""}${s.outputs ? ` — outputs: ${s.outputs}` : ""}`
              )
              .join("\n");

      const res = await fetch("/api/decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          stages: inputMode === "structured" ? stages : undefined,
          ...(reanalyzeParentId ? { parentId: reanalyzeParentId } : {}),
          ...(costContext.hourlyRate || costContext.hoursPerStep
            ? { costContext }
            : {}),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Decomposition failed");
      }

      const workflow = await res.json();
      // Persist to localStorage for immediate availability
      saveWorkflowLocal(workflow);
      router.push(`/xray/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsDecomposing(false);
    }
  };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Mode toggle */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 16,
          background: "var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: 4,
          width: "fit-content",
        }}
      >
        {(["freeform", "structured"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setInputMode(mode)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background:
                inputMode === mode ? "var(--color-surface)" : "transparent",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: inputMode === mode ? 600 : 400,
              color:
                inputMode === mode ? "var(--color-dark)" : "var(--color-muted)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {mode === "freeform" ? "Natural Language" : "Structured"}
          </button>
        ))}
      </div>

      {/* Cost context (optional) */}
      <div style={{ marginBottom: 16 }}>
        <button
          onClick={() => setShowCostContext(!showCostContext)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-muted)",
            padding: "4px 0",
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transition: "transform 0.2s",
              transform: showCostContext ? "rotate(90deg)" : "rotate(0deg)",
              fontSize: 10,
            }}
          >
            &#9654;
          </span>
          Cost Context (optional — improves ROI estimates)
        </button>

        {showCostContext && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginTop: 8,
              padding: "12px 16px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--color-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Avg. Team Hourly Rate ($)
              </label>
              <input
                type="number"
                min={0}
                step={5}
                placeholder="e.g. 75"
                value={costContext.hourlyRate ?? ""}
                onChange={(e) =>
                  setCostContext((c) => ({
                    ...c,
                    hourlyRate: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "#fff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--color-dark)",
                  outline: "none",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--color-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Avg. Hours Per Step
              </label>
              <input
                type="number"
                min={0}
                step={0.5}
                placeholder="e.g. 2"
                value={costContext.hoursPerStep ?? ""}
                onChange={(e) =>
                  setCostContext((c) => ({
                    ...c,
                    hoursPerStep: e.target.value ? Number(e.target.value) : undefined,
                  }))
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--color-border)",
                  background: "#fff",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "var(--color-dark)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        )}

        {showCostContext && (
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 11,
              color: "var(--color-muted)",
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Providing cost data produces more accurate ROI estimates. Without
            it, the report will use conservative ranges and clearly label
            assumptions.
          </p>
        )}
      </div>

      {inputMode === "freeform" ? (
        <FreeformInput
          value={text}
          onChange={setText}
          onSubmit={handleSubmit}
          disabled={isDecomposing}
        />
      ) : (
        <StructuredForm
          stages={stages}
          onStagesChange={setStages}
          onSubmit={handleSubmit}
          disabled={isDecomposing}
        />
      )}
    </div>
  );
}
