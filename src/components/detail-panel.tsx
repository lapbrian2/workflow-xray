"use client";

import { useEffect, useCallback } from "react";
import type { Step } from "@/lib/types";
import { LAYER_COLORS, LAYER_LABELS } from "@/lib/types";

interface DetailPanelProps {
  step: Step | null;
  onClose: () => void;
}

export default function DetailPanel({ step, onClose }: DetailPanelProps) {
  // Keyboard dismiss with Escape
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (step) {
      document.addEventListener("keydown", handleKeyDown);
      return () => document.removeEventListener("keydown", handleKeyDown);
    }
  }, [step, handleKeyDown]);

  if (!step) return null;

  const color = LAYER_COLORS[step.layer];

  return (
    <div
      role="complementary"
      aria-label={`Details for ${step.name}`}
      style={{
        position: "absolute",
        right: 0,
        top: 0,
        bottom: 0,
        width: "clamp(280px, 85vw, 336px)",
        background: "var(--color-surface)",
        borderLeft: "1px solid var(--color-border)",
        padding: 24,
        overflowY: "auto",
        animation: "slideIn 0.2s ease",
        zIndex: 10,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              color,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
            }}
          >
            {LAYER_LABELS[step.layer]}
          </span>
          <h3
            style={{
              fontSize: 18,
              fontWeight: 700,
              fontFamily: "var(--font-display)",
              color: "var(--color-dark)",
              marginTop: 4,
            }}
          >
            {step.name}
          </h3>
        </div>
        <button
          onClick={onClose}
          aria-label="Close detail panel"
          style={{
            background: "none",
            border: "none",
            fontSize: 20,
            color: "var(--color-muted)",
            cursor: "pointer",
            padding: "4px 8px",
          }}
        >
          &times;
        </button>
      </div>

      <p
        style={{
          fontSize: 14,
          color: "var(--color-text)",
          lineHeight: 1.6,
          marginBottom: 16,
        }}
      >
        {step.description}
      </p>

      {/* Automation score */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "var(--radius-sm)",
          background: `${color}08`,
          borderLeft: `3px solid ${color}`,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.06em",
            marginBottom: 8,
          }}
        >
          AUTOMATION SCORE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div
            style={{
              flex: 1,
              height: 6,
              borderRadius: 3,
              background: "var(--color-border)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${step.automationScore}%`,
                height: "100%",
                background: color,
                borderRadius: 3,
                transition: "width 0.5s ease",
              }}
            />
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 14,
              fontWeight: 700,
              color,
            }}
          >
            {step.automationScore}%
          </span>
        </div>
      </div>

      {/* Owner */}
      {step.owner && (
        <Section title="OWNER">
          <span style={{ fontSize: 13, color: "var(--color-dark)" }}>
            {step.owner}
          </span>
        </Section>
      )}

      {/* Tools */}
      {step.tools.length > 0 && (
        <Section title="TOOLS">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {step.tools.map((t) => (
              <span
                key={t}
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  padding: "3px 8px",
                  borderRadius: 4,
                  background: `${color}12`,
                  color,
                  fontWeight: 500,
                }}
              >
                {t}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* Inputs */}
      <Section title="INPUTS">
        <ul style={{ paddingLeft: 16, fontSize: 13, color: "var(--color-text)" }}>
          {step.inputs.map((inp, i) => (
            <li key={i} style={{ marginBottom: 2, lineHeight: 1.5 }}>
              {inp}
            </li>
          ))}
        </ul>
      </Section>

      {/* Outputs */}
      <Section title="OUTPUTS">
        <ul style={{ paddingLeft: 16, fontSize: 13, color: "var(--color-text)" }}>
          {step.outputs.map((out, i) => (
            <li key={i} style={{ marginBottom: 2, lineHeight: 1.5 }}>
              {out}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 700,
          color: "var(--color-muted)",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
