"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { saveWorkflowLocal, getWorkflowLocal } from "@/lib/client-db";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";
import { exportBatchToPdf } from "@/lib/pdf-batch-export";
import type { ExtractionSource, Workflow } from "@/lib/types";

// ---------------------------------------------------------------------------
// Template system
// ---------------------------------------------------------------------------

type Category = "Sales" | "Engineering" | "Marketing" | "HR" | "Operations" | "Support";

interface Template {
  name: string;
  category: Category;
  icon: string;
  description: string;
  prompt: string;
}

const TEMPLATES: Template[] = [
  {
    name: "Sales Pipeline",
    category: "Sales",
    icon: "\u{1F4B0}",
    description: "Lead qualification through deal close",
    prompt:
      "Our B2B sales pipeline: SDR identifies prospect from LinkedIn/inbound lead \u2192 SDR sends personalized outreach sequence (3 emails, 2 LinkedIn touches) \u2192 If prospect responds, SDR qualifies using BANT framework \u2192 Qualified leads handed to AE with notes in Salesforce \u2192 AE runs discovery call (30 min) \u2192 AE sends custom proposal using PandaDoc \u2192 Prospect reviews with internal stakeholders (1-2 weeks) \u2192 AE follows up and handles objections \u2192 Legal reviews contract terms \u2192 Deal closes, AE does warm handoff to Account Manager \u2192 AM sends onboarding package",
  },
  {
    name: "Sprint Cycle",
    category: "Engineering",
    icon: "\u26A1",
    description: "Two-week agile sprint from planning to retro",
    prompt:
      "Engineering sprint cycle (2 weeks): PM grooms backlog and writes user stories in Linear \u2192 Team does sprint planning, estimates with story points \u2192 Developers pick tickets and create feature branches \u2192 Developer writes code and unit tests \u2192 Code review by 2 peers (must approve before merge) \u2192 QA engineer tests on staging environment \u2192 If bugs found, ticket goes back to developer \u2192 PM does acceptance testing \u2192 Merged to main branch \u2192 DevOps deploys to production (automated CI/CD via GitHub Actions) \u2192 PM updates stakeholders in Slack \u2192 Team runs sprint retrospective",
  },
  {
    name: "Content Pipeline",
    category: "Marketing",
    icon: "\u270D\uFE0F",
    description: "Blog post from ideation to analytics",
    prompt:
      "Content marketing pipeline: Content strategist identifies topic from SEO research (Ahrefs/Semrush) \u2192 Writer receives brief with target keywords, audience, and angle \u2192 Writer creates first draft in Google Docs (3-5 days) \u2192 Editor reviews for quality, tone, and brand voice \u2192 Writer revises based on feedback \u2192 SEO specialist optimizes meta tags, headers, internal links \u2192 Designer creates featured image and social graphics in Figma \u2192 Content manager publishes to CMS (WordPress) \u2192 Social media manager creates promotion posts for LinkedIn, Twitter, newsletter \u2192 Marketing analyst tracks performance after 7 and 30 days \u2192 Content strategist reviews metrics and plans updates",
  },
  {
    name: "Employee Onboarding",
    category: "HR",
    icon: "\u{1F44B}",
    description: "New hire from offer acceptance to 90-day review",
    prompt:
      "New employee onboarding: HR sends offer letter via DocuSign \u2192 Once signed, HR creates employee profile in HRIS (BambooHR) \u2192 IT provisions laptop, email, Slack access, and tool licenses \u2192 Hiring manager prepares onboarding plan with 30/60/90 day goals \u2192 Day 1: HR runs orientation session (benefits, policies, culture) \u2192 IT walks through tool setup and security training \u2192 Hiring manager introduces team and assigns buddy \u2192 Week 1: New hire shadows team members and reads documentation \u2192 Week 2-4: New hire takes on first small tasks with buddy support \u2192 30-day check-in with hiring manager \u2192 60-day performance conversation \u2192 90-day review with formal feedback and goal setting",
  },
  {
    name: "Incident Response",
    category: "Engineering",
    icon: "\u{1F6A8}",
    description: "Production incident from alert to post-mortem",
    prompt:
      "Production incident response: PagerDuty alert fires based on monitoring threshold (Datadog) \u2192 On-call engineer acknowledges within 5 minutes \u2192 Engineer assesses severity (P1-P4) and opens incident channel in Slack \u2192 If P1/P2: engineer pages team lead and starts war room \u2192 Team investigates using logs (Datadog), traces (Sentry), and dashboards \u2192 Engineer identifies root cause and implements fix or workaround \u2192 Fix deployed to production (hotfix branch, expedited review) \u2192 Engineer confirms metrics return to normal \u2192 Incident commander sends status update to stakeholders \u2192 Within 48 hours: team writes post-mortem document \u2192 Team reviews post-mortem in weekly meeting \u2192 Action items assigned and tracked in Linear",
  },
  {
    name: "Customer Support",
    category: "Support",
    icon: "\u{1F3A7}",
    description: "Support ticket from creation to resolution",
    prompt:
      "Customer support workflow: Customer submits ticket via Zendesk (email, chat, or web form) \u2192 Auto-triage bot categorizes by product area and suggests help articles \u2192 If unresolved, routed to Tier 1 support agent based on category \u2192 Agent reviews customer history and account status in CRM \u2192 Agent troubleshoots using knowledge base and internal docs \u2192 If can\u2019t resolve within 30 minutes, escalates to Tier 2 specialist \u2192 Tier 2 investigates, may loop in engineering for bug confirmation \u2192 Resolution applied and customer notified \u2192 Agent sends satisfaction survey (CSAT) \u2192 If CSAT < 3/5, case flagged for team lead review \u2192 Monthly: support manager analyzes top ticket categories and creates improvement backlog",
  },
];

const ALL_CATEGORIES: Category[] = [
  "Sales",
  "Engineering",
  "Marketing",
  "HR",
  "Operations",
  "Support",
];

// Category accent colors — hex values required for opacity suffixes in JS.
// These mirror the CSS vars: --color-accent, --color-info, --color-memory,
// --color-warning, --color-success, --color-integration in globals.css.
const CATEGORY_COLORS: Record<Category, string> = {
  Sales: "#e8553a",
  Engineering: "#2d7dd2",
  Marketing: "#8e44ad",
  HR: "#d4a017",
  Operations: "#17a589",
  Support: "#616a6b",
};

// ---------------------------------------------------------------------------
// PreviewCard — shared card for Notion / URL fetch previews
// ---------------------------------------------------------------------------

interface PreviewCardProps {
  title: string;
  content: string;
  stats: string;
  truncated: boolean;
  originalLength?: number;
  onUseRaw: () => void;
  onExtract: () => void;
  onCancel: () => void;
  extracting: boolean;
  headerLabel?: string;
}

function PreviewCard({
  title,
  content,
  stats,
  truncated,
  originalLength,
  onUseRaw,
  onExtract,
  onCancel,
  extracting,
  headerLabel = "Page Fetched",
}: PreviewCardProps) {
  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--success-bg)",
        border: "1px solid rgba(23,165,137,0.19)",
        borderRadius: 8,
        animation: "fadeIn 0.25s ease",
      }}
    >
      {/* Title + close row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-success)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {headerLabel}
        </div>
        <button
          onClick={onCancel}
          aria-label="Cancel preview"
          style={{
            background: "none",
            border: "none",
            fontSize: 16,
            color: "var(--color-muted)",
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          &times;
        </button>
      </div>

      {/* Page title */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--color-dark)",
          marginBottom: 4,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>

      {/* Stats line */}
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--color-muted)",
          marginBottom: 8,
        }}
      >
        {stats}
        {truncated && originalLength && (
          <span style={{ color: "var(--color-warning)" }}>
            {" "}
            &middot; truncated from {originalLength.toLocaleString()} chars
          </span>
        )}
      </div>

      {/* Content snippet with fade */}
      <div
        style={{
          position: "relative",
          maxHeight: 80,
          overflow: "hidden",
          marginBottom: 10,
        }}
      >
        <pre
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            lineHeight: 1.5,
            color: "var(--color-text)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            margin: 0,
          }}
        >
          {content.slice(0, 600)}
        </pre>
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 36,
            background:
              "linear-gradient(transparent, var(--success-bg))",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={onUseRaw}
          disabled={extracting}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            cursor: extracting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          Use Raw Content
        </button>
        <button
          onClick={onExtract}
          disabled={extracting}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: extracting
              ? "var(--color-border)"
              : "var(--color-info)",
            color: extracting
              ? "var(--color-muted)"
              : "var(--color-light)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            cursor: extracting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {extracting ? (
            <>
              <span
                style={{
                  width: 10,
                  height: 10,
                  border: "2px solid rgba(240,242,245,0.3)",
                  borderTop: "2px solid var(--color-light)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
              Extracting...
            </>
          ) : (
            "Extract Workflows"
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// VisualPreviewCard — for pages with minimal text (canvas editors, SPAs)
// ---------------------------------------------------------------------------

interface VisualPreviewCardProps {
  title: string;
  screenshot: string;
  sourceUrl: string;
  additionalContext: string;
  onContextChange: (v: string) => void;
  onExtractFromScreenshot: () => void;
  onDescribeManually: () => void;
  onCancel: () => void;
  extracting: boolean;
}

function VisualPreviewCard({
  title,
  screenshot,
  sourceUrl,
  additionalContext,
  onContextChange,
  onExtractFromScreenshot,
  onDescribeManually,
  onCancel,
  extracting,
}: VisualPreviewCardProps) {
  // Ensure the screenshot has a data URL prefix for <img> src
  const imgSrc = screenshot.startsWith("data:")
    ? screenshot
    : `data:image/png;base64,${screenshot}`;

  return (
    <div
      style={{
        padding: "12px 14px",
        background: "var(--info-bg)",
        border: "1px solid rgba(45,125,210,0.19)",
        borderRadius: 8,
        animation: "fadeIn 0.25s ease",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 700,
            color: "var(--color-info)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Visual Content Detected
        </div>
        <button
          onClick={onCancel}
          aria-label="Cancel preview"
          style={{
            background: "none",
            border: "none",
            fontSize: 16,
            color: "var(--color-muted)",
            cursor: "pointer",
            padding: "2px 6px",
          }}
        >
          &times;
        </button>
      </div>

      {/* Page title */}
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--color-dark)",
          marginBottom: 4,
          lineHeight: 1.4,
        }}
      >
        {title}
      </div>

      {/* Info message */}
      <div
        style={{
          fontFamily: "var(--font-body)",
          fontSize: 11,
          color: "var(--color-text)",
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      >
        This page has minimal text content. We captured a screenshot instead.
        Claude can analyze the visual layout to extract workflows.
      </div>

      {/* Screenshot preview thumbnail */}
      <div
        style={{
          position: "relative",
          maxHeight: 160,
          overflow: "hidden",
          marginBottom: 10,
          borderRadius: 6,
          border: "1px solid var(--color-border)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imgSrc}
          alt={`Screenshot of ${title}`}
          style={{ width: "100%", display: "block", objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 40,
            background: "linear-gradient(transparent, var(--info-bg))",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Source URL hint */}
      {sourceUrl && (
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            color: "var(--color-muted)",
            marginBottom: 8,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {sourceUrl}
        </div>
      )}

      {/* Optional context textarea */}
      <textarea
        value={additionalContext}
        onChange={(e) => onContextChange(e.target.value)}
        placeholder="Optional: Describe what this page is about to help extraction (e.g. 'n8n workflow for processing orders')"
        style={{
          width: "100%",
          minHeight: 52,
          padding: "8px 10px",
          borderRadius: 6,
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--color-dark)",
          resize: "vertical",
          outline: "none",
          marginBottom: 10,
          lineHeight: 1.5,
        }}
      />

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button
          onClick={onDescribeManually}
          disabled={extracting}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "1px solid var(--color-border)",
            background: "var(--color-surface)",
            color: "var(--color-dark)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            cursor: extracting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
          }}
        >
          Describe Manually
        </button>
        <button
          onClick={onExtractFromScreenshot}
          disabled={extracting}
          style={{
            padding: "6px 14px",
            borderRadius: 6,
            border: "none",
            background: extracting ? "var(--color-border)" : "var(--color-info)",
            color: extracting ? "var(--color-muted)" : "var(--color-light)",
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            cursor: extracting ? "not-allowed" : "pointer",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {extracting ? (
            <>
              <span
                style={{
                  width: 10,
                  height: 10,
                  border: "2px solid rgba(240,242,245,0.3)",
                  borderTop: "2px solid var(--color-light)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
              Extracting...
            </>
          ) : (
            "Extract from Screenshot"
          )}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FreeformInputProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
}

export default function FreeformInput({
  value,
  onChange,
  onSubmit,
  disabled,
}: FreeformInputProps) {
  const [activeCategory, setActiveCategory] = useState<Category | "All">("All");
  const [hoveredCard, setHoveredCard] = useState<number | null>(null);
  const [hoveredPill, setHoveredPill] = useState<string | null>(null);
  const [notionUrl, setNotionUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState<{
    title: string;
    content: string;
    blockCount: number;
    pageId: string;
    truncated?: boolean;
    originalLength?: number;
  } | null>(null);

  const handleNotionFetch = useCallback(async () => {
    if (!notionUrl.trim() || importing) return;
    setImporting(true);
    setImportError(null);
    setImportPreview(null);
    setExtractionResults(null);
    setExtractionError(null);
    try {
      const res = await fetch("/api/notion-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl: notionUrl.trim() }),
      });
      if (!res.ok) {
        let errMsg = "Import failed";
        try {
          const err = await res.json();
          errMsg = err.error?.message || err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status}): ${res.statusText}`;
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setImportPreview(data);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : "Failed to import from Notion"
      );
    } finally {
      setImporting(false);
    }
  }, [notionUrl]);

  const handleInsertImport = useCallback(() => {
    if (!importPreview) return;
    onChange(importPreview.content);
    setImportPreview(null);
    setNotionUrl("");
    setShowImport(false);
  }, [importPreview, onChange]);

  const handleCancelPreview = useCallback(() => {
    setImportPreview(null);
  }, []);

  // ─── URL Import state ───
  const [urlInput, setUrlInput] = useState("");
  const [urlFetching, setUrlFetching] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlPreview, setUrlPreview] = useState<{
    title: string;
    content: string;
    url: string;
    charCount: number;
    truncated: boolean;
    originalLength?: number;
    isVisualContent?: boolean;
    screenshot?: string | null;
  } | null>(null);

  // ─── Vision context (optional user description for screenshot extraction) ───
  const [visionContext, setVisionContext] = useState("");

  // ─── Import tab state ───
  const [importTab, setImportTab] = useState<"notion" | "url" | "crawl" | "file">("notion");

  // ─── File Upload state ───
  const [fileParsing, setFileParsing] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileDragOver, setFileDragOver] = useState(false);
  const [filePreview, setFilePreview] = useState<{
    title: string;
    content: string;
    charCount: number;
    fileName: string;
    fileType: string;
    fileSizeBytes: number;
    truncated: boolean;
    originalLength?: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Crawl Site state ───
  interface CrawlWorkflowItem {
    id: string;
    title: string;
    pageUrl: string;
    status: "queued" | "analyzing" | "complete" | "error";
    savedId?: string;
    steps?: number;
    gaps?: number;
    automationPotential?: number;
    error?: string;
  }
  interface CrawlProgress {
    stage: "idle" | "mapping" | "scraping" | "extracting" | "decomposing" | "complete" | "error";
    // Map
    totalPages?: number;
    pages?: string[];
    mapFallback?: boolean;
    mapFallbackReason?: string;
    // Scrape
    scrapeCurrent?: number;
    scrapeTotal?: number;
    scrapeUrl?: string;
    // Extract
    extractCurrent?: number;
    extractTotal?: number;
    extractUrl?: string;
    totalWorkflowsFound?: number;
    // Decompose
    decomposeCurrent?: number;
    decomposeTotal?: number;
    workflows?: CrawlWorkflowItem[];
    // Complete
    summary?: {
      totalPages: number;
      pagesScraped: number;
      pagesWithWorkflows: number;
      totalWorkflows: number;
      workflowsSaved: number;
      workflowsFailed: number;
      savedWorkflowIds: string[];
    };
    // Error
    errorMessage?: string;
  }
  const [crawlUrl, setCrawlUrl] = useState("");
  const [crawlMaxPages, setCrawlMaxPages] = useState(20);
  const [crawlRunning, setCrawlRunning] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [crawlProgress, setCrawlProgress] = useState<CrawlProgress>({ stage: "idle" });
  const crawlAbortRef = useRef<AbortController | null>(null);

  // Abort crawl SSE stream on unmount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    return () => {
      if (crawlAbortRef.current) {
        crawlAbortRef.current.abort();
        crawlAbortRef.current = null;
      }
    };
  }, []);

  // ─── Crawl SSE handler ───
  const handleCrawlStart = useCallback(async () => {
    if (crawlRunning || !crawlUrl.trim()) return;
    setCrawlRunning(true);
    setCrawlError(null);
    setCrawlProgress({ stage: "mapping" });

    const abort = new AbortController();
    crawlAbortRef.current = abort;

    try {
      const res = await fetch("/api/crawl-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: crawlUrl.trim(), maxPages: crawlMaxPages }),
        signal: abort.signal,
      });

      if (!res.ok) {
        let errMsg = `Request failed (${res.status})`;
        try {
          const err = await res.json();
          errMsg = err.error?.message || err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status}): ${res.statusText}`;
        }
        throw new Error(errMsg);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      try {
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));
              handleCrawlEvent(event);
            } catch {
              // Skip malformed SSE lines
            }
          }
        }

        // Process remaining buffer
        if (buffer.startsWith("data: ")) {
          try {
            const event = JSON.parse(buffer.slice(6));
            handleCrawlEvent(event);
          } catch {
            // skip
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Crawl failed";
      setCrawlError(msg);
      setCrawlProgress((p) => ({ ...p, stage: "error", errorMessage: msg }));
    } finally {
      setCrawlRunning(false);
      crawlAbortRef.current = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crawlUrl, crawlMaxPages]);

  const handleCrawlEvent = useCallback((event: Record<string, unknown>) => {
    const type = event.type as string;

    setCrawlProgress((prev) => {
      switch (type) {
        case "map_start":
          return { ...prev, stage: "mapping" };

        case "map_complete":
          return {
            ...prev,
            stage: "scraping",
            totalPages: event.totalPages as number,
            pages: event.pages as string[],
            mapFallback: (event.fallback as boolean) || false,
            mapFallbackReason: (event.fallbackReason as string) || undefined,
          };

        case "map_error":
          return { ...prev, stage: "error", errorMessage: event.error as string };

        case "scrape_start":
          return {
            ...prev,
            stage: "scraping",
            scrapeCurrent: event.current as number,
            scrapeTotal: event.total as number,
            scrapeUrl: event.url as string,
          };

        case "scrape_complete":
          return {
            ...prev,
            scrapeCurrent: event.current as number,
            scrapeTotal: event.total as number,
          };

        case "scrape_error":
          return {
            ...prev,
            scrapeCurrent: event.current as number,
          };

        case "extract_start":
          return {
            ...prev,
            stage: "extracting",
            extractCurrent: event.current as number,
            extractTotal: event.total as number,
            extractUrl: event.url as string,
          };

        case "extract_complete": {
          const wfCount = event.workflowCount as number;
          return {
            ...prev,
            extractCurrent: event.current as number,
            totalWorkflowsFound: (prev.totalWorkflowsFound || 0) + wfCount,
          };
        }

        case "extract_skip":
          return {
            ...prev,
            extractCurrent: event.current as number,
          };

        case "decompose_queue": {
          const items = (event.workflows as Array<{ id: string; title: string; pageUrl: string }>).map(
            (w) => ({
              id: w.id,
              title: w.title,
              pageUrl: w.pageUrl,
              status: "queued" as const,
            })
          );
          return {
            ...prev,
            stage: "decomposing",
            workflows: items,
            decomposeTotal: event.total as number,
            decomposeCurrent: 0,
          };
        }

        case "decompose_start": {
          const wfId = event.workflowId as string;
          return {
            ...prev,
            stage: "decomposing",
            decomposeCurrent: event.current as number,
            workflows: (prev.workflows || []).map((w) =>
              w.id === wfId ? { ...w, status: "analyzing" as const } : w
            ),
          };
        }

        case "decompose_complete": {
          const wfId = event.workflowId as string;
          return {
            ...prev,
            decomposeCurrent: event.current as number,
            workflows: (prev.workflows || []).map((w) =>
              w.id === wfId
                ? {
                    ...w,
                    status: "complete" as const,
                    savedId: event.savedId as string,
                    steps: event.steps as number,
                    gaps: event.gaps as number,
                    automationPotential: event.automationPotential as number,
                  }
                : w
            ),
          };
        }

        case "decompose_error": {
          const wfId = event.workflowId as string;
          return {
            ...prev,
            decomposeCurrent: event.current as number,
            workflows: (prev.workflows || []).map((w) =>
              w.id === wfId
                ? { ...w, status: "error" as const, error: event.error as string }
                : w
            ),
          };
        }

        case "pipeline_complete":
          return {
            ...prev,
            stage: "complete",
            summary: event.summary as CrawlProgress["summary"],
          };

        case "pipeline_error":
          return {
            ...prev,
            stage: "error",
            errorMessage: event.error as string,
          };

        default:
          return prev;
      }
    });
  }, []);

  const handleCrawlReset = useCallback(() => {
    if (crawlAbortRef.current) {
      crawlAbortRef.current.abort();
      crawlAbortRef.current = null;
    }
    setCrawlRunning(false);
    setCrawlError(null);
    setCrawlProgress({ stage: "idle" });
  }, []);

  // ─── File upload handler ───
  const handleFileSelect = useCallback(async (file: File) => {
    setFileParsing(true);
    setFileError(null);
    setFilePreview(null);
    setExtractionResults(null);
    setExtractionError(null);

    try {
      const fileName = file.name;
      const lastDotIndex = fileName.lastIndexOf(".");
      if (lastDotIndex === -1) {
        throw new Error("File must have an extension (e.g., .pdf, .docx, .xlsx).");
      }
      const ext = fileName.substring(lastDotIndex).toLowerCase();
      const textExts = new Set([".txt", ".md", ".log", ".csv", ".json"]);
      const serverExts = new Set([".pdf", ".docx", ".xlsx", ".xls"]);

      let content: string;
      const title = fileName.replace(/\.[^.]+$/, "");

      if (textExts.has(ext)) {
        // Client-side parsing for text formats
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read file"));
          reader.readAsText(file);
        });

        // Pretty-print JSON for readability
        if (ext === ".json") {
          try {
            const parsed = JSON.parse(content);
            content = JSON.stringify(parsed, null, 2);
          } catch {
            // Leave as-is if not valid JSON
          }
        }
      } else if (serverExts.has(ext)) {
        // Server-side parsing for PDF, DOCX, Excel
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-file", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          let errMsg = "Failed to parse file";
          try {
            const err = await res.json();
            errMsg = err.error?.message || err.error || errMsg;
          } catch {
            // Response wasn't JSON — use status text
            errMsg = `Server error (${res.status}): ${res.statusText}`;
          }
          throw new Error(errMsg);
        }

        const data = await res.json();
        content = data.content;
      } else {
        throw new Error(`Unsupported file type: ${ext}. Supported: .txt, .md, .csv, .json, .pdf, .docx, .xlsx, .xls`);
      }

      // Truncate client-side for very large text files
      const MAX_CHARS = 30_000;
      const truncated = content.length > MAX_CHARS;
      const safeContent = truncated ? content.slice(0, MAX_CHARS) : content;

      if (safeContent.trim().length === 0) {
        throw new Error("File contains no readable text.");
      }

      setFilePreview({
        title,
        content: safeContent,
        charCount: safeContent.length,
        fileName: file.name,
        fileType: ext,
        fileSizeBytes: file.size,
        truncated,
        originalLength: content.length,
      });
    } catch (err) {
      setFileError(
        err instanceof Error ? err.message : "Failed to read file"
      );
    } finally {
      setFileParsing(false);
      setFileDragOver(false);
      // Reset file input so re-selecting the same file triggers onChange
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, []);

  const handleFileInsert = useCallback(() => {
    if (!filePreview) return;
    onChange(filePreview.content);
    setFilePreview(null);
    setShowImport(false);
    setExtractionResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [filePreview, onChange]);

  const handleFileCancelPreview = useCallback(() => {
    setFilePreview(null);
    setExtractionResults(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  // ─── Extraction state ───
  interface ExtractedWf {
    id: string;
    title: string;
    summary?: string;
    extractedDescription: string;
    estimatedSteps?: number;
    sourceSection?: string;
    confidence?: string;
  }
  const [extracting, setExtracting] = useState(false);
  const [extractionResults, setExtractionResults] = useState<{
    documentTitle: string;
    workflows: ExtractedWf[];
    sourceType?: "notion" | "url" | "text" | "file";
    sourceUrl?: string;
  } | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const extractLock = useRef(false);

  // ─── Analyze All state ───
  interface AnalyzeAllWorkflowItem {
    id: string;
    title: string;
    extractedDescription: string;
    status: "queued" | "analyzing" | "complete" | "error";
    savedId?: string;
    steps?: number;
    gaps?: number;
    automationPotential?: number;
    error?: string;
    sourceSection?: string;
    confidence?: string;
  }
  interface AnalyzeAllProgress {
    stage: "idle" | "analyzing" | "complete";
    current?: number;
    total?: number;
    sourceType?: "notion" | "url" | "manual" | "file" | "text";
    sourceTitle?: string;
    workflows?: AnalyzeAllWorkflowItem[];
    summary?: {
      totalWorkflows: number;
      workflowsSaved: number;
      workflowsFailed: number;
      savedWorkflowIds: string[];
      totalSteps: number;
      totalGaps: number;
      avgAutomation: number;
      failedWorkflows?: AnalyzeAllWorkflowItem[];
    };
  }
  const [analyzeAllProgress, setAnalyzeAllProgress] = useState<AnalyzeAllProgress>({ stage: "idle" });
  const analyzeAllAbortRef = useRef<AbortController | null>(null);
  const [batchExporting, setBatchExporting] = useState(false);

  // ─── URL fetch handler ───
  const handleUrlFetch = useCallback(async () => {
    if (!urlInput.trim() || urlFetching) return;
    setUrlFetching(true);
    setUrlError(null);
    setUrlPreview(null);
    setExtractionResults(null);
    try {
      const res = await fetch("/api/scrape-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim() }),
      });
      if (!res.ok) {
        let errMsg = "Failed to fetch URL";
        try {
          const err = await res.json();
          errMsg = err.error?.message || err.error || errMsg;
        } catch {
          errMsg = `Server error (${res.status}): ${res.statusText}`;
        }
        throw new Error(errMsg);
      }
      const data = await res.json();
      setUrlPreview(data);
    } catch (err) {
      setUrlError(
        err instanceof Error ? err.message : "Could not scrape this page."
      );
    } finally {
      setUrlFetching(false);
    }
  }, [urlInput]);

  const handleUrlInsert = useCallback(() => {
    if (!urlPreview) return;
    onChange(urlPreview.content);
    setUrlPreview(null);
    setUrlInput("");
    setShowImport(false);
    setExtractionResults(null);
  }, [urlPreview, onChange]);

  const handleUrlCancelPreview = useCallback(() => {
    setUrlPreview(null);
    setExtractionResults(null);
  }, []);

  // ─── Extraction handler (shared for Notion, URL, and text) ───
  const handleExtractWorkflows = useCallback(
    async (content: string, sourceType: "notion" | "url" | "text" | "file", sourceUrl?: string) => {
      if (extractLock.current) return;
      extractLock.current = true;
      setExtracting(true);
      setExtractionError(null);
      setExtractionResults(null);
      try {
        const res = await fetch("/api/extract-workflows", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, sourceType, sourceUrl }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || err.error || "Extraction failed");
        }
        const data = await res.json();
        if (!data.workflows || data.workflows.length === 0) {
          setExtractionError("No workflows found in this document. Try a page that describes a process or procedure.");
        } else {
          setExtractionResults({
            documentTitle: data.documentTitle || "Untitled",
            workflows: data.workflows,
            sourceType: sourceType === "text" ? "text" : sourceType,
            sourceUrl,
          });
        }
      } catch (err) {
        setExtractionError(
          err instanceof Error
            ? err.message
            : "Could not extract workflows. Try using raw content instead."
        );
      } finally {
        setExtracting(false);
        extractLock.current = false;
      }
    },
    []
  );

  const handleSelectExtracted = useCallback(
    (wf: ExtractedWf) => {
      onChange(wf.extractedDescription);
      setExtractionResults(null);
      setImportPreview(null);
      setUrlPreview(null);
      setShowImport(false);
    },
    [onChange]
  );

  // ─── Analyze All handler ───
  const runAnalyzeAll = useCallback(async (workflowItems: AnalyzeAllWorkflowItem[], srcType?: string, srcTitle?: string, srcUrl?: string) => {
    // Create a new AbortController for this run
    const abort = new AbortController();
    analyzeAllAbortRef.current = abort;

    setAnalyzeAllProgress({
      stage: "analyzing",
      current: 0,
      total: workflowItems.length,
      sourceType: (srcType as AnalyzeAllProgress["sourceType"]) || "manual",
      sourceTitle: srcTitle,
      workflows: workflowItems.map((w) => ({ ...w, status: "queued" as const })),
    });

    const savedIds: string[] = [];
    let failed = 0;
    let totalSteps = 0;
    let totalGaps = 0;
    let automationSum = 0;
    const failedItems: AnalyzeAllWorkflowItem[] = [];

    for (let i = 0; i < workflowItems.length; i++) {
      if (abort.signal.aborted) break;

      const wf = workflowItems[i];
      const itemId = wf.id;

      // Mark current as analyzing
      setAnalyzeAllProgress((prev) => ({
        ...prev,
        current: i + 1,
        workflows: prev.workflows?.map((w) =>
          w.id === itemId ? { ...w, status: "analyzing" as const } : w
        ),
      }));

      try {
        // 1. Decompose via SSE stream (same endpoint as single submit)
        const res = await fetchWithTimeout(
          "/api/decompose",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: wf.extractedDescription }),
            signal: abort.signal,
          },
          120000
        );

        if (abort.signal.aborted) break;

        // Check for pre-stream errors (non-SSE JSON responses)
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("text/event-stream")) {
          if (!res.ok) {
            let errMsg = "Decomposition failed";
            try {
              const err = await res.json();
              errMsg = err.error?.message || err.error || errMsg;
            } catch {
              errMsg = `Server error (${res.status})`;
            }
            throw new Error(errMsg);
          }
          throw new Error("Unexpected response format");
        }

        // Parse SSE stream to extract workflow from complete/partial event
        const reader = res.body?.getReader();
        if (!reader) throw new Error("No response stream");

        let workflow: Workflow | null = null;
        let sseError: string | null = null;

        try {
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const parts = buffer.split("\n\n");
            buffer = parts.pop() || "";

            for (const part of parts) {
              const lines = part.trim().split("\n");
              const dataLine = lines.find((l) => l.startsWith("data: "));
              if (!dataLine) continue;
              try {
                const event = JSON.parse(dataLine.slice(6));
                if (event.type === "complete" || event.type === "partial") {
                  workflow = event.workflow;
                } else if (event.type === "error") {
                  sseError = event.message || "Decomposition failed";
                }
              } catch {
                // Skip malformed SSE lines
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const lines = buffer.trim().split("\n");
            const dataLine = lines.find((l) => l.startsWith("data: "));
            if (dataLine) {
              try {
                const event = JSON.parse(dataLine.slice(6));
                if (event.type === "complete" || event.type === "partial") {
                  workflow = event.workflow;
                } else if (event.type === "error") {
                  sseError = event.message || "Decomposition failed";
                }
              } catch {
                // Skip
              }
            }
          }
        } finally {
          reader.releaseLock();
        }

        if (sseError) throw new Error(sseError);
        if (!workflow) throw new Error("No workflow received from analysis");

        // Attach extraction source metadata with correct source type
        const resolvedType = srcType === "text" ? "manual" : (srcType || "manual");
        const extractionSource: ExtractionSource = {
          type: resolvedType as ExtractionSource["type"],
          url: srcUrl,
          title: wf.title,
          extractedAt: new Date().toISOString(),
          sourceSection: wf.sourceSection,
          totalWorkflowsInDocument: workflowItems.length,
        };
        workflow.extractionSource = extractionSource;

        // 2. Update server with extraction source metadata
        try {
          await fetch("/api/workflows", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(workflow),
            signal: abort.signal,
          });
        } catch {
          // Non-critical — workflow already saved by decompose route
        }

        // 3. Save to local IndexedDB
        saveWorkflowLocal(workflow);
        savedIds.push(workflow.id);

        const steps = workflow.decomposition?.steps?.length ?? 0;
        const gaps = workflow.decomposition?.gaps?.length ?? 0;
        const auto = workflow.decomposition?.health?.automationPotential ?? 0;
        totalSteps += steps;
        totalGaps += gaps;
        automationSum += auto;

        // Mark complete with stats
        setAnalyzeAllProgress((prev) => ({
          ...prev,
          workflows: prev.workflows?.map((w) =>
            w.id === itemId
              ? {
                  ...w,
                  status: "complete" as const,
                  savedId: workflow.id,
                  steps,
                  gaps,
                  automationPotential: auto,
                }
              : w
          ),
        }));
      } catch (err) {
        if (abort.signal.aborted) break;
        failed++;
        const errorMsg = err instanceof Error ? err.message : "Failed";
        failedItems.push({ ...wf, status: "error", error: errorMsg });
        setAnalyzeAllProgress((prev) => ({
          ...prev,
          workflows: prev.workflows?.map((w) =>
            w.id === itemId
              ? { ...w, status: "error" as const, error: errorMsg }
              : w
          ),
        }));
      }
    }

    // If aborted, reset to idle
    if (abort.signal.aborted) {
      setAnalyzeAllProgress({ stage: "idle" });
      analyzeAllAbortRef.current = null;
      return;
    }

    const saved = savedIds.length;

    // Complete with rich summary
    setAnalyzeAllProgress({
      stage: "complete",
      current: workflowItems.length,
      total: workflowItems.length,
      sourceType: (srcType as AnalyzeAllProgress["sourceType"]) || "manual",
      workflows: undefined,
      summary: {
        totalWorkflows: workflowItems.length,
        workflowsSaved: saved,
        workflowsFailed: failed,
        savedWorkflowIds: savedIds,
        totalSteps,
        totalGaps,
        avgAutomation: saved > 0 ? Math.round(automationSum / saved) : 0,
        failedWorkflows: failedItems.length > 0 ? failedItems : undefined,
      },
    });
    analyzeAllAbortRef.current = null;
  }, []);

  const handleAnalyzeAll = useCallback(() => {
    if (!extractionResults || extractionResults.workflows.length === 0) return;
    if (analyzeAllProgress.stage === "analyzing") return; // Guard double-click

    const items: AnalyzeAllWorkflowItem[] = extractionResults.workflows.map((wf, i) => ({
      id: `aa_${i + 1}`,
      title: wf.title,
      extractedDescription: wf.extractedDescription,
      status: "queued" as const,
      sourceSection: wf.sourceSection,
      confidence: wf.confidence,
    }));

    const srcType = extractionResults.sourceType || "manual";
    const srcTitle = extractionResults.documentTitle;
    const srcUrl = extractionResults.sourceUrl;

    // Hide extraction results — progress cards replace them
    setExtractionResults(null);

    runAnalyzeAll(items, srcType, srcTitle, srcUrl);
  }, [extractionResults, analyzeAllProgress.stage, runAnalyzeAll]);

  const handleRetryFailed = useCallback(() => {
    if (!analyzeAllProgress.summary?.failedWorkflows?.length) return;
    const failedItems = analyzeAllProgress.summary.failedWorkflows.map((wf, i) => ({
      ...wf,
      id: `retry_${i + 1}`,
      status: "queued" as const,
      error: undefined,
    }));
    runAnalyzeAll(failedItems, analyzeAllProgress.sourceType);
  }, [analyzeAllProgress, runAnalyzeAll]);

  // ─── Batch PDF export handler ───
  const handleBatchPdfExport = useCallback(async () => {
    if (batchExporting) return;
    const savedIds = analyzeAllProgress.summary?.savedWorkflowIds;
    if (!savedIds || savedIds.length === 0) return;

    setBatchExporting(true);
    try {
      // Fetch workflows from localStorage (they were just saved there)
      const workflows: Workflow[] = [];
      for (const id of savedIds) {
        const local = getWorkflowLocal(id);
        if (local) {
          workflows.push(local);
        } else {
          // Fallback: try fetching from server
          try {
            const res = await fetch(`/api/workflows?id=${id}`);
            if (res.ok) {
              const data = await res.json();
              if (data) workflows.push(data);
            }
          } catch {
            // Skip — workflow not available
          }
        }
      }

      if (workflows.length === 0) {
        throw new Error("No workflows found. They may have been removed.");
      }

      const sourceTitle = analyzeAllProgress.sourceTitle || extractionResults?.documentTitle;
      await exportBatchToPdf(workflows, sourceTitle);
    } catch (err) {
      console.error("Batch PDF export failed:", err);
      alert(err instanceof Error ? err.message : "Failed to generate PDF. Please try again.");
    } finally {
      setBatchExporting(false);
    }
  }, [batchExporting, analyzeAllProgress, extractionResults]);

  // ─── Screenshot extraction handler ───
  const handleExtractFromScreenshot = useCallback(async () => {
    if (!urlPreview?.screenshot || extractLock.current) return;
    extractLock.current = true;
    setExtracting(true);
    setExtractionError(null);
    setExtractionResults(null);
    try {
      const res = await fetch("/api/extract-from-screenshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screenshot: urlPreview.screenshot,
          sourceUrl: urlPreview.url,
          additionalContext: visionContext || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || err.error || "Screenshot extraction failed");
      }
      const data = await res.json();
      if (!data.workflows || data.workflows.length === 0) {
        setExtractionError("No workflows found in the screenshot. Try describing the workflow manually.");
      } else {
        setExtractionResults({
          documentTitle: data.documentTitle || "Untitled",
          workflows: data.workflows,
          sourceType: "url",
          sourceUrl: urlPreview?.url,
        });
      }
    } catch (err) {
      setExtractionError(
        err instanceof Error ? err.message : "Could not extract workflows from screenshot."
      );
    } finally {
      setExtracting(false);
      extractLock.current = false;
    }
  }, [urlPreview, visionContext]);

  const handleDescribeManually = useCallback(() => {
    setUrlPreview(null);
    setShowImport(false);
    setVisionContext("");
  }, []);

  const filtered =
    activeCategory === "All"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === activeCategory);

  // Categories that actually have templates (avoid empty sections)
  const populatedCategories = ALL_CATEGORIES.filter((cat) =>
    TEMPLATES.some((t) => t.category === cat),
  );

  // Group templates by category for section headers
  const grouped: { category: Category; templates: Template[] }[] = [];
  if (activeCategory === "All") {
    for (const cat of populatedCategories) {
      const items = TEMPLATES.filter((t) => t.category === cat);
      if (items.length) grouped.push({ category: cat, templates: items });
    }
  } else {
    grouped.push({
      category: activeCategory as Category,
      templates: filtered,
    });
  }

  return (
    <div>
      {/* Textarea --------------------------------------------------------- */}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            if (!disabled && value.trim().length >= 20) {
              onSubmit();
            }
          }
        }}
        disabled={disabled}
        placeholder="Describe your workflow in natural language. Include team members, tools, and handoff points for the best analysis..."
        style={{
          width: "100%",
          minHeight: 180,
          padding: "16px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          fontFamily: "var(--font-body)",
          fontSize: 15,
          lineHeight: 1.7,
          color: "var(--color-dark)",
          resize: "vertical",
          outline: "none",
          transition: "border-color 0.2s",
        }}
      />

      {/* Submit row -------------------------------------------------------- */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 8,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            color: "var(--color-muted)",
          }}
        >
          {value.length} chars &middot; Ctrl+Enter to submit
        </span>
        <button
          onClick={onSubmit}
          disabled={disabled || value.trim().length < 20}
          style={{
            padding: "10px 28px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background:
              disabled || value.trim().length < 20
                ? "var(--color-border)"
                : "linear-gradient(135deg, var(--color-accent) 0%, var(--color-accent-light) 100%)",
            color:
              disabled || value.trim().length < 20
                ? "var(--color-muted)"
                : "var(--color-light)",
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 600,
            cursor:
              disabled || value.trim().length < 20
                ? "not-allowed"
                : "pointer",
            transition: "all var(--duration-normal) var(--ease-default)",
            boxShadow:
              disabled || value.trim().length < 20
                ? "none"
                : "var(--shadow-accent)",
            letterSpacing: "0.02em",
          }}
        >
          {disabled ? (
            <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: "2px solid rgba(240,242,245,0.3)",
                  borderTop: "2px solid var(--color-light)",
                  borderRadius: "50%",
                  animation: "spin 0.8s linear infinite",
                  display: "inline-block",
                }}
              />
              Analyzing...
            </span>
          ) : (
            "Decompose Workflow"
          )}
        </button>
      </div>

      {/* Text extraction hint for long content */}
      {value.length > 1000 && !extracting && !extractionResults && (
        <div style={{ marginTop: 6 }}>
          <button
            onClick={() => handleExtractWorkflows(value, "text")}
            disabled={disabled || extracting}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--color-info)",
              padding: 0,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            Pasted a long document? Extract workflows from this text &rarr;
          </button>
        </div>
      )}

      {/* Import section (Notion + URL) ------------------------------------- */}
      <div style={{ marginTop: 16, marginBottom: 8 }}>
        <button
          onClick={() => setShowImport(!showImport)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            background: "none",
            border: "none",
            cursor: "pointer",
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--color-muted)",
            padding: "4px 0",
            letterSpacing: "0.02em",
          }}
        >
          <span
            style={{
              display: "inline-block",
              transition: "transform 0.2s",
              transform: showImport ? "rotate(90deg)" : "rotate(0deg)",
              fontSize: 10,
            }}
          >
            &#9654;
          </span>
          Import Content
        </button>

        {showImport && (
          <div
            style={{
              marginTop: 8,
              padding: "12px 16px",
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-sm)",
              animation: "fadeIn 0.2s ease",
            }}
          >
            {/* Tab pills */}
            <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
              {(["notion", "url", "crawl", "file"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setImportTab(tab);
                    // Clear stale state from other tabs
                    setImportError(null);
                    setUrlError(null);
                    setImportPreview(null);
                    setUrlPreview(null);
                    setExtractionResults(null);
                    setExtractionError(null);
                    // Reset analyze-all progress on tab switch
                    if (analyzeAllProgress.stage !== "idle") {
                      analyzeAllAbortRef.current?.abort();
                      analyzeAllAbortRef.current = null;
                      setAnalyzeAllProgress({ stage: "idle" });
                    }
                    // Reset crawl state when leaving crawl tab
                    if (tab !== "crawl") {
                      if (crawlRunning && crawlAbortRef.current) {
                        crawlAbortRef.current.abort();
                        crawlAbortRef.current = null;
                        setCrawlRunning(false);
                      }
                      setCrawlError(null);
                      setCrawlProgress({ stage: "idle" });
                    }
                    // Reset file state when leaving file tab
                    if (tab !== "file") {
                      setFileError(null);
                      setFilePreview(null);
                      setFileDragOver(false);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: 6,
                    border: "none",
                    background: importTab === tab ? "var(--color-dark)" : "var(--color-border)",
                    color: importTab === tab ? "var(--color-light)" : "var(--color-text)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {tab === "notion" && (
                    <svg width="10" height="10" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.7 }}>
                      <path d="M6.017 4.313l55.333 -4.087c6.797 -0.583 8.543 -0.19 12.817 2.917l17.663 12.443c2.913 2.14 3.883 2.723 3.883 5.053v68.243c0 4.277 -1.553 6.807 -6.99 7.193L24.467 99.967c-4.08 0.193 -6.023 -0.39 -8.16 -3.113L3.3 79.94c-2.333 -3.113 -3.3 -5.443 -3.3 -8.167V11.113c0 -3.497 1.553 -6.413 6.017 -6.8z" fill="currentColor" />
                    </svg>
                  )}
                  {tab === "crawl" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="2" y1="12" x2="22" y2="12" />
                      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                  )}
                  {tab === "file" && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.7 }}>
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="15" y2="15" />
                    </svg>
                  )}
                  {tab === "notion" ? "Notion" : tab === "url" ? "URL" : tab === "crawl" ? "Crawl Site" : "Upload"}
                </button>
              ))}
            </div>

            {/* ── Notion tab ── */}
            {importTab === "notion" && (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--color-text)",
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}
                >
                  Paste a Notion page URL. The &ldquo;Workflow X-Ray&rdquo; integration must be connected.
                </div>

                {!importPreview && !extractionResults && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={notionUrl}
                      onChange={(e) => { setNotionUrl(e.target.value); setImportError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNotionFetch(); } }}
                      placeholder="https://www.notion.so/your-page-id"
                      disabled={importing || disabled}
                      style={{
                        flex: 1, padding: "8px 12px", borderRadius: 6,
                        border: `1px solid ${importError ? "rgba(232,85,58,0.25)" : "var(--color-border)"}`,
                        background: "var(--color-surface)", fontFamily: "var(--font-mono)",
                        fontSize: 12, color: "var(--color-dark)", outline: "none",
                      }}
                    />
                    <button
                      onClick={handleNotionFetch}
                      disabled={importing || !notionUrl.trim() || disabled}
                      style={{
                        padding: "8px 16px", borderRadius: 6, border: "none",
                        background: importing || !notionUrl.trim() ? "var(--color-border)" : "var(--color-dark)",
                        color: importing || !notionUrl.trim() ? "var(--color-muted)" : "var(--color-light)",
                        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                        cursor: importing || !notionUrl.trim() ? "not-allowed" : "pointer",
                        transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      }}
                    >
                      {importing ? (<><span style={{ width: 12, height: 12, border: "2px solid rgba(240,242,245,0.3)", borderTop: "2px solid var(--color-light)", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Fetching...</>) : "Fetch Page"}
                    </button>
                  </div>
                )}

                {/* Notion preview card */}
                {importPreview && !extractionResults && (
                  <PreviewCard
                    title={importPreview.title}
                    content={importPreview.content}
                    stats={`${importPreview.blockCount} blocks \u00b7 ${importPreview.content.length.toLocaleString()} chars`}
                    truncated={!!importPreview.truncated}
                    originalLength={importPreview.originalLength}
                    onUseRaw={handleInsertImport}
                    onExtract={() => handleExtractWorkflows(importPreview.content, "notion", notionUrl || undefined)}
                    onCancel={handleCancelPreview}
                    extracting={extracting}
                  />
                )}
              </>
            )}

            {/* ── URL tab ── */}
            {importTab === "url" && (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--color-text)",
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}
                >
                  Enter any web page URL to scrape its content.
                </div>

                {!urlPreview && !extractionResults && (
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => { setUrlInput(e.target.value); setUrlError(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleUrlFetch(); } }}
                      placeholder="https://example.com/process-docs"
                      disabled={urlFetching || disabled}
                      style={{
                        flex: 1, padding: "8px 12px", borderRadius: 6,
                        border: `1px solid ${urlError ? "rgba(232,85,58,0.25)" : "var(--color-border)"}`,
                        background: "var(--color-surface)", fontFamily: "var(--font-mono)",
                        fontSize: 12, color: "var(--color-dark)", outline: "none",
                      }}
                    />
                    <button
                      onClick={handleUrlFetch}
                      disabled={urlFetching || !urlInput.trim() || disabled}
                      style={{
                        padding: "8px 16px", borderRadius: 6, border: "none",
                        background: urlFetching || !urlInput.trim() ? "var(--color-border)" : "var(--color-dark)",
                        color: urlFetching || !urlInput.trim() ? "var(--color-muted)" : "var(--color-light)",
                        fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600,
                        cursor: urlFetching || !urlInput.trim() ? "not-allowed" : "pointer",
                        transition: "all 0.2s", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap",
                      }}
                    >
                      {urlFetching ? (<><span style={{ width: 12, height: 12, border: "2px solid rgba(240,242,245,0.3)", borderTop: "2px solid var(--color-light)", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} /> Fetching...</>) : "Fetch Page"}
                    </button>
                  </div>
                )}

                {/* URL preview card — text or visual */}
                {urlPreview && !extractionResults && (
                  urlPreview.isVisualContent && urlPreview.screenshot ? (
                    <VisualPreviewCard
                      title={urlPreview.title}
                      screenshot={urlPreview.screenshot}
                      sourceUrl={urlPreview.url}
                      additionalContext={visionContext}
                      onContextChange={setVisionContext}
                      onExtractFromScreenshot={handleExtractFromScreenshot}
                      onDescribeManually={handleDescribeManually}
                      onCancel={handleUrlCancelPreview}
                      extracting={extracting}
                    />
                  ) : (
                    <PreviewCard
                      title={urlPreview.title}
                      content={urlPreview.content}
                      stats={`${urlPreview.charCount.toLocaleString()} chars`}
                      truncated={urlPreview.truncated}
                      originalLength={urlPreview.originalLength}
                      onUseRaw={handleUrlInsert}
                      onExtract={() => handleExtractWorkflows(urlPreview.content, "url", urlPreview.url)}
                      onCancel={handleUrlCancelPreview}
                      extracting={extracting}
                    />
                  )
                )}
              </>
            )}

            {/* ── Crawl Site tab ── */}
            {importTab === "crawl" && (
              <div>
                {/* ─ Idle: Input form ─ */}
                {crawlProgress.stage === "idle" && (
                  <>
                    <div
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: 12,
                        color: "var(--color-text)",
                        marginBottom: 8,
                        lineHeight: 1.5,
                      }}
                    >
                      Enter a website URL to crawl. All pages will be scraped, analyzed for workflows, and auto-decomposed.
                    </div>

                    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                      <input
                        type="text"
                        value={crawlUrl}
                        onChange={(e) => { setCrawlUrl(e.target.value); setCrawlError(null); }}
                        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleCrawlStart(); } }}
                        placeholder="https://docs.example.com"
                        disabled={crawlRunning || disabled}
                        style={{
                          flex: 1, padding: "8px 12px", borderRadius: 6,
                          border: `1px solid ${crawlError ? "rgba(232,85,58,0.25)" : "var(--color-border)"}`,
                          background: "var(--color-surface)", fontFamily: "var(--font-mono)",
                          fontSize: 12, color: "var(--color-dark)", outline: "none",
                        }}
                      />
                    </div>

                    {/* Max pages slider */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-muted)", fontWeight: 600 }}>
                          Max pages
                        </span>
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--color-dark)" }}>
                          {crawlMaxPages}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1}
                        max={50}
                        value={crawlMaxPages}
                        onChange={(e) => setCrawlMaxPages(Number(e.target.value))}
                        disabled={crawlRunning || disabled}
                        style={{ width: "100%", accentColor: "var(--color-accent)" }}
                      />
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted)", marginTop: 2 }}>
                        ~{1 + crawlMaxPages * 2} Firecrawl credits
                      </div>
                    </div>

                    <button
                      onClick={handleCrawlStart}
                      disabled={crawlRunning || !crawlUrl.trim() || disabled}
                      style={{
                        width: "100%",
                        padding: "10px 20px",
                        borderRadius: 6,
                        border: "none",
                        background: crawlRunning || !crawlUrl.trim()
                          ? "var(--color-border)"
                          : "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)",
                        color: crawlRunning || !crawlUrl.trim() ? "var(--color-muted)" : "var(--color-light)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: crawlRunning || !crawlUrl.trim() ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        boxShadow: crawlRunning || !crawlUrl.trim() ? "none" : "0 2px 8px rgba(232,85,58,0.2)",
                        letterSpacing: "0.02em",
                      }}
                    >
                      Crawl &amp; Analyze
                    </button>
                  </>
                )}

                {/* ─ Progress: mapping / scraping / extracting / decomposing ─ */}
                {["mapping", "scraping", "extracting", "decomposing"].includes(crawlProgress.stage) && (
                  <div>
                    {/* 4-stage progress bar */}
                    <div style={{ display: "flex", gap: 3, marginBottom: 16 }}>
                      {(["mapping", "scraping", "extracting", "decomposing"] as const).map((s) => {
                        const stages = ["mapping", "scraping", "extracting", "decomposing"];
                        const currentIdx = stages.indexOf(crawlProgress.stage);
                        const stageIdx = stages.indexOf(s);
                        const isComplete = stageIdx < currentIdx;
                        const isActive = stageIdx === currentIdx;
                        return (
                          <div key={s} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                            <div
                              style={{
                                height: 4,
                                borderRadius: 2,
                                background: isComplete
                                  ? "var(--color-success)"
                                  : isActive
                                    ? "var(--color-accent)"
                                    : "var(--color-border)",
                                transition: "background 0.3s ease",
                                position: "relative",
                                overflow: "hidden",
                              }}
                            >
                              {isActive && (
                                <div
                                  style={{
                                    position: "absolute",
                                    inset: 0,
                                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)",
                                    animation: "cardShimmer 1.5s ease infinite",
                                    backgroundSize: "300% 100%",
                                  }}
                                />
                              )}
                            </div>
                            <span
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 8,
                                color: isComplete ? "var(--color-success)" : isActive ? "var(--color-accent)" : "var(--color-muted)",
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                fontWeight: isActive ? 700 : 500,
                                textAlign: "center",
                              }}
                            >
                              {s === "mapping" ? "Map" : s === "scraping" ? "Scrape" : s === "extracting" ? "Extract" : "Decompose"}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Stage detail text */}
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        color: "var(--color-dark)",
                        marginBottom: 12,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          border: "2px solid rgba(232,85,58,0.2)",
                          borderTop: "2px solid var(--color-accent)",
                          borderRadius: "50%",
                          animation: "spin 0.8s linear infinite",
                          display: "inline-block",
                          flexShrink: 0,
                        }}
                      />
                      {crawlProgress.stage === "mapping" && "Discovering pages..."}
                      {crawlProgress.stage === "scraping" && (
                        <>Scraping pages... {crawlProgress.scrapeCurrent || 0}/{crawlProgress.scrapeTotal || "?"}</>
                      )}
                      {crawlProgress.stage === "extracting" && (
                        <>Extracting workflows... {crawlProgress.extractCurrent || 0}/{crawlProgress.extractTotal || "?"}</>
                      )}
                      {crawlProgress.stage === "decomposing" && (
                        <>Decomposing workflows... {crawlProgress.decomposeCurrent || 0}/{crawlProgress.decomposeTotal || "?"}</>
                      )}
                    </div>

                    {/* Map fallback notice */}
                    {crawlProgress.mapFallback && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          color: "var(--color-warning)",
                          marginBottom: 8,
                          padding: "4px 8px",
                          background: "rgba(212,160,23,0.06)",
                          borderRadius: 4,
                          border: "1px solid rgba(212,160,23,0.15)",
                        }}
                      >
                        Site map unavailable — scanning page directly
                        {crawlProgress.mapFallbackReason && (
                          <span style={{ color: "var(--color-muted)" }}> ({crawlProgress.mapFallbackReason})</span>
                        )}
                      </div>
                    )}

                    {/* Scraping URL hint */}
                    {crawlProgress.stage === "scraping" && crawlProgress.scrapeUrl && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          color: "var(--color-muted)",
                          marginBottom: 8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {crawlProgress.scrapeUrl}
                      </div>
                    )}

                    {/* Extracting URL hint */}
                    {crawlProgress.stage === "extracting" && crawlProgress.extractUrl && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 9,
                          color: "var(--color-muted)",
                          marginBottom: 8,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {crawlProgress.extractUrl}
                      </div>
                    )}

                    {/* Workflows found counter (during extracting) */}
                    {crawlProgress.stage === "extracting" && (crawlProgress.totalWorkflowsFound || 0) > 0 && (
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: "var(--color-success)",
                          marginBottom: 8,
                          fontWeight: 600,
                        }}
                      >
                        {crawlProgress.totalWorkflowsFound} workflow{crawlProgress.totalWorkflowsFound !== 1 ? "s" : ""} found so far
                      </div>
                    )}

                    {/* Per-workflow cards (decomposing stage) */}
                    {crawlProgress.stage === "decomposing" && crawlProgress.workflows && crawlProgress.workflows.length > 0 && (
                      <div
                        style={{
                          maxHeight: 240,
                          overflowY: "auto",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          paddingRight: 4,
                        }}
                      >
                        {crawlProgress.workflows.map((wf) => (
                          <div
                            key={wf.id}
                            style={{
                              padding: "8px 10px",
                              borderRadius: 6,
                              border: `1px solid ${
                                wf.status === "complete" ? "rgba(23,165,137,0.2)"
                                  : wf.status === "error" ? "rgba(232,85,58,0.2)"
                                  : wf.status === "analyzing" ? "rgba(45,125,210,0.2)"
                                  : "var(--color-border)"
                              }`,
                              background: wf.status === "complete" ? "rgba(23,165,137,0.04)"
                                : wf.status === "error" ? "rgba(232,85,58,0.04)"
                                : wf.status === "analyzing" ? "rgba(45,125,210,0.04)"
                                : "var(--color-surface)",
                              transition: "all 0.2s ease",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                              <span style={{ fontSize: 12, flexShrink: 0 }}>
                                {wf.status === "queued" && <span style={{ opacity: 0.4 }}>&#9203;</span>}
                                {wf.status === "analyzing" && (
                                  <span
                                    style={{
                                      width: 10,
                                      height: 10,
                                      border: "2px solid rgba(45,125,210,0.2)",
                                      borderTop: "2px solid var(--color-info)",
                                      borderRadius: "50%",
                                      animation: "spin 0.8s linear infinite",
                                      display: "inline-block",
                                    }}
                                  />
                                )}
                                {wf.status === "complete" && <span style={{ color: "var(--color-success)" }}>&#10003;</span>}
                                {wf.status === "error" && <span style={{ color: "var(--color-accent)" }}>&#10007;</span>}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    color: "var(--color-dark)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {wf.title}
                                </div>
                                <div
                                  style={{
                                    fontFamily: "var(--font-mono)",
                                    fontSize: 8,
                                    color: "var(--color-muted)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {wf.pageUrl}
                                </div>
                              </div>
                              {wf.status === "complete" && wf.steps !== undefined && (
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-success)", fontWeight: 600, flexShrink: 0 }}>
                                  {wf.steps}s / {wf.gaps}g / {wf.automationPotential}%
                                </div>
                              )}
                              {wf.status === "error" && (
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-accent)", flexShrink: 0 }}>
                                  Failed
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* ─ Complete ─ */}
                {crawlProgress.stage === "complete" && crawlProgress.summary && (
                  <div>
                    <div
                      style={{
                        padding: "16px",
                        background: "linear-gradient(135deg, rgba(23,165,137,0.06) 0%, rgba(45,125,210,0.04) 100%)",
                        borderRadius: 8,
                        border: "1px solid rgba(23,165,137,0.2)",
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--color-success)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          marginBottom: 10,
                        }}
                      >
                        Crawl Complete
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                        {[
                          { label: "Pages Scraped", value: crawlProgress.summary.pagesScraped },
                          { label: "Workflows Found", value: crawlProgress.summary.totalWorkflows },
                          { label: "Saved", value: crawlProgress.summary.workflowsSaved },
                        ].map((s) => (
                          <div key={s.label} style={{ textAlign: "center" }}>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 20, fontWeight: 700, color: "var(--color-dark)" }}>
                              {s.value}
                            </div>
                            <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                              {s.label}
                            </div>
                          </div>
                        ))}
                      </div>
                      {crawlProgress.summary.workflowsFailed > 0 && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-warning)", marginTop: 8 }}>
                          {crawlProgress.summary.workflowsFailed} workflow{crawlProgress.summary.workflowsFailed !== 1 ? "s" : ""} failed to decompose
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href="/library"
                        style={{
                          flex: 1,
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "none",
                          background: "linear-gradient(135deg, var(--color-accent) 0%, #F09060 100%)",
                          color: "var(--color-light)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: "center",
                          textDecoration: "none",
                          cursor: "pointer",
                          boxShadow: "0 2px 8px rgba(232,85,58,0.2)",
                        }}
                      >
                        View in Library &rarr;
                      </a>
                      <button
                        onClick={handleCrawlReset}
                        style={{
                          padding: "8px 16px",
                          borderRadius: 6,
                          border: "1px solid var(--color-border)",
                          background: "var(--color-surface)",
                          color: "var(--color-dark)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        New Crawl
                      </button>
                    </div>
                  </div>
                )}

                {/* ─ Error ─ */}
                {crawlProgress.stage === "error" && (
                  <div>
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "rgba(232,85,58,0.05)",
                        border: "1px solid rgba(232,85,58,0.2)",
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          fontWeight: 700,
                          color: "var(--color-accent)",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          marginBottom: 6,
                        }}
                      >
                        Crawl Failed
                      </div>
                      <div
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--color-text)",
                          lineHeight: 1.5,
                        }}
                      >
                        {crawlProgress.errorMessage || crawlError || "An unexpected error occurred."}
                      </div>
                    </div>
                    <button
                      onClick={handleCrawlReset}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 6,
                        border: "none",
                        background: "var(--color-dark)",
                        color: "var(--color-light)",
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      Try Again
                    </button>
                  </div>
                )}

                {/* Crawl error inline (e.g., rate limit before SSE starts) */}
                {crawlError && crawlProgress.stage === "idle" && (
                  <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-danger)", lineHeight: 1.5 }}>
                    {crawlError}
                  </div>
                )}
              </div>
            )}

            {/* ── File Upload tab ── */}
            {importTab === "file" && (
              <>
                <div
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    color: "var(--color-text)",
                    marginBottom: 8,
                    lineHeight: 1.5,
                  }}
                >
                  Upload a document to extract workflows from. Supports .txt, .md, .csv, .json, .pdf, .docx, .xlsx, and .xls.
                </div>

                {!filePreview && !extractionResults && (
                  <div>
                    {/* Drop zone / file input with drag-and-drop */}
                    <label
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!fileParsing && !disabled) setFileDragOver(true);
                      }}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!fileParsing && !disabled) setFileDragOver(true);
                      }}
                      onDragLeave={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFileDragOver(false);
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setFileDragOver(false);
                        if (fileParsing || disabled) return;
                        const droppedFile = e.dataTransfer.files?.[0];
                        if (droppedFile) handleFileSelect(droppedFile);
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "20px 16px",
                        borderRadius: 8,
                        border: fileDragOver
                          ? "2px dashed var(--color-info)"
                          : "2px dashed var(--color-border)",
                        background: fileDragOver
                          ? "rgba(45,125,210,0.06)"
                          : "var(--color-surface)",
                        cursor: fileParsing || disabled ? "not-allowed" : "pointer",
                        transition: "all 0.2s",
                        gap: 8,
                        opacity: fileParsing ? 0.6 : 1,
                      }}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".txt,.md,.log,.csv,.json,.pdf,.docx,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileSelect(file);
                        }}
                        disabled={fileParsing || disabled}
                        style={{ display: "none" }}
                      />
                      {fileParsing ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              border: "2px solid rgba(45,125,210,0.2)",
                              borderTop: "2px solid var(--color-info)",
                              borderRadius: "50%",
                              animation: "spin 0.8s linear infinite",
                              display: "inline-block",
                            }}
                          />
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-info)" }}>
                            Parsing file...
                          </span>
                        </div>
                      ) : (
                        <>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={fileDragOver ? "var(--color-info)" : "var(--color-muted)"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                          </svg>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: fileDragOver ? "var(--color-info)" : "var(--color-muted)" }}>
                            {fileDragOver ? "Drop file here" : "Drag & drop or click to select"}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted)", opacity: 0.6 }}>
                            .txt, .md, .csv, .json, .pdf, .docx, .xlsx, .xls &middot; max 10MB
                          </span>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* File error */}
                {fileError && (
                  <div
                    style={{
                      marginTop: 8,
                      padding: "8px 12px",
                      background: "rgba(232,85,58,0.05)",
                      border: "1px solid rgba(232,85,58,0.15)",
                      borderRadius: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: 11,
                      color: "var(--color-accent)",
                      lineHeight: 1.5,
                    }}
                  >
                    {fileError}
                  </div>
                )}

                {/* File preview card */}
                {filePreview && !extractionResults && (
                  <PreviewCard
                    headerLabel="File Loaded"
                    title={filePreview.title}
                    content={filePreview.content}
                    stats={`${filePreview.fileName} \u00b7 ${(filePreview.fileSizeBytes / 1024).toFixed(1)}KB \u00b7 ${filePreview.charCount.toLocaleString()} chars`}
                    truncated={filePreview.truncated}
                    originalLength={filePreview.originalLength}
                    onUseRaw={handleFileInsert}
                    onExtract={() => handleExtractWorkflows(filePreview.content, "file", filePreview.fileName)}
                    onCancel={handleFileCancelPreview}
                    extracting={extracting}
                  />
                )}
              </>
            )}

            {/* ── Extraction results (shared) ── */}
            {extractionResults && (
              <div style={{ marginTop: 4, animation: "fadeIn 0.25s ease" }}>
                <div style={{
                  padding: "12px 14px",
                  background: "var(--info-bg)",
                  border: "1px solid rgba(45,125,210,0.19)",
                  borderRadius: 8,
                }}>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10,
                  }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--color-info)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                        Workflows Found
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--color-dark)" }}>
                        {extractionResults.documentTitle}
                      </div>
                    </div>
                    <button
                      onClick={() => { setExtractionResults(null); }}
                      style={{ background: "none", border: "none", fontSize: 16, color: "var(--color-muted)", cursor: "pointer", padding: "2px 6px" }}
                    >
                      &times;
                    </button>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {extractionResults.workflows.map((wf) => (
                      <button
                        key={wf.id}
                        onClick={() => handleSelectExtracted(wf)}
                        style={{
                          textAlign: "left", padding: "10px 12px", borderRadius: 6,
                          border: "1px solid var(--color-border)", background: "var(--color-surface)",
                          cursor: "pointer", transition: "all 0.2s",
                          display: "flex", flexDirection: "column", gap: 4,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 700, color: "var(--color-dark)" }}>
                            {wf.title}
                          </span>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-info)", fontWeight: 600 }}>
                            Select &rarr;
                          </span>
                        </div>
                        {wf.summary && (
                          <div style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--color-text)", lineHeight: 1.4 }}>
                            {wf.summary}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 8, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted)" }}>
                          {wf.estimatedSteps && <span>~{wf.estimatedSteps} steps</span>}
                          {wf.confidence && (
                            <span style={{
                              color: wf.confidence === "high" ? "var(--color-success)" : wf.confidence === "medium" ? "var(--color-warning)" : "var(--color-muted)",
                            }}>
                              {wf.confidence} confidence
                            </span>
                          )}
                          {wf.sourceSection && <span>{wf.sourceSection}</span>}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Analyze All button — shown when 2+ workflows */}
                  {extractionResults.workflows.length >= 2 && (
                    <div style={{ marginTop: 10, borderTop: "1px solid rgba(45,125,210,0.12)", paddingTop: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-muted)" }}>
                        {extractionResults.workflows.length} workflows found
                      </span>
                      <button
                        onClick={handleAnalyzeAll}
                        disabled={disabled || analyzeAllProgress.stage === "analyzing"}
                        style={{
                          padding: "7px 16px",
                          borderRadius: 6,
                          border: "none",
                          background: disabled || analyzeAllProgress.stage === "analyzing" ? "var(--color-border)" : "var(--color-info)",
                          color: disabled || analyzeAllProgress.stage === "analyzing" ? "var(--color-muted)" : "var(--color-light)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: disabled || analyzeAllProgress.stage === "analyzing" ? "not-allowed" : "pointer",
                          transition: "all 0.2s",
                          letterSpacing: "0.04em",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <span style={{ fontSize: 13 }}>&#9654;</span>
                        Analyze All
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Analyze All: progress cards ── */}
            {analyzeAllProgress.stage === "analyzing" && analyzeAllProgress.workflows && (
              <div role="status" aria-live="polite" aria-label="Batch workflow analysis progress" style={{ marginTop: 4, animation: "fadeIn 0.25s ease" }}>
                <div style={{
                  padding: "12px 14px",
                  background: "var(--info-bg)",
                  border: "1px solid rgba(45,125,210,0.19)",
                  borderRadius: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: "var(--color-info)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2 }}>
                        Analyzing All Workflows
                      </div>
                      <div style={{ fontFamily: "var(--font-display)", fontSize: 13, fontWeight: 700, color: "var(--color-dark)" }}>
                        {analyzeAllProgress.workflows.filter((w) => w.status === "complete" || w.status === "error").length} of {analyzeAllProgress.total} complete
                      </div>
                    </div>
                    <button
                      onClick={() => { analyzeAllAbortRef.current?.abort(); }}
                      aria-label="Cancel batch analysis"
                      style={{
                        background: "none",
                        border: "1px solid var(--color-border)",
                        borderRadius: 4,
                        fontSize: 9,
                        fontFamily: "var(--font-mono)",
                        fontWeight: 600,
                        color: "var(--color-muted)",
                        cursor: "pointer",
                        padding: "4px 10px",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--color-accent)"; e.currentTarget.style.color = "var(--color-accent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-border)"; e.currentTarget.style.color = "var(--color-muted)"; }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Overall progress bar */}
                  <div style={{ height: 3, borderRadius: 2, background: "rgba(45,125,210,0.12)", marginBottom: 10, overflow: "hidden" }}>
                    <div style={{
                      width: `${(analyzeAllProgress.workflows.filter((w) => w.status === "complete" || w.status === "error").length / (analyzeAllProgress.total ?? 1)) * 100}%`,
                      height: "100%",
                      background: "var(--color-info)",
                      borderRadius: 2,
                      transition: "width 0.4s ease",
                    }} />
                  </div>

                  {/* Per-workflow status cards */}
                  <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
                    {analyzeAllProgress.workflows.map((wf) => {
                      const isComplete = wf.status === "complete" && wf.savedId;
                      const Tag = isComplete ? "a" : "div";
                      return (
                        <Tag
                          key={wf.id}
                          {...(isComplete ? { href: `/xray/${wf.savedId}`, target: "_blank", rel: "noopener noreferrer" } : {})}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 6,
                            textDecoration: "none",
                            cursor: isComplete ? "pointer" : "default",
                            border: `1px solid ${
                              wf.status === "complete" ? "rgba(23,165,137,0.2)"
                              : wf.status === "error" ? "rgba(232,85,58,0.2)"
                              : wf.status === "analyzing" ? "rgba(45,125,210,0.2)"
                              : "var(--color-border)"
                            }`,
                            background:
                              wf.status === "complete" ? "rgba(23,165,137,0.04)"
                              : wf.status === "error" ? "rgba(232,85,58,0.04)"
                              : wf.status === "analyzing" ? "rgba(45,125,210,0.06)"
                              : "var(--color-surface)",
                            transition: "all 0.2s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            {/* Status icon */}
                            <span style={{ fontSize: 12, flexShrink: 0 }}>
                              {wf.status === "queued" && <span style={{ opacity: 0.4 }}>&#9203;</span>}
                              {wf.status === "analyzing" && (
                                <span style={{
                                  width: 10, height: 10,
                                  border: "2px solid rgba(45,125,210,0.2)",
                                  borderTop: "2px solid var(--color-info)",
                                  borderRadius: "50%",
                                  animation: "spin 0.8s linear infinite",
                                  display: "inline-block",
                                }} />
                              )}
                              {wf.status === "complete" && <span style={{ color: "var(--color-success)" }}>&#10003;</span>}
                              {wf.status === "error" && <span style={{ color: "var(--color-accent)" }}>&#10007;</span>}
                            </span>
                            {/* Title */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
                                color: "var(--color-dark)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                              }}>
                                {wf.title}
                              </div>
                              {wf.status === "error" && wf.error && (
                                <div style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "var(--color-accent)", marginTop: 2, opacity: 0.8 }}>
                                  {wf.error}
                                </div>
                              )}
                            </div>
                            {/* Results or link indicator */}
                            {wf.status === "complete" && wf.steps !== undefined && (
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-success)", fontWeight: 600, flexShrink: 0, display: "flex", alignItems: "center", gap: 4 }}>
                                {wf.steps}s / {wf.gaps}g / {wf.automationPotential}%
                                <span style={{ fontSize: 8, opacity: 0.6 }}>&rarr;</span>
                              </div>
                            )}
                            {wf.status === "error" && (
                              <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-accent)", flexShrink: 0 }}>
                                Failed
                              </div>
                            )}
                          </div>
                        </Tag>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── Analyze All: completion summary ── */}
            {analyzeAllProgress.stage === "complete" && analyzeAllProgress.summary && (() => {
              const s = analyzeAllProgress.summary;
              const allGood = s.workflowsFailed === 0;
              return (
                <div role="status" aria-live="polite" aria-label="Batch analysis complete" style={{ marginTop: 4, animation: "fadeIn 0.25s ease" }}>
                  <div style={{
                    padding: "14px 16px",
                    background: allGood
                      ? "linear-gradient(135deg, rgba(23,165,137,0.06) 0%, rgba(45,125,210,0.04) 100%)"
                      : "linear-gradient(135deg, rgba(212,160,23,0.06) 0%, rgba(232,85,58,0.03) 100%)",
                    border: `1px solid ${allGood ? "rgba(23,165,137,0.2)" : "rgba(212,160,23,0.2)"}`,
                    borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                      <div>
                        <div style={{
                          fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                          color: allGood ? "var(--color-success)" : "var(--color-warning)",
                          letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 2,
                        }}>
                          {allGood ? "All Workflows Analyzed" : "Analysis Complete"}
                        </div>
                        <div style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--color-dark)" }}>
                          {s.workflowsSaved} workflow{s.workflowsSaved !== 1 ? "s" : ""} saved to library
                        </div>
                      </div>
                      <button
                        onClick={() => setAnalyzeAllProgress({ stage: "idle" })}
                        aria-label="Dismiss summary"
                        style={{ background: "none", border: "none", fontSize: 16, color: "var(--color-muted)", cursor: "pointer", padding: "2px 6px" }}
                      >
                        &times;
                      </button>
                    </div>

                    {/* Stats grid */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: s.workflowsFailed > 0 ? "repeat(5, 1fr)" : "repeat(4, 1fr)",
                      gap: 8,
                      marginBottom: 14,
                      padding: "10px 8px",
                      background: "rgba(255,255,255,0.5)",
                      borderRadius: 6,
                      border: "1px solid rgba(0,0,0,0.04)",
                    }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--color-success)" }}>
                          {s.workflowsSaved}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Saved
                        </div>
                      </div>
                      {s.workflowsFailed > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--color-accent)" }}>
                            {s.workflowsFailed}
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                            Failed
                          </div>
                        </div>
                      )}
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--color-dark)" }}>
                          {s.totalSteps}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Steps
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--color-warning)" }}>
                          {s.totalGaps}
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Gaps
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 18, fontWeight: 700, color: "var(--color-info)" }}>
                          {s.avgAutomation}%
                        </div>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "var(--color-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Avg Auto
                        </div>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {s.workflowsSaved > 0 && (
                        <a
                          href="/library"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "7px 16px",
                            borderRadius: 6,
                            background: "var(--color-success)",
                            color: "var(--color-light)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            textDecoration: "none",
                            transition: "all 0.2s",
                            letterSpacing: "0.04em",
                          }}
                        >
                          View in Library &rarr;
                        </a>
                      )}
                      {s.workflowsSaved > 0 && (
                        <button
                          onClick={handleBatchPdfExport}
                          disabled={batchExporting}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 6,
                            border: "1px solid var(--color-info)",
                            background: batchExporting ? "var(--color-border)" : "transparent",
                            color: batchExporting ? "var(--color-muted)" : "var(--color-info)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: batchExporting ? "not-allowed" : "pointer",
                            transition: "all 0.2s",
                            letterSpacing: "0.04em",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            opacity: batchExporting ? 0.7 : 1,
                          }}
                        >
                          {batchExporting ? (
                            <>
                              <span style={{
                                width: 12,
                                height: 12,
                                border: "2px solid rgba(45,125,210,0.2)",
                                borderTop: "2px solid var(--color-info)",
                                borderRadius: "50%",
                                animation: "spin 0.8s linear infinite",
                                display: "inline-block",
                              }} />
                              Generating PDF...
                            </>
                          ) : (
                            <>&#128196; Download PDF</>
                          )}
                        </button>
                      )}
                      {s.workflowsFailed > 0 && s.failedWorkflows && (
                        <button
                          onClick={handleRetryFailed}
                          style={{
                            padding: "7px 16px",
                            borderRadius: 6,
                            border: "1px solid var(--color-warning)",
                            background: "transparent",
                            color: "var(--color-warning)",
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: "pointer",
                            transition: "all 0.2s",
                            letterSpacing: "0.04em",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          &#8635; Retry {s.workflowsFailed} Failed
                        </button>
                      )}
                      <button
                        onClick={() => setAnalyzeAllProgress({ stage: "idle" })}
                        style={{
                          padding: "7px 16px",
                          borderRadius: 6,
                          border: "1px solid var(--color-border)",
                          background: "transparent",
                          color: "var(--color-text)",
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          transition: "all 0.2s",
                          letterSpacing: "0.04em",
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Extracting spinner */}
            {extracting && (
              <div style={{
                marginTop: 8, padding: "12px", textAlign: "center",
                fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-info)",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
                <span style={{ width: 14, height: 14, border: "2px solid rgba(45,125,210,0.2)", borderTop: "2px solid var(--color-info)", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />
                Extracting workflows...
              </div>
            )}

            {/* Errors */}
            {(importError || urlError || extractionError) && (
              <div style={{ marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-danger)", lineHeight: 1.5 }}>
                {importError || urlError || extractionError}
              </div>
            )}
          </div>
        )}
      </div>

      {/* =================================================================
          Template Library
          ================================================================= */}
      <div style={{ marginTop: 32 }}>
        {/* Section heading */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 16,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fontWeight: 700,
              color: "var(--color-muted)",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Workflow Templates
          </span>
          <span
            style={{
              flex: 1,
              height: 1,
              background:
                "linear-gradient(90deg, var(--color-border), transparent)",
            }}
          />
        </div>

        {/* Category filter pills ------------------------------------------ */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 6,
            marginBottom: 20,
          }}
        >
          {/* "All" pill */}
          {(["All", ...populatedCategories] as const).map((cat) => {
            const isActive = activeCategory === cat;
            const isHover = hoveredPill === cat;
            const accentColor =
              cat === "All"
                ? "var(--color-accent)"
                : CATEGORY_COLORS[cat as Category];

            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as Category | "All")}
                onMouseEnter={() => !disabled && setHoveredPill(cat)}
                onMouseLeave={() => !disabled && setHoveredPill(null)}
                disabled={disabled}
                style={{
                  padding: "5px 14px",
                  borderRadius: 999,
                  border: `1.5px solid ${
                    isActive
                      ? accentColor
                      : isHover
                        ? accentColor
                        : "var(--color-border)"
                  }`,
                  background: isActive
                    ? accentColor
                    : isHover
                      ? `${accentColor}0D` // ~5% opacity
                      : "var(--color-surface)",
                  color: isActive
                    ? "var(--color-light)"
                    : isHover
                      ? accentColor
                      : "var(--color-text)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: disabled ? "not-allowed" : "pointer",
                  transition: "all 0.2s cubic-bezier(0.4,0,0.2,1)",
                  transform: isHover && !isActive ? "translateY(-1px)" : "none",
                  letterSpacing: "0.02em",
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Grouped template cards ----------------------------------------- */}
        {grouped.map(({ category, templates }) => (
          <div key={category} style={{ marginBottom: 20 }}>
            {/* Category sub-header (only when showing "All") */}
            {activeCategory === "All" && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: CATEGORY_COLORS[category],
                    display: "inline-block",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--color-dark)",
                    letterSpacing: "0.04em",
                  }}
                >
                  {category}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    color: "var(--color-muted)",
                    marginLeft: 2,
                  }}
                >
                  {templates.length}
                </span>
              </div>
            )}

            {/* Card grid */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              {templates.map((tpl) => {
                const globalIdx = TEMPLATES.indexOf(tpl);
                const isHover = hoveredCard === globalIdx;
                const accent = CATEGORY_COLORS[tpl.category];

                return (
                  <button
                    key={globalIdx}
                    onClick={() => onChange(tpl.prompt)}
                    onMouseEnter={() => !disabled && setHoveredCard(globalIdx)}
                    onMouseLeave={() => !disabled && setHoveredCard(null)}
                    disabled={disabled}
                    style={{
                      textAlign: "left",
                      padding: 0,
                      borderRadius: "var(--radius-lg)",
                      border: `1.5px solid ${
                        isHover ? accent : "var(--color-border)"
                      }`,
                      background: "var(--color-surface)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition:
                        "all 0.25s cubic-bezier(0.4,0,0.2,1)",
                      transform: isHover
                        ? "translateY(-3px)"
                        : "translateY(0)",
                      boxShadow: isHover
                        ? `0 12px 32px -8px rgba(0,0,0,0.10), 0 0 0 1px ${accent}22`
                        : "0 1px 3px rgba(0,0,0,0.04)",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    {/* Top accent bar */}
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        right: 0,
                        height: 3,
                        background: accent,
                        opacity: isHover ? 1 : 0,
                        transition: "opacity 0.25s",
                      }}
                    />

                    <div style={{ padding: "16px 16px 14px" }}>
                      {/* Icon + name row */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 22,
                            lineHeight: 1,
                            flexShrink: 0,
                            width: 36,
                            height: 36,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            borderRadius: "var(--radius-sm)",
                            background: `${accent}0F`, // ~6% opacity
                            transition: "background 0.25s",
                            ...(isHover
                              ? { background: `${accent}1A` } // ~10%
                              : {}),
                          }}
                        >
                          {tpl.icon}
                        </span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 13,
                            fontWeight: 700,
                            color: "var(--color-dark)",
                            lineHeight: 1.3,
                          }}
                        >
                          {tpl.name}
                        </span>
                      </div>

                      {/* Description */}
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 12,
                          color: "var(--color-muted)",
                          lineHeight: 1.5,
                          margin: 0,
                        }}
                      >
                        {tpl.description}
                      </p>
                    </div>

                    {/* Footer */}
                    <div
                      style={{
                        padding: "8px 16px",
                        borderTop: `1px solid ${
                          isHover ? `${accent}22` : "var(--color-border)"
                        }`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "border-color 0.25s",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: isHover ? accent : "var(--color-muted)",
                          fontWeight: 600,
                          letterSpacing: "0.04em",
                          transition: "color 0.25s",
                        }}
                      >
                        {tpl.category}
                      </span>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 10,
                          color: isHover ? accent : "var(--color-muted)",
                          transition: "color 0.25s, transform 0.25s",
                          transform: isHover
                            ? "translateX(2px)"
                            : "translateX(0)",
                          display: "inline-block",
                        }}
                      >
                        Use template &rarr;
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
