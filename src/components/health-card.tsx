"use client";

import { useEffect, useState, useRef } from "react";
import type { HealthMetrics } from "@/lib/types";
import ScoreRing from "./score-ring";
import MetricBar from "./metric-bar";

interface HealthCardProps {
  health: HealthMetrics;
  stepCount: number;
  gapCount: number;
}

function scoreLabel(value: number): string {
  if (value >= 80) return "Excellent";
  if (value >= 60) return "Good";
  if (value >= 40) return "Fair";
  return "Poor";
}

function scoreColor(value: number): string {
  if (value >= 80) return "var(--color-success)";
  if (value >= 60) return "var(--color-info)";
  if (value >= 40) return "var(--color-warning)";
  return "var(--color-accent)";
}

/** For metrics where high = bad (complexity, fragility), invert the color logic */
function invertedScoreColor(value: number): string {
  if (value <= 20) return "var(--color-success)";
  if (value <= 40) return "var(--color-info)";
  if (value <= 60) return "var(--color-warning)";
  return "var(--color-accent)";
}

function invertedScoreLabel(value: number): string {
  if (value <= 20) return "Excellent";
  if (value <= 40) return "Good";
  if (value <= 60) return "Fair";
  return "Poor";
}

function statBoxColor(label: string, value: number): string {
  if (label === "Steps" || label === "Gaps") return "var(--color-dark)";
  if (label === "Complexity") return invertedScoreColor(value as number);
  if (label === "Avg Automation") return scoreColor(value as number);
  return "var(--color-dark)";
}

function statBoxBorderColor(label: string, value: number): string {
  if (label === "Complexity") return invertedScoreColor(value as number) + "40";
  if (label === "Avg Automation") return scoreColor(value as number) + "40";
  return "var(--color-border)";
}

function generateInterpretation(health: HealthMetrics): string {
  const issues: string[] = [];
  if (health.fragility >= 60) {
    issues.push("high fragility -- consider adding fallback mechanisms");
  }
  if (health.complexity >= 70) {
    issues.push("high complexity -- look for steps that can be merged or simplified");
  }
  if (health.automationPotential < 40) {
    issues.push("low automation potential -- identify manual steps that could be tooled");
  }
  if (health.teamLoadBalance < 40) {
    issues.push("uneven team load -- redistribute ownership across team members");
  }

  if (issues.length === 0) {
    return "This workflow is well-balanced with healthy scores across all dimensions.";
  }
  return "This workflow has " + issues.join("; ") + ".";
}

/** Severity-based background tint for the score rings section */
function overallHealthBg(health: HealthMetrics): string {
  const avg = (health.complexity + health.fragility + (100 - health.automationPotential) + (100 - health.teamLoadBalance)) / 4;
  if (avg >= 60) return "linear-gradient(135deg, rgba(232,85,58,0.03) 0%, rgba(212,160,23,0.02) 100%)";
  if (avg >= 40) return "linear-gradient(135deg, rgba(212,160,23,0.03) 0%, rgba(45,125,210,0.02) 100%)";
  return "linear-gradient(135deg, rgba(23,165,137,0.03) 0%, rgba(45,125,210,0.02) 100%)";
}

export default function HealthCard({
  health,
  stepCount,
  gapCount,
}: HealthCardProps) {
  return (
    <div style={{ animation: "staggerFadeIn 0.5s ease both" }}>
      {/* Summary stats */}
      <div
        className="grid-stats-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        <AnimatedStatBox label="Steps" value={stepCount} delay={0} />
        <AnimatedStatBox label="Gaps" value={gapCount} delay={80} />
        <AnimatedStatBox
          label="Avg Automation"
          value={`${health.automationPotential}%`}
          numericValue={health.automationPotential}
          delay={160}
        />
        <AnimatedStatBox
          label="Complexity"
          value={health.complexity}
          numericValue={health.complexity}
          delay={240}
        />
      </div>

      {/* Score rings with interpretive labels */}
      <div
        className="grid-stats-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          padding: "clamp(20px, 4vw, 32px) clamp(16px, 3vw, 24px)",
          background: overallHealthBg(health),
          backdropFilter: "blur(8px)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          marginBottom: 24,
          position: "relative",
          overflow: "hidden",
          animation: "staggerFadeIn 0.5s ease 0.15s both",
        }}
      >
        {/* Subtle ambient gradient overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 30% 20%, rgba(45,125,210,0.04) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(142,68,173,0.03) 0%, transparent 60%)",
            pointerEvents: "none",
          }}
        />

        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <ScoreRing
            value={health.complexity}
            label="Complexity"
            color="var(--color-info)"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: invertedScoreColor(health.complexity),
              marginTop: 8,
              padding: "3px 10px",
              borderRadius: 12,
              background: invertedScoreColor(health.complexity) + "12",
              display: "inline-block",
              letterSpacing: "0.04em",
            }}
          >
            {invertedScoreLabel(health.complexity)}
          </div>
        </div>
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <ScoreRing
            value={health.fragility}
            label="Fragility"
            color="var(--color-accent)"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: invertedScoreColor(health.fragility),
              marginTop: 8,
              padding: "3px 10px",
              borderRadius: 12,
              background: invertedScoreColor(health.fragility) + "12",
              display: "inline-block",
              letterSpacing: "0.04em",
            }}
          >
            {invertedScoreLabel(health.fragility)}
          </div>
        </div>
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <ScoreRing
            value={health.automationPotential}
            label="Automation"
            color="var(--color-success)"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: scoreColor(health.automationPotential),
              marginTop: 8,
              padding: "3px 10px",
              borderRadius: 12,
              background: scoreColor(health.automationPotential) + "12",
              display: "inline-block",
              letterSpacing: "0.04em",
            }}
          >
            {scoreLabel(health.automationPotential)}
          </div>
        </div>
        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <ScoreRing
            value={health.teamLoadBalance}
            label="Team Balance"
            color="var(--color-memory)"
          />
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 700,
              color: scoreColor(health.teamLoadBalance),
              marginTop: 8,
              padding: "3px 10px",
              borderRadius: 12,
              background: scoreColor(health.teamLoadBalance) + "12",
              display: "inline-block",
              letterSpacing: "0.04em",
            }}
          >
            {scoreLabel(health.teamLoadBalance)}
          </div>
        </div>
      </div>

      {/* Detailed bars */}
      <div
        style={{
          padding: 24,
          background: "var(--color-surface)",
          borderRadius: "var(--radius-lg)",
          border: "1px solid var(--color-border)",
          animation: "staggerFadeIn 0.5s ease 0.3s both",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            color: "var(--color-dark)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Health Breakdown
        </div>
        <MetricBar
          label="Complexity"
          value={health.complexity}
          color="var(--color-info)"
        />
        <MetricBar
          label="Fragility"
          value={health.fragility}
          color="var(--color-accent)"
        />
        <MetricBar
          label="Automation Potential"
          value={health.automationPotential}
          color="var(--color-success)"
        />
        <MetricBar
          label="Team Load Balance"
          value={health.teamLoadBalance}
          color="var(--color-memory)"
        />

        {/* Interpretation line */}
        <div
          style={{
            marginTop: 16,
            padding: "12px 16px",
            background: "linear-gradient(135deg, rgba(232,85,58,0.04) 0%, rgba(45,125,210,0.03) 100%)",
            borderRadius: "var(--radius-sm)",
            borderLeft: "3px solid var(--color-accent)",
            animation: "staggerFadeIn 0.4s ease 0.5s both",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--color-accent)",
              letterSpacing: "0.06em",
              marginBottom: 4,
              textTransform: "uppercase",
            }}
          >
            Interpretation
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text)",
              lineHeight: 1.55,
              fontFamily: "var(--font-body)",
            }}
          >
            {generateInterpretation(health)}
          </div>
        </div>
      </div>
    </div>
  );
}

/** StatBox with animated count-up number */
function AnimatedStatBox({
  label,
  value,
  numericValue,
  delay = 0,
}: {
  label: string;
  value: string | number;
  numericValue?: number;
  delay?: number;
}) {
  const nv = numericValue ?? (typeof value === "number" ? value : undefined);
  const accentColor = nv !== undefined ? statBoxColor(label, nv) : "var(--color-dark)";
  const borderColor = nv !== undefined ? statBoxBorderColor(label, nv) : "var(--color-border)";
  const [displayVal, setDisplayVal] = useState<string | number>(typeof value === "number" ? 0 : value);
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    if (typeof value !== "number") {
      // For string values like "72%", animate the numeric part
      const match = String(value).match(/^(\d+)/);
      if (match) {
        const target = parseInt(match[1]);
        const suffix = String(value).replace(/^\d+/, "");
        const duration = 1000;
        const startTime = performance.now();

        const delayTimeout = setTimeout(() => {
          mountedRef.current = true;
          const animate = (now: number) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayVal(Math.round(eased * target) + suffix);
            if (progress < 1) {
              rafRef.current = requestAnimationFrame(animate);
            }
          };
          rafRef.current = requestAnimationFrame(animate);
        }, delay);

        return () => {
          clearTimeout(delayTimeout);
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
      }
      return;
    }

    const target = value;
    const duration = 1000;
    const startTime = performance.now();

    const delayTimeout = setTimeout(() => {
      mountedRef.current = true;
      const animate = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplayVal(Math.round(eased * target));
        if (progress < 1) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };
      rafRef.current = requestAnimationFrame(animate);
    }, delay);

    return () => {
      clearTimeout(delayTimeout);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, delay]);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        padding: 16,
        background: hovered
          ? "linear-gradient(135deg, var(--color-surface) 0%, rgba(232,85,58,0.02) 100%)"
          : "var(--color-surface)",
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${borderColor}`,
        textAlign: "center",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-3px)" : "translateY(0)",
        boxShadow: hovered
          ? "0 8px 24px rgba(0,0,0,0.06)"
          : "0 1px 3px rgba(0,0,0,0.02)",
        animation: `staggerFadeIn 0.4s ease ${delay}ms both`,
        cursor: "default",
      }}
    >
      <div
        style={{
          fontSize: 24,
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          color: accentColor,
          animation: "countUpFade 0.6s ease both",
          animationDelay: `${delay + 200}ms`,
        }}
      >
        {displayVal}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          fontWeight: 500,
          letterSpacing: "0.04em",
          marginTop: 4,
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
    </div>
  );
}
