"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Workflow, GapType, Step } from "@/lib/types";
import { GAP_LABELS, LAYER_COLORS, SEVERITY_COLORS } from "@/lib/types";
import { listWorkflowsLocal, mergeWithServer } from "@/lib/client-db";
import ScoreRing from "@/components/score-ring";
import Breadcrumb from "@/components/breadcrumb";
import { useToast } from "@/components/toast";
import { computeHealthTrends } from "@/lib/chart-data";
import HealthTrendChart from "@/components/health-trend-chart";

export default function DashboardPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { addToast } = useToast();

  useEffect(() => {
    const local = listWorkflowsLocal();
    if (local.length > 0) {
      setWorkflows(local);
      setLoading(false);
    }
    fetch("/api/workflows")
      .then((r) => r.json())
      .then((data) => {
        const merged = mergeWithServer(data.workflows || []);
        setWorkflows(merged);
        setError(null);
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : "Failed to load workflows";
        setWorkflows((current) => {
          if (current.length === 0) setError(msg);
          return current;
        });
        addToast("error", msg);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Aggregations ──
  const allSteps = useMemo(
    () => workflows.flatMap((w) => w.decomposition.steps),
    [workflows]
  );
  const allGaps = useMemo(
    () => workflows.flatMap((w) => w.decomposition.gaps),
    [workflows]
  );

  // Team workload
  const ownerStats = useMemo(() => {
    const map: Record<
      string,
      { steps: number; workflows: Set<string>; totalAuto: number; minAuto: number }
    > = {};
    workflows.forEach((w) =>
      w.decomposition.steps.forEach((s) => {
        const name = s.owner || "Unassigned";
        if (!map[name])
          map[name] = { steps: 0, workflows: new Set(), totalAuto: 0, minAuto: 100 };
        map[name].steps++;
        map[name].workflows.add(w.id);
        map[name].totalAuto += s.automationScore;
        map[name].minAuto = Math.min(map[name].minAuto, s.automationScore);
      })
    );
    return Object.entries(map)
      .map(([name, d]) => ({
        name,
        steps: d.steps,
        workflows: d.workflows.size,
        avgAutomation: Math.round(d.totalAuto / d.steps),
        minAutomation: d.minAuto,
      }))
      .sort((a, b) => b.steps - a.steps);
  }, [workflows]);

  // Tool usage
  const toolStats = useMemo(() => {
    const map: Record<string, number> = {};
    allSteps.forEach((s) =>
      s.tools.forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      })
    );
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [allSteps]);

  // Gap stats
  const gapStats = useMemo(() => {
    const map: Record<string, { count: number; severities: Record<string, number> }> = {};
    allGaps.forEach((g) => {
      if (!map[g.type]) map[g.type] = { count: 0, severities: {} };
      map[g.type].count++;
      map[g.type].severities[g.severity] = (map[g.type].severities[g.severity] || 0) + 1;
    });
    return Object.entries(map)
      .map(([type, d]) => ({ type: type as GapType, ...d }))
      .sort((a, b) => b.count - a.count);
  }, [allGaps]);

  // Health averages
  const healthAvg = useMemo(() => {
    if (workflows.length === 0)
      return { complexity: 0, fragility: 0, automationPotential: 0, teamLoadBalance: 0 };
    const sum = workflows.reduce(
      (acc, w) => ({
        complexity: acc.complexity + w.decomposition.health.complexity,
        fragility: acc.fragility + w.decomposition.health.fragility,
        automationPotential: acc.automationPotential + w.decomposition.health.automationPotential,
        teamLoadBalance: acc.teamLoadBalance + w.decomposition.health.teamLoadBalance,
      }),
      { complexity: 0, fragility: 0, automationPotential: 0, teamLoadBalance: 0 }
    );
    const n = workflows.length;
    return {
      complexity: Math.round(sum.complexity / n),
      fragility: Math.round(sum.fragility / n),
      automationPotential: Math.round(sum.automationPotential / n),
      teamLoadBalance: Math.round(sum.teamLoadBalance / n),
    };
  }, [workflows]);

  // Automation opportunities — lowest automation steps
  const manualSteps = useMemo(() => {
    const enriched = workflows.flatMap((w) =>
      w.decomposition.steps.map((s) => ({
        ...s,
        workflowTitle: w.decomposition.title,
        workflowId: w.id,
      }))
    );
    return enriched
      .filter((s) => s.automationScore < 40)
      .sort((a, b) => a.automationScore - b.automationScore)
      .slice(0, 10);
  }, [workflows]);

  // Layer distribution
  const layerDist = useMemo(() => {
    const map: Record<string, number> = {};
    allSteps.forEach((s) => {
      map[s.layer] = (map[s.layer] || 0) + 1;
    });
    return Object.entries(map)
      .map(([layer, count]) => ({ layer, count }))
      .sort((a, b) => b.count - a.count);
  }, [allSteps]);

  // Volume over time (group by week)
  const volumeByWeek = useMemo(() => {
    if (workflows.length === 0) return [];
    const buckets: Record<string, number> = {};
    workflows.forEach((w) => {
      const d = new Date(w.createdAt);
      const weekStart = new Date(d);
      // ISO week start (Monday): getDay() 0=Sun→-6, 1=Mon→0, 2=Tue→-1, etc.
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7));
      const key = weekStart.toISOString().split("T")[0];
      buckets[key] = (buckets[key] || 0) + 1;
    });
    return Object.entries(buckets)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [workflows]);

  // Health metric trends over time
  const healthTrends = useMemo(() => {
    return computeHealthTrends(workflows);
  }, [workflows]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)" }}>
        <div
          style={{
            height: 32,
            width: 250,
            background: "var(--color-border)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 24,
            animation: "pulse-slow 1.5s ease infinite",
          }}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                height: 100,
                background: "var(--color-border)",
                borderRadius: "var(--radius-lg)",
                animation: `pulse-slow 1.5s ease ${i * 0.15}s infinite`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (error && workflows.length === 0) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)" }}>
        <h1
          className="text-gradient"
          style={{
            fontSize: "clamp(24px, 5vw, 32px)",
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Team Dashboard
        </h1>
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            animation: "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--accent-bg-light), rgba(252, 232, 228, 0.6))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 22,
              fontWeight: 700,
              color: "var(--color-accent)",
            }}
          >
            !
          </div>
          <div style={{ fontSize: 15, color: "var(--color-danger)", fontFamily: "var(--font-body)", marginBottom: 8 }}>
            {error}
          </div>
          <button
            onClick={() => { setError(null); setLoading(true); fetch("/api/workflows").then((r) => r.json()).then((data) => { setWorkflows(mergeWithServer(data.workflows || [])); }).catch((err) => { setError(err instanceof Error ? err.message : "Failed to load workflows. Please try again."); }).finally(() => setLoading(false)); }}
            style={{
              padding: "10px 28px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)",
              color: "var(--color-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(232, 85, 58, 0.25)",
            }}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)" }}>
        <h1
          className="text-gradient"
          style={{
            fontSize: "clamp(24px, 5vw, 32px)",
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            marginBottom: 8,
          }}
        >
          Team Dashboard
        </h1>
        <div className="empty-state">
          <div className="empty-state-icon">&#x1F4CA;</div>
          <div className="empty-state-title">No data yet</div>
          <div className="empty-state-desc">
            Decompose some workflows to see aggregated team insights.
          </div>
          <Link
            href="/"
            className="btn-primary"
            style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            Create a Workflow &rarr;
          </Link>
        </div>
      </div>
    );
  }

  const maxToolCount = toolStats.length > 0 ? toolStats[0].count : 1;
  const maxOwnerSteps = ownerStats.length > 0 ? ownerStats[0].steps : 1;

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px) 64px" }}>
      <Breadcrumb items={[{ label: "Library", href: "/library" }, { label: "Dashboard" }]} />
      <h1
        style={{
          fontSize: "clamp(24px, 5vw, 32px)",
          fontWeight: 900,
          fontFamily: "var(--font-display)",
          color: "var(--color-dark)",
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        Team Dashboard
      </h1>
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 14,
          color: "var(--color-text)",
          marginBottom: 24,
        }}
      >
        Aggregated insights across {workflows.length} workflow
        {workflows.length !== 1 ? "s" : ""} &middot; {allSteps.length} total
        steps &middot; {allGaps.length} total gaps
      </p>

      {/* ── Top-level health scores ── */}
      <div
        className="grid-stats-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 32,
          animation: "fadeIn 0.3s ease",
        }}
      >
        <HealthStat label="Avg Automation" value={healthAvg.automationPotential} color="var(--color-success)" />
        <HealthStat label="Avg Fragility" value={healthAvg.fragility} color="var(--color-accent)" invertColor />
        <HealthStat label="Avg Complexity" value={healthAvg.complexity} color="var(--color-info)" />
        <HealthStat label="Team Balance" value={healthAvg.teamLoadBalance} color="var(--color-memory)" />
      </div>

      {/* ── Two-column grid ── */}
      <div
        className="grid-2col"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 32,
        }}
      >
        {/* Team Workload */}
        <Section title="Team Workload" subtitle={`${ownerStats.length} team members`}>
          {ownerStats.slice(0, 8).map((o) => (
            <div
              key={o.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-dark)",
                  minWidth: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {o.name}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 16,
                  background: "var(--color-border)",
                  borderRadius: 4,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    width: `${(o.steps / maxOwnerSteps) * 100}%`,
                    height: "100%",
                    background:
                      o.minAutomation >= 60
                        ? "var(--color-success)"
                        : o.minAutomation >= 40
                          ? "var(--color-warning)"
                          : "var(--color-accent)",
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-muted)",
                  minWidth: 60,
                  textAlign: "right",
                }}
              >
                {o.steps} steps &middot; {o.avgAutomation}%
              </div>
            </div>
          ))}
        </Section>

        {/* Tool Usage */}
        <Section title="Tool Usage" subtitle={`${toolStats.length} tools tracked`}>
          {toolStats.length === 0 && (
            <div
              style={{
                fontFamily: "var(--font-body)",
                fontSize: 13,
                color: "var(--color-muted)",
                padding: "16px 0",
              }}
            >
              No tools detected yet
            </div>
          )}
          {toolStats.slice(0, 8).map((t) => (
            <div
              key={t.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 8,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-dark)",
                  minWidth: 100,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {t.name}
              </div>
              <div
                style={{
                  flex: 1,
                  height: 16,
                  background: "var(--color-border)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(t.count / maxToolCount) * 100}%`,
                    height: "100%",
                    background: "var(--color-info)",
                    borderRadius: 4,
                    transition: "width 0.5s ease",
                  }}
                />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--color-muted)",
                  minWidth: 30,
                  textAlign: "right",
                }}
              >
                {t.count}x
              </div>
            </div>
          ))}
        </Section>

        {/* Gap Analysis */}
        <Section
          title="Gap Analysis"
          subtitle={`${allGaps.length} gaps across ${gapStats.length} types`}
        >
          {gapStats.map((g) => {
            const total = g.count;
            const high = g.severities["high"] || 0;
            const medium = g.severities["medium"] || 0;
            const low = g.severities["low"] || 0;
            return (
              <div
                key={g.type}
                style={{
                  marginBottom: 12,
                  padding: 10,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface-alt)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--color-dark)",
                    }}
                  >
                    {GAP_LABELS[g.type] || g.type}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      color: "var(--color-muted)",
                    }}
                  >
                    {total}x
                  </span>
                </div>
                {/* Severity bar */}
                <div
                  style={{
                    display: "flex",
                    height: 6,
                    borderRadius: 3,
                    overflow: "hidden",
                    gap: 1,
                  }}
                >
                  {high > 0 && (
                    <div
                      style={{
                        flex: high,
                        background: SEVERITY_COLORS.high,
                        borderRadius: 3,
                      }}
                    />
                  )}
                  {medium > 0 && (
                    <div
                      style={{
                        flex: medium,
                        background: SEVERITY_COLORS.medium,
                        borderRadius: 3,
                      }}
                    />
                  )}
                  {low > 0 && (
                    <div
                      style={{
                        flex: low,
                        background: SEVERITY_COLORS.low,
                        borderRadius: 3,
                      }}
                    />
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginTop: 4,
                    fontFamily: "var(--font-mono)",
                    fontSize: 9,
                    color: "var(--color-muted)",
                  }}
                >
                  {high > 0 && <span style={{ color: SEVERITY_COLORS.high }}>{high} high</span>}
                  {medium > 0 && <span style={{ color: SEVERITY_COLORS.medium }}>{medium} med</span>}
                  {low > 0 && <span style={{ color: SEVERITY_COLORS.low }}>{low} low</span>}
                </div>
              </div>
            );
          })}
        </Section>

        {/* Layer Distribution */}
        <Section
          title="Architecture Layers"
          subtitle={`${allSteps.length} steps across ${layerDist.length} layers`}
        >
          {layerDist.map((l) => {
            const color = LAYER_COLORS[l.layer as keyof typeof LAYER_COLORS] || "var(--color-muted)";
            const pct = allSteps.length > 0 ? Math.round((l.count / allSteps.length) * 100) : 0;
            return (
              <div
                key={l.layer}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-dark)",
                    minWidth: 100,
                    textTransform: "capitalize",
                  }}
                >
                  {l.layer}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 16,
                    background: "var(--color-border)",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: "100%",
                      background: color,
                      borderRadius: 4,
                      transition: "width 0.5s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-muted)",
                    minWidth: 50,
                    textAlign: "right",
                  }}
                >
                  {l.count} ({pct}%)
                </div>
              </div>
            );
          })}
        </Section>
      </div>

      {/* ── Automation Opportunities (full width) ── */}
      <Section
        title="Automation Opportunities"
        subtitle={`${manualSteps.length} steps with <40% automation`}
        fullWidth
      >
        {manualSteps.length === 0 ? (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 13,
              color: "var(--color-muted)",
              padding: "16px 0",
              textAlign: "center",
            }}
          >
            All steps have 40%+ automation potential. Great job!
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 10,
            }}
          >
            {manualSteps.map((s, i) => (
              <Link
                key={`${s.workflowId}-${s.id}`}
                href={`/xray/${s.workflowId}`}
                style={{
                  padding: 12,
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  textDecoration: "none",
                  display: "block",
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
                      fontFamily: "var(--font-mono)",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "var(--color-dark)",
                    }}
                  >
                    {s.name}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 700,
                      color: "var(--color-accent)",
                      background: "var(--accent-bg-light)",
                      padding: "2px 6px",
                      borderRadius: 3,
                    }}
                  >
                    {s.automationScore}%
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-muted)",
                  }}
                >
                  {s.owner || "Unassigned"} &middot;{" "}
                  {(s as Step & { workflowTitle: string }).workflowTitle}
                </div>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ── Health Trends ── */}
      {healthTrends.length >= 2 && (
        <div style={{ marginTop: 32 }}>
          <Section
            title="Health Trends"
            subtitle={`Health scores across ${healthTrends.reduce((sum, p) => sum + p.count, 0)} workflows over ${healthTrends.length} periods`}
            fullWidth
          >
            <HealthTrendChart data={healthTrends} />
          </Section>
        </div>
      )}

      {/* ── Workflow Volume ── */}
      {volumeByWeek.length > 1 && (
        <div style={{ marginTop: 32 }}>
          <Section title="Workflow Volume" subtitle="Workflows created over time" fullWidth>
            <SimpleAreaChart data={volumeByWeek} />
          </Section>
        </div>
      )}
    </div>
  );
}

// ── Sub-components ──

function HealthStat({
  label,
  value,
  color,
  invertColor,
}: {
  label: string;
  value: number;
  color: string;
  invertColor?: boolean;
}) {
  const displayColor = invertColor ? (value > 60 ? "var(--color-accent)" : value > 30 ? "var(--color-warning)" : "var(--color-success)") : color;
  return (
    <div
      style={{
        padding: 20,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        textAlign: "center",
      }}
    >
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}>
        <ScoreRing value={value} size={56} color={displayColor} label="" />
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          fontWeight: 700,
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
  fullWidth,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  fullWidth?: boolean;
}) {
  return (
    <div
      style={{
        padding: 24,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--color-border)",
        ...(fullWidth ? { gridColumn: "1 / -1" } : {}),
        animation: "fadeIn 0.3s ease",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--color-dark)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        {title}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          marginBottom: 16,
        }}
      >
        {subtitle}
      </div>
      {children}
    </div>
  );
}

function SimpleAreaChart({ data }: { data: { date: string; count: number }[] }) {
  if (data.length < 2) return null;

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const width = 600;
  const height = 120;
  const padding = { top: 10, right: 10, bottom: 24, left: 30 };
  const chartW = width - padding.left - padding.right;
  const chartH = height - padding.top - padding.bottom;

  const points = data.map((d, i) => ({
    x: padding.left + (i / (data.length - 1)) * chartW,
    y: padding.top + chartH - (d.count / maxCount) * chartH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1].x},${padding.top + chartH} L${points[0].x},${padding.top + chartH} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto" }}
    >
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((pct) => (
        <line
          key={pct}
          x1={padding.left}
          y1={padding.top + chartH * (1 - pct)}
          x2={padding.left + chartW}
          y2={padding.top + chartH * (1 - pct)}
          stroke="var(--color-border)"
          strokeWidth={0.5}
        />
      ))}
      {/* Area */}
      <path d={areaPath} fill="var(--chart-blue-area)" />
      {/* Line */}
      <path d={linePath} fill="none" stroke="var(--chart-blue)" strokeWidth={2} />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="var(--chart-blue)" />
      ))}
      {/* X labels */}
      {data.map((d, i) => {
        if (data.length > 6 && i % 2 !== 0 && i !== data.length - 1) return null;
        return (
          <text
            key={i}
            x={points[i].x}
            y={height - 4}
            textAnchor="middle"
            fill="var(--color-muted)"
            fontSize={8}
            fontFamily="var(--font-mono)"
          >
            {new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        );
      })}
      {/* Y labels */}
      {[0, Math.round(maxCount / 2), maxCount].map((v, i) => (
        <text
          key={i}
          x={padding.left - 4}
          y={padding.top + chartH - (v / maxCount) * chartH + 3}
          textAnchor="end"
          fill="var(--color-muted)"
          fontSize={8}
          fontFamily="var(--font-mono)"
        >
          {v}
        </text>
      ))}
    </svg>
  );
}
