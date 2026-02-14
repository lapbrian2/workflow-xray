"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { saveWorkflowLocal } from "@/lib/client-db";
import type { StageInput } from "@/lib/types";
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
