"use client";

import { useState } from "react";
import Link from "next/link";
import type { Workflow } from "@/lib/types";
import { formatDate, truncate } from "@/lib/utils";

interface WorkflowCardProps {
  workflow: Workflow;
  onDelete?: (id: string) => void;
}

function healthDotColor(value: number, invert: boolean): string {
  const v = invert ? 100 - value : value;
  if (v >= 65) return "#17A589";
  if (v >= 40) return "#D4A017";
  return "#E8553A";
}

function fragilityBarColor(fragility: number): string {
  if (fragility >= 70) return "#E8553A";
  if (fragility >= 40) return "#D4A017";
  return "#17A589";
}

export default function WorkflowCard({ workflow, onDelete }: WorkflowCardProps) {
  const { decomposition } = workflow;
  const health = decomposition.health;
  const [hovered, setHovered] = useState(false);

  // Average health indicator color
  const avgHealth =
    (health.automationPotential + health.teamLoadBalance +
      (100 - health.fragility) + (100 - health.complexity)) /
    4;
  const healthColor =
    avgHealth >= 65 ? "#17A589" : avgHealth >= 40 ? "#D4A017" : "#E8553A";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${hovered ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: 0,
        transition: "border-color 0.2s, box-shadow 0.2s",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered
          ? "0 6px 20px rgba(0,0,0,0.10)"
          : "0 1px 3px rgba(0,0,0,0.04)",
        overflow: "hidden",
      }}
    >
      {/* Fragility bar at top */}
      <div
        style={{
          height: 4,
          width: "100%",
          background: "var(--color-border)",
          borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${health.fragility}%`,
            background: fragilityBarColor(health.fragility),
            borderRadius: "var(--radius-lg) 0 0 0",
            transition: "width 0.4s ease",
          }}
          title={`Fragility: ${health.fragility}%`}
        />
      </div>

      <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
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

        {/* Mini health summary dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 4,
          }}
        >
          <HealthDot
            label="Complexity"
            value={health.complexity}
            color={healthDotColor(health.complexity, true)}
          />
          <HealthDot
            label="Fragility"
            value={health.fragility}
            color={healthDotColor(health.fragility, true)}
          />
          <HealthDot
            label="Automation"
            value={health.automationPotential}
            color={healthDotColor(health.automationPotential, false)}
          />
          <HealthDot
            label="Balance"
            value={health.teamLoadBalance}
            color={healthDotColor(health.teamLoadBalance, false)}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              color: "var(--color-muted)",
              marginLeft: "auto",
            }}
          >
            health
          </span>
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
              display: "flex",
              alignItems: "center",
              gap: 6,
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
            {workflow.version && workflow.version > 1 && (
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  background: "var(--color-accent)",
                  color: "#fff",
                  padding: "1px 6px",
                  borderRadius: 3,
                  fontWeight: 600,
                }}
              >
                v{workflow.version}
              </span>
            )}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              href={`/xray/${workflow.id}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                color: "#fff",
                textDecoration: "none",
                padding: "5px 12px",
                borderRadius: 6,
                background: "var(--color-accent)",
                transition: "opacity 0.15s",
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
    </div>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        padding: "2px 8px",
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

function HealthDot({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      title={`${label}: ${value}%`}
      style={{
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: color,
        flexShrink: 0,
        cursor: "default",
      }}
    />
  );
}
