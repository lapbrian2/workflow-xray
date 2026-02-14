"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Workflow, CompareResult } from "@/lib/types";
import { listWorkflowsLocal, mergeWithServer } from "@/lib/client-db";
import CompareView from "@/components/compare-view";
import { useToast } from "@/components/toast";

export default function ComparePage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<[string | null, string | null]>([
    null,
    null,
  ]);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    // Load from localStorage first (instant)
    const localWorkflows = listWorkflowsLocal();
    if (localWorkflows.length > 0) {
      setWorkflows(localWorkflows);
      setLoading(false);
    }

    // Then try server and merge
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((data) => {
        const serverWorkflows: Workflow[] = data.workflows || [];
        const merged = mergeWithServer(serverWorkflows);
        setWorkflows(merged);
      })
      .catch(() => {
        if (localWorkflows.length === 0) {
          setError("Failed to load workflows");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (id: string) => {
    setResult(null);
    setError(null);
    if (selected[0] === id) {
      setSelected([null, selected[1]]);
    } else if (selected[1] === id) {
      setSelected([selected[0], null]);
    } else if (!selected[0]) {
      setSelected([id, selected[1]]);
    } else if (!selected[1]) {
      setSelected([selected[0], id]);
    } else {
      setSelected([selected[0], id]);
    }
  };

  const handleCompare = async () => {
    if (!selected[0] || !selected[1]) return;

    const w1 = workflows.find((w) => w.id === selected[0]);
    const w2 = workflows.find((w) => w.id === selected[1]);
    if (!w1 || !w2) return;

    setComparing(true);
    setError(null);
    try {
      const res = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          before: w1.decomposition,
          after: w2.decomposition,
        }),
      });
      if (!res.ok) throw new Error("Comparison failed");
      const data = await res.json();
      setResult(data);
      addToast("success", "Comparison complete");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      addToast("error", msg);
    } finally {
      setComparing(false);
    }
  };

  const handleExportPdf = async () => {
    if (!result || !selected[0] || !selected[1]) return;
    const w1 = workflows.find((w) => w.id === selected[0]);
    const w2 = workflows.find((w) => w.id === selected[1]);
    if (!w1 || !w2) return;

    setExporting(true);
    try {
      const { exportComparePdf } = await import("@/lib/pdf-compare-export");
      await exportComparePdf(w1.decomposition, w2.decomposition, result);
      addToast("success", "Compare PDF downloaded");
    } catch {
      console.error("Compare PDF export failed");
      addToast("error", "PDF export failed");
    } finally {
      setExporting(false);
    }
  };

  const getSelectionWorkflow = (idx: 0 | 1) => {
    const id = selected[idx];
    if (!id) return null;
    return workflows.find((w) => w.id === id) || null;
  };

  const before = getSelectionWorkflow(0);
  const after = getSelectionWorkflow(1);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px) 64px" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 28, animation: "fadeInUp 0.4s var(--ease-spring) both" }}>
        <Link
          href="/library"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
            textDecoration: "none",
            marginBottom: 8,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: "var(--radius-xs)",
            transition: "all var(--duration-fast) var(--ease-default)",
          }}
        >
          &larr; Library
        </Link>
        <h1
          style={{
            fontSize: "clamp(28px, 5vw, 36px)",
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            marginBottom: 10,
            background:
              "linear-gradient(135deg, var(--color-dark) 0%, var(--color-accent) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Compare Workflows
        </h1>
        <p
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--color-text)",
          }}
        >
          Select two workflows to compare side-by-side. See what changed, what
          improved, and what needs attention.
        </p>
      </div>

      {/* Selection status bar */}
      <div
        style={{
          display: "flex",
          gap: 12,
          marginBottom: 24,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            flex: 1,
            minWidth: 200,
            padding: 12,
            borderRadius: "var(--radius-sm)",
            border: `2px solid ${before ? "#2D7DD2" : "var(--color-border)"}`,
            background: before ? "#2D7DD208" : "var(--color-surface)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "#2D7DD2",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            Before (Baseline)
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 700,
              color: before ? "var(--color-dark)" : "var(--color-muted)",
            }}
          >
            {before ? before.decomposition.title : "Select a workflow..."}
          </div>
        </div>

        <span
          style={{
            fontSize: 18,
            color: "var(--color-muted)",
            fontWeight: 700,
          }}
        >
          →
        </span>

        <div
          style={{
            flex: 1,
            minWidth: 200,
            padding: 12,
            borderRadius: "var(--radius-sm)",
            border: `2px solid ${after ? "#17A589" : "var(--color-border)"}`,
            background: after ? "#17A58908" : "var(--color-surface)",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "#17A589",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 4,
            }}
          >
            After (Updated)
          </div>
          <div
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 700,
              color: after ? "var(--color-dark)" : "var(--color-muted)",
            }}
          >
            {after ? after.decomposition.title : "Select a workflow..."}
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={!selected[0] || !selected[1] || comparing}
          style={{
            padding: "12px 24px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background:
              selected[0] && selected[1]
                ? "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 100%)"
                : "var(--color-border)",
            color: selected[0] && selected[1] ? "#fff" : "var(--color-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            cursor:
              selected[0] && selected[1] && !comparing ? "pointer" : "default",
            opacity: comparing ? 0.7 : 1,
            transition: "all var(--duration-normal) var(--ease-default)",
            display: "flex",
            alignItems: "center",
            gap: 6,
            boxShadow:
              selected[0] && selected[1]
                ? "var(--shadow-accent)"
                : "none",
          }}
        >
          {comparing ? (
            <>
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid rgba(255,255,255,0.3)",
                  borderTop: "2px solid #fff",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
              Comparing...
            </>
          ) : (
            "Compare"
          )}
        </button>
      </div>

      {/* Workflow selector grid */}
      {!result && (
        <>
          {loading && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  style={{
                    padding: 16,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)",
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    style={{
                      height: 14,
                      width: "60%",
                      background: "var(--color-border)",
                      borderRadius: 4,
                      marginBottom: 8,
                      animation: `pulse-slow 1.5s ease ${i * 0.15}s infinite`,
                    }}
                  />
                  <div
                    style={{
                      height: 10,
                      width: "40%",
                      background: "var(--color-border)",
                      borderRadius: 4,
                      animation: `pulse-slow 1.5s ease ${i * 0.15 + 0.1}s infinite`,
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {!loading && workflows.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">
                &#x2194;
              </div>
              <div className="empty-state-title">
                No workflows to compare
              </div>
              <div className="empty-state-desc">
                You need at least two saved workflows to use the compare feature.
                Create your first workflow to get started.
              </div>
              <Link
                href="/"
                className="btn-primary"
                style={{
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                Create a Workflow &rarr;
              </Link>
            </div>
          )}

          {!loading && workflows.length > 0 && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}
            >
              {workflows.map((w) => {
                const isFirst = selected[0] === w.id;
                const isSecond = selected[1] === w.id;
                const isSelected = isFirst || isSecond;

                return (
                  <button
                    key={w.id}
                    onClick={() => handleSelect(w.id)}
                    className="card-interactive"
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-lg)",
                      border: `2px solid ${
                        isFirst
                          ? "#2D7DD2"
                          : isSecond
                            ? "#17A589"
                            : "var(--color-border)"
                      }`,
                      background: isSelected
                        ? isFirst
                          ? "linear-gradient(135deg, #2D7DD208 0%, #2D7DD204 100%)"
                          : "linear-gradient(135deg, #17A58908 0%, #17A58904 100%)"
                        : "var(--color-surface)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all var(--duration-normal) var(--ease-default)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 4,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--color-dark)",
                        }}
                      >
                        {w.decomposition.title}
                      </span>
                      {isSelected && (
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 9,
                            fontWeight: 700,
                            color: isFirst ? "#2D7DD2" : "#17A589",
                            background: isFirst ? "#2D7DD215" : "#17A58915",
                            padding: "2px 6px",
                            borderRadius: 3,
                          }}
                        >
                          {isFirst ? "BEFORE" : "AFTER"}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        color: "var(--color-muted)",
                        display: "flex",
                        gap: 8,
                      }}
                    >
                      <span>{w.decomposition.steps.length} steps</span>
                      <span>{w.decomposition.gaps.length} gaps</span>
                      <span>
                        {w.decomposition.health.automationPotential}% auto
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 9,
                        color: "var(--color-muted)",
                        marginTop: 4,
                      }}
                    >
                      {new Date(w.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Error */}
      {error && (
        <div
          style={{
            padding: "14px 20px",
            background: "linear-gradient(135deg, rgba(253,240,238,0.95) 0%, rgba(255,230,225,0.9) 100%)",
            borderRadius: "var(--radius-lg)",
            border: "1px solid rgba(232,85,58,0.12)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 24,
            animation: "fadeInUpSm 0.35s var(--ease-default)",
            boxShadow: "0 2px 12px rgba(232,85,58,0.06)",
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "50%",
              background: "rgba(232,85,58,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              fontWeight: 700,
              color: "#C0392B",
              flexShrink: 0,
            }}
          >
            !
          </div>
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "#C0392B",
              lineHeight: 1.5,
            }}
          >
            {error}
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
              opacity: 0.6,
              flexShrink: 0,
              marginLeft: "auto",
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* Results */}
      {result && before && after && (
        <CompareView
          result={result}
          before={before.decomposition}
          after={after.decomposition}
          onExportPdf={handleExportPdf}
          exporting={exporting}
        />
      )}
    </div>
  );
}
