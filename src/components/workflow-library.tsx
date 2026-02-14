"use client";

import { useState, useEffect, useMemo, useRef } from "react";
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
  const [searchFocused, setSearchFocused] = useState(false);
  const [bulkSyncing, setBulkSyncing] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<{
    done: number;
    total: number;
    errors: string[];
  } | null>(null);

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
    // Confirmation dialog to prevent accidental deletion
    const workflow = workflows.find((w) => w.id === id);
    const title = workflow?.decomposition?.title || "this workflow";
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;

    // Delete from both server and localStorage
    deleteWorkflowLocal(id);
    await fetch(`/api/workflows?id=${id}`, { method: "DELETE" }).catch(() => {});
    setWorkflows((w) => w.filter((wf) => wf.id !== id));
  };

  const bulkSyncLock = useRef(false);
  const handleBulkSync = async () => {
    if (bulkSyncing || bulkSyncLock.current || workflows.length === 0) return;
    bulkSyncLock.current = true;
    setBulkSyncing(true);
    const errors: string[] = [];
    setBulkSyncProgress({ done: 0, total: workflows.length, errors: [] });

    for (let i = 0; i < workflows.length; i++) {
      const w = workflows[i];
      try {
        const res = await fetch("/api/notion-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workflow: w,
            appUrl: `${window.location.origin}/xray/${w.id}`,
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          errors.push(`${w.decomposition.title}: ${err.error || "failed"}`);
        }
      } catch {
        errors.push(`${w.decomposition.title}: network error`);
      }
      setBulkSyncProgress({ done: i + 1, total: workflows.length, errors: [...errors] });
    }

    setBulkSyncing(false);
    bulkSyncLock.current = false;
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
          className="grid-stats-5"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginBottom: 28,
          }}
        >
          {[
            { label: "Workflows", value: String(workflows.length), color: undefined, sub: undefined, delay: 0 },
            { label: "Avg Automation", value: `${quickStats.avgAutomation}%`, color: "#17A589", sub: undefined, delay: 1 },
            { label: "Avg Fragility", value: `${quickStats.avgFragility}%`, color: "#E8553A", sub: undefined, delay: 2 },
            {
              label: "Top Gap",
              value: quickStats.topGap ? GAP_LABELS[quickStats.topGap[0] as GapType] || quickStats.topGap[0] : "\u2014",
              sub: quickStats.topGap ? `${quickStats.topGap[1]}\u00d7` : undefined,
              color: "#D4A017",
              delay: 3,
            },
            {
              label: "Busiest Owner",
              value: quickStats.topOwner ? quickStats.topOwner[0] : "\u2014",
              sub: quickStats.topOwner ? `${quickStats.topOwner[1]} steps` : undefined,
              color: "#8E44AD",
              delay: 4,
            },
          ].map((stat, i) => (
            <QuickStat
              key={stat.label}
              label={stat.label}
              value={stat.value}
              color={stat.color}
              sub={stat.sub}
              delay={stat.delay}
            />
          ))}
        </div>
      )}

      {/* Search + Controls */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <div
          style={{
            flex: 1,
            minWidth: 200,
            position: "relative",
          }}
        >
          {/* Search icon */}
          <div
            style={{
              position: "absolute",
              left: 14,
              top: "50%",
              transform: "translateY(-50%)",
              color: searchFocused ? "var(--color-accent)" : "var(--color-muted)",
              transition: "color 0.3s ease",
              fontSize: 14,
              pointerEvents: "none",
              zIndex: 1,
            }}
          >
            &#x2315;
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search workflows..."
            style={{
              width: "100%",
              padding: "10px 16px 10px 36px",
              borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${searchFocused ? "var(--color-accent)" : "var(--color-border)"}`,
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--color-dark)",
              outline: "none",
              background: "var(--color-surface)",
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
              boxShadow: searchFocused
                ? "0 0 0 3px rgba(232, 85, 58, 0.1), 0 4px 12px rgba(0,0,0,0.06)"
                : "0 1px 3px rgba(0,0,0,0.04)",
            }}
          />
        </div>
        <button
          onClick={handleSearch}
          style={{
            padding: "10px 28px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "linear-gradient(135deg, var(--color-dark) 0%, #2a3a52 100%)",
            color: "#F0F2F5",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: "0 2px 8px rgba(28, 37, 54, 0.2)",
          }}
        >
          Search
        </button>
        <Link
          href="/compare"
          style={{
            padding: "10px 24px",
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            transition: "all 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}
        >
          Compare
        </Link>
        <button
          onClick={handleBulkSync}
          disabled={bulkSyncing || workflows.length === 0}
          style={{
            padding: "10px 24px",
            borderRadius: "var(--radius-sm)",
            border: "1.5px solid var(--color-border)",
            background: bulkSyncing ? "var(--color-border)" : "var(--color-surface)",
            color: bulkSyncing ? "var(--color-muted)" : "var(--color-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            cursor: bulkSyncing ? "default" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "all 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            opacity: bulkSyncing ? 0.7 : 1,
          }}
        >
          {bulkSyncing ? (
            <>
              <span
                style={{
                  width: 12,
                  height: 12,
                  border: "2px solid rgba(0,0,0,0.1)",
                  borderTop: "2px solid var(--color-dark)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
              {bulkSyncProgress
                ? `${bulkSyncProgress.done}/${bulkSyncProgress.total}`
                : "Syncing..."}
            </>
          ) : (
            <>
              <svg
                width="12"
                height="12"
                viewBox="0 0 100 100"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z"
                  fill="currentColor"
                  opacity="0.4"
                />
              </svg>
              Sync All to Notion
            </>
          )}
        </button>
      </div>

      {/* Bulk sync result banner */}
      {bulkSyncProgress && !bulkSyncing && (
        <div
          style={{
            padding: "10px 16px",
            borderRadius: "var(--radius-sm)",
            marginBottom: 12,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            animation: "fadeIn 0.3s ease",
            background:
              bulkSyncProgress.errors.length > 0
                ? "#FDF0EE"
                : "#E8F8F5",
            border: `1px solid ${
              bulkSyncProgress.errors.length > 0
                ? "#E8553A30"
                : "#17A58930"
            }`,
            color:
              bulkSyncProgress.errors.length > 0
                ? "#C0392B"
                : "#17A589",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>
              {bulkSyncProgress.errors.length === 0
                ? `All ${bulkSyncProgress.total} workflows synced to Notion`
                : `${bulkSyncProgress.total - bulkSyncProgress.errors.length} of ${bulkSyncProgress.total} synced (${bulkSyncProgress.errors.length} failed)`}
            </span>
            <button
              onClick={() => setBulkSyncProgress(null)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 14,
                color: "inherit",
                padding: "2px 6px",
              }}
            >
              &times;
            </button>
          </div>
          {bulkSyncProgress.errors.length > 0 && (
            <div style={{ marginTop: 6, fontSize: 10, opacity: 0.8 }}>
              {bulkSyncProgress.errors.map((e, i) => (
                <div key={i}>{e}</div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sort + Filter bar */}
      {!loading && !error && workflows.length > 0 && (
        <div
          style={{
            display: "flex",
            gap: 16,
            marginBottom: 20,
            alignItems: "center",
            flexWrap: "wrap",
            animation: "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) 0.15s both",
          }}
        >
          {/* Sort pills */}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
            {sortOptions.map((opt) => {
              const isActive = sortKey === opt.key;
              return (
                <button
                  key={opt.key}
                  onClick={() => handleSort(opt.key)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: isActive
                      ? "linear-gradient(135deg, var(--color-dark) 0%, #2a3a52 100%)"
                      : "var(--color-border)",
                    color: isActive ? "#F0F2F5" : "var(--color-text)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                    boxShadow: isActive
                      ? "0 2px 8px rgba(28, 37, 54, 0.25)"
                      : "none",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}
                >
                  {opt.label}
                  {isActive && (
                    <span style={{ marginLeft: 3, fontSize: 9 }}>
                      {sortDir === "desc" ? "\u2193" : "\u2191"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Gap filter */}
          {availableGapTypes.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
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
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: gapFilter === "all"
                    ? "linear-gradient(135deg, var(--color-dark) 0%, #2a3a52 100%)"
                    : "var(--color-border)",
                  color: gapFilter === "all" ? "#F0F2F5" : "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                  boxShadow: gapFilter === "all" ? "0 2px 8px rgba(28, 37, 54, 0.25)" : "none",
                  transform: gapFilter === "all" ? "scale(1.05)" : "scale(1)",
                }}
              >
                All
              </button>
              {availableGapTypes.map((gt) => {
                const isActive = gapFilter === gt;
                return (
                  <button
                    key={gt}
                    onClick={() => setGapFilter(gt === gapFilter ? "all" : gt)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      background: isActive
                        ? "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)"
                        : "var(--color-border)",
                      color: isActive ? "#fff" : "var(--color-text)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                      whiteSpace: "nowrap",
                      boxShadow: isActive ? "0 2px 8px rgba(232, 85, 58, 0.3)" : "none",
                      transform: isActive ? "scale(1.05)" : "scale(1)",
                    }}
                  >
                    {GAP_LABELS[gt] || gt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Result count */}
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-muted)",
              marginLeft: "auto",
              background: "var(--color-border)",
              padding: "4px 10px",
              borderRadius: 20,
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
                padding: 20,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              {/* Shimmer overlay */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background:
                    "linear-gradient(90deg, transparent 0%, rgba(232,85,58,0.03) 50%, transparent 100%)",
                  backgroundSize: "300% 100%",
                  animation: "cardShimmer 2s ease infinite",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  height: 16,
                  width: "70%",
                  background: "var(--color-border)",
                  borderRadius: 6,
                  marginBottom: 12,
                  animation: `pulse-slow 1.5s ease ${i * 0.15}s infinite`,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "50%",
                  background: "var(--color-border)",
                  borderRadius: 6,
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
                      borderRadius: 6,
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
              background: "linear-gradient(135deg, #FDF0EE, #fce8e4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 22,
              fontWeight: 700,
              color: "#E8553A",
              boxShadow: "0 4px 16px rgba(232, 85, 58, 0.15)",
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
              padding: "10px 28px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)",
              color: "#fff",
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
      )}

      {/* Empty — no workflows */}
      {!loading && !error && workflows.length === 0 && !search && (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            animation: "fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--color-border), #dfe4ea)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 22,
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
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            animation: "fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        >
          <div style={{ fontSize: 16, color: "var(--color-text)", fontFamily: "var(--font-body)", marginBottom: 8 }}>
            No workflows match this filter
          </div>
          <div style={{ fontSize: 13, color: "var(--color-muted)", fontFamily: "var(--font-body)", marginBottom: 16 }}>
            Try a different gap type or clear your filters.
          </div>
          <button
            onClick={() => { setGapFilter("all"); setSearch(""); }}
            style={{
              padding: "8px 20px",
              borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--color-border)",
              background: "var(--color-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text)",
              cursor: "pointer",
              transition: "all 0.2s ease",
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
            gap: 18,
          }}
        >
          {filtered.map((w, i) => (
            <div
              key={w.id}
              style={{
                animation: `fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) ${Math.min(i * 0.06, 0.6)}s both`,
              }}
            >
              <WorkflowCard workflow={w} onDelete={handleDelete} />
            </div>
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
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  delay: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 18,
        background: hovered
          ? "linear-gradient(135deg, var(--color-surface) 0%, rgba(255,255,255,0.9) 100%)"
          : "var(--color-surface)",
        borderRadius: "var(--radius-lg)",
        border: `1.5px solid ${hovered ? (color || "var(--color-accent)") : "var(--color-border)"}`,
        textAlign: "center",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        animation: `fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) ${delay * 0.08}s both`,
        boxShadow: hovered
          ? `0 8px 24px ${color ? color + "18" : "rgba(0,0,0,0.08)"}`
          : "0 1px 3px rgba(0,0,0,0.04)",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
        cursor: "default",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Subtle top accent bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: "20%",
          right: "20%",
          height: 2,
          background: color
            ? `linear-gradient(90deg, transparent, ${color}, transparent)`
            : "linear-gradient(90deg, transparent, var(--color-border), transparent)",
          opacity: hovered ? 0.8 : 0.3,
          transition: "opacity 0.3s ease",
          borderRadius: "0 0 2px 2px",
        }}
      />
      <div
        style={{
          fontSize: 22,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: color || "var(--color-dark)",
          lineHeight: 1.2,
          animation: `statCount 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay * 0.08 + 0.2}s both`,
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
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}
