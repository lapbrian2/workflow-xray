"use client";

interface MetricBarProps {
  label: string;
  value: number;
  color: string;
}

export default function MetricBar({ label, value, color }: MetricBarProps) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 4,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-text)",
            fontWeight: 500,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color,
            fontWeight: 700,
          }}
        >
          {value}%
        </span>
      </div>
      <div
        style={{
          height: 6,
          borderRadius: 3,
          background: "var(--color-border)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${value}%`,
            height: "100%",
            borderRadius: 3,
            background: color,
            transition: "width 0.8s ease",
          }}
        />
      </div>
    </div>
  );
}
