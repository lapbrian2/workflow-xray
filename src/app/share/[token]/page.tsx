"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import type { Decomposition } from "@/lib/types";
import XRayViz from "@/components/xray-viz";
import GapAnalysis from "@/components/gap-analysis";
import HealthCard from "@/components/health-card";

interface SharedWorkflow {
  id: string;
  decomposition: Decomposition;
  createdAt: string;
  updatedAt: string;
  version?: number;
}

interface ShareMeta {
  label?: string;
  expiresAt?: string;
}

interface ShareResponse {
  workflow: SharedWorkflow;
  share: ShareMeta;
}

type ActiveTab = "flow" | "gaps" | "health";

export default function SharePage() {
  const params = useParams();
  const token = params.token as string;

  const [data, setData] = useState<ShareResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>("flow");

  useEffect(() => {
    let cancelled = false;

    const loadSharedWorkflow = async () => {
      setError(null);
      setLoading(true);
      try {
        const res = await fetch(`/api/share/${token}`);
        if (cancelled) return;

        if (!res.ok) {
          if (res.status === 404) {
            throw new Error(
              "This share link is invalid or the workflow has been deleted."
            );
          }
          if (res.status === 410) {
            throw new Error("This share link has expired.");
          }
          throw new Error("Something went wrong. Please try again.");
        }

        const json: ShareResponse = await res.json();
        if (cancelled) return;
        setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load shared workflow"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadSharedWorkflow();

    return () => {
      cancelled = true;
    };
  }, [token]);

  /* ── Loading State ── */
  if (loading) {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)",
        }}
      >
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
  if (error || !data) {
    return (
      <div
        style={{
          maxWidth: 960,
          margin: "0 auto",
          padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px)",
        }}
      >
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
            {error || "Unable to load shared workflow"}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              marginBottom: 24,
            }}
          >
            The share link may be invalid, expired, or the workflow may have been
            removed.
          </div>
          <a
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
            Go to Workflow X-Ray
          </a>
        </div>

        {/* Branding footer */}
        <div
          style={{
            textAlign: "center",
            marginTop: 48,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
          }}
        >
          Shared via Workflow X-Ray
        </div>
      </div>
    );
  }

  /* ── Success State ── */
  const { workflow, share } = data;
  const { decomposition } = workflow;
  const tabs: { key: ActiveTab; label: string }[] = [
    { key: "flow", label: "Flow Map" },
    { key: "gaps", label: `Gaps (${decomposition.gaps.length})` },
    { key: "health", label: "Health" },
  ];

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "clamp(20px, 4vw, 32px) clamp(16px, 4vw, 32px) 64px",
      }}
    >
      {/* Header */}
      <div
        style={{
          marginBottom: 28,
          animation: "fadeInUp 0.4s var(--ease-spring) both",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
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

        {/* Tags row */}
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
          <Tag
            label={`${decomposition.health.automationPotential}% automatable`}
          />
        </div>

        {/* Share metadata */}
        {(share.label || share.expiresAt) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginTop: 12,
              flexWrap: "wrap",
            }}
          >
            {share.label && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--color-muted)",
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-border)",
                  padding: "3px 10px",
                  borderRadius: "var(--radius-xs)",
                }}
              >
                Shared: {share.label}
              </span>
            )}
            {share.expiresAt && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-muted)",
                }}
              >
                Expires:{" "}
                {new Date(share.expiresAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Shared X-Ray analysis views"
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
        {activeTab === "gaps" && <GapAnalysis gaps={decomposition.gaps} />}
        {activeTab === "health" && (
          <HealthCard
            health={decomposition.health}
            stepCount={decomposition.steps.length}
            gapCount={decomposition.gaps.length}
          />
        )}
      </div>

      {/* Branding footer */}
      <div
        style={{
          textAlign: "center",
          marginTop: 48,
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-muted)",
        }}
      >
        <a
          href="/"
          style={{
            color: "var(--color-muted)",
            textDecoration: "none",
          }}
        >
          Shared via Workflow X-Ray
        </a>
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
