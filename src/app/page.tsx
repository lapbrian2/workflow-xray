"use client";

import WorkflowInput from "@/components/workflow-input";
import { useStore } from "@/lib/store";

export default function Home() {
  const { error, isDecomposing } = useStore();

  return (
    <div
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 28px 80px",
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 36 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-muted)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Powered by Claude
        </div>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            color: "var(--color-dark)",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          X-Ray Any Workflow
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "var(--color-text)",
            fontFamily: "var(--font-body)",
            lineHeight: 1.7,
            maxWidth: 520,
            margin: "0 auto",
          }}
        >
          Describe a workflow in natural language. Get a visual decomposition
          with flow maps, gap analysis, and health scoring.
        </p>
      </div>

      {/* Loading indicator */}
      {isDecomposing && (
        <div
          style={{
            textAlign: "center",
            padding: "16px",
            marginBottom: 16,
            background: "#EDF4FC",
            borderRadius: 8,
            border: "1px solid #2D7DD220",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "#2D7DD2",
              fontWeight: 600,
            }}
          >
            Claude is analyzing your workflow...
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--color-text)",
              marginTop: 4,
            }}
          >
            This usually takes 3-8 seconds.
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "12px 16px",
            marginBottom: 16,
            background: "#FDF0EE",
            borderRadius: 8,
            border: "1px solid #E8553A20",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "#C0392B",
          }}
        >
          {error}
        </div>
      )}

      {/* Input */}
      <WorkflowInput />
    </div>
  );
}
