"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { HealthTrendPoint } from "@/lib/chart-data";

interface HealthTrendChartProps {
  data: HealthTrendPoint[];
}

const METRIC_COLORS = {
  complexity: "#2D7DD2", // blue -- matches colorBlue in PDF
  fragility: "#E8553A", // red/orange -- matches accent
  automationPotential: "#17A589", // green -- matches colorGreen in PDF
  teamLoadBalance: "#8E44AD", // purple -- matches colorPurple in PDF
};

const METRIC_NAMES: Record<string, string> = {
  complexity: "Complexity",
  fragility: "Fragility",
  automationPotential: "Automation",
  teamLoadBalance: "Team Balance",
};

export default function HealthTrendChart({ data }: HealthTrendChartProps) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart
        data={data}
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
        <Legend
          wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="complexity"
          stroke={METRIC_COLORS.complexity}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name={METRIC_NAMES.complexity}
        />
        <Line
          type="monotone"
          dataKey="fragility"
          stroke={METRIC_COLORS.fragility}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name={METRIC_NAMES.fragility}
        />
        <Line
          type="monotone"
          dataKey="automationPotential"
          stroke={METRIC_COLORS.automationPotential}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name={METRIC_NAMES.automationPotential}
        />
        <Line
          type="monotone"
          dataKey="teamLoadBalance"
          stroke={METRIC_COLORS.teamLoadBalance}
          strokeWidth={2}
          dot={{ r: 3 }}
          activeDot={{ r: 5 }}
          name={METRIC_NAMES.teamLoadBalance}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
