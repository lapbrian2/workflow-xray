"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { BatchTrendData } from "@/lib/analytics";

interface BatchTrendsChartProps {
  data: BatchTrendData;
}

export default function BatchTrendsChart({ data }: BatchTrendsChartProps) {
  const improvementSign = data.averageHealthImprovement > 0 ? "+" : "";
  const improvementColor =
    data.averageHealthImprovement > 0
      ? "var(--color-success)"
      : data.averageHealthImprovement < 0
        ? "var(--color-accent)"
        : "var(--color-muted)";

  return (
    <div>
      {/* ── Summary stat cards ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {/* Versioned Workflows */}
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
            {data.versionedWorkflowCount}{" "}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--color-muted)",
              }}
            >
              / {data.totalWorkflows}
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
            Versioned Workflows
          </div>
        </div>

        {/* Avg Health Improvement */}
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
              color: improvementColor,
              marginBottom: 4,
            }}
          >
            {improvementSign}
            {data.averageHealthImprovement}{" "}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--color-muted)",
              }}
            >
              pts
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
            Avg Health Improvement
          </div>
        </div>

        {/* Total Analyzed */}
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
            {data.totalWorkflows}{" "}
            <span
              style={{
                fontSize: 12,
                fontWeight: 400,
                color: "var(--color-muted)",
              }}
            >
              workflows
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
            Total Analyzed
          </div>
        </div>
      </div>

      {/* ── Weekly bar chart ── */}
      {data.weeklyTrends.length >= 2 ? (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={data.weeklyTrends}
            margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis
              dataKey="label"
              tick={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              stroke="var(--color-muted)"
            />
            <YAxis
              domain={[0, 100]}
              tick={{
                fontSize: 10,
                fontFamily: "var(--font-mono)",
              }}
              stroke="var(--color-muted)"
            />
            <Tooltip
              contentStyle={{
                background: "var(--color-surface)",
                border: "1px solid var(--color-border)",
                borderRadius: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
              }}
            />
            <Bar
              dataKey="avgOverallHealth"
              fill="#2D7DD2"
              radius={[4, 4, 0, 0]}
              name="Avg Overall Health"
            />
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px 16px",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--color-muted)",
            textAlign: "center",
          }}
        >
          Analyze more workflows over time to see batch trends
        </div>
      )}
    </div>
  );
}
