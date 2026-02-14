"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import type { Workflow, GapType } from "@/lib/types";
import { GAP_LABELS } from "@/lib/types";
import { listWorkflowsLocal, mergeWithServer, deleteWorkflowLocal } from "@/lib/client-db";
import WorkflowCard from "./workflow-card";

type SortKey = "date" | "gaps" | "automation" | "fragility" | "complexity" | "steps";
type SortDir = "asc" | "desc";

export default function WorkflowLibrary() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [gapFilter, setGapFilter] = useState<GapType | "all">("all");

  const fetchWorkflows = async () => {
    setError(null);
    try {
      // Load from localStorage first (instant)
      const localWorkflows = listWorkflowsLocal(search || undefined);
      if (localWorkflows.length > 0) {
        setWorkflows(localWorkflows);
        setLoading(false);
      }

      // Then try server and merge
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/workflows?${params}`);
      if (res.ok) {
        const data = await res.json();
        const serverWorkflows: Workflow[] = data.workflows || [];
        // Merge server data with local data — server wins on conflicts
        const merged = mergeWithServer(serverWorkflows);
        setWorkflows(search ? merged.filter((w) => {
          const q = search.toLowerCase();
          return w.decomposition.title.toLowerCase().includes(q) ||
            w.description.toLowerCase().includes(q);
        }) : merged);
      } else if (localWorkflows.length === 0) {
        throw new Error("Failed to load workflows");
      }
    } catch (err) {
      if (workflows.length === 0) {
        setError(err instanceof Error ? err.message : "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setLoading(true);
    fetchWorkflows();
  };

  const handleDelete = async (id: string) => {
    // Delete from both server and localStorage
    deleteWorkflowLocal(id);
    await fetch(`/api/workflows?id=${id}`, { method: "DELETE" }).catch(() => {});
    setWorkflows((w) => w.filter((wf) => wf.id !== id));
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "desc");
    }
  };

  // ── Quick Stats ──
  const quickStats = useMemo(() => {
    if (workflows.length === 0) return null;

    const avgAutomation = Math.round(
      workflows.reduce((sum, w) => sum + w.decomposition.health.automationPotential, 0) /
        workflows.length
    );

    const avgFragility = Math.round(
      workflows.reduce((sum, w) => sum + w.decomposition.health.fragility, 0) /
        workflows.length
    );

    // Most common gap type
    const gapCounts: Record<string, number> = {};
    workflows.forEach((w) =>
      w.decomposition.gaps.forEach((g) => {
        gapCounts[g.type] = (gapCounts[g.type] || 0) + 1;
      })
    );
    const topGap = Object.entries(gapCounts).sort((a, b) => b[1] - a[1])[0];

    // Most overloaded owner
    const ownerCounts: Record<string, number> = {};
    workflows.forEach((w) =>
      w.decomposition.steps.forEach((s) => {
        if (s.owner) ownerCounts[s.owner] = (ownerCounts[s.owner] || 0) + 1;
      })
    );
    const topOwner = Object.entries(ownerCounts).sort((a, b) => b[1] - a[1])[0];

    const totalGaps = workflows.reduce((sum, w) => sum + w.decomposition.gaps.length, 0);

    return { avgAutomation, avgFragility, topGap, topOwner, totalGaps };
  }, [workflows]);

  // ── Filtered + Sorted ──
  const filtered = useMemo(() => {
    let result = [...workflows];

    // Gap type filter
    if (gapFilter !== "all") {
      result = result.filter((w) =>
        w.decomposition.gaps.some((g) => g.type === gapFilter)
      );
    }

    // Sort
    result.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "date":
          av = new Date(a.createdAt).getTime();
          bv = new Date(b.createdAt).getTime();
          break;
        case "gaps":
          av = a.decomposition.gaps.length;
          bv = b.decomposition.gaps.length;
          break;
        case "automation":
          av = a.decomposition.health.automationPotential;
          bv = b.decomposition.health.automationPotential;
          break;
        case "fragility":
          av = a.decomposition.health.fragility;
          bv = b.decomposition.health.fragility;
          break;
        case "complexity":
          av = a.decomposition.health.complexity;
          bv = b.decomposition.health.complexity;
          break;
        case "steps":
          av = a.decomposition.steps.length;
          bv = b.decomposition.steps.length;
          break;
        default:
          return 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return result;
  }, [workflows, gapFilter, sortKey, sortDir]);

  // ── All gap types present across all workflows ──
  const availableGapTypes = useMemo(() => {
    const types = new Set<GapType>();
    workflows.forEach((w) => w.decomposition.gaps.forEach((g) => types.add(g.type)));
    return Array.from(types);
  }, [workflows]);

  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "date", label: "Date" },
    { key: "fragility", label: "Fragility" },
    { key: "gaps", label: "Gaps" },
    { key: "automation", label: "Automation" },
    { key: "complexity", label: "Complexity" },
    { key: "steps", label: "Steps" },
  ];

  return (
    <div>
      {/* Quick Stats Bar */}
      {!loading && !error && quickStats && workflows.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
            marginBottom: 24,
            animation: "fadeIn 0.3s ease",
          }}
        >
          <QuickStat label="Workflows" value={String(workflows.length)} />
          <QuickStat label="Avg Automation" value={`${quickStats.avgAutomation}%`} color="#17A589" />
          <QuickStat label="Avg Fragility" value={`${quickStats.avgFragility}%`} color="#E8553A" />
          <QuickStat
            label="Top Gap"
            value={quickStats.topGap ? GAP_LABELS[quickStats.topGap[0] as GapType] || quickStats.topGap[0] : "—"}
            sub={quickStats.topGap ? `${quickStats.topGap[1]}×` : undefined}
            color="#D4A017"
          />
          <QuickStat
            label="Busiest Owner"
            value={quickStats.topOwner ? quickStats.topOwner[0] : "—"}
            sub={quickStats.topOwner ? `${quickStats.topOwner[1]} steps` : undefined}
            color="#8E44AD"
          />
        </div>
      )}

      {/* Search + Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search workflows..."
          style={{
            flex: 1,
            minWidth: 200,
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--color-dark)",
            outline: "none",
            background: "var(--color-surface)",
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: "8px 24px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--color-dark)",
            color: "#F0F2F5",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Search
        </button>
        <Link
          href="/compare"
          style={{
            padding: "8px 24px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          Compare
        </Link>
      </div>

      {/* Sort + Filter bar */}
      {!loading && !error && workflows.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          {/* Sort pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                fontWeight: 700,
                color: "var(--color-muted)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginRight: 4,
              }}
            >
              Sort:
            </span>
            {sortOptions.map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleSort(opt.key)}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "none",
                  background: sortKey === opt.key ? "var(--color-dark)" : "var(--color-border)",
                  color: sortKey === opt.key ? "#F0F2F5" : "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {opt.label}
                {sortKey === opt.key && (
                  <span style={{ marginLeft: 2 }}>{sortDir === "desc" ? "↓" : "↑"}</span>
                )}
              </button>
            ))}
          </div>

          {/* Gap filter */}
          {availableGapTypes.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--color-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginRight: 4,
                }}
              >
                Gap:
              </span>
              <button
                onClick={() => setGapFilter("all")}
                style={{
                  padding: "4px 8px",
                  borderRadius: 4,
                  border: "none",
                  background: gapFilter === "all" ? "var(--color-dark)" : "var(--color-border)",
                  color: gapFilter === "all" ? "#F0F2F5" : "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                All
              </button>
              {availableGapTypes.map((gt) => (
                <button
                  key={gt}
                  onClick={() => setGapFilter(gt === gapFilter ? "all" : gt)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: 4,
                    border: "none",
                    background: gapFilter === gt ? "var(--color-accent)" : "var(--color-border)",
                    color: gapFilter === gt ? "#fff" : "var(--color-text)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    whiteSpace: "nowrap",
                  }}
                >
                  {GAP_LABELS[gt] || gt}
                </button>
              ))}
            </div>
          )}

          {/* Result count */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-muted)",
              marginLeft: "auto",
            }}
          >
            {filtered.length} of {workflows.length}
          </span>
        </div>
      )}

      {/* Loading — skeleton cards */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: 16,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <div
                style={{
                  height: 16,
                  width: "70%",
                  background: "var(--color-border)",
                  borderRadius: 4,
                  marginBottom: 12,
                  animation: `pulse-slow 1.5s ease ${i * 0.15}s infinite`,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "50%",
                  background: "var(--color-border)",
                  borderRadius: 4,
                  marginBottom: 16,
                  animation: `pulse-slow 1.5s ease ${i * 0.15 + 0.1}s infinite`,
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                {[40, 56, 48].map((w, j) => (
                  <div
                    key={j}
                    style={{
                      height: 20,
                      width: w,
                      background: "var(--color-border)",
                      borderRadius: 4,
                      animation: `pulse-slow 1.5s ease ${i * 0.15 + 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#FDF0EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 20,
            }}
          >
            !
          </div>
          <div style={{ fontSize: 15, color: "#C0392B", fontFamily: "var(--font-body)", marginBottom: 8 }}>
            {error}
          </div>
          <button
            onClick={() => { setLoading(true); fetchWorkflows(); }}
            style={{
              padding: "8px 24px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty — no workflows */}
      {!loading && !error && workflows.length === 0 && !search && (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 20,
              color: "var(--color-muted)",
            }}
          >
            &#x2731;
          </div>
          <div style={{ fontSize: 16, color: "var(--color-text)", fontFamily: "var(--font-body)", marginBottom: 8 }}>
            No workflows yet
          </div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", fontFamily: "var(--font-body)" }}>
            Decompose a workflow to see it here.
          </div>
        </div>
      )}

      {/* Partial — filter/search returned no results */}
      {!loading && !error && workflows.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 24px" }}>
          <div style={{ fontSize: 16, color: "var(--color-text)", fontFamily: "var(--font-body)", marginBottom: 8 }}>
            No workflows match this filter
          </div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", fontFamily: "var(--font-body)", marginBottom: 16 }}>
            Try a different gap type or clear your filters.
          </div>
          <button
            onClick={() => { setGapFilter("all"); setSearch(""); }}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Clear Filters
          </button>
        </div>
      )}

      {/* Success — workflow grid */}
      {!loading && !error && filtered.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {filtered.map((w) => (
            <WorkflowCard key={w.id} workflow={w} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuickStat({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: 16,
        background: "var(--color-surface)",
        borderRadius: "var(--radius-sm)",
        border: "1px solid var(--color-border)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: color || "var(--color-dark)",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-muted)",
            marginTop: 2,
          }}
        >
          {sub}
        </div>
      )}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--color-muted)",
          fontWeight: 500,
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
