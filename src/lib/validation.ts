/**
 * Zod validation schemas for all API route inputs.
 * INFR-04: Every API route validates input with Zod before processing.
 *
 * Uses Zod v4 syntax (error param, not message).
 */

import { z } from "zod";

// ─── /api/auth ───

export const AuthLoginSchema = z.object({
  password: z.string().min(1, { error: "Password is required." }),
});
export type AuthLoginInput = z.infer<typeof AuthLoginSchema>;

// ─── /api/decompose ───

export const DecomposeInputSchema = z.object({
  description: z
    .string()
    .min(1, { error: "Workflow description is required." })
    .max(15000, {
      error: "Workflow description is too long (max 15,000 characters).",
    }),
  stages: z
    .array(
      z.object({
        name: z.string().max(500),
        owner: z.string().max(200).optional(),
        tools: z.string().max(500).optional(),
        inputs: z.string().max(500).optional(),
        outputs: z.string().max(500).optional(),
      })
    )
    .max(20)
    .optional(),
  context: z.string().max(5000).optional(),
  parentId: z.string().optional(),
  skipCache: z.boolean().optional(),
  costContext: z
    .object({
      hourlyRate: z.number().min(0).max(10000).optional(),
      hoursPerStep: z.number().min(0).max(1000).optional(),
      teamSize: z.number().int().min(1).max(10000).optional(),
      teamContext: z.string().max(200).optional(),
    })
    .optional(),
});
export type DecomposeInput = z.infer<typeof DecomposeInputSchema>;

// ─── /api/workflows (POST — save) ───

export const WorkflowSaveSchema = z.object({
  id: z.string().min(1),
  decomposition: z.object({
    id: z.string(),
    title: z.string(),
    steps: z.array(z.object({}).passthrough()),
    gaps: z.array(z.object({}).passthrough()),
    health: z.object({
      complexity: z.number(),
      fragility: z.number(),
      automationPotential: z.number(),
      teamLoadBalance: z.number(),
    }),
  }).passthrough(),
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}).passthrough(); // Allow extra fields like parentId, version, costContext, etc.
export type WorkflowSaveInput = z.infer<typeof WorkflowSaveSchema>;

// ─── /api/workflows (DELETE — query params) ───

export const WorkflowDeleteParamsSchema = z.object({
  id: z.string().min(1, { error: "Workflow ID is required." }),
});
export type WorkflowDeleteParams = z.infer<typeof WorkflowDeleteParamsSchema>;

// ─── /api/compare ───

export const CompareSchema = z.object({
  before: z.object({}).passthrough(),
  after: z.object({}).passthrough(),
});
export type CompareInput = z.infer<typeof CompareSchema>;

// ─── /api/remediation ───

export const RemediationInputSchema = z.object({
  workflowId: z.string().min(1, { error: "workflowId is required." }),
  teamContext: z
    .object({
      teamSize: z.number().int().min(1).optional(),
      budget: z.string().max(200).optional(),
      timeline: z.string().max(200).optional(),
      constraints: z.array(z.string().max(200)).max(10).optional(),
    })
    .optional(),
});
export type RemediationInput = z.infer<typeof RemediationInputSchema>;

// ─── /api/notion-import ───

export const NotionImportSchema = z.object({
  pageUrl: z.string().min(1, { error: "Notion page URL or ID is required." }),
});
export type NotionImportInput = z.infer<typeof NotionImportSchema>;

// ─── /api/notion-sync ───

export const NotionSyncSchema = z.object({
  workflow: z.object({
    id: z.string(),
    decomposition: z.object({}).passthrough(),
    description: z.string().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  }).passthrough(),
  appUrl: z.string().optional(),
  notionPageId: z.string().optional(),
  department: z.string().max(100).optional(),
  client: z.string().max(200).optional(),
});
export type NotionSyncInput = z.infer<typeof NotionSyncSchema>;

// ─── /api/remediation-notion-sync ───

export const RemediationNotionSyncSchema = z.object({
  plan: z.object({
    id: z.string(),
    workflowId: z.string(),
    title: z.string(),
    summary: z.string(),
    phases: z.array(z.object({}).passthrough()),
  }).passthrough(),
  gaps: z.array(
    z.object({
      type: z.string(),
      severity: z.string(),
    }).passthrough()
  ).optional(),
  workflowTitle: z.string().optional(),
  notionPageId: z.string().optional(),
});
export type RemediationNotionSyncInput = z.infer<typeof RemediationNotionSyncSchema>;

// ─── /api/extract-workflows ───

export const ExtractWorkflowsSchema = z.object({
  content: z
    .string()
    .min(1, { error: "Content is required." })
    .max(50000, { error: "Content too long (max 50,000 characters)." }),
  sourceUrl: z.string().optional(),
  sourceType: z.string().optional(),
});
export type ExtractWorkflowsInput = z.infer<typeof ExtractWorkflowsSchema>;

// ─── /api/extract-from-screenshot ───

export const ExtractFromScreenshotSchema = z.object({
  screenshot: z
    .string()
    .min(1, { error: "Screenshot data is required." }),
  sourceUrl: z.string().optional(),
  additionalContext: z.string().max(5000).optional(),
});
export type ExtractFromScreenshotInput = z.infer<typeof ExtractFromScreenshotSchema>;

// ─── /api/scrape-url ───

export const ScrapeUrlSchema = z.object({
  url: z.string().min(1, { error: "URL is required." }),
});
export type ScrapeUrlInput = z.infer<typeof ScrapeUrlSchema>;

// ─── /api/crawl-site ───

export const CrawlSiteSchema = z.object({
  url: z.string().min(1, { error: "URL is required." }),
  maxPages: z.number().int().min(1).max(50).optional(),
  autoDecompose: z.boolean().optional(),
});
export type CrawlSiteInput = z.infer<typeof CrawlSiteSchema>;

// ─── /api/parse-file (post-FormData extraction validation) ───

export const ParseFileMetaSchema = z.object({
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().min(0),
});
export type ParseFileMeta = z.infer<typeof ParseFileMetaSchema>;

// ─── /api/shares (POST -- create share link) ───

export const CreateShareLinkSchema = z.object({
  workflowId: z.string().min(1, { error: "Workflow ID is required." }),
  label: z.string().max(200).optional(),
  expiresInDays: z.number().int().min(1).max(365).optional(),
});
export type CreateShareLinkInput = z.infer<typeof CreateShareLinkSchema>;

// ─── /api/shares (DELETE -- revoke share link) ───

export const DeleteShareLinkSchema = z.object({
  token: z.string().min(1, { error: "Share token is required." }),
});
export type DeleteShareLinkInput = z.infer<typeof DeleteShareLinkSchema>;
