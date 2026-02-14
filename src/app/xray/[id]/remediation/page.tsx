"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type {
  Workflow,
  RemediationPlan,
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
import Breadcrumb from "@/components/breadcrumb";
import ConfirmModal from "@/components/confirm-modal";
import { useToast } from "@/components/toast";

export default function RemediationPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { addToast } = useToast();

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
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
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
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
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
      if (teamContext.teamSize) {
        const parsed = parseInt(teamContext.teamSize, 10);
        if (!isNaN(parsed) && parsed > 0) ctx.teamSize = parsed;
      }
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
      addToast("success", "Remediation plan generated successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate remediation plan";
      setError(msg);
      addToast("error", msg);
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
      addToast("success", "PDF downloaded successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF export failed";
      setError(msg);
      addToast("error", msg);
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
      addToast("success", "Synced to Notion successfully");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to sync to Notion";
      setError(msg);
      addToast("error", msg);
    } finally {
      setSyncing(false);
      syncLock.current = false;
    }
  };

  const handleRegenerate = () => {
    setShowRegenConfirm(true);
  };

  const confirmRegenerate = () => {
    setShowRegenConfirm(false);
    setPlan(null);
    setShowTeamContext(true);
  };

  // ── Loading State ──
  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px)" }}>
        <div style={{ height: 12, width: 120, background: "var(--color-border)", borderRadius: 4, marginBottom: 8, animation: "pulse-slow 1.5s ease infinite" }} />
        <div style={{ height: 32, width: 400, maxWidth: "100%", background: "var(--color-border)", borderRadius: "var(--radius-sm)", marginBottom: 24, animation: "pulse-slow 1.5s ease 0.1s infinite" }} />
        <div style={{ height: 200, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", animation: "pulse-slow 1.5s ease 0.2s infinite" }} />
      </div>
    );
  }

  // ── Error State (no workflow) ──
  if (!workflow) {
    return (
      <div className="empty-state" style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(24px, 4vw, 40px) clamp(16px, 4vw, 32px)" }}>
        <div className="empty-state-icon" style={{ background: "linear-gradient(135deg, #FDF0EE, #FFE6E1)", color: "var(--color-accent)" }}>!</div>
        <div className="empty-state-title" style={{ color: "var(--color-danger)" }}>{error || "Workflow not found"}</div>
        <div className="empty-state-desc">The workflow you&apos;re looking for doesn&apos;t exist or couldn&apos;t be loaded.</div>
        <Link href="/" className="btn-primary" style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
          Back to Home
        </Link>
      </div>
    );
  }

  const totalTasks = plan ? plan.phases.reduce((sum, p) => sum + p.tasks.length, 0) : 0;
  const currentPhase = plan?.phases.find((p) => p.id === activePhase);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px) 64px" }}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "X-Ray", href: "/" },
          { label: workflow.decomposition.title, href: `/xray/${id}` },
          { label: "Remediation" },
        ]}
      />

      {/* Header */}
      <div style={{ marginBottom: 24, animation: "fadeInUp 0.4s var(--ease-spring) both" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1
            className="text-gradient"
            style={{
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: 900,
              fontFamily: "var(--font-display)",
              letterSpacing: "-0.02em",
            }}
          >
            Remediation Plan
          </h1>
          {plan && (
            <span style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-muted)",
              background: "var(--color-border)",
              padding: "2px 10px",
              borderRadius: "var(--radius-full)",
            }}>
              {totalTasks} tasks &middot; {plan.phases.length} phases
            </span>
          )}
        </div>
        <div style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--color-text)",
          marginTop: 6,
        }}>
          {workflow.decomposition.title}
        </div>

        {/* Action buttons */}
        {plan && (
          <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
            <button
              onClick={handleExportPdf}
              disabled={exporting}
              className="btn-primary"
              style={{
                fontSize: 12,
                padding: "8px 20px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: exporting ? 0.7 : 1,
                cursor: exporting ? "wait" : "pointer",
              }}
            >
              {exporting ? "Exporting..." : "Download PDF"}
            </button>
            <button
              onClick={handleNotionSync}
              disabled={syncing}
              className="btn-secondary"
              style={{
                fontSize: 12,
                padding: "8px 20px",
                display: "flex",
                alignItems: "center",
                gap: 6,
                opacity: syncing ? 0.7 : 1,
                borderColor: synced ? "rgba(23, 165, 137, 0.3)" : undefined,
                background: synced ? "rgba(23, 165, 137, 0.06)" : undefined,
                color: synced ? "var(--color-success)" : undefined,
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
                      style={{ color: "var(--color-success)", textDecoration: "underline", fontSize: 10 }}
                    >
                      Open
                    </a>
                  )}
                </>
              ) : "Sync to Notion"}
            </button>
            <button
              onClick={handleRegenerate}
              className="btn-ghost"
              style={{ fontSize: 12 }}
            >
              Regenerate
            </button>
          </div>
        )}
      </div>

      {/* Error banner */}
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
              color: "var(--color-danger)",
              flexShrink: 0,
            }}
          >
            !
          </div>
          <div style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-danger)", lineHeight: 1.5, flex: 1 }}>
            {error}
          </div>
          <button
            onClick={() => setError(null)}
            style={{
              background: "none",
              border: "none",
              fontSize: 16,
              color: "var(--color-danger)",
              cursor: "pointer",
              padding: "2px 6px",
              opacity: 0.6,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>
      )}

      {/* No plan yet — generation UI */}
      {!plan && !generating && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", padding: "clamp(24px, 4vw, 40px)", textAlign: "center",
          animation: "fadeInUp 0.4s var(--ease-spring) both",
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔧</div>
          <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 700, color: "var(--color-dark)", marginBottom: 8 }}>
            Generate Remediation Plan
          </h2>

          {/* Zero-gaps guard */}
          {workflow.decomposition.gaps.length === 0 ? (
            <div style={{ maxWidth: 500, margin: "0 auto" }}>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-muted)", marginBottom: 16 }}>
                This workflow has no gaps to remediate. The diagnostic found zero issues — nice work!
              </p>
              <Link
                href={`/xray/${id}`}
                className="btn-secondary"
                style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                &larr; Back to X-Ray
              </Link>
            </div>
          ) : (
            <>
              <p style={{ fontFamily: "var(--font-body)", fontSize: 14, color: "var(--color-text)", marginBottom: 24, maxWidth: 500, margin: "0 auto 24px" }}>
                Create a phased action plan to address the {workflow.decomposition.gaps.length} gaps identified in the diagnostic. Each task includes priority, owner, tools, and success metrics.
              </p>

              {/* Team Context Toggle */}
              <button
                onClick={() => setShowTeamContext(!showTeamContext)}
                className="btn-ghost"
                style={{
                  margin: "0 auto 16px",
                  display: "block",
                  fontSize: 11,
                }}
              >
                {showTeamContext ? "Hide team context" : "+ Add team context (optional)"}
              </button>

              {showTeamContext && (
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
                  maxWidth: 500, margin: "0 auto 24px", textAlign: "left",
                  animation: "fadeInUpSm 0.3s var(--ease-default) both",
                }}>
                  <div>
                    <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Team Size</label>
                    <input
                      type="number"
                      value={teamContext.teamSize}
                      onChange={(e) => setTeamContext((c) => ({ ...c, teamSize: e.target.value }))}
                      placeholder="e.g., 8"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                        fontSize: 13, outline: "none", background: "var(--color-bg)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Budget</label>
                    <input
                      value={teamContext.budget}
                      onChange={(e) => setTeamContext((c) => ({ ...c, budget: e.target.value }))}
                      placeholder="e.g., $5K/month"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                        fontSize: 13, outline: "none", background: "var(--color-bg)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Timeline</label>
                    <input
                      value={teamContext.timeline}
                      onChange={(e) => setTeamContext((c) => ({ ...c, timeline: e.target.value }))}
                      placeholder="e.g., 3 months"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                        fontSize: 13, outline: "none", background: "var(--color-bg)",
                      }}
                    />
                  </div>
                  <div>
                    <label style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", display: "block", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Constraints</label>
                    <input
                      value={teamContext.constraints}
                      onChange={(e) => setTeamContext((c) => ({ ...c, constraints: e.target.value }))}
                      placeholder="e.g., no new tools, remote-only"
                      style={{
                        width: "100%", padding: "10px 14px", borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--color-border)", fontFamily: "var(--font-body)",
                        fontSize: 13, outline: "none", background: "var(--color-bg)",
                      }}
                    />
                  </div>
                </div>
              )}

              <button
                onClick={handleGenerate}
                className="btn-primary"
                style={{
                  padding: "12px 36px",
                  fontSize: 14,
                  fontWeight: 700,
                  boxShadow: "var(--shadow-accent-lg)",
                }}
              >
                Generate Plan
              </button>
            </>
          )}
        </div>
      )}

      {/* Generating state */}
      {generating && (
        <div style={{
          background: "var(--color-surface)", border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)", padding: "clamp(32px, 4vw, 48px)", textAlign: "center",
          animation: "fadeIn 0.4s ease",
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
          <div className="progress-bar" style={{ maxWidth: 300, margin: "16px auto 0" }} />
        </div>
      )}

      {/* Plan exists — render it */}
      {plan && (
        <div style={{ animation: "fadeIn 0.4s ease" }}>
          {/* Executive Summary */}
          <div style={{
            background: "linear-gradient(135deg, #1C2536 0%, #2a3a52 100%)",
            borderRadius: "var(--radius-lg)", padding: "clamp(18px, 3vw, 28px)", marginBottom: 20,
            color: "#F0F2F5",
            boxShadow: "var(--shadow-lg)",
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
            padding: 4, width: "fit-content", maxWidth: "100%", overflowX: "auto",
          }}>
            {plan.phases.map((phase) => (
              <button
                key={phase.id}
                onClick={() => setActivePhase(phase.id)}
                className={`tab-pill${activePhase === phase.id ? " tab-active" : ""}`}
              >
                {phase.name}
                <span style={{ marginLeft: 6, fontSize: 10, opacity: 0.6 }}>
                  {phase.tasks.length}
                </span>
              </button>
            ))}
            <button
              onClick={() => setActivePhase("impact")}
              className={`tab-pill${activePhase === "impact" ? " tab-active" : ""}`}
            >
              Impact
            </button>
          </div>

          {/* Phase content */}
          {currentPhase && activePhase !== "impact" && (
            <div style={{ animation: "fadeInUpSm 0.3s var(--ease-default) both" }}>
              {/* Phase header */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4, flexWrap: "wrap" }}>
                  <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 700, color: "var(--color-dark)", margin: 0 }}>
                    {currentPhase.name}
                  </h2>
                  <span className="badge" style={{
                    background: "var(--color-accent)",
                    color: "#fff",
                    fontSize: 10,
                  }}>
                    {currentPhase.timeframe}
                  </span>
                </div>
                <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-text)", margin: 0, lineHeight: 1.6 }}>
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
            <div style={{ animation: "fadeInUpSm 0.3s var(--ease-default) both" }}>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(18px, 4vw, 22px)", fontWeight: 700, color: "var(--color-dark)", marginBottom: 16 }}>
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

      {/* Regenerate confirmation modal */}
      <ConfirmModal
        open={showRegenConfirm}
        title="Regenerate Plan?"
        message="This will discard the current remediation plan and generate a new one. You can optionally update team context before regenerating."
        confirmLabel="Regenerate"
        variant="warning"
        onConfirm={confirmRegenerate}
        onCancel={() => setShowRegenConfirm(false)}
      />
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
      className="card-interactive"
      style={{
        borderLeft: `3px solid ${priorityColor}`,
        borderRadius: "var(--radius-sm)",
        padding: "16px 20px",
        cursor: "pointer",
        animation: `fadeInUpSm 0.3s ease ${index * 0.05}s both`,
      }}
      onClick={() => setExpanded(!expanded)}
      role="button"
      aria-expanded={expanded}
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setExpanded(!expanded); } }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: expanded ? 12 : 0, transition: "margin 0.2s ease" }}>
        <span className="badge" style={{
          background: priorityColor + "18",
          color: priorityColor,
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
        <span style={{
          fontSize: 12, color: "var(--color-muted)",
          transition: "transform 0.2s ease",
          transform: expanded ? "rotate(180deg)" : "rotate(0)",
          flexShrink: 0,
        }}>
          ▾
        </span>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div style={{ animation: "fadeInUpSm 0.25s ease both" }}>
          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--color-text)", lineHeight: 1.6, margin: "0 0 12px" }}>
            {task.description}
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
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
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted)", fontWeight: 600, textTransform: "uppercase" }}>
                Addresses:
              </span>
              {task.gapIds.map((gapIdx) => {
                const gap = gaps[gapIdx];
                if (!gap) return null;
                const severityColor =
                  gap.severity === "high" ? "var(--color-danger)" :
                  gap.severity === "medium" ? "var(--color-warning)" :
                  "var(--color-success)";
                return (
                  <span
                    key={gapIdx}
                    className="badge"
                    style={{
                      background: "var(--color-border)",
                      color: "var(--color-text)",
                      fontSize: 9,
                      borderLeft: `2px solid ${severityColor}`,
                      borderRadius: "var(--radius-xs)",
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
    <div style={{
      padding: "8px 12px",
      background: "var(--color-bg)",
      borderRadius: "var(--radius-xs)",
      border: "1px solid var(--color-border)",
    }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 600, color: "var(--color-muted)", textTransform: "uppercase", marginBottom: 3, letterSpacing: "0.04em" }}>
        {label}
      </div>
      <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--color-text)", lineHeight: 1.4 }}>
        {value}
      </div>
    </div>
  );
}

// ── Impact Card Component ──

function ImpactCard({ impact }: { impact: ProjectedImpact }) {
  return (
    <div className="card-interactive" style={{
      borderRadius: "var(--radius-sm)",
      padding: "18px 22px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ fontFamily: "var(--font-display)", fontSize: 15, fontWeight: 600, color: "var(--color-dark)", flex: 1 }}>
          {impact.metricName}
        </span>
        <span className={`badge ${
          impact.confidence === "high" ? "status-success" :
          impact.confidence === "medium" ? "status-warning" :
          "status-danger"
        }`}>
          {impact.confidence} confidence
        </span>
      </div>

      {/* Before → After */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 10 }}>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
          color: "var(--color-muted)",
        }}>
          {impact.currentValue}
        </div>
        <span style={{
          fontSize: 16,
          color: "var(--color-accent)",
          fontWeight: 700,
        }}>→</span>
        <div style={{
          fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700,
          color: "var(--color-success)",
        }}>
          {impact.projectedValue}
        </div>
      </div>

      <div style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--color-muted)", fontStyle: "italic", lineHeight: 1.5 }}>
        {impact.assumption}
      </div>
    </div>
  );
}
