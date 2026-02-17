"use client";

import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import type { Node } from "@xyflow/react";

/**
 * Capture the React Flow viewport as a PNG data URL.
 *
 * Uses html-to-image to render the .react-flow__viewport DOM element
 * at 2x resolution (2048x1200 default) for sharp PDF embedding.
 *
 * @param nodes - The React Flow nodes array (used to compute bounds)
 * @param options - Optional overrides for width, height, and background color
 * @returns A PNG data URL string suitable for jsPDF addImage
 */
export async function captureFlowAsDataUrl(
  nodes: Node[],
  options?: { width?: number; height?: number; bgColor?: string }
): Promise<string> {
  const captureWidth = options?.width ?? 2048;
  const captureHeight = options?.height ?? 1200;
  const bgColor = options?.bgColor ?? "#FFFFFF";

  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(
    nodesBounds,
    captureWidth,
    captureHeight,
    0.5, // minZoom
    2,   // maxZoom
    0.1  // padding (10%)
  );

  const viewportEl = document.querySelector(
    ".react-flow__viewport"
  ) as HTMLElement | null;

  if (!viewportEl) {
    throw new Error(
      "Could not find .react-flow__viewport element. " +
        "Ensure the React Flow component is mounted and visible before capturing."
    );
  }

  const dataUrl = await toPng(viewportEl, {
    backgroundColor: bgColor,
    width: captureWidth,
    height: captureHeight,
    style: {
      width: String(captureWidth),
      height: String(captureHeight),
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node: HTMLElement) => {
      // Exclude minimap and controls from the capture
      const classList = node.classList;
      if (!classList) return true;
      return (
        !classList.contains("react-flow__minimap") &&
        !classList.contains("react-flow__controls")
      );
    },
  });

  return dataUrl;
}
