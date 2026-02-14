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

  useEffect(() => {
    async function load() {
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
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 28px" }}>
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
            fontSize: 15,
          }}
        >
          Loading workflow...
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "40px 28px" }}>
        <div
          style={{
            textAlign: "center",
            padding: "80px 20px",
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: "#C0392B",
              fontFamily: "var(--font-body)",
              marginBottom: 12,
            }}
          >
            {error || "Workflow not found"}
          </div>
          <Link
            href="/"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              color: "var(--color-dark)",
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 6,
              background: "var(--color-border)",
            }}
          >
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const { decomposition } = workflow;
  const tabs = [
    { key: "flow" as const, label: "Flow Map" },
    { key: "gaps" as const, label: `Gaps (${decomposition.gaps.length})` },
    { key: "health" as const, label: "Health" },
  ];

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 28px 60px" }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
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
            fontSize: 24,
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
            gap: 8,
            marginTop: 8,
          }}
        >
          <Tag label={`${decomposition.steps.length} steps`} />
          <Tag label={`${decomposition.gaps.length} gaps`} />
          <Tag label={`${decomposition.health.automationPotential}% automatable`} />
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 20,
          background: "var(--color-border)",
          borderRadius: 8,
          padding: 3,
          width: "fit-content",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "8px 18px",
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
              borderRadius: 12,
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
