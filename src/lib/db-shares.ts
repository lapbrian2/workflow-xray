/**
 * Share link KV CRUD operations.
 *
 * Follows the same storage backend pattern as db.ts:
 *   KV (Vercel KV / Upstash) > Memory fallback (explicit opt-in only)
 *
 * Key schema:
 *   share:{token}                → JSON-encoded ShareLink
 *   workflow:{workflowId}:shares → Set of token strings (secondary index)
 */

import type { ShareLink } from "./types";

// ─── In-memory fallback (local dev ONLY — requires explicit opt-in) ───

const globalStore = globalThis as unknown as {
  __shareStore?: Map<string, ShareLink>;
  __shareIndex?: Map<string, Set<string>>;
};
if (!globalStore.__shareStore) {
  globalStore.__shareStore = new Map<string, ShareLink>();
}
if (!globalStore.__shareIndex) {
  globalStore.__shareIndex = new Map<string, Set<string>>();
}
const memoryStore = globalStore.__shareStore;
const memoryIndex = globalStore.__shareIndex;

// ─── KV access ───

async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import("@vercel/kv");
    return kv;
  }
  return null;
}

type StorageBackend = "kv" | "memory";

async function getBackend(): Promise<StorageBackend> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return "kv";
  }
  if (process.env.ALLOW_MEMORY_STORAGE === "true") {
    console.warn(
      "[db-shares] WARNING: Using in-memory storage. Data will NOT persist across serverless cold starts."
    );
    return "memory";
  }
  throw new Error(
    "No storage backend configured. Set KV_REST_API_URL + KV_REST_API_TOKEN, " +
      "or ALLOW_MEMORY_STORAGE=true for local development."
  );
}

// ─── Internal: raw read without access-count side effects ───

async function _getShareLinkRaw(token: string): Promise<ShareLink | null> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    const raw = await kv.get(`share:${token}`);
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as ShareLink;
      } catch {
        return null;
      }
    }
    return raw as ShareLink;
  }

  // Memory fallback
  return memoryStore.get(token) ?? null;
}

// ─── CREATE ───

export async function createShareLink(
  workflowId: string,
  label?: string,
  expiresInDays?: number
): Promise<ShareLink> {
  const backend = await getBackend();
  const now = new Date().toISOString();

  const shareLink: ShareLink = {
    token: crypto.randomUUID(),
    workflowId,
    label,
    createdAt: now,
    expiresAt: expiresInDays
      ? new Date(Date.now() + expiresInDays * 86400 * 1000).toISOString()
      : undefined,
    accessCount: 0,
    permissions: "readonly",
  };

  if (backend === "kv") {
    const kv = (await getKv())!;
    const kvOptions = expiresInDays ? { ex: expiresInDays * 86400 } : undefined;
    await kv.set(`share:${shareLink.token}`, JSON.stringify(shareLink), kvOptions);
    await kv.sadd(`workflow:${workflowId}:shares`, shareLink.token);
    return shareLink;
  }

  // Memory fallback
  memoryStore.set(shareLink.token, shareLink);
  if (!memoryIndex.has(workflowId)) {
    memoryIndex.set(workflowId, new Set());
  }
  memoryIndex.get(workflowId)!.add(shareLink.token);
  return shareLink;
}

// ─── GET (with access-count increment) ───

export async function getShareLink(token: string): Promise<ShareLink | null> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    const raw = await kv.get(`share:${token}`);
    if (!raw) return null;

    let shareLink: ShareLink;
    if (typeof raw === "string") {
      try {
        shareLink = JSON.parse(raw) as ShareLink;
      } catch {
        return null;
      }
    } else {
      shareLink = raw as ShareLink;
    }

    // Best-effort access count update
    try {
      shareLink.accessCount = (shareLink.accessCount || 0) + 1;
      shareLink.lastAccessedAt = new Date().toISOString();

      // Preserve existing TTL if set
      const remainingTtl = await kv.ttl(`share:${token}`);
      const kvOptions = remainingTtl > 0 ? { ex: remainingTtl } : undefined;
      await kv.set(`share:${token}`, JSON.stringify(shareLink), kvOptions);
    } catch {
      // Best-effort — do not throw if update fails
    }

    return shareLink;
  }

  // Memory fallback
  const shareLink = memoryStore.get(token) ?? null;
  if (shareLink) {
    // Check expiry for memory store (KV handles TTL natively)
    if (shareLink.expiresAt && new Date(shareLink.expiresAt) < new Date()) {
      memoryStore.delete(token);
      return null;
    }
    shareLink.accessCount = (shareLink.accessCount || 0) + 1;
    shareLink.lastAccessedAt = new Date().toISOString();
  }
  return shareLink;
}

// ─── LIST ───

export async function listShareLinks(workflowId: string): Promise<ShareLink[]> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    const tokens: string[] = await kv.smembers(`workflow:${workflowId}:shares`);
    if (!tokens || tokens.length === 0) return [];

    const results = await Promise.all(
      tokens.map(async (token) => {
        const link = await _getShareLinkRaw(token);
        if (!link) {
          // Clean up stale token from the set
          try {
            await kv.srem(`workflow:${workflowId}:shares`, token);
          } catch {
            // Best-effort cleanup
          }
        }
        return link;
      })
    );

    const validLinks = results.filter(Boolean) as ShareLink[];
    // Sort by createdAt descending (newest first)
    validLinks.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return validLinks;
  }

  // Memory fallback
  const tokenSet = memoryIndex.get(workflowId);
  if (!tokenSet || tokenSet.size === 0) return [];

  const validLinks: ShareLink[] = [];
  for (const token of tokenSet) {
    const link = memoryStore.get(token);
    if (link) {
      // Check expiry
      if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
        memoryStore.delete(token);
        tokenSet.delete(token);
        continue;
      }
      validLinks.push(link);
    } else {
      tokenSet.delete(token);
    }
  }

  validLinks.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return validLinks;
}

// ─── DELETE ───

export async function deleteShareLink(token: string): Promise<boolean> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    // Get the share link first to know the workflowId
    const shareLink = await _getShareLinkRaw(token);
    await kv.del(`share:${token}`);
    if (shareLink) {
      await kv.srem(`workflow:${shareLink.workflowId}:shares`, token);
    }
    return true;
  }

  // Memory fallback
  const shareLink = memoryStore.get(token);
  memoryStore.delete(token);
  if (shareLink) {
    const tokenSet = memoryIndex.get(shareLink.workflowId);
    if (tokenSet) {
      tokenSet.delete(token);
      if (tokenSet.size === 0) {
        memoryIndex.delete(shareLink.workflowId);
      }
    }
  }
  return true;
}

// ─── DELETE ALL FOR WORKFLOW ───

export async function deleteShareLinksForWorkflow(
  workflowId: string
): Promise<number> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    const tokens: string[] = await kv.smembers(`workflow:${workflowId}:shares`);
    if (!tokens || tokens.length === 0) return 0;

    await Promise.all(tokens.map((token) => kv.del(`share:${token}`)));
    await kv.del(`workflow:${workflowId}:shares`);
    return tokens.length;
  }

  // Memory fallback
  const tokenSet = memoryIndex.get(workflowId);
  if (!tokenSet || tokenSet.size === 0) return 0;

  const count = tokenSet.size;
  for (const token of tokenSet) {
    memoryStore.delete(token);
  }
  memoryIndex.delete(workflowId);
  return count;
}
