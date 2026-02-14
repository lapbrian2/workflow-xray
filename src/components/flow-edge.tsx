"use client";

import { BaseEdge, getSmoothStepPath, type EdgeProps } from "@xyflow/react";

export default function FlowEdge(props: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
    sourcePosition: props.sourcePosition,
    targetPosition: props.targetPosition,
    borderRadius: 12,
  });

  return (
    <BaseEdge
      id={props.id}
      path={edgePath}
      style={{
        stroke: "#C5D0DC",
        strokeWidth: 2,
      }}
    />
  );
}
