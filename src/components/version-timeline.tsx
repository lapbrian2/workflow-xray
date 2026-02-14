"use client";

import { useState } from "react";
import type { Workflow } from "@/lib/types";

interface VersionTimelineProps {
  versions: Workflow[];
  currentId: string;
  onSelectVersion: (id: string) => void;
}

function formatShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function VersionTimeline({
  versions,
  currentId,
  onSelectVersion,
}: VersionTimelineProps) {
  if (versions.length <= 1) return null;

  const sorted = [...versions].sort(
    (a, b) => (a.version ?? 1) - (b.version ?? 1)
  );

  return (
    <div
      role="tablist"
      aria-label="Version timeline"
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        padding: "12px 16px 16px",
        marginBottom: 16,
        overflowX: "auto",
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-lg)",
        position: "relative",
      }}
    >
      {/* Subtle label */}
      <span
        style={{
          position: "absolute",
          top: 6,
          right: 12,
          fontFamily: "var(--font-mono)",
          fontSize: 8,
          color: "var(--color-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          opacity: 0.6,
        }}
      >
        versions
      </span>

      {sorted.map((v, i) => {
        const isActive = v.id === currentId;
        const isLast = i === sorted.length - 1;

        return (
          <div
            key={v.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              flexShrink: 0,
            }}
          >
            <VersionDot
              version={v}
              isActive={isActive}
              isLatest={isLast}
              onSelect={() => onSelectVersion(v.id)}
            />

            {/* Connecting line */}
            {!isLast && (
              <div
                style={{
                  height: 2,
                  width: 32,
                  background: `linear-gradient(90deg, ${
                    isActive ? "var(--color-accent)" : "var(--color-border)"
                  }, var(--color-border))`,
                  marginTop: 13,
                  flexShrink: 0,
                  transition: "background 0.3s ease",
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function VersionDot({
  version: v,
  isActive,
  isLatest,
  onSelect,
}: {
  version: Workflow;
  isActive: boolean;
  isLatest: boolean;
  onSelect: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      role="tab"
      aria-selected={isActive}
      aria-label={`Version ${v.version ?? 1}, created ${formatShortDate(v.createdAt)}`}
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        cursor: "pointer",
        position: "relative",
        minWidth: 56,
        padding: "6px 8px 4px",
        borderRadius: "var(--radius-sm)",
        background: isActive
          ? "rgba(232, 85, 58, 0.06)"
          : hovered
          ? "rgba(0, 0, 0, 0.02)"
          : "transparent",
        border: "none",
        transition: "all 0.2s ease",
        transform: hovered && !isActive ? "translateY(-1px)" : "none",
      }}
    >
      {/* Dot */}
      <div
        style={{
          width: isActive ? 16 : hovered ? 14 : 12,
          height: isActive ? 16 : hovered ? 14 : 12,
          borderRadius: "50%",
          background: isActive
            ? "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)"
            : hovered
            ? "var(--color-muted)"
            : "transparent",
          border: isActive
            ? "none"
            : `2px solid ${hovered ? "var(--color-muted)" : "var(--color-border)"}`,
          transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
          flexShrink: 0,
          boxShadow: isActive
            ? "0 0 0 4px rgba(232, 85, 58, 0.12), 0 2px 8px rgba(232, 85, 58, 0.2)"
            : hovered
            ? "0 0 0 3px rgba(0, 0, 0, 0.04)"
            : "none",
        }}
      />

      {/* Version label */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: isActive ? 12 : 11,
          fontWeight: isActive ? 700 : hovered ? 600 : 500,
          color: isActive
            ? "var(--color-accent)"
            : hovered
            ? "var(--color-dark)"
            : "var(--color-text)",
          marginTop: 6,
          transition: "all 0.2s ease",
          lineHeight: 1,
        }}
      >
        v{v.version ?? 1}
      </span>

      {/* Date label */}
      <span
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 9,
          color: "var(--color-muted)",
          marginTop: 2,
          whiteSpace: "nowrap",
          lineHeight: 1,
        }}
      >
        {formatShortDate(v.createdAt)}
      </span>

      {/* "Latest" badge on the last version */}
      {isLatest && (
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 7,
            fontWeight: 700,
            color: "var(--color-success)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginTop: 3,
            lineHeight: 1,
          }}
        >
          latest
        </span>
      )}
    </button>
  );
}
