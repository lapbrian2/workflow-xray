"use client";

import { useEffect, useState, useRef } from "react";

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
  size = 120,
}: ScoreRingProps) {
  const strokeWidth = 7;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (value / 100) * circumference;
  const [mounted, setMounted] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const rafRef = useRef<number | null>(null);

  // Determine if score is extreme (triggers pulse)
  const isExtreme = value >= 80 || value <= 20;

  // Hex to rgba helper for glow
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  };

  useEffect(() => {
    // Trigger the mount animation after a frame
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
  }, []);

  // Animate the number counting up
  useEffect(() => {
    if (!mounted) return;
    const duration = 1200;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayValue(Math.round(eased * value));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [mounted, value]);

  const glowColor = hexToRgba(color, 0.4);

  return (
    <div style={{ textAlign: "center", position: "relative" }}>
      <svg
        width={size}
        height={size}
        style={{
          transform: "rotate(-90deg)",
          filter: `drop-shadow(0 0 8px ${hexToRgba(color, 0.3)})`,
          animation: isExtreme
            ? `ringPulseExtreme 2.5s ease-in-out infinite`
            : `glowPulseSvg 3s ease-in-out infinite`,
          // @ts-expect-error CSS custom property
          "--glow-color": glowColor,
        }}
      >
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-border)"
          strokeWidth={strokeWidth}
          strokeOpacity={0.5}
        />
        {/* Glow underlay -- wider, faint stroke for ambient glow */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth + 6}
          strokeOpacity={0.08}
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? targetOffset : circumference}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
        {/* Main fill ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={mounted ? targetOffset : circumference}
          strokeLinecap="round"
          style={{
            transition: "stroke-dashoffset 1.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </svg>
      {/* Center number */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          fontFamily: "var(--font-mono)",
          fontSize: size >= 100 ? 22 : 18,
          fontWeight: 700,
          color: "var(--color-dark)",
          animation: mounted ? "countUpFade 0.8s ease both" : "none",
          animationDelay: "0.3s",
          lineHeight: 1,
        }}
      >
        {displayValue}
      </div>
      {/* Label */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          fontWeight: 600,
          color: "var(--color-muted)",
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          marginTop: 8,
        }}
      >
        {label}
      </div>
    </div>
  );
}
