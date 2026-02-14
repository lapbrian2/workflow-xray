"use client";

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

const CRITICAL_COLOR = "#DC143C";

export default function FlowEdge(props: EdgeProps) {
  const isCriticalPath = !!(props.data as Record<string, unknown>)?.isCriticalPath;

  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 12,
  });

  const edgeStyle = props.style || {};
  const stroke = isCriticalPath
    ? CRITICAL_COLOR
    : edgeStyle.stroke || "#C5D0DC";
  const strokeWidth = isCriticalPath ? 3 : 2;

  return (
    <>
      {/* Glow layer for critical path edges */}
      {isCriticalPath && (
        <BaseEdge
          id={`${props.id}-glow`}
          path={edgePath}
          style={{
            stroke: CRITICAL_COLOR,
            strokeWidth: 8,
            strokeOpacity: 0.15,
            filter: "blur(2px)",
          }}
        />
      )}
      <BaseEdge
        id={props.id}
        path={edgePath}
        style={{
          stroke,
          strokeWidth,
        }}
      />
    </>
  );
}
