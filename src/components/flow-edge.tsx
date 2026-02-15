"use client";

import { useState } from "react";
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

const CRITICAL_COLOR = "#DC143C";

export default function FlowEdge(props: EdgeProps) {
  const edgeData = props.data as Record<string, unknown> | undefined;
  const isCriticalPath = !!edgeData?.isCriticalPath;
  const isDimmed = !!edgeData?.dimmed;
  const [hovered, setHovered] = useState(false);

  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 16,
  });

  const edgeStyle = props.style || {};
  const stroke = isCriticalPath
    ? CRITICAL_COLOR
    : (edgeStyle.stroke as string) || "#C5D0DC";
  const strokeWidth = isCriticalPath ? 2.5 : hovered ? 2.5 : 1.5;

  const markerId = `arrow-${props.id}`;
  const midX = (props.sourceX + props.targetX) / 2;
  const midY = (props.sourceY + props.targetY) / 2;

  return (
    <>
      {/* Arrow marker definition */}
      <defs>
        <marker
          id={markerId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="5"
          markerHeight="5"
          orient="auto-start-reverse"
        >
          <path
            d="M 0 0 L 10 5 L 0 10 z"
            fill={isCriticalPath ? CRITICAL_COLOR : (hovered ? stroke : stroke)}
          />
        </marker>
      </defs>

      {/* Invisible hit area for hover targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ cursor: "pointer" }}
      />

      {/* Glow layer for critical path edges */}
      {isCriticalPath && (
        <BaseEdge
          id={`${props.id}-glow`}
          path={edgePath}
          style={{
            stroke: CRITICAL_COLOR,
            strokeWidth: 8,
            strokeOpacity: 0.12,
            filter: "blur(3px)",
          }}
        />
      )}

      {/* Main edge */}
      <BaseEdge
        id={props.id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth,
          opacity: isDimmed ? 0.15 : hovered ? 1 : undefined,
          transition: "opacity 0.2s ease, stroke-width 0.15s ease",
          markerEnd: `url(#${markerId})`,
        }}
      />

      {/* Hover label */}
      {hovered && !isDimmed && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${midX}px,${midY}px)`,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
              background: "var(--color-surface, #fff)",
              border: "1px solid var(--color-border)",
              padding: "2px 6px",
              borderRadius: 4,
              pointerEvents: "none",
              whiteSpace: "nowrap",
              color: "var(--color-muted)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            dependency
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
