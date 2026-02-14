"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Decomposition } from "@/lib/types";
import { LAYER_COLORS } from "@/lib/types";
import { useStore } from "@/lib/store";
import FlowNode from "./flow-node";
import FlowEdge from "./flow-edge";
import DetailPanel from "./detail-panel";
import LayerLegend from "./layer-legend";

const nodeTypes = { custom: FlowNode };
const edgeTypes = { custom: FlowEdge };

interface XRayVizProps {
  decomposition: Decomposition;
}

export default function XRayViz({ decomposition }: XRayVizProps) {
  const { selectedNodeId, setSelectedNodeId } = useStore();

  /* ── Empty State ── */
  if (!decomposition.steps || decomposition.steps.length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          color: "var(--color-muted)",
          fontFamily: "var(--font-body)",
          padding: 48,
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "var(--color-border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 16,
            fontSize: 20,
          }}
        >
          &#x25C7;
        </div>
        <div
          style={{
            fontSize: 15,
            color: "var(--color-text)",
            marginBottom: 4,
          }}
        >
          No steps to visualize
        </div>
        <div style={{ fontSize: 13 }}>
          The decomposition produced no workflow steps.
        </div>
      </div>
    );
  }

  const handleNodeClick = useCallback(
    (id: string) => {
      setSelectedNodeId(selectedNodeId === id ? null : id);
    },
    [selectedNodeId, setSelectedNodeId]
  );

  const { nodes, edges } = useMemo(() => {
    const steps = decomposition.steps;

    // Layout: arrange nodes in a top-down flow
    // Group by dependency depth for vertical positioning
    const depthMap = new Map<string, number>();

    function getDepth(stepId: string, visited = new Set<string>()): number {
      if (depthMap.has(stepId)) return depthMap.get(stepId)!;
      if (visited.has(stepId)) {
        depthMap.set(stepId, 0);
        return 0;
      }
      visited.add(stepId);

      const step = steps.find((s) => s.id === stepId);
      if (!step || step.dependencies.length === 0) {
        depthMap.set(stepId, 0);
        return 0;
      }

      const maxParentDepth = Math.max(
        ...step.dependencies.map((d) => getDepth(d, visited))
      );
      const depth = maxParentDepth + 1;
      depthMap.set(stepId, depth);
      return depth;
    }

    steps.forEach((s) => getDepth(s.id));

    // Group steps by depth
    const depthGroups = new Map<number, typeof steps>();
    steps.forEach((s) => {
      const d = depthMap.get(s.id) || 0;
      if (!depthGroups.has(d)) depthGroups.set(d, []);
      depthGroups.get(d)!.push(s);
    });

    const nodes: Node[] = [];
    const xSpacing = 280;
    const ySpacing = 160;

    depthGroups.forEach((groupSteps, depth) => {
      const totalWidth = groupSteps.length * xSpacing;
      const startX = -totalWidth / 2 + xSpacing / 2;

      groupSteps.forEach((step, i) => {
        nodes.push({
          id: step.id,
          type: "custom",
          position: { x: startX + i * xSpacing, y: depth * ySpacing },
          data: {
            step,
            selected: selectedNodeId === step.id,
            onClick: handleNodeClick,
          },
        });
      });
    });

    const edges: Edge[] = [];
    steps.forEach((step) => {
      step.dependencies.forEach((depId) => {
        edges.push({
          id: `${depId}-${step.id}`,
          source: depId,
          target: step.id,
          type: "custom",
          style: {
            stroke: LAYER_COLORS[step.layer] + "60",
          },
        });
      });
    });

    return { nodes, edges };
  }, [decomposition.steps, selectedNodeId, handleNodeClick]);

  const selectedStep = decomposition.steps.find(
    (s) => s.id === selectedNodeId
  );

  return (
    <div style={{ position: "relative", height: "100%" }}>
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 5,
        }}
      >
        <LayerLegend />
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#E8ECF1" gap={20} />
        <Controls
          showInteractive={false}
          style={{ borderRadius: 8, border: "1px solid var(--color-border)" }}
        />
      </ReactFlow>

      <DetailPanel
        step={selectedStep || null}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
