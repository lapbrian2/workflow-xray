"use client";

import { useMemo, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import type { Decomposition, Step } from "@/lib/types";
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
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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

  const handleNodeHoverStart = useCallback((id: string) => {
    setHoveredNodeId(id);
  }, []);

  const handleNodeHoverEnd = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  // Compute connected node set for hover highlighting
  const connectedNodeIds = useMemo(() => {
    if (!hoveredNodeId) return null;
    const connected = new Set<string>([hoveredNodeId]);
    decomposition.steps.forEach((s) => {
      if (s.id === hoveredNodeId) {
        s.dependencies.forEach((d) => connected.add(d));
      }
      if (s.dependencies.includes(hoveredNodeId)) {
        connected.add(s.id);
      }
    });
    return connected;
  }, [hoveredNodeId, decomposition.steps]);

  // Compute critical path (longest dependency chain through the DAG)
  const criticalPathIds = useMemo(() => {
    const steps = decomposition.steps;
    const stepMap = new Map(steps.map((s) => [s.id, s]));

    const longestPath = new Map<string, number>();
    const pathParent = new Map<string, string | null>();

    function computeLongest(
      stepId: string,
      visited = new Set<string>()
    ): number {
      if (longestPath.has(stepId)) return longestPath.get(stepId)!;
      if (visited.has(stepId)) return 0;
      visited.add(stepId);

      const step = stepMap.get(stepId);
      if (!step || step.dependencies.length === 0) {
        longestPath.set(stepId, 1);
        pathParent.set(stepId, null);
        return 1;
      }

      let maxLen = 0;
      let maxParent: string | null = null;
      for (const dep of step.dependencies) {
        const len = computeLongest(dep, visited);
        if (len > maxLen) {
          maxLen = len;
          maxParent = dep;
        }
      }

      visited.delete(stepId);
      const total = maxLen + 1;
      longestPath.set(stepId, total);
      pathParent.set(stepId, maxParent);
      return total;
    }

    steps.forEach((s) => computeLongest(s.id));

    let maxStep = steps[0]?.id;
    let maxLen = 0;
    longestPath.forEach((len, id) => {
      if (len > maxLen) {
        maxLen = len;
        maxStep = id;
      }
    });

    const pathIds = new Set<string>();
    let current: string | null | undefined = maxStep;
    while (current) {
      pathIds.add(current);
      current = pathParent.get(current) ?? null;
    }

    return pathIds;
  }, [decomposition.steps]);

  // Compute gap counts per step
  const gapCountByStep = useMemo(() => {
    const map = new Map<string, number>();
    decomposition.gaps.forEach((g) => {
      g.stepIds.forEach((id) => {
        map.set(id, (map.get(id) || 0) + 1);
      });
    });
    return map;
  }, [decomposition.gaps]);

  const { nodes, edges } = useMemo(() => {
    const steps = decomposition.steps;

    // ── Compute depth for vertical positioning ──
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

    // ── Barycenter edge-crossing reduction ──
    const childrenOf = new Map<string, string[]>();
    const parentsOf = new Map<string, string[]>();
    steps.forEach((s) => {
      parentsOf.set(s.id, [...s.dependencies]);
      s.dependencies.forEach((depId) => {
        if (!childrenOf.has(depId)) childrenOf.set(depId, []);
        childrenOf.get(depId)!.push(s.id);
      });
    });

    const positionMap = new Map<string, number>();
    const row0 = depthGroups.get(0) || [];
    row0.forEach((s, i) => positionMap.set(s.id, i));

    const maxDepth = Math.max(...Array.from(depthGroups.keys()), 0);

    // Top-down pass: sort each row by average parent position
    for (let d = 1; d <= maxDepth; d++) {
      const group = depthGroups.get(d);
      if (!group) continue;

      const barycenters = group.map((s) => {
        const parents = parentsOf.get(s.id) || [];
        if (parents.length === 0) return { step: s, bc: 0 };
        const avgPos =
          parents.reduce((sum, pid) => sum + (positionMap.get(pid) ?? 0), 0) /
          parents.length;
        return { step: s, bc: avgPos };
      });

      barycenters.sort((a, b) => a.bc - b.bc);
      const sorted = barycenters.map((b) => b.step);
      depthGroups.set(d, sorted);
      sorted.forEach((s, i) => positionMap.set(s.id, i));
    }

    // Bottom-up refinement pass
    for (let d = maxDepth - 1; d >= 0; d--) {
      const group = depthGroups.get(d);
      if (!group) continue;

      const barycenters = group.map((s) => {
        const children = childrenOf.get(s.id) || [];
        if (children.length === 0)
          return { step: s, bc: positionMap.get(s.id) ?? 0 };
        const avgPos =
          children.reduce(
            (sum, cid) => sum + (positionMap.get(cid) ?? 0),
            0
          ) / children.length;
        return { step: s, bc: avgPos };
      });

      barycenters.sort((a, b) => a.bc - b.bc);
      const sorted = barycenters.map((b) => b.step);
      depthGroups.set(d, sorted);
      sorted.forEach((s, i) => positionMap.set(s.id, i));
    }

    // ── Dynamic spacing based on complexity ──
    const maxRowWidth = Math.max(
      ...Array.from(depthGroups.values()).map((g) => g.length)
    );
    const avgDeps =
      steps.reduce((sum, s) => sum + s.dependencies.length, 0) /
      Math.max(steps.length, 1);

    const xSpacing = maxRowWidth <= 3 ? 300 : maxRowWidth <= 5 ? 260 : 230;
    const ySpacing = avgDeps > 2 ? 200 : avgDeps > 1 ? 180 : 160;

    // ── Build nodes ──
    const nodes: Node[] = [];

    depthGroups.forEach((groupSteps, depth) => {
      const totalWidth = groupSteps.length * xSpacing;
      const startX = -totalWidth / 2 + xSpacing / 2;

      groupSteps.forEach((step, i) => {
        const isDimmed =
          connectedNodeIds !== null && !connectedNodeIds.has(step.id);

        nodes.push({
          id: step.id,
          type: "custom",
          position: { x: startX + i * xSpacing, y: depth * ySpacing },
          data: {
            step,
            selected: selectedNodeId === step.id,
            onClick: handleNodeClick,
            isCriticalPath: criticalPathIds.has(step.id),
            gapCount: gapCountByStep.get(step.id) || 0,
            dimmed: isDimmed,
            onHoverStart: handleNodeHoverStart,
            onHoverEnd: handleNodeHoverEnd,
          },
        });
      });
    });

    // ── Build edges ──
    const edges: Edge[] = [];
    steps.forEach((step) => {
      step.dependencies.forEach((depId) => {
        const isOnCriticalPath =
          criticalPathIds.has(depId) && criticalPathIds.has(step.id);
        const isEdgeDimmed =
          connectedNodeIds !== null &&
          !(connectedNodeIds.has(depId) && connectedNodeIds.has(step.id));

        edges.push({
          id: `${depId}-${step.id}`,
          source: depId,
          target: step.id,
          type: "custom",
          data: {
            isCriticalPath: isOnCriticalPath,
            dimmed: isEdgeDimmed,
          },
          style: {
            stroke: isOnCriticalPath
              ? "#DC143C"
              : LAYER_COLORS[step.layer] + "80",
            strokeWidth: isOnCriticalPath ? 3 : 1.5,
          },
        });
      });
    });

    return { nodes, edges };
  }, [
    decomposition.steps,
    selectedNodeId,
    handleNodeClick,
    criticalPathIds,
    gapCountByStep,
    connectedNodeIds,
    handleNodeHoverStart,
    handleNodeHoverEnd,
  ]);

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
        fitViewOptions={{ padding: 0.35 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#E8ECF1" gap={20} />
        <Controls
          showInteractive={false}
          style={{ borderRadius: 8, border: "1px solid var(--color-border)" }}
        />
        <MiniMap
          nodeColor={(node) => {
            const step = (node.data as { step: Step }).step;
            return LAYER_COLORS[step.layer];
          }}
          maskColor="rgba(0, 0, 0, 0.06)"
          style={{
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            height: 90,
            width: 140,
          }}
        />
      </ReactFlow>

      <DetailPanel
        step={selectedStep || null}
        onClose={() => setSelectedNodeId(null)}
      />
    </div>
  );
}
