"use client";

import Link from "next/link";
import type { Workflow } from "@/lib/types";
import { formatDate, truncate } from "@/lib/utils";

interface WorkflowCardProps {
  workflow: Workflow;
  onDelete?: (id: string) => void;
}

export default function WorkflowCard({ workflow, onDelete }: WorkflowCardProps) {
  const { decomposition } = workflow;
  const health = decomposition.health;

  // Average health indicator color
  const avgHealth =
    (health.automationPotential + health.teamLoadBalance +
      (100 - health.fragility) + (100 - health.complexity)) /
    4;
  const healthColor =
    avgHealth >= 65 ? "#17A589" : avgHealth >= 40 ? "#D4A017" : "#E8553A";

  return (
    <div
      style={{
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: 10,
        padding: "16px 20px",
        transition: "border-color 0.2s, box-shadow 0.2s",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <Link
          href={`/xray/${workflow.id}`}
          style={{
            fontSize: 15,
            fontWeight: 700,
            fontFamily: "var(--font-display)",
            color: "var(--color-dark)",
            textDecoration: "none",
            lineHeight: 1.3,
          }}
        >
          {decomposition.title}
        </Link>
        <div
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: healthColor,
            flexShrink: 0,
            marginTop: 4,
          }}
          title={`Health: ${Math.round(avgHealth)}%`}
        />
      </div>

      <p
        style={{
          fontSize: 13,
          color: "var(--color-text)",
          lineHeight: 1.5,
        }}
      >
        {truncate(workflow.description, 120)}
      </p>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Tag label={`${decomposition.steps.length} steps`} />
        <Tag label={`${decomposition.gaps.length} gaps`} />
        <Tag label={`${health.automationPotential}% automatable`} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: "auto",
          paddingTop: 8,
          borderTop: "1px solid var(--color-border)",
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
          }}
        >
          {formatDate(workflow.createdAt)}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          <Link
            href={`/xray/${workflow.id}`}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              color: "var(--color-dark)",
              textDecoration: "none",
              padding: "4px 10px",
              borderRadius: 5,
              background: "var(--color-border)",
            }}
          >
            View
          </Link>
          {onDelete && (
            <button
              onClick={() => onDelete(workflow.id)}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--color-muted)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
              }}
            >
              Delete
            </button>
          )}
        </div>
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
        padding: "2px 7px",
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
