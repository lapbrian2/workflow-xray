/**
 * Analysis Cache Library (CACH-01 through CACH-04 foundation)
 *
 * Content hash computation, cache get/set against Vercel KV (or in-memory fallback).
 * Hash identity is based on: normalized description, stages, teamSize, promptVersion, modelId.
 * hourlyRate and hoursPerStep are excluded (they don't affect Claude's analysis output).
 */

import { createHash } from "crypto";
import type { Decomposition } from "./types";
import type { DecomposeMetadata } from "./decompose";

// ─── CacheEntry interface ───

export interface CacheEntry {
  hash: string;
  decomposition: Decomposition;
  metadata: DecomposeMetadata;
  cachedAt: string; // ISO timestamp
  hitCount: number;
}

// ─── Hash computation ───

interface HashInput {
  description: string;
  stages?: { name: string; owner?: string; tools?: string; inputs?: string; outputs?: string }[];
  costContext?: { teamSize?: number; hourlyRate?: number; hoursPerStep?: number; [key: string]: unknown };
}

/**
 * Compute a content hash for analysis cache identity.
 * Normalizes description (trim, collapse whitespace, lowercase).
 * Includes stringified stages, teamSize, promptVersion, and modelId.
 * Returns first 16 hex chars of SHA-256.
 */
export function computeAnalysisHash(
  input: HashInput,
  promptVersion: string,
  modelId: string
): string {
  // Normalize description: trim, collapse internal whitespace, lowercase
  const normalizedDescription = input.description
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  // Include stages (or empty array)
  const stages = JSON.stringify(input.stages ?? []);

  // Only include teamSize from costContext (hourlyRate/hoursPerStep don't affect analysis)
  const teamSize = String(input.costContext?.teamSize ?? "");

  const hashInput = [normalizedDescription, stages, teamSize, promptVersion, modelId].join("|");

  return createHash("sha256").update(hashInput).digest("hex").slice(0, 16);
}

// ─── In-memory fallback (same globalThis pattern as db.ts) ───

const globalStore = globalThis as unknown as {
  __analysisCacheStore?: Map<string, CacheEntry>;
};
if (!globalStore.__analysisCacheStore) {
  globalStore.__analysisCacheStore = new Map<string, CacheEntry>();
}
const memoryCache = globalStore.__analysisCacheStore;

// ─── KV helper (same pattern as db.ts) ───

async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import("@vercel/kv");
    return kv;
  }
  return null;
}

type CacheBackend = "kv" | "memory";

async function getCacheBackend(): Promise<CacheBackend> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return "kv";
  }
  // Fall back to memory storage — works for dev and when KV isn't configured
  return "memory";
}

const CACHE_TTL_SECONDS = 604800; // 7 days

// ─── Cache get ───

/**
 * Retrieve a cached analysis by hash.
 * Returns null on miss. Increments hitCount on hit.
 */
export async function getCachedAnalysis(hash: string): Promise<CacheEntry | null> {
  const backend = await getCacheBackend();
  const key = `cache:${hash}`;

  if (backend === "kv") {
    const kv = (await getKv())!;
    const raw = await kv.get(key);
    if (!raw) return null;

    const entry: CacheEntry =
      typeof raw === "string" ? JSON.parse(raw) : (raw as CacheEntry);

    // Increment hitCount
    entry.hitCount += 1;
    await kv.set(key, JSON.stringify(entry), { ex: CACHE_TTL_SECONDS });
    return entry;
  }

  // Memory backend
  const entry = memoryCache.get(key);
  if (!entry) return null;

  // Increment hitCount (mutate in place — same reference in Map)
  entry.hitCount += 1;
  return { ...entry }; // Return copy to prevent external mutation
}

// ─── Cache set ───

/**
 * Store an analysis in the cache.
 * Uses 7-day TTL when backed by Vercel KV.
 */
export async function setCachedAnalysis(hash: string, entry: CacheEntry): Promise<void> {
  const backend = await getCacheBackend();
  const key = `cache:${hash}`;

  if (backend === "kv") {
    const kv = (await getKv())!;
    await kv.set(key, JSON.stringify(entry), { ex: CACHE_TTL_SECONDS });
    return;
  }

  // Memory backend — store directly (no TTL needed for dev/tests)
  memoryCache.set(key, { ...entry }); // Store copy to prevent external mutation
}
