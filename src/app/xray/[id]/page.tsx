"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { Workflow } from "@/lib/types";
import { useStore } from "@/lib/store";
import XRayViz from "@/components/xray-viz";
import GapAnalysis from "@/components/gap-analysis";
import HealthCard from "@/components/health-card";

export default function XRayPage() {
  const params = useParams();
  const id = params.id as string;
  const { activeTab, setActiveTab } = useStore();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/workflows?id=${id}`);
      if (!res.ok) throw new Error("Workflow not found");
      const data = await res.json();
      setWorkflow(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── Loading State ── */
  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px" }}>
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
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 32px" }}>
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
              background: "#FDF0EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 24,
              color: "#E8553A",
              fontWeight: 700,
            }}
          >
            !
          </div>
          <div
            style={{
              fontSize: 16,
              color: "#C0392B",
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
              onClick={load}
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
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 32px 64px" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
            textDecoration: "none",
            marginBottom: 8,
            display: "inline-block",
          }}
        >
          &larr; New X-Ray
        </Link>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            fontFamily: "var(--font-display)",
            color: "var(--color-dark)",
            letterSpacing: "-0.02em",
          }}
        >
          {decomposition.title}
        </h1>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 8,
            flexWrap: "wrap",
          }}
        >
          <Tag label={`${decomposition.steps.length} steps`} />
          <Tag label={`${decomposition.gaps.length} gaps`} />
          <Tag label={`${decomposition.health.automationPotential}% automatable`} />
          <span style={{ flex: 1 }} />
          <Link
            href="/library"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              color: "var(--color-muted)",
              textDecoration: "none",
              padding: "4px 8px",
              borderRadius: 4,
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              transition: "all 0.2s",
            }}
          >
            View in Library &rarr;
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 24,
          background: "var(--color-border)",
          borderRadius: "var(--radius-sm)",
          padding: 4,
          width: "fit-content",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "none",
              background:
                activeTab === tab.key ? "var(--color-surface)" : "transparent",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 600 : 400,
              color:
                activeTab === tab.key
                  ? "var(--color-dark)"
                  : "var(--color-muted)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ animation: "fadeIn 0.3s ease" }}>
        {activeTab === "flow" && (
          <div
            style={{
              height: 600,
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
        padding: "3px 8px",
        borderRadius: 4,
        background: "var(--color-border)",
        color: "var(--color-text)",
        fontWeight: 500,
      }}
    >
      {label}
    </span>
  );
}
