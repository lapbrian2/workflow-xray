"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Workflow,
  RemediationPlan,
  RemediationPhase,
  RemediationTask,
  ProjectedImpact,
} from "@/lib/types";
import {
  TASK_PRIORITY_COLORS,
  TASK_PRIORITY_LABELS,
  TASK_EFFORT_LABELS,
  GAP_LABELS,
} from "@/lib/types";
import { getWorkflowLocal } from "@/lib/client-db";
import { exportRemediationPdf } from "@/lib/pdf-remediation-export";

export default function RemediationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [plan, setPlan] = useState<RemediationPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState<string | null>(null);
  const [showTeamContext, setShowTeamContext] = useState(false);
  const [teamContext, setTeamContext] = useState({
    teamSize: "",
    budget: "",
    timeline: "",
    constraints: "",
  });

  const generateLock = useRef(false);
  const exportLock = useRef(false);
  const syncLock = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load workflow and check for existing plan
  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        // Try local first
        let wf = getWorkflowLocal(id);

        // Try server
        try {
          const res = await fetch(`/api/workflows?id=${id}`);
          if (res.ok) {
            wf = await res.json();
          }
        } catch {
          // Use local
        }

        if (cancelled) return;
        if (!wf) {
          setError("Workflow not found");
          setLoading(false);
          return;
        }

        setWorkflow(wf);

        // Check for existing remediation plan
        try {
          const planRes = await fetch(`/api/remediation?workflowId=${id}`);
          if (planRes.ok) {
            const data = await planRes.json();
            if (data.plan) {
              setPlan(data.plan);
              setActivePhase(data.plan.phases[0]?.id || null);
            }
          }
        } catch {
          // No existing plan — that's fine
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, [id]);

  // Elapsed timer during generation
  useEffect(() => {
    if (generating) {
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((e) => e + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [generating]);

  const loadingMessage = useMemo(() => {
    if (elapsed < 5) return "Analyzing gaps and building remediation strategy...";
    if (elapsed < 12) return "Prioritizing tasks across phases...";
    if (elapsed < 25) return "Projecting impact and defining success metrics...";
    if (elapsed < 45) return "Almost there — finalizing the plan...";
    return "Still working — complex workflows need more time...";
  }, [elapsed]);

  const handleGenerate = async () => {
    if (!workflow || generating || generateLock.current) return;
    generateLock.current = true;
    setGenerating(true);
    setError(null);

    try {
      const ctx: Record<string, unknown> = {};
      if (teamContext.teamSize) ctx.teamSize = parseInt(teamContext.teamSize);
      if (teamContext.budget) ctx.budget = teamContext.budget;
      if (teamContext.timeline) ctx.timeline = teamContext.timeline;
      if (teamContext.constraints) {
        ctx.constraints = teamContext.constraints.split(",").map((s) => s.trim()).filter(Boolean);
      }

      const res = await fetch("/api/remediation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflowId: workflow.id,
          teamContext: Object.keys(ctx).length > 0 ? ctx : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to generate plan");
      }

      const data = await res.json();
      setPlan(data.plan);
      setActivePhase(data.plan.phases[0]?.id || null);
      setShowTeamContext(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate remediation plan");
    } finally {
      setGenerating(false);
      generateLock.current = false;
    }
  };

  const handleExportPdf = async () => {
    if (!plan || !workflow || exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    try {
      await exportRemediationPdf(plan, workflow.decomposition);
    } catch (err) {
      setError(err instanceof Error ? err.message : "PDF export failed");
    } finally {
      setExporting(false);
      exportLock.current = false;
    }
  };

  const handleNotionSync = async () => {
    if (!plan || !workflow || syncing || syncLock.current) return;
    syncLock.current = true;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/remediation-notion-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          gaps: workflow.decomposition.gaps,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Sync failed");
      }
      const data = await res.json();
      setSynced(true);
      setNotionUrl(data.notionUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sync to Notion");
    } finally {
      setSyncing(false);
      syncLock.current = false;
    }
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px" }}>
        <div style={{ height: 12, width: 120, background: "var(--color-border)", borderRadius: 4, marginBottom: 8, animation: "pulse-slow 1.5s ease infinite" }} />
        <div style={{ height: 32, width: 400, background: "var(--color-border)", borderRadius: "var(--radius-sm)", marginBottom: 24, animation: "pulse-slow 1.5s ease 0.1s infinite" }} />
        <div style={{ height: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", animation: "pulse-slow 1.5s ease 0.2s infinite" }} />
      </div>
    );
  }

  // ── Error State (no workflow) ──
  if (!workflow) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px", textAlign: "center" }}>
        <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#FDF0EE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 24, color: "#E8553A", fontWeight: 700 }}>!</div>
        <div style={{ fontSize: 16, color: "#C0392B", fontFamily: "var(--font-body)", marginBottom: 8 }}>{error || "Workflow not found"}</div>
        <Link href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--color-accent)", textDecoration: "none" }}>Back to Home</Link>
      </div>
    );
  }

  const totalTasks = plan ? plan.phases.reduce((sum, p) => sum + p.tasks.length, 0) : 0;
  const currentPhase = plan?.phases.find((p) => p.id === activePhase);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 32px 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href={`/xray/${id}`}
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
            textDecoration: "none",
            marginBottom: 8,
            display: "inline-block",
          }}
        >
          &larr; Back to X-Ray
        </Link>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1
            style={{
              fontSize: 28,
              fontWeight: 900,
              fontFamily: "var(--font-display)",
              color: "var(--color-dark)",
              letterSpacing: "-0.02em",
            }}
          >
            Remediation Plan
          </h1>
          {plan && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--color-muted)" }}>
              {totalTasks} tasks across {plan.phases.length} phases
            </span>
          )}
        </div>
        <div style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-text)", marginTop: 4 }}>
          {workflow.decomposition.title}
        </div>

        {/* Action buttons */}
        {plan && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "#fff",
                padding: "4px 12px", borderRadius: 4, border: "none",
                background: "var(--color-accent)", cursor: exporting ? "wait" : "pointer",
                opacity: exporting ? 0.7 : 1, fontWeight: 600,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {exporting ? "Exporting..." : "Download PDF"}
            </button>
            <button
              onClick={handleNotionSync}
              disabled={syncing}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11,
                color: synced ? "#17A589" : "var(--color-dark)",
                padding: "4px 12px", borderRadius: 4,
                border: `1px solid ${synced ? "#17A58940" : "var(--color-border)"}`,
                background: synced ? "#17A58910" : "var(--color-surface)",
                cursor: syncing ? "default" : "pointer",
                fontWeight: 600, opacity: syncing ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: 6,
              }}
            >
              {syncing ? "Syncing..." : synced ? (
                <>
                  Synced
                  {notionUrl && (
                    <a
                      href={notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      style={{ color: "#17A589", textDecoration: "underline", fontSize: 10 }}
                    >
                      Open
                    </a>
                  )}
                </>
              ) : "Sync to Notion"}
            </button>
            <button
              onClick={() => { setPlan(null); setShowTeamContext(true); }}
              style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-dark)",
                padding: "4px 12px", borderRadius: 4,
                border: "1px solid var(--color-border)", background: "var(--color-surface)",
                cursor: "pointer", fontWeight: 600,
              }}
            >
              Regenerate
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div style={{
          padding: "10px 16px", borderRadius: "var(--radius-sm)", marginBottom: 16,
          background: "#FDF0EE", border: "1px solid #E8553A30", color: "#C0392B",
          fontFamily: "var(--font-mono)", fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {/* No plan yet — generation UI */}
      {!plan && !generating && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", padding: 32, textAlign: "center",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔧</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 700, color: "var(--color-dark)", marginBottom: 8 }}>
            Generate Remediation Plan
          </h2>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-text)", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
            Create a phased action plan to address the {workflow.decomposition.gaps.length} gaps identified in the diagnostic. Each task includes priority, owner, tools, and success metrics.
          </p>

          {/* Team Context Toggle */}
          <button
            onClick={() => setShowTeamContext(!showTeamContext)}
            style={{
              fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-muted)",
              background: "none", border: "none", cursor: "pointer",
              textDecoration: "underline", marginBottom: 16, display: "block",
              margin: "0 auto 16px",
            }}
          >
            {showTeamContext ? "Hide team context" : "+ Add team context (optional)"}
          </button>

          {showTeamContext && (
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
              maxWidth: 500, margin: "0 auto 24px", textAlign: "left",
            }}>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>Team Size</label>
                <input
                  type="number"
                  value={teamContext.teamSize}
                  onChange={(e) => setTeamContext((c) => ({ ...c, teamSize: e.target.value }))}
                  placeholder="e.g., 8"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                    fontSize: 13, outline: "none", background: "var(--color-bg)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>Budget</label>
                <input
                  value={teamContext.budget}
                  onChange={(e) => setTeamContext((c) => ({ ...c, budget: e.target.value }))}
                  placeholder="e.g., $5K/month"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                    fontSize: 13, outline: "none", background: "var(--color-bg)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>Timeline</label>
                <input
                  value={teamContext.timeline}
                  onChange={(e) => setTeamContext((c) => ({ ...c, timeline: e.target.value }))}
                  placeholder="e.g., 3 months"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                    fontSize: 13, outline: "none", background: "var(--color-bg)",
                  }}
                />
              </div>
              <div>
                <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4 }}>Constraints (comma-separated)</label>
                <input
                  value={teamContext.constraints}
                  onChange={(e) => setTeamContext((c) => ({ ...c, constraints: e.target.value }))}
                  placeholder="e.g., no new tools, remote-only"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                    fontSize: 13, outline: "none", background: "var(--color-bg)",
                  }}
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            style={{
              padding: "12px 36px", borderRadius: "var(--radius-sm)", border: "none",
              background: "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)",
              color: "#fff", fontFamily: "var(--font-mono)", fontSize: 14, fontWeight: 700,
              cursor: "pointer", boxShadow: "0 4px 16px rgba(232, 85, 58, 0.3)",
              transition: "all 0.2s",
            }}
          >
            Generate Plan
          </button>
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", padding: 48, textAlign: "center",
        }}>
          <div style={{
            width: 48, height: 48, border: "3px solid var(--color-border)",
            borderTop: "3px solid var(--color-accent)", borderRadius: "50%",
            animation: "spin 0.8s linear infinite", margin: "0 auto 20px",
          }} />
          <div style={{ fontFamily: "var(--font-body)", fontSize: 15, color: "var(--color-dark)", marginBottom: 8 }}>
            {loadingMessage}
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-muted)" }}>
            {elapsed}s elapsed
          </div>
        </div>
      )}

      {/* Plan exists — render it */}
      {plan && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          {/* Executive Summary */}
          <div style={{
            background: "linear-gradient(135deg, #1C2536 0%, #2a3a52 100%)",
            borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 20,
            color: "#F0F2F5",
          }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Executive Summary
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.7, margin: 0, color: "rgba(255,255,255,0.9)" }}>
              {plan.summary}
            </p>
          </div>

          {/* Phase tabs */}
          <div style={{
            display: "flex", gap: 2, marginBottom: 20,
            background: "var(--color-border)", borderRadius: "var(--radius-sm)",
            padding: 4, width: "fit-content",
          }}>
            {plan.phases.map((phase) => (
              <button
                key={phase.id}
                onClick={() => setActivePhase(phase.id)}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: "none",
                  background: activePhase === phase.id ? "var(--color-surface)" : "transparent",
                  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: activePhase === phase.id ? 600 : 400,
                  color: activePhase === phase.id ? "var(--color-dark)" : "var(--color-muted)",
                  cursor: "pointer", transition: "all 0.2s",
                }}
              >
                {phase.name}
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                  {phase.tasks.length}
                </span>
              </button>
            ))}
            <button
              onClick={() => setActivePhase("impact")}
              style={{
                padding: "8px 16px", borderRadius: 6, border: "none",
                background: activePhase === "impact" ? "var(--color-surface)" : "transparent",
                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: activePhase === "impact" ? 600 : 400,
                color: activePhase === "impact" ? "var(--color-dark)" : "var(--color-muted)",
                cursor: "pointer", transition: "all 0.2s",
              }}
            >
              Impact
            </button>
          </div>

          {/* Phase content */}
          {currentPhase && activePhase !== "impact" && (
            <div>
              {/* Phase header */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--color-dark)", margin: 0 }}>
                    {currentPhase.name}
                  </h2>
                  <span style={{
                    fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
                    padding: "2px 8px", borderRadius: 4,
                    background: "var(--color-accent)", color: "#fff",
                  }}>
                    {currentPhase.timeframe}
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-text)", margin: 0 }}>
                  {currentPhase.description}
                </p>
              </div>

              {/* Task cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {currentPhase.tasks.map((task, i) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    index={i}
                    gaps={workflow.decomposition.gaps}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Impact view */}
          {activePhase === "impact" && plan.projectedImpact.length > 0 && (
            <div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--color-dark)", marginBottom: 16 }}>
                Projected Impact
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {plan.projectedImpact.map((impact, i) => (
                  <ImpactCard key={i} impact={impact} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Task Card Component ──

function TaskCard({
  task,
  index,
  gaps,
}: {
  task: RemediationTask;
  index: number;
  gaps: { type: string; severity: string }[];
}) {
  const [expanded, setExpanded] = useState(false);
  const priorityColor = TASK_PRIORITY_COLORS[task.priority];

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: "var(--radius-sm)",
        padding: "16px 20px",
        cursor: "pointer",
        transition: "all 0.2s",
        animation: `fadeInUp 0.3s ease ${index * 0.05}s both`,
      }}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: expanded ? 12 : 0 }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
          padding: "2px 6px", borderRadius: 3,
          background: priorityColor + "18", color: priorityColor,
          textTransform: "uppercase",
        }}>
          {TASK_PRIORITY_LABELS[task.priority]}
        </span>
        <span style={{
          fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600,
          color: "var(--color-dark)", flex: 1,
        }}>
          {task.title}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)",
          whiteSpace: "nowrap",
        }}>
          {TASK_EFFORT_LABELS[task.effort]}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-muted)", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "rotate(0)" }}>
          ▾
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ animation: "fadeIn 0.2s ease" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-text)", lineHeight: 1.6, margin: "0 0 12px" }}>
            {task.description}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            {task.owner && (
              <MetaField label="Owner" value={task.owner} />
            )}
            {task.tools.length > 0 && (
              <MetaField label="Tools" value={task.tools.join(", ")} />
            )}
            {task.successMetric && (
              <MetaField label="Success Metric" value={task.successMetric} />
            )}
            {task.dependencies.length > 0 && (
              <MetaField label="Depends On" value={task.dependencies.join(", ")} />
            )}
          </div>

          {/* Addressed gaps */}
          {task.gapIds.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase", alignSelf: "center" }}>
                Addresses:
              </span>
              {task.gapIds.map((gapIdx) => {
                const gap = gaps[gapIdx];
                if (!gap) return null;
                return (
                  <span
                    key={gapIdx}
                    style={{
                      fontFamily: "var(--font-mono)", fontSize: 9,
                      padding: "2px 6px", borderRadius: 3,
                      background: "var(--color-border)", color: "var(--color-text)",
                    }}
                  >
                    {GAP_LABELS[gap.type as keyof typeof GAP_LABELS] || gap.type} ({gap.severity})
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--color-text)" }}>
        {value}
      </div>
    </div>
  );
}

// ── Impact Card Component ──

function ImpactCard({ impact }: { impact: ProjectedImpact }) {
  const confidenceColors = {
    high: "#17A589",
    medium: "#D4A017",
    low: "#E8553A",
  };

  return (
    <div style={{
      background: "var(--color-surface)", border: "1px solid var(--color-border)",
      borderRadius: "var(--radius-sm)", padding: "16px 20px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--color-dark)", flex: 1 }}>
          {impact.metricName}
        </span>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
          padding: "2px 6px", borderRadius: 3,
          background: confidenceColors[impact.confidence] + "18",
          color: confidenceColors[impact.confidence],
        }}>
          {impact.confidence} confidence
        </span>
      </div>

      {/* Before → After */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
          color: "var(--color-muted)",
        }}>
          {impact.currentValue}
        </div>
        <span style={{ fontSize: 16, color: "var(--color-accent)" }}>→</span>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700,
          color: "#17A589",
        }}>
          {impact.projectedValue}
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--color-muted)", fontStyle: "italic" }}>
        {impact.assumption}
      </div>
    </div>
  );
}
