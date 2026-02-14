"use client";

import { LAYER_COLORS, LAYER_LABELS, type Layer } from "@/lib/types";

const LAYERS: Layer[] = [
  "cell",
  "orchestration",
  "memory",
  "human",
  "integration",
];

export default function LayerLegend() {
  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        padding: "10px 16px",
        background: "var(--color-surface)",
        borderRadius: 8,
        border: "1px solid var(--color-border)",
        flexWrap: "wrap",
      }}
    >
      {LAYERS.map((layer) => (
        <div
          key={layer}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: LAYER_COLORS[layer],
            }}
          />
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10.5,
              color: "var(--color-text)",
              fontWeight: 500,
            }}
          >
            {LAYER_LABELS[layer]}
          </span>
        </div>
      ))}
    </div>
  );
}
