"use client";

import type { CostAnalyticsData } from "@/lib/analytics";

interface CostBreakdownProps {
  data: CostAnalyticsData;
}

export default function CostBreakdown({ data }: CostBreakdownProps) {
  if (data.totalAnalyses === 0) {
    return (
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 13,
          color: "var(--color-muted)",
          padding: "32px 16px",
          textAlign: "center",
        }}
      >
        No analyses yet -- decompose some workflows to see cost analytics
      </div>
    );
  }

  const cachePercent =
    data.totalAnalyses > 0
      ? Math.round((data.cacheHits / data.totalAnalyses) * 100)
      : 0;

  const totalTokens = data.totalInputTokens + data.totalOutputTokens;
  const inputPct = totalTokens > 0 ? (data.totalInputTokens / totalTokens) * 100 : 50;
  const outputPct = totalTokens > 0 ? (data.totalOutputTokens / totalTokens) * 100 : 50;

  return (
    <div>
      {/* Row 1: 4 stat boxes */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Total Analyses */}
        <div
          style={{
            padding: 16,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--color-dark)",
              marginBottom: 4,
            }}
          >
            {data.totalAnalyses}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Total Analyses
          </div>
        </div>

        {/* Cache Hits */}
        <div
          style={{
            padding: 16,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              fontWeight: 700,
              color: data.cacheHits > 0 ? "#17A589" : "var(--color-dark)",
              marginBottom: 4,
            }}
          >
            {data.cacheHits}{" "}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: data.cacheHits > 0 ? "#17A589" : "var(--color-muted)",
              }}
            >
              ({cachePercent}%)
            </span>
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Cache Hits
          </div>
        </div>

        {/* API Cost */}
        <div
          style={{
            padding: 16,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--color-dark)",
              marginBottom: 4,
            }}
          >
            ${data.totalCost.toFixed(2)}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              color: "var(--color-muted)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            API Cost
          </div>
        </div>

        {/* Cache Savings */}
        <div
          style={{
            padding: 16,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-sm)",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 20,
              fontWeight: 700,
              color: "#17A589",
              marginBottom: 4,
            }}
          >
            ~${data.estimatedSavings.toFixed(2)}
          </div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              fontWeight: 700,
              color: "#17A589",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Cache Savings
          </div>
        </div>
      </div>

      {/* Row 2: Token usage bar */}
      <div>
        {/* Labels */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              color: "#2D7DD2",
            }}
          >
            Input: {data.totalInputTokens.toLocaleString()} tokens
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              fontWeight: 600,
              color: "#8E44AD",
            }}
          >
            Output: {data.totalOutputTokens.toLocaleString()} tokens
          </span>
        </div>

        {/* Stacked bar */}
        <div
          style={{
            display: "flex",
            height: 24,
            borderRadius: 6,
            overflow: "hidden",
            gap: 2,
          }}
        >
          <div
            style={{
              width: `${inputPct}%`,
              height: "100%",
              background: "#2D7DD2",
              borderRadius: inputPct === 100 ? 6 : "6px 0 0 6px",
              transition: "width 0.5s ease",
            }}
          />
          <div
            style={{
              width: `${outputPct}%`,
              height: "100%",
              background: "#8E44AD",
              borderRadius: outputPct === 100 ? 6 : "0 6px 6px 0",
              transition: "width 0.5s ease",
            }}
          />
        </div>

        {/* Avg cost */}
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            color: "var(--color-muted)",
            marginTop: 8,
            textAlign: "center",
          }}
        >
          Avg cost per analysis: ${data.costPerAnalysis.toFixed(4)}
        </div>
      </div>
    </div>
  );
}
