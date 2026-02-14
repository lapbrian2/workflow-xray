"use client";

interface ScoreRingProps {
  value: number;
  label: string;
  color: string;
  size?: number;
}

export default function ScoreRing({
  value,
  label,
  color,
  size = 100,
}: ScoreRingProps) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <div
        style={{
          marginTop: -size / 2 - 12,
          marginBottom: size / 2 - 12,
          fontFamily: "var(--font-mono)",
          fontSize: 20,
          fontWeight: 700,
          color: "var(--color-dark)",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginTop: 4,
        }}
      >
        {label}
      </div>
    </div>
  );
}
