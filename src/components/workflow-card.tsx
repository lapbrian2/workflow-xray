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
  if (v >= 65) return "var(--color-success)";
  if (v >= 40) return "var(--color-warning)";
  return "var(--color-accent)";
}

function fragilityBarColor(fragility: number): string {
  if (fragility >= 70) return "var(--color-accent)";
  if (fragility >= 40) return "var(--color-warning)";
  return "var(--color-success)";
}

function getHealthBorderColor(avgHealth: number): string {
  if (avgHealth >= 65) return "var(--color-success)";
  if (avgHealth >= 40) return "var(--color-warning)";
  return "var(--color-accent)";
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
    avgHealth >= 65 ? "var(--color-success)" : avgHealth >= 40 ? "var(--color-warning)" : "var(--color-accent)";
  const borderAccentColor = getHealthBorderColor(avgHealth);

  const handleDeleteClick = () => {
    onDelete?.(workflow.id);
  };

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "var(--color-surface)",
        border: `1px solid ${hovered ? "var(--color-accent)" : "var(--color-border)"}`,
        borderRadius: "var(--radius-lg)",
        borderLeft: `3px solid ${borderAccentColor}`,
        padding: 0,
        transition: "all 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
        display: "flex",
        flexDirection: "column",
        boxShadow: hovered
          ? "0 12px 32px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.02)"
          : "0 1px 4px rgba(0,0,0,0.04)",
        overflow: "hidden",
        position: "relative",
        transform: hovered ? "translateY(-2px)" : "translateY(0)",
      }}
    >
      {/* Shimmer overlay on hover */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.03) 30%, rgba(232,85,58,0.04) 50%, rgba(255,255,255,0.03) 70%, transparent 100%)",
          backgroundSize: "300% 100%",
          animation: hovered ? "cardShimmer 1.5s ease infinite" : "none",
          pointerEvents: "none",
          zIndex: 0,
          opacity: hovered ? 1 : 0,
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Fragility bar at top */}
      <div
        style={{
          height: 3,
          width: "100%",
          background: "var(--color-border)",
          overflow: "hidden",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${health.fragility}%`,
            background: `linear-gradient(90deg, ${fragilityBarColor(health.fragility)}, ${fragilityBarColor(health.fragility)}88)`,
            transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
            transformOrigin: "left",
          }}
          title={`Fragility: ${health.fragility}%`}
        />
      </div>

      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, flex: 1, position: "relative", zIndex: 1 }}>
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
              transition: "color 0.2s ease",
            }}
          >
            {decomposition.title}
          </Link>
          {/* Animated health indicator */}
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: `radial-gradient(circle, ${healthColor} 40%, ${healthColor}88 100%)`,
              flexShrink: 0,
              marginTop: 4,
              boxShadow: hovered
                ? `0 0 8px ${healthColor}55`
                : `0 0 0 ${healthColor}00`,
              transition: "box-shadow 0.3s ease",
              animation: hovered ? "dotPulse 2s ease infinite" : "none",
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

        {/* Stats with mini-bars */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <StatTag
            label={`${decomposition.steps.length} steps`}
            value={Math.min(decomposition.steps.length / 15, 1)}
            color="var(--color-info)"
          />
          <StatTag
            label={`${decomposition.gaps.length} gaps`}
            value={Math.min(decomposition.gaps.length / 8, 1)}
            color={decomposition.gaps.length > 4 ? "var(--color-accent)" : "var(--color-warning)"}
          />
          <StatTag
            label={`${health.automationPotential}% auto`}
            value={health.automationPotential / 100}
            color="var(--color-success)"
          />
        </div>

        {/* Health mini-bars instead of just dots */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <MiniHealthBar label="Complexity" value={health.complexity} invert />
          <MiniHealthBar label="Fragility" value={health.fragility} invert />
          <MiniHealthBar label="Automation" value={health.automationPotential} />
          <MiniHealthBar label="Balance" value={health.teamLoadBalance} />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 8,
              color: "var(--color-muted)",
              marginLeft: "auto",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
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
            paddingTop: 10,
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
                  background: "linear-gradient(135deg, var(--color-accent), #F09060)",
                  color: "var(--color-light)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 600,
                }}
              >
                v{workflow.version}
              </span>
            )}
            {workflow.remediationPlan && (
              <Link
                href={`/xray/${workflow.id}/remediation`}
                onClick={(e) => e.stopPropagation()}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9,
                  background: "linear-gradient(135deg, var(--color-success), var(--color-cell))",
                  color: "var(--color-light)",
                  padding: "2px 7px",
                  borderRadius: 4,
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                }}
              >
                🔧 Plan
              </Link>
            )}
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Link
              href={`/xray/${workflow.id}`}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--color-light)",
                textDecoration: "none",
                padding: "5px 14px",
                borderRadius: 6,
                background: "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(232, 85, 58, 0.2)",
              }}
            >
              View
            </Link>
            {onDelete && (
              <button
                onClick={handleDeleteClick}
                aria-label={`Delete ${decomposition.title}`}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-muted)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 6,
                  transition: "all var(--duration-fast) var(--ease-default)",
                  fontWeight: 400,
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

function StatTag({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        padding: "3px 10px 3px 8px",
        borderRadius: 5,
        background: "var(--color-border)",
        color: "var(--color-text)",
        fontWeight: 500,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Mini bar indicator */}
      <span
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 2,
          width: `${value * 100}%`,
          background: `linear-gradient(90deg, ${color}, ${color}88)`,
          borderRadius: 2,
          transition: "width 0.5s ease",
        }}
      />
      {label}
    </span>
  );
}

function MiniHealthBar({
  label,
  value,
  invert,
}: {
  label: string;
  value: number;
  invert?: boolean;
}) {
  const v = invert ? 100 - value : value;
  const color = v >= 65 ? "var(--color-success)" : v >= 40 ? "var(--color-warning)" : "var(--color-accent)";

  return (
    <div
      title={`${label}: ${value}%`}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
        cursor: "default",
      }}
    >
      {/* Bar */}
      <div
        style={{
          width: 24,
          height: 4,
          borderRadius: 2,
          background: "var(--color-border)",
          overflow: "hidden",
          position: "relative",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: 2,
            transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            transformOrigin: "left",
          }}
        />
      </div>
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 7,
          color: "var(--color-muted)",
          lineHeight: 1,
        }}
      >
        {value}
      </span>
    </div>
  );
}
