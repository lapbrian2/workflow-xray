"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { Workflow, CompareResult } from "@/lib/types";
import { listWorkflowsLocal, mergeWithServer } from "@/lib/client-db";
import CompareView from "@/components/compare-view";

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
    } catch {
      console.error("Compare PDF export failed");
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
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 32px 64px" }}>
      <Link
        href="/library"
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-muted)",
          textDecoration: "none",
          marginBottom: 8,
          display: "inline-block",
        }}
      >
        &larr; Library
      </Link>
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
        Compare Workflows
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--color-text)",
          marginBottom: 24,
        }}
      >
        Select two workflows to compare side-by-side. See what changed, what
        improved, and what needs attention.
      </p>

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
                ? "var(--color-accent)"
                : "var(--color-border)",
            color: selected[0] && selected[1] ? "#fff" : "var(--color-muted)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            cursor:
              selected[0] && selected[1] && !comparing ? "pointer" : "default",
            opacity: comparing ? 0.7 : 1,
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 6,
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
            <div style={{ textAlign: "center", padding: "64px 24px" }}>
              <div
                style={{
                  fontSize: 16,
                  color: "var(--color-text)",
                  fontFamily: "var(--font-body)",
                  marginBottom: 8,
                }}
              >
                No workflows to compare
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--color-muted)",
                  marginBottom: 16,
                }}
              >
                You need at least two saved workflows to use the compare feature.
              </div>
              <Link
                href="/"
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  color: "#fff",
                  background: "var(--color-accent)",
                  padding: "8px 24px",
                  borderRadius: "var(--radius-sm)",
                  textDecoration: "none",
                }}
              >
                Create a Workflow
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
                    style={{
                      padding: 16,
                      borderRadius: "var(--radius-sm)",
                      border: `2px solid ${
                        isFirst
                          ? "#2D7DD2"
                          : isSecond
                            ? "#17A589"
                            : "var(--color-border)"
                      }`,
                      background: isSelected
                        ? isFirst
                          ? "#2D7DD208"
                          : "#17A58908"
                        : "var(--color-surface)",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "all 0.15s",
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
            padding: 16,
            background: "#FDF0EE",
            borderRadius: "var(--radius-sm)",
            color: "#C0392B",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            marginBottom: 24,
          }}
        >
          {error}
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
