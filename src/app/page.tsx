"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import WorkflowInput from "@/components/workflow-input";
import { useStore } from "@/lib/store";
import { getWorkflowLocal } from "@/lib/client-db";
import type { Workflow } from "@/lib/types";

function HomeContent() {
  const { error, isDecomposing, setError } = useStore();
  const searchParams = useSearchParams();
  const reanalyzeId = searchParams.get("reanalyze");

  const [reanalyzeWorkflow, setReanalyzeWorkflow] = useState<Workflow | null>(
    null
  );
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false);

  useEffect(() => {
    if (!reanalyzeId) {
      setReanalyzeWorkflow(null);
      return;
    }
    setReanalyzeLoading(true);

    // Check localStorage first
    const local = getWorkflowLocal(reanalyzeId);
    if (local) {
      setReanalyzeWorkflow(local);
      setReanalyzeLoading(false);
    }

    // Then try server
    fetch(`/api/workflows?id=${reanalyzeId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data: Workflow) => setReanalyzeWorkflow(data))
      .catch(() => {
        if (!local) setReanalyzeWorkflow(null);
      })
      .finally(() => setReanalyzeLoading(false));
  }, [reanalyzeId]);

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "64px 32px 96px",
      }}
    >
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-muted)",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Powered by Claude
        </div>
        <h1
          style={{
            fontSize: 56,
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            color: "var(--color-dark)",
            letterSpacing: "-0.03em",
            lineHeight: 1.1,
            marginBottom: 16,
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
            maxWidth: 480,
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
            padding: "24px 32px",
            marginBottom: 24,
            background: "#EDF4FC",
            borderRadius: "var(--radius-lg)",
            border: "1px solid #2D7DD220",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              border: "3px solid #2D7DD230",
              borderTop: "3px solid #2D7DD2",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              flexShrink: 0,
            }}
          />
          <div>
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
                fontSize: 12,
                color: "var(--color-text)",
                marginTop: 4,
              }}
            >
              This usually takes 3-8 seconds.
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "16px 24px",
            marginBottom: 24,
            background: "#FDF0EE",
            borderRadius: "var(--radius-lg)",
            border: "1px solid #E8553A20",
            display: "flex",
            alignItems: "flex-start",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#E8553A20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginTop: 1,
              fontSize: 12,
              fontWeight: 700,
              color: "#C0392B",
            }}
          >
            !
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "#C0392B",
                fontWeight: 600,
                marginBottom: 4,
              }}
            >
              Decomposition failed
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "#C0392B",
                opacity: 0.8,
                lineHeight: 1.5,
              }}
            >
              {error}
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              color: "#C0392B",
              cursor: "pointer",
              padding: "2px 6px",
              borderRadius: 4,
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Re-analyze banner */}
      {reanalyzeId && !reanalyzeLoading && reanalyzeWorkflow && (
        <div
          style={{
            padding: "16px 24px",
            marginBottom: 24,
            background: "#FFF8F6",
            borderRadius: "var(--radius-lg)",
            border: "1px solid #E8553A30",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: "50%",
              background: "#E8553A20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-accent)",
            }}
          >
            &#x21bb;
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                color: "var(--color-accent)",
                fontWeight: 600,
                marginBottom: 2,
              }}
            >
              Re-analyzing: {reanalyzeWorkflow.decomposition.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 12,
                color: "var(--color-text)",
                opacity: 0.8,
              }}
            >
              This will create a new version.
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <WorkflowInput
          key={reanalyzeId || "default"}
          initialText={reanalyzeWorkflow?.description}
          reanalyzeParentId={reanalyzeId || undefined}
        />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}
