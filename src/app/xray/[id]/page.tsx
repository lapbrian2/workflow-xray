"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { Workflow } from "@/lib/types";
import { useStore } from "@/lib/store";
import { getWorkflowLocal, saveWorkflowLocal } from "@/lib/client-db";
import XRayViz from "@/components/xray-viz";
import GapAnalysis from "@/components/gap-analysis";
import HealthCard from "@/components/health-card";
import VersionTimeline from "@/components/version-timeline";
import { exportToPdf } from "@/lib/pdf-export";
import Breadcrumb from "@/components/breadcrumb";
import { useToast } from "@/components/toast";

export default function XRayPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { activeTab, setActiveTab, resetXRayView } = useStore();
  const { addToast } = useToast();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [versionSiblings, setVersionSiblings] = useState<Workflow[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [notionUrl, setNotionUrl] = useState<string | null>(null);
  const [notionPageId, setNotionPageId] = useState<string | null>(null);
  const exportLock = useRef(false);
  const syncLock = useRef(false);

  const handleExportPdf = async () => {
    if (!workflow || exportLock.current) return;
    exportLock.current = true;
    setExporting(true);
    try {
      await exportToPdf(workflow.decomposition, workflow.costContext);
      addToast("success", "PDF downloaded successfully");
    } catch (err) {
      console.error("PDF export failed:", err);
      const msg = err instanceof Error ? err.message : "PDF export failed. Please try again.";
      setError(msg);
      addToast("error", msg);
    } finally {
      setExporting(false);
      exportLock.current = false;
    }
  };

  const handleReanalyze = () => {
    if (!workflow) return;
    const parentId = workflow.parentId || workflow.id;
    router.push(`/?reanalyze=${parentId}`);
  };

  const handleNotionSync = async () => {
    if (!workflow || syncing || syncLock.current) return;
    syncLock.current = true;
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/notion-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workflow,
          appUrl: `${window.location.origin}/xray/${workflow.id}`,
          notionPageId: notionPageId || undefined,
        }),
      });
      if (!res.ok) {
        let err;
        try {
          err = await res.json();
        } catch {
          err = { error: { message: `Sync failed with status ${res.status}` } };
        }
        // If page was deleted (404), fall back to creating a new one
        if (res.status === 404 && notionPageId) {
          setNotionPageId(null);
          setSynced(false);
          setNotionUrl(null);
          throw new Error("Notion page was deleted. Click Sync again to create a new one.");
        }
        throw new Error(err.error?.message || err.error || "Sync failed");
      }
      const data = await res.json();
      setSynced(true);
      setNotionUrl(data.notionUrl);
      setNotionPageId(data.pageId);
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

  // Retry counter to re-trigger the effect
  const [retryCount, setRetryCount] = useState(0);

  // Reset flow map view state + Notion sync state when switching between workflows
  useEffect(() => {
    resetXRayView();
    setSynced(false);
    setNotionUrl(null);
    setNotionPageId(null);
  }, [id, resetXRayView]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkflow = async () => {
      setError(null);
      setLoading(true);
      try {
        const local = getWorkflowLocal(id);
        let resolved: Workflow | null = local;

        try {
          const res = await fetch(`/api/workflows?id=${id}`);
          if (cancelled) return;
          if (res.ok) {
            const serverData: Workflow = await res.json();
            resolved = serverData;
            saveWorkflowLocal(serverData);
          }
        } catch {
          // Server unavailable — use local data
        }

        if (cancelled) return;

        if (!resolved) {
          throw new Error("Workflow not found");
        }

        setWorkflow(resolved);

        const rootId = resolved.parentId || resolved.id;
        try {
          const allRes = await fetch("/api/workflows");
          if (cancelled) return;
          if (allRes.ok) {
            const allData = await allRes.json();
            const siblings = (allData.workflows as Workflow[]).filter(
              (w: Workflow) => w.id === rootId || w.parentId === rootId
            );
            setVersionSiblings(siblings.length > 1 ? siblings : []);
          }
        } catch {
          // Silently ignore version fetch errors
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadWorkflow();

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, retryCount]);

  /* ── Loading State ── */
  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)" }}>
        {/* Back link skeleton */}
        <div
          style={{
            height: 12,
            width: 80,
            background: "var(--color-border)",
            borderRadius: 4,
            marginBottom: 8,
            animation: "pulse-slow 1.5s ease infinite",
          }}
        />
        {/* Title skeleton */}
        <div
          style={{
            height: 32,
            width: 320,
            background: "var(--color-border)",
            borderRadius: "var(--radius-sm)",
            marginBottom: 12,
            animation: "pulse-slow 1.5s ease 0.1s infinite",
          }}
        />
        {/* Tags skeleton */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[72, 56, 96].map((w, i) => (
            <div
              key={i}
              style={{
                height: 20,
                width: w,
                background: "var(--color-border)",
                borderRadius: 4,
                animation: `pulse-slow 1.5s ease ${0.2 + i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
        {/* Tab skeleton */}
        <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
          {[80, 64, 72].map((w, i) => (
            <div
              key={i}
              style={{
                height: 32,
                width: w,
                background: "var(--color-border)",
                borderRadius: "var(--radius-sm)",
                animation: `pulse-slow 1.5s ease ${0.3 + i * 0.1}s infinite`,
              }}
            />
          ))}
        </div>
        {/* Content skeleton */}
        <div
          style={{
            height: 500,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-lg)",
            animation: "pulse-slow 1.5s ease 0.5s infinite",
          }}
        />
      </div>
    );
  }

  /* ── Error State ── */
  if (error || !workflow) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)" }}>
        <div
          style={{
            textAlign: "center",
            padding: "80px 24px",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(232, 85, 58, 0.06)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 24,
              color: "var(--color-accent)",
              fontWeight: 700,
            }}
          >
            !
          </div>
          <div
            style={{
              fontSize: 16,
              color: "var(--color-danger)",
              fontFamily: "var(--font-body)",
              marginBottom: 8,
            }}
          >
            {error || "Workflow not found"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              marginBottom: 24,
            }}
          >
            The workflow may have been deleted or the link is invalid.
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
            <button
              onClick={() => setRetryCount((c) => c + 1)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 600,
                color: "#fff",
                padding: "8px 24px",
                borderRadius: "var(--radius-sm)",
                border: "none",
                background: "var(--color-accent)",
                cursor: "pointer",
              }}
            >
              Retry
            </button>
            <Link
              href="/"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                color: "var(--color-text)",
                textDecoration: "none",
                padding: "8px 16px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    );
  }

  /* ── Success State ── */
  const { decomposition } = workflow;
  const tabs = [
    { key: "flow" as const, label: "Flow Map" },
    { key: "gaps" as const, label: `Gaps (${decomposition.gaps.length})` },
    { key: "health" as const, label: "Health" },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px) 64px" }}>
      {/* Breadcrumb */}
      <Breadcrumb
        items={[
          { label: "X-Ray", href: "/" },
          { label: decomposition.title },
        ]}
      />

      {/* Header */}
      <div style={{ marginBottom: 28, animation: "fadeInUp 0.4s var(--ease-spring) both" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          <h1
            style={{
              fontSize: "clamp(24px, 5vw, 32px)",
              fontWeight: 900,
              fontFamily: "var(--font-display)",
              color: "var(--color-dark)",
              letterSpacing: "-0.02em",
            }}
          >
            {decomposition.title}
          </h1>
          {workflow.version && workflow.version > 1 && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: 700,
                color: "var(--color-accent)",
                background: "rgba(232, 85, 58, 0.08)",
                padding: "2px 8px",
                borderRadius: "var(--radius-xs)",
              }}
            >
              v{workflow.version}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 12,
            flexWrap: "wrap",
          }}
        >
          <Tag label={`${decomposition.steps.length} steps`} />
          <Tag label={`${decomposition.gaps.length} gaps`} />
          <Tag label={`${decomposition.health.automationPotential}% automatable`} />
          <span style={{ flex: 1 }} />
          <button
            onClick={handleExportPdf}
            disabled={exporting}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 100%)",
              cursor: exporting ? "wait" : "pointer",
              transition: "all var(--duration-normal) var(--ease-default)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              boxShadow: "var(--shadow-accent)",
            }}
          >
            {exporting ? (
              <>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    border: "2px solid rgba(255,255,255,0.3)",
                    borderTop: "2px solid #fff",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }}
                />
                Exporting...
              </>
            ) : (
              "Download PDF"
            )}
          </button>
          <Link
            href={`/xray/${id}/remediation`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "#fff",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "linear-gradient(135deg, var(--color-success) 0%, #1ABC9C 100%)",
              cursor: "pointer",
              transition: "all var(--duration-normal) var(--ease-default)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              textDecoration: "none",
              boxShadow: "0 2px 8px rgba(23, 165, 137, 0.25)",
            }}
          >
            Remediation Plan
          </Link>
          <button
            onClick={handleReanalyze}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-dark)",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--color-border)",
              background: "var(--color-surface)",
              cursor: "pointer",
              transition: "all var(--duration-normal) var(--ease-default)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              boxShadow: "var(--shadow-xs)",
            }}
          >
            Re-analyze
          </button>
          <button
            onClick={handleNotionSync}
            disabled={syncing}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: synced ? "var(--color-success)" : "var(--color-dark)",
              padding: "6px 14px",
              borderRadius: "var(--radius-sm)",
              border: `1.5px solid ${synced ? "rgba(23,165,137,0.25)" : "var(--color-border)"}`,
              background: synced
                ? "var(--success-bg-light)"
                : "var(--color-surface)",
              cursor: syncing ? "default" : "pointer",
              transition: "all 0.2s",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: 600,
              opacity: syncing ? 0.7 : 1,
            }}
          >
            {syncing ? (
              <>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    border: "2px solid rgba(0,0,0,0.1)",
                    borderTop: "2px solid var(--color-dark)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                    display: "inline-block",
                  }}
                />
                {notionPageId ? "Updating..." : "Syncing..."}
              </>
            ) : synced ? (
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
                Update Notion
                {notionUrl && (
                  <a
                    href={notionUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      color: "var(--color-success)",
                      textDecoration: "underline",
                      fontSize: 10,
                    }}
                  >
                    Open
                  </a>
                )}
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
                Sync to Notion
              </>
            )}
          </button>
          <Link
            href="/library"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-muted)",
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1.5px solid var(--color-border)",
              background: "var(--color-surface)",
              transition: "all var(--duration-normal) var(--ease-default)",
              boxShadow: "var(--shadow-xs)",
            }}
          >
            View in Library &rarr;
          </Link>
        </div>
      </div>

      {/* Version Timeline */}
      {versionSiblings.length > 1 && (
        <VersionTimeline
          versions={versionSiblings}
          currentId={workflow.id}
          onSelectVersion={(vId) => router.push(`/xray/${vId}`)}
        />
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="X-Ray analysis views"
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 24,
          background: "rgba(0,0,0,0.04)",
          borderRadius: "var(--radius-sm)",
          padding: 4,
          width: "fit-content",
          animation: "fadeInUp 0.4s var(--ease-spring) 0.1s both",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            role="tab"
            aria-selected={activeTab === tab.key}
            aria-controls={`tabpanel-${tab.key}`}
            onClick={() => setActiveTab(tab.key)}
            className={`tab-pill${activeTab === tab.key ? " tab-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeTab}`}
        aria-label={`${activeTab} view`}
        style={{ animation: "fadeIn 0.3s ease" }}
      >
        {activeTab === "flow" && (
          <div
            style={{
              height: "max(500px, 65vh)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <XRayViz decomposition={decomposition} />
          </div>
        )}
        {activeTab === "gaps" && (
          <GapAnalysis gaps={decomposition.gaps} />
        )}
        {activeTab === "health" && (
          <HealthCard
            health={decomposition.health}
            stepCount={decomposition.steps.length}
            gapCount={decomposition.gaps.length}
          />
        )}
      </div>
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        padding: "4px 10px",
        borderRadius: "var(--radius-full)",
        background: "rgba(0,0,0,0.04)",
        color: "var(--color-text)",
        fontWeight: 600,
        letterSpacing: "0.02em",
        border: "1px solid rgba(0,0,0,0.06)",
      }}
    >
      {label}
    </span>
  );
}
