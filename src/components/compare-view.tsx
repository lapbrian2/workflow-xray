"use client";

import type {
  CompareResult,
  Decomposition,
  Gap,
  Step,
} from "@/lib/types";
import { GAP_LABELS, SEVERITY_COLORS, LAYER_LABELS, LAYER_COLORS } from "@/lib/types";

interface CompareViewProps {
  result: CompareResult;
  before: Decomposition;
  after: Decomposition;
  onExportPdf?: () => void;
  exporting?: boolean;
}

export default function CompareView({ result, before, after, onExportPdf, exporting }: CompareViewProps) {
  const { added, removed, modified, healthDelta } = result;

  // ── Compute gap diffs from before/after decompositions ──
  const beforeGapKeys = before.gaps.map(gapKey);
  const afterGapKeys = after.gaps.map(gapKey);
  const gapsResolved = before.gaps.filter((g) => !afterGapKeys.includes(gapKey(g)));
  const gapsNew = after.gaps.filter((g) => !beforeGapKeys.includes(gapKey(g)));
  const gapsPersistent = after.gaps.filter((g) => beforeGapKeys.includes(gapKey(g)));

  // ── Compute unchanged steps ──
  const modifiedIds = new Set(modified.map((m) => m.step.id));
  const addedIds = new Set(added.map((s) => s.id));
  const unchangedSteps = after.steps.filter(
    (s) => !addedIds.has(s.id) && !modifiedIds.has(s.id)
  );

  // ── Build summary parts ──
  const summaryParts: string[] = [];
  if (gapsResolved.length > 0) {
    summaryParts.push(
      `${gapsResolved.length} gap${gapsResolved.length !== 1 ? "s" : ""} resolved`
    );
  }
  if (gapsNew.length > 0) {
    summaryParts.push(
      `${gapsNew.length} new gap${gapsNew.length !== 1 ? "s" : ""} introduced`
    );
  }
  if (healthDelta.automationPotential !== 0) {
    summaryParts.push(
      `automation ${healthDelta.automationPotential > 0 ? "improved" : "decreased"} by ${Math.abs(healthDelta.automationPotential)}%`
    );
  }
  if (healthDelta.fragility !== 0) {
    summaryParts.push(
      `fragility ${healthDelta.fragility < 0 ? "reduced" : "increased"} by ${Math.abs(healthDelta.fragility)} points`
    );
  }

  // ── Find before-step for modified steps ──
  const beforeStepMap = new Map(before.steps.map((s) => [s.id, s]));

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* ── Summary Card ── */}
      <div
        style={{
          padding: 20,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 12,
          }}
        >
          Comparison Summary
        </div>
        {onExportPdf && (
          <button
            onClick={onExportPdf}
            disabled={exporting}
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              background: "var(--color-accent)",
              border: "none",
              padding: "6px 14px",
              borderRadius: 4,
              cursor: exporting ? "wait" : "pointer",
              opacity: exporting ? 0.7 : 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 12,
            }}
          >
            {exporting ? "Exporting..." : "Download Compare PDF"}
          </button>
        )}
        {summaryParts.length > 0 ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {summaryParts.map((part, i) => {
              const isGood =
                part.includes("resolved") ||
                part.includes("improved") ||
                part.includes("reduced");
              return (
                <span
                  key={i}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    fontWeight: 600,
                    padding: "6px 14px",
                    borderRadius: "var(--radius-sm)",
                    background: isGood ? "#E9F7EF" : "#FDF0EE",
                    color: isGood ? "#17A589" : "#E8553A",
                  }}
                >
                  {part}
                </span>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 14,
              color: "var(--color-muted)",
            }}
          >
            No significant changes detected.
          </div>
        )}

        {/* Before / After titles */}
        <div
          style={{
            display: "flex",
            gap: 16,
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--color-border)",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              Before
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--color-dark)",
              }}
            >
              {before.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-muted)",
                marginTop: 2,
              }}
            >
              {before.steps.length} steps &middot; {before.gaps.length} gaps
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              fontSize: 18,
              color: "var(--color-muted)",
            }}
          >
            &rarr;
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 9,
                color: "var(--color-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                marginBottom: 4,
              }}
            >
              After
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 15,
                fontWeight: 700,
                color: "var(--color-dark)",
              }}
            >
              {after.title}
            </div>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--color-muted)",
                marginTop: 2,
              }}
            >
              {after.steps.length} steps &middot; {after.gaps.length} gaps
            </div>
          </div>
        </div>
      </div>

      {/* ── Health Delta Section ── */}
      <div
        style={{
          padding: 20,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          Health Scores
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          <HealthMetricDelta
            label="Complexity"
            beforeVal={before.health.complexity}
            afterVal={after.health.complexity}
            delta={healthDelta.complexity}
            color="#2D7DD2"
            lowerIsBetter
          />
          <HealthMetricDelta
            label="Fragility"
            beforeVal={before.health.fragility}
            afterVal={after.health.fragility}
            delta={healthDelta.fragility}
            color="#E8553A"
            lowerIsBetter
          />
          <HealthMetricDelta
            label="Automation"
            beforeVal={before.health.automationPotential}
            afterVal={after.health.automationPotential}
            delta={healthDelta.automationPotential}
            color="#17A589"
            lowerIsBetter={false}
          />
          <HealthMetricDelta
            label="Team Balance"
            beforeVal={before.health.teamLoadBalance}
            afterVal={after.health.teamLoadBalance}
            delta={healthDelta.teamLoadBalance}
            color="#8E44AD"
            lowerIsBetter={false}
          />
        </div>
      </div>

      {/* ── Steps Diff Section ── */}
      <div
        style={{
          padding: 20,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Steps
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
            marginBottom: 16,
            display: "flex",
            gap: 12,
          }}
        >
          <span style={{ color: "#17A589" }}>+{added.length} added</span>
          <span style={{ color: "#E8553A" }}>&minus;{removed.length} removed</span>
          <span style={{ color: "#D4A017" }}>~{modified.length} modified</span>
          <span>{unchangedSteps.length} unchanged</span>
        </div>

        {added.map((s) => (
          <StepDiffCard key={`added-${s.id}`} step={s} type="added" />
        ))}
        {removed.map((s) => (
          <StepDiffCard key={`removed-${s.id}`} step={s} type="removed" />
        ))}
        {modified.map((m) => (
          <StepDiffCard
            key={`modified-${m.step.id}`}
            step={m.step}
            type="modified"
            changes={m.changes}
            beforeStep={beforeStepMap.get(m.step.id)}
          />
        ))}
        {unchangedSteps.map((s) => (
          <StepDiffCard key={`unchanged-${s.id}`} step={s} type="unchanged" />
        ))}
      </div>

      {/* ── Gaps Diff Section ── */}
      <div
        style={{
          padding: 20,
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          borderRadius: "var(--radius-lg)",
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-muted)",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}
        >
          Gap Analysis
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
            marginBottom: 16,
            display: "flex",
            gap: 12,
          }}
        >
          <span style={{ color: "#17A589" }}>
            {gapsResolved.length} resolved
          </span>
          <span style={{ color: "#E8553A" }}>
            {gapsNew.length} new
          </span>
          <span>{gapsPersistent.length} persistent</span>
        </div>

        {gapsResolved.map((g, i) => (
          <GapDiffCard key={`resolved-${i}`} gap={g} type="resolved" />
        ))}
        {gapsNew.map((g, i) => (
          <GapDiffCard key={`new-${i}`} gap={g} type="new" />
        ))}
        {gapsPersistent.map((g, i) => (
          <GapDiffCard key={`persist-${i}`} gap={g} type="persistent" />
        ))}

        {gapsResolved.length === 0 &&
          gapsNew.length === 0 &&
          gapsPersistent.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: 32,
                color: "var(--color-muted)",
                fontFamily: "var(--font-body)",
                fontSize: 13,
              }}
            >
              No gaps in either workflow.
            </div>
          )}
      </div>
    </div>
  );
}

// ── Helpers ──

function gapKey(g: Gap): string {
  return `${g.type}::${g.description}`;
}

// ── Sub-components ──

function HealthMetricDelta({
  label,
  beforeVal,
  afterVal,
  delta,
  color,
  lowerIsBetter,
}: {
  label: string;
  beforeVal: number;
  afterVal: number;
  delta: number;
  color: string;
  lowerIsBetter: boolean;
}) {
  const isImprovement = lowerIsBetter ? delta < 0 : delta > 0;
  const badgeColor =
    delta === 0
      ? "var(--color-muted)"
      : isImprovement
        ? "#17A589"
        : "#E8553A";
  const badgeBg =
    delta === 0
      ? "var(--color-border)"
      : isImprovement
        ? "#E9F7EF"
        : "#FDF0EE";
  const arrow = delta === 0 ? "" : delta > 0 ? "\u2191" : "\u2193";

  return (
    <div
      style={{
        textAlign: "center",
        padding: 12,
        borderRadius: "var(--radius-sm)",
        background: "#F7F8FA",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--color-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            color: "var(--color-muted)",
          }}
        >
          {beforeVal}
        </span>
        <span style={{ color: "var(--color-muted)", fontSize: 12 }}>&rarr;</span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 18,
            fontWeight: 700,
            color: color,
          }}
        >
          {afterVal}
        </span>
      </div>
      {delta !== 0 ? (
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 700,
            padding: "3px 10px",
            borderRadius: 4,
            background: badgeBg,
            color: badgeColor,
          }}
        >
          {arrow} {delta > 0 ? "+" : ""}
          {delta}
        </span>
      ) : (
        <span
          style={{
            display: "inline-block",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            padding: "3px 10px",
            borderRadius: 4,
            background: badgeBg,
            color: badgeColor,
          }}
        >
          No change
        </span>
      )}
    </div>
  );
}

function StepDiffCard({
  step,
  type,
  changes,
  beforeStep,
}: {
  step: Step;
  type: "added" | "removed" | "modified" | "unchanged";
  changes?: string[];
  beforeStep?: Step;
}) {
  const config = {
    added: {
      border: "#17A589",
      bg: "#17A58908",
      label: "ADDED",
      labelColor: "#17A589",
    },
    removed: {
      border: "#E8553A",
      bg: "#E8553A08",
      label: "REMOVED",
      labelColor: "#E8553A",
    },
    modified: {
      border: "#D4A017",
      bg: "#D4A01708",
      label: "MODIFIED",
      labelColor: "#D4A017",
    },
    unchanged: {
      border: "var(--color-border)",
      bg: "transparent",
      label: "",
      labelColor: "",
    },
  };
  const c = config[type];
  const layerColor = LAYER_COLORS[step.layer];

  return (
    <div
      style={{
        padding: 12,
        borderLeft: `3px solid ${c.border}`,
        background: c.bg,
        borderRadius: "var(--radius-sm)",
        marginBottom: 8,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 700,
              color:
                type === "removed" ? "var(--color-muted)" : "var(--color-dark)",
              textDecoration: type === "removed" ? "line-through" : "none",
            }}
          >
            {step.name}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 600,
              color: layerColor,
              padding: "1px 6px",
              borderRadius: 3,
              background: `${layerColor}15`,
              letterSpacing: "0.04em",
            }}
          >
            {LAYER_LABELS[step.layer]}
          </span>
        </div>
        {c.label && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              color: c.labelColor,
              background: `${c.labelColor}15`,
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: "0.06em",
            }}
          >
            {c.label}
          </span>
        )}
      </div>

      {type === "modified" && changes && beforeStep && (
        <div style={{ marginTop: 8 }}>
          {changes.map((change) => {
            const bVal =
              change === "automationScore"
                ? `${beforeStep.automationScore}%`
                : change === "tools"
                  ? beforeStep.tools.join(", ")
                  : String(
                      (beforeStep as unknown as Record<string, unknown>)[change] ?? "\u2014"
                    );

            const aVal =
              change === "automationScore"
                ? `${step.automationScore}%`
                : change === "tools"
                  ? step.tools.join(", ")
                  : String(
                      (step as unknown as Record<string, unknown>)[change] ?? "\u2014"
                    );

            return (
              <div
                key={change}
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--color-text)",
                  marginBottom: 4,
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    color: "#D4A017",
                    fontWeight: 600,
                    minWidth: 100,
                  }}
                >
                  {change}:
                </span>
                <span
                  style={{
                    color: "var(--color-muted)",
                    textDecoration: "line-through",
                  }}
                >
                  {bVal}
                </span>
                <span style={{ color: "var(--color-muted)" }}>&rarr;</span>
                <span style={{ color: "var(--color-dark)" }}>{aVal}</span>
              </div>
            );
          })}
        </div>
      )}

      {type === "modified" && changes && !beforeStep && (
        <div
          style={{
            marginTop: 8,
            padding: "6px 10px",
            borderRadius: 4,
            background: "rgba(212, 160, 23, 0.08)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 600,
              color: "#D4A017",
            }}
          >
            Changed:{" "}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-text)",
            }}
          >
            {changes.join(", ")}
          </span>
        </div>
      )}

      {step.owner && type !== "modified" && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-muted)",
            marginTop: 4,
          }}
        >
          Owner: {step.owner} &middot; Auto: {step.automationScore}%
        </div>
      )}
    </div>
  );
}

function GapDiffCard({
  gap,
  type,
}: {
  gap: Gap;
  type: "resolved" | "new" | "persistent";
}) {
  const sevColor = SEVERITY_COLORS[gap.severity];
  const isResolved = type === "resolved";
  const isNew = type === "new";

  return (
    <div
      style={{
        padding: 12,
        borderLeft: `3px solid ${isResolved ? "#17A589" : isNew ? "#E8553A" : "var(--color-border)"}`,
        background: isResolved
          ? "#17A58908"
          : isNew
            ? "#E8553A08"
            : "transparent",
        borderRadius: "var(--radius-sm)",
        marginBottom: 8,
        opacity: isResolved ? 0.7 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: sevColor,
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              fontWeight: 700,
              color: isResolved ? "var(--color-muted)" : "var(--color-dark)",
              textDecoration: isResolved ? "line-through" : "none",
            }}
          >
            {GAP_LABELS[gap.type] || gap.type}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 600,
              color: sevColor,
              background: `${sevColor}15`,
              padding: "1px 6px",
              borderRadius: 3,
              textTransform: "uppercase",
            }}
          >
            {gap.severity}
          </span>
        </div>
        {(isResolved || isNew) && (
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              color: isResolved ? "#17A589" : "#E8553A",
              background: isResolved ? "#17A58915" : "#E8553A15",
              padding: "2px 8px",
              borderRadius: 4,
              letterSpacing: "0.06em",
            }}
          >
            {isResolved ? "RESOLVED" : "NEW"}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 12,
          color: isResolved ? "var(--color-muted)" : "var(--color-text)",
          textDecoration: isResolved ? "line-through" : "none",
          lineHeight: 1.5,
          marginTop: 4,
        }}
      >
        {gap.description}
      </div>
    </div>
  );
}
