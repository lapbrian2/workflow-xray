"use client";

import { useState, useCallback, useRef } from "react";

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
          Page Fetched
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
    try {
      const res = await fetch("/api/notion-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageUrl: notionUrl.trim() }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Import failed");
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
  }, [notionUrl, importing]);

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
  } | null>(null);

  // ─── Import tab state ───
  const [importTab, setImportTab] = useState<"notion" | "url">("notion");

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
  } | null>(null);
  const [extractionError, setExtractionError] = useState<string | null>(null);
  const extractLock = useRef(false);

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
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch URL");
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
  }, [urlInput, urlFetching]);

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
    async (content: string, sourceType: "notion" | "url" | "text", sourceUrl?: string) => {
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
          throw new Error(err.error || "Extraction failed");
        }
        const data = await res.json();
        if (!data.workflows || data.workflows.length === 0) {
          setExtractionError("No workflows found in this document. Try a page that describes a process or procedure.");
        } else {
          setExtractionResults({
            documentTitle: data.documentTitle || "Untitled",
            workflows: data.workflows,
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
            onSubmit();
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
              {(["notion", "url"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setImportTab(tab)}
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
                  {tab === "notion" ? "Notion" : "URL"}
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

                {/* URL preview card */}
                {urlPreview && !extractionResults && (
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
                </div>
              </div>
            )}

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
                onMouseEnter={() => setHoveredPill(cat)}
                onMouseLeave={() => setHoveredPill(null)}
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
                    onMouseEnter={() => setHoveredCard(globalIdx)}
                    onMouseLeave={() => setHoveredCard(null)}
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
