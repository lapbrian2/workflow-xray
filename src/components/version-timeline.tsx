"use client";

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
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 0,
        padding: "16px 0 20px",
        marginBottom: 16,
        overflowX: "auto",
      }}
    >
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
            {/* Dot + labels column */}
            <div
              onClick={() => onSelectVersion(v.id)}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                cursor: "pointer",
                position: "relative",
                minWidth: 48,
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: isActive ? 14 : 12,
                  height: isActive ? 14 : 12,
                  borderRadius: "50%",
                  background: isActive ? "#E8553A" : "transparent",
                  border: isActive
                    ? "2px solid #E8553A"
                    : "2px solid var(--color-border)",
                  transition: "all 0.2s",
                  flexShrink: 0,
                  boxShadow: isActive
                    ? "0 0 0 3px rgba(232, 85, 58, 0.15)"
                    : "none",
                }}
              />
              {/* Version label */}
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? "#E8553A" : "var(--color-dark)",
                  marginTop: 6,
                  transition: "color 0.2s",
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
                }}
              >
                {formatShortDate(v.createdAt)}
              </span>
            </div>

            {/* Connecting line */}
            {!isLast && (
              <div
                style={{
                  height: 2,
                  width: 32,
                  background: "var(--color-border)",
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
