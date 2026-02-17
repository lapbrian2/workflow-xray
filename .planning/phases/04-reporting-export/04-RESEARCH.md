# Phase 4: Reporting & Export - Research

**Researched:** 2026-02-17
**Domain:** Client-side PDF generation, data visualization charting, flow diagram export
**Confidence:** HIGH

## Summary

Phase 4 requires upgrading the existing jsPDF-based PDF export system to include structured sections (executive summary, flow diagram, gap analysis table, phased recommendations) and adding visual charting to the team dashboard for health metric trends. The project already has a mature, well-architected programmatic PDF generation system using jsPDF 4.1.0 with direct drawing primitives -- no html2canvas/screenshot approach. This is a significant advantage: the existing PDFs are already cross-browser consistent because they use programmatic geometry rather than browser rendering.

The two main technical challenges are: (1) embedding a React Flow diagram image into the jsPDF document, which requires capturing the `@xyflow/react` viewport as a raster image and inserting it, and (2) adding trend charts to the dashboard, which requires a charting library since the current dashboard only has static bar visualizations and a hand-rolled SVG area chart. The existing dashboard already computes health averages, gap distribution, team workload, and automation metrics but displays them as numbers and simple bars -- not as time-series trend charts showing how scores change.

A critical architectural consideration is that health metric trend data does not currently exist. Workflows have `createdAt` timestamps and point-in-time health scores, but there is no dedicated "health history" or "snapshot over time" storage. The trend visualization will need to derive time-series data from the existing workflow collection by grouping workflows by time period and computing aggregate health scores per period.

**Primary recommendation:** Keep jsPDF for PDF generation (it already works well), add `svg2pdf.js` for embedding flow diagram SVGs, add `recharts` 3.x for dashboard trend charts, and derive trend data from existing workflow timestamps rather than building new storage infrastructure.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jsPDF | ^4.1.0 | Programmatic PDF generation | Already in use, mature, cross-browser consistent via programmatic drawing |
| svg2pdf.js | ^2.7.0 | SVG-to-PDF embedding for flow diagrams | Official jsPDF companion by yWorks (diagramming experts), adds `doc.svg()` method |
| recharts | ^3.7.0 | Dashboard trend charts (line, area) | React 19 compatible (peerDep: ^19.0.0), SVG-based, composable, most popular React charting lib |
| html-to-image | 1.11.11 | Capture React Flow viewport as image | Official React Flow recommended approach, used in their docs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @xyflow/react | ^12.10.0 | Flow diagram rendering (already installed) | Source of the SVG viewport to capture for PDF embedding |
| html2canvas | ^1.4.1 | DOM-to-canvas (already installed) | Fallback if html-to-image SVG capture has issues |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| recharts | Hand-rolled SVG (like existing `SimpleAreaChart`) | Already exists for volume chart; works for simple cases but lacks tooltips, legends, responsive containers, and multi-series for health trends |
| recharts | visx | More flexible but requires more code; visx is low-level D3 wrapper, recharts is higher-level with built-in components |
| svg2pdf.js | html-to-image -> addImage() | Raster image loses quality on zoom; SVG embedding via svg2pdf.js preserves vectors |
| html-to-image | html2canvas for flow capture | html2canvas has known issues with SVG foreignObject; html-to-image handles it better |

**Installation:**
```bash
npm install recharts svg2pdf.js html-to-image@1.11.11
```

Note: `html-to-image` MUST be pinned to version 1.11.11 -- newer versions have confirmed export issues per React Flow official documentation.

## Architecture Patterns

### Recommended Project Structure
```
src/
  lib/
    pdf-export.ts            # Existing - ENHANCE with flow diagram + structured sections
    pdf-compare-export.ts    # Existing - ADD flow diagram if relevant
    pdf-batch-export.ts      # Existing - ADD flow diagram thumbnails
    pdf-remediation-export.ts # Existing - minimal changes
    pdf-shared.ts            # NEW - Extract shared helpers (colors, page break, headers, etc.)
    chart-data.ts            # NEW - Health trend data derivation from workflow collection
    flow-capture.ts          # NEW - React Flow viewport capture utilities
  components/
    health-trend-chart.tsx   # NEW - Recharts-based trend visualization
    dashboard-charts.tsx     # NEW - Collection of dashboard chart components
    xray-viz.tsx             # Existing - ADD export capture ref
  app/
    dashboard/
      page.tsx               # Existing - ENHANCE with trend charts
```

### Pattern 1: Shared PDF Drawing Utilities
**What:** Extract the duplicated color palette, helpers (checkPageBreak, drawHorizontalRule, drawSectionHeader), and layout constants into a shared module.
**When to use:** All 4 PDF export files currently duplicate ~50 lines of identical helpers and color definitions.
**Example:**
```typescript
// src/lib/pdf-shared.ts
import type { jsPDF } from "jspdf";

export const PDF_COLORS = {
  dark: [28, 37, 54] as [number, number, number],
  bodyText: [64, 75, 94] as [number, number, number],
  muted: [136, 149, 167] as [number, number, number],
  accent: [45, 125, 210] as [number, number, number],
  border: [222, 226, 231] as [number, number, number],
  bgLight: [247, 248, 250] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  // metric colors
  blue: [45, 125, 210] as [number, number, number],
  red: [220, 68, 55] as [number, number, number],
  green: [23, 165, 137] as [number, number, number],
  purple: [142, 68, 173] as [number, number, number],
  orange: [232, 85, 58] as [number, number, number],
};

export interface PdfContext {
  doc: jsPDF;
  y: number;
  margin: number;
  contentWidth: number;
  pageWidth: number;
  pageHeight: number;
}

export function checkPageBreak(ctx: PdfContext, needed: number): PdfContext {
  if (ctx.y + needed > ctx.pageHeight - 25) {
    ctx.doc.addPage();
    return { ...ctx, y: ctx.margin };
  }
  return ctx;
}

export function drawSectionHeader(ctx: PdfContext, title: string): PdfContext {
  const updated = checkPageBreak(ctx, 16);
  const { doc } = updated;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_COLORS.dark);
  doc.text(title, updated.margin, updated.y);
  updated.y += 2;
  doc.setDrawColor(...PDF_COLORS.accent);
  doc.setLineWidth(0.6);
  doc.line(updated.margin, updated.y, updated.margin + 30, updated.y);
  updated.y += 6;
  return updated;
}
```

### Pattern 2: Flow Diagram Capture for PDF
**What:** Capture the React Flow SVG viewport as an image dataURL, then embed in jsPDF via addImage().
**When to use:** When generating a PDF that needs to include the visual flow diagram.
**Example:**
```typescript
// src/lib/flow-capture.ts
import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";
import type { Node } from "@xyflow/react";

const EXPORT_WIDTH = 1024;
const EXPORT_HEIGHT = 600;

export async function captureFlowAsDataUrl(
  nodes: Node[],
  options?: { width?: number; height?: number; bgColor?: string }
): Promise<string> {
  const width = options?.width ?? EXPORT_WIDTH;
  const height = options?.height ?? EXPORT_HEIGHT;
  const bgColor = options?.bgColor ?? "#FFFFFF";

  const nodesBounds = getNodesBounds(nodes);
  const viewport = getViewportForBounds(nodesBounds, width, height, 0.5, 2);

  const viewportEl = document.querySelector(".react-flow__viewport") as HTMLElement;
  if (!viewportEl) throw new Error("React Flow viewport not found in DOM");

  return toPng(viewportEl, {
    backgroundColor: bgColor,
    width,
    height,
    style: {
      width: `${width}px`,
      height: `${height}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
    filter: (node) => {
      // Exclude minimap and controls from capture
      if (node instanceof HTMLElement) {
        const classList = node.classList;
        if (classList?.contains("react-flow__minimap")) return false;
        if (classList?.contains("react-flow__controls")) return false;
      }
      return true;
    },
  });
}
```

### Pattern 3: Health Trend Data Derivation
**What:** Compute time-series health data from existing workflows by grouping by week/month and calculating aggregate health scores.
**When to use:** Dashboard trend charts need time-series data that does not exist as a dedicated store.
**Example:**
```typescript
// src/lib/chart-data.ts
import type { Workflow, HealthMetrics } from "./types";

interface HealthTrendPoint {
  date: string;      // ISO date (start of period)
  label: string;     // Display label
  count: number;     // Number of workflows in this period
  complexity: number;
  fragility: number;
  automationPotential: number;
  teamLoadBalance: number;
  overallHealth: number;
}

export function computeHealthTrends(
  workflows: Workflow[],
  granularity: "week" | "month" = "week"
): HealthTrendPoint[] {
  if (workflows.length === 0) return [];

  // Group workflows by time period
  const buckets: Record<string, Workflow[]> = {};
  workflows.forEach((w) => {
    const d = new Date(w.createdAt);
    let key: string;
    if (granularity === "week") {
      const weekStart = new Date(d);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - ((dayOfWeek + 6) % 7));
      key = weekStart.toISOString().split("T")[0];
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
    }
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(w);
  });

  // Compute cumulative health at each point (all workflows up to that date)
  const sorted = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
  const cumulativeWorkflows: Workflow[] = [];

  return sorted.map(([date, newWorkflows]) => {
    cumulativeWorkflows.push(...newWorkflows);
    const n = cumulativeWorkflows.length;
    const sum = cumulativeWorkflows.reduce(
      (acc, w) => ({
        complexity: acc.complexity + w.decomposition.health.complexity,
        fragility: acc.fragility + w.decomposition.health.fragility,
        automationPotential: acc.automationPotential + w.decomposition.health.automationPotential,
        teamLoadBalance: acc.teamLoadBalance + w.decomposition.health.teamLoadBalance,
      }),
      { complexity: 0, fragility: 0, automationPotential: 0, teamLoadBalance: 0 }
    );

    const avg = {
      complexity: Math.round(sum.complexity / n),
      fragility: Math.round(sum.fragility / n),
      automationPotential: Math.round(sum.automationPotential / n),
      teamLoadBalance: Math.round(sum.teamLoadBalance / n),
    };

    return {
      date,
      label: new Date(date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      count: n,
      ...avg,
      overallHealth: Math.round(
        (avg.complexity + (100 - avg.fragility) + avg.automationPotential + avg.teamLoadBalance) / 4
      ),
    };
  });
}
```

### Pattern 4: Recharts Trend Chart Component
**What:** Composable trend chart using recharts with multi-line series for health metrics.
**When to use:** Dashboard page to show how health metrics change over time.
**Example:**
```typescript
// src/components/health-trend-chart.tsx
"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface TrendPoint {
  label: string;
  complexity: number;
  fragility: number;
  automationPotential: number;
  teamLoadBalance: number;
}

interface HealthTrendChartProps {
  data: TrendPoint[];
}

const METRIC_COLORS = {
  complexity: "#2D7DD2",
  fragility: "#E8553A",
  automationPotential: "#17A589",
  teamLoadBalance: "#8E44AD",
};

export default function HealthTrendChart({ data }: HealthTrendChartProps) {
  if (data.length < 2) return null;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          stroke="var(--color-muted)"
        />
        <YAxis
          domain={[0, 100]}
          tick={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
          stroke="var(--color-muted)"
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: 8,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
          }}
        />
        <Legend
          wrapperStyle={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
        />
        <Line
          type="monotone"
          dataKey="complexity"
          stroke={METRIC_COLORS.complexity}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Complexity"
        />
        <Line
          type="monotone"
          dataKey="fragility"
          stroke={METRIC_COLORS.fragility}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Fragility"
        />
        <Line
          type="monotone"
          dataKey="automationPotential"
          stroke={METRIC_COLORS.automationPotential}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Automation"
        />
        <Line
          type="monotone"
          dataKey="teamLoadBalance"
          stroke={METRIC_COLORS.teamLoadBalance}
          strokeWidth={2}
          dot={{ r: 3 }}
          name="Team Balance"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

### Anti-Patterns to Avoid
- **Server-side PDF with Puppeteer/Playwright:** Vercel serverless functions do not support headless browsers. All PDF generation must remain client-side with jsPDF.
- **html2canvas for the entire report:** The existing approach already uses programmatic jsPDF drawing, which is superior to screenshot-based approaches. Do not regress to html2canvas for full-page capture.
- **Storing health snapshots separately:** Avoid building a new "health history" table/store. The trend data can be derived from existing workflow `createdAt` timestamps and their health scores -- the data already exists.
- **Heavy charting libraries (e.g., Highcharts, ECharts):** These add 200KB+ bundle size. Recharts is ~45KB gzipped and covers the use case.
- **Duplicating drawing code across PDF export files:** Extract shared utilities first; the current 4 files share ~80% of their helper code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SVG-to-PDF embedding | Custom SVG parser for jsPDF | svg2pdf.js `doc.svg()` | SVG spec is massive; svg2pdf.js handles transforms, gradients, text, etc. |
| Flow diagram capture | Manual canvas rendering of React Flow | html-to-image + React Flow utilities | React Flow's custom nodes, edges, and styling are complex DOM; html-to-image handles it |
| Interactive trend charts | Custom SVG chart components | recharts `<LineChart>`, `<AreaChart>` | Tooltips, legends, responsive sizing, animation, accessibility -- all built in |
| PDF table layout | Manual x/y coordinate math for tables | jsPDF autoTable plugin OR the existing manual approach (already works) | The existing manual approach is already solid; consider jspdf-autotable only if table complexity increases |
| Cross-browser font consistency | Custom font embedding logic | jsPDF built-in Helvetica (standard 14 fonts) | Standard PDF fonts render identically everywhere; custom fonts cause Safari issues |

**Key insight:** The existing codebase already solved the hardest problem -- programmatic PDF generation with professional layout. The phase should enhance it incrementally, not rebuild it.

## Common Pitfalls

### Pitfall 1: html-to-image Version Mismatch
**What goes wrong:** Flow diagram capture produces blank or corrupted images.
**Why it happens:** Versions newer than 1.11.11 of html-to-image have confirmed export bugs, particularly with SVG foreignObject and CSS transforms.
**How to avoid:** Pin `html-to-image` to exactly version 1.11.11. This is documented in React Flow's official download-image example.
**Warning signs:** Blank white rectangles in captured images, missing node text/styling.

### Pitfall 2: Flow Diagram Capture Timing
**What goes wrong:** Captured image is empty or shows loading state.
**Why it happens:** React Flow hasn't finished rendering when capture is triggered. Nodes may not have settled into final positions.
**How to avoid:** Use `onNodesChange` or `useReactFlow().fitView()` completion before triggering capture. Add a small delay (`requestAnimationFrame` or `setTimeout(fn, 100)`) after fitView.
**Warning signs:** Captured diagram shows partial rendering or nodes at (0,0).

### Pitfall 3: PDF Page Break Mid-Section
**What goes wrong:** A section header appears at the bottom of a page with its content on the next page, or a flow diagram image is split across pages.
**Why it happens:** The existing `checkPageBreak` function checks remaining space but large embedded images may exceed a full page.
**How to avoid:** For the flow diagram, calculate the image height at the target width and check if it fits. If not, force a new page before inserting. For structured sections, estimate total section height before starting to draw.
**Warning signs:** Orphaned section headers, images that appear clipped at page boundaries.

### Pitfall 4: jsPDF addImage Format and Quality
**What goes wrong:** Flow diagram in PDF is blurry or has artifacts.
**Why it happens:** Using JPEG compression for diagrams with text/lines, or using too low a resolution for the capture.
**How to avoid:** Capture at 2x resolution (2048x1200 for a 1024x600 display) and use PNG format (lossless). When calling `doc.addImage()`, use format "PNG" and specify the display dimensions smaller than the capture dimensions.
**Warning signs:** Fuzzy text in flow nodes, aliased edges, color banding.

### Pitfall 5: Recharts SSR/Hydration Mismatch
**What goes wrong:** Console errors about hydration mismatch, or charts flash/re-render on load.
**Why it happens:** Recharts measures DOM dimensions for responsive sizing, which differs between server and client.
**How to avoid:** Mark chart components with `"use client"` directive (already the pattern in this codebase). Wrap in `<ResponsiveContainer>` which handles resize. Consider a loading placeholder until client-side hydration completes.
**Warning signs:** React hydration warnings in console, chart renders at wrong size then snaps to correct size.

### Pitfall 6: Trend Data with Too Few Workflows
**What goes wrong:** Trend chart shows a single dot or nothing useful.
**Why it happens:** User has only 1-2 workflows, so there are not enough data points for a trend.
**How to avoid:** Show the trend chart only when there are 3+ data points (matching the existing `volumeByWeek` pattern that checks `data.length > 1`). Show an informative empty state explaining that more workflows are needed to see trends.
**Warning signs:** Charts with a single dot, misleading "trends" from 2 data points.

### Pitfall 7: Safari Custom Font Rendering in PDFs
**What goes wrong:** PDF text shows garbled characters or blank text in Safari.
**Why it happens:** jsPDF custom font embedding has known Safari issues (GitHub issue #2711).
**How to avoid:** Stick with jsPDF standard fonts (Helvetica, Times, Courier) which are the built-in 14 PDF fonts. The existing codebase already does this correctly -- do not change to custom fonts.
**Warning signs:** Gibberish characters when opening PDF in Safari's built-in viewer.

## Code Examples

Verified patterns from official sources:

### Embedding Flow Diagram in PDF via addImage
```typescript
// After capturing the flow diagram as a data URL
const flowImageDataUrl = await captureFlowAsDataUrl(nodes);

// Calculate dimensions to maintain aspect ratio within PDF content width
const imgAspect = EXPORT_WIDTH / EXPORT_HEIGHT; // 1024/600
const pdfImgWidth = contentWidth; // ~170mm on A4
const pdfImgHeight = pdfImgWidth / imgAspect;

// Check page break for the image
ctx = checkPageBreak(ctx, pdfImgHeight + 10);

// Add image to PDF
doc.addImage(
  flowImageDataUrl,
  "PNG",
  margin,
  ctx.y,
  pdfImgWidth,
  pdfImgHeight
);
ctx.y += pdfImgHeight + 8;
```

### SVG-to-PDF Alternative (svg2pdf.js)
```typescript
// Source: https://github.com/yWorks/svg2pdf.js
import { jsPDF } from "jspdf";
import "svg2pdf.js"; // Adds doc.svg() method

const doc = new jsPDF();
const svgElement = document.querySelector(".react-flow__viewport svg");

// svg2pdf.js preserves vectors -- sharper than raster
await doc.svg(svgElement, {
  x: margin,
  y: ctx.y,
  width: contentWidth,
  height: pdfImgHeight,
});
```

### Recharts Basic Line Chart with ResponsiveContainer
```typescript
// Source: https://recharts.github.io/en-US/examples/SimpleLineChart/
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

<ResponsiveContainer width="100%" height={280}>
  <LineChart data={trendData}>
    <XAxis dataKey="label" />
    <YAxis domain={[0, 100]} />
    <Tooltip />
    <Line type="monotone" dataKey="automationPotential" stroke="#17A589" />
    <Line type="monotone" dataKey="fragility" stroke="#E8553A" />
  </LineChart>
</ResponsiveContainer>
```

### React Flow Image Download (Official Pattern)
```typescript
// Source: https://reactflow.dev/examples/misc/download-image
import { toPng } from "html-to-image";
import { getNodesBounds, getViewportForBounds } from "@xyflow/react";

const nodesBounds = getNodesBounds(getNodes());
const viewport = getViewportForBounds(nodesBounds, imageWidth, imageHeight, 0.5, 2);

const dataUrl = await toPng(
  document.querySelector(".react-flow__viewport"),
  {
    backgroundColor: "#FFFFFF",
    width: imageWidth,
    height: imageHeight,
    style: {
      width: `${imageWidth}px`,
      height: `${imageHeight}px`,
      transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
    },
  }
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| html2canvas screenshot -> PDF | Programmatic jsPDF drawing | Already in codebase | Cross-browser consistent, structured content |
| jsPDF 2.x | jsPDF 4.1.0 | Jan 2026 (4.0.0 security fix) | CVE-2025-68428 patched, Vite compatibility |
| svg2pdf.js fork of jsPDF | svg2pdf.js 2.x as plugin for standard jsPDF | 2023+ | Clean separation, `doc.svg()` API |
| recharts 2.x | recharts 3.7.0 | Jan 2026 | React 19 peer dependency support, rewritten state management |
| Custom SVG charts | recharts composable components | N/A | Tooltips, legends, responsive sizing built-in |

**Deprecated/outdated:**
- `jsPDF.addSvg()` native method: Experimental, supports tiny SVG subset. Use `svg2pdf.js` instead.
- `html-to-image` versions > 1.11.11: Have confirmed export bugs. Pin to 1.11.11.
- `react-is` override for recharts: No longer needed with recharts 3.x (react-is is now a peer dependency matching React version).

## Open Questions

1. **Flow diagram in PDF: raster vs. vector?**
   - What we know: `html-to-image` produces raster (PNG); `svg2pdf.js` can embed SVG as vectors. Custom React Flow nodes with HTML may not convert cleanly via svg2pdf.js.
   - What's unclear: Whether the custom FlowNode components (which use HTML via foreignObject) will render correctly with svg2pdf.js.
   - Recommendation: Start with the raster approach (html-to-image -> addImage) as it is proven to work with React Flow. If quality is insufficient, investigate svg2pdf.js as an enhancement. The raster approach at 2x resolution will look professional in print.

2. **Health trend data granularity**
   - What we know: Workflows have `createdAt` timestamps. The dashboard already groups by week for the volume chart.
   - What's unclear: Whether users will have enough workflows to make weekly trends meaningful, or if monthly granularity is better.
   - Recommendation: Default to weekly granularity (matching existing `volumeByWeek` pattern) with a toggle for monthly view if the date range spans > 3 months.

3. **PDF sections: are all 4 required sections new or do some exist?**
   - What we know: The existing PDF already has executive summary, key metrics, health dashboard, workflow steps, gap analysis, recommendations, estimated impact, and implementation roadmap sections.
   - What's unclear: The requirement says "executive summary, flow diagram, gap analysis table, phased recommendations" -- the existing PDF has all of these EXCEPT the flow diagram.
   - Recommendation: The main new work is embedding the flow diagram. The other 3 sections already exist in the current PDF. Verify with requirements that the existing sections satisfy REPT-03, and focus effort on the flow diagram embedding.

4. **Batch PDF flow diagrams**
   - What we know: The batch export generates one PDF for all workflows. Each workflow would need its own flow diagram.
   - What's unclear: Whether capturing flow diagrams for multiple workflows in batch is feasible (only one React Flow instance is in the DOM at a time).
   - Recommendation: For batch PDF, either (a) skip flow diagrams (they are workflow-specific and the batch view is aggregate), or (b) pre-capture each flow diagram before batch generation and pass data URLs as parameters.

## Sources

### Primary (HIGH confidence)
- Existing codebase analysis: `src/lib/pdf-export.ts`, `pdf-compare-export.ts`, `pdf-remediation-export.ts`, `pdf-batch-export.ts` -- all 4 PDF generation files reviewed
- Existing codebase: `src/app/dashboard/page.tsx` -- full dashboard implementation reviewed
- Existing codebase: `src/components/xray-viz.tsx` -- React Flow implementation reviewed
- Existing codebase: `src/lib/types.ts` -- all data types and interfaces reviewed
- [React Flow Download Image example](https://reactflow.dev/examples/misc/download-image) -- official pattern for image export
- [svg2pdf.js GitHub](https://github.com/yWorks/svg2pdf.js) -- v2.7.0 confirmed, jsPDF plugin API
- [recharts GitHub](https://github.com/recharts/recharts) -- v3.7.0 confirmed, React 19 peerDep support
- [jsPDF npm](https://www.npmjs.com/package/jspdf) -- v4.1.0 in project, v4.0.0 security release confirmed

### Secondary (MEDIUM confidence)
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- state management rewrite
- [html-to-image GitHub](https://github.com/bubkoo/html-to-image) -- export methods (toPng, toSvg, toBlob)
- [jsPDF Safari font issue #2711](https://github.com/parallax/jsPDF/issues/2711) -- custom font Safari problems confirmed
- Multiple search results confirming recharts 3.x peerDependencies: react ^16.8.0 || ^17.0.0 || ^18.0.0 || ^19.0.0

### Tertiary (LOW confidence)
- [Aglowid comparison of React chart libraries 2026](https://aglowiditsolutions.com/blog/react-chart-libraries/) -- market overview
- jsPDF 4.0.0 CVE-2025-68428 details -- security vulnerability addressed in version the project already uses

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries verified via npm, GitHub, codebase analysis. Versions confirmed. React 19 compatibility confirmed for recharts 3.x.
- Architecture: HIGH - Patterns derived directly from examining existing codebase. The approach builds on established patterns rather than introducing new paradigms.
- Pitfalls: HIGH - Derived from official docs (html-to-image version pin), GitHub issues (Safari fonts), and direct codebase analysis (existing checkPageBreak patterns).

**Research date:** 2026-02-17
**Valid until:** 2026-03-17 (30 days -- stable libraries, well-understood domain)
