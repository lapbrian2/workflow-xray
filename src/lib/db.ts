import type { Workflow } from "./types";

// ─── In-memory fallback (local dev ONLY — requires explicit opt-in) ───
// Use globalThis to survive between warm invocations on serverless
const globalStore = globalThis as unknown as {
  __workflowStore?: Map<string, Workflow>;
};
if (!globalStore.__workflowStore) {
  globalStore.__workflowStore = new Map<string, Workflow>();
}
const memoryStore = globalStore.__workflowStore;

// ─── Blob-based persistence (Vercel Blob) ───
async function getBlob() {
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return await import("@vercel/blob");
  }
  return null;
}

// ─── KV-based persistence (Vercel KV / Upstash) ───
async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import("@vercel/kv");
    return kv;
  }
  return null;
}

// Determine storage backend priority: KV > Blob > Memory (explicit opt-in only)
type StorageBackend = "kv" | "blob" | "memory";

async function getBackend(): Promise<StorageBackend> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return "kv";
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return "blob";
  }
  // INFR-01: Fail hard when no storage is configured — no silent data loss
  if (process.env.ALLOW_MEMORY_STORAGE === "true") {
    console.warn(
      "[db] WARNING: Using in-memory storage. Data will NOT persist across serverless cold starts."
    );
    return "memory";
  }
  throw new Error(
    "No storage backend configured. Set KV_REST_API_URL + KV_REST_API_TOKEN, " +
      "BLOB_READ_WRITE_TOKEN, or ALLOW_MEMORY_STORAGE=true for local development."
  );
}

const BLOB_PREFIX = "workflows/";

// ─── KV ID Migration: Array → Redis Set (one-time) ───
let idsMigrated = false;

async function migrateIdsToSet(
  kv: Awaited<ReturnType<typeof getKv>> & object
): Promise<void> {
  if (idsMigrated) return;
  idsMigrated = true;

  try {
    const raw = await kv.get("workflow:ids");
    if (raw === null) return;

    let ids: string[] = [];
    if (Array.isArray(raw)) {
      ids = raw;
    } else if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          ids = parsed;
        }
      } catch {
        return;
      }
    } else {
      return;
    }

    if (ids.length > 0) {
      // Delete old key first to avoid WRONGTYPE error
      await kv.del("workflow:ids");
      // SADD all existing IDs atomically — cast needed for @vercel/kv's rest parameter typing
      await (kv.sadd as (key: string, ...members: string[]) => Promise<number>)(
        "workflow:ids",
        ...ids
      );
      console.log(
        `[db] Migrated ${ids.length} workflow IDs from array to Redis Set`
      );
    }
  } catch (error) {
    console.warn("[db] ID migration skipped:", error);
  }
}

// ─── SAVE ───
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    await kv.set(`workflow:${workflow.id}`, JSON.stringify(workflow));
    // SADD is atomic and idempotent — no race condition
    await kv.sadd("workflow:ids", workflow.id);
    return;
  }

  if (backend === "blob") {
    const blob = (await getBlob())!;
    await blob.put(
      `${BLOB_PREFIX}${workflow.id}.json`,
      JSON.stringify(workflow),
      {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      }
    );
    return;
  }

  // Memory fallback (explicit opt-in only)
  memoryStore.set(workflow.id, workflow);
}

// ─── GET ───
export async function getWorkflow(id: string): Promise<Workflow | null> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    const raw = await kv.get(`workflow:${id}`);
    if (!raw) return null;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as Workflow;
      } catch {
        return null;
      }
    }
    return raw as Workflow;
  }

  if (backend === "blob") {
    const blob = (await getBlob())!;
    try {
      const { blobs } = await blob.list({
        prefix: `${BLOB_PREFIX}${id}.json`,
      });
      if (blobs.length === 0) return null;
      const res = await fetch(blobs[0].url);
      if (!res.ok) return null;
      return (await res.json()) as Workflow;
    } catch {
      return null;
    }
  }

  return memoryStore.get(id) || null;
}

// ─── LIST ───
export async function listWorkflows(
  search?: string,
  limit = 100
): Promise<Workflow[]> {
  const backend = await getBackend();
  let workflows: Workflow[] = [];

  if (backend === "kv") {
    const kv = (await getKv())!;
    // Run one-time migration from array to Set (if needed)
    await migrateIdsToSet(kv);
    // SMEMBERS returns all set members as an array — atomic read
    const ids: string[] = await kv.smembers("workflow:ids");
    const results = await Promise.all(ids.map((wid) => getWorkflow(wid)));
    workflows = results.filter(Boolean) as Workflow[];
  } else if (backend === "blob") {
    const blob = (await getBlob())!;
    try {
      const { blobs } = await blob.list({ prefix: BLOB_PREFIX });
      const results = await Promise.all(
        blobs.map(async (b) => {
          try {
            const res = await fetch(b.url);
            if (!res.ok) return null;
            return (await res.json()) as Workflow;
          } catch {
            return null;
          }
        })
      );
      workflows = results.filter(Boolean) as Workflow[];
    } catch {
      workflows = [];
    }
  } else {
    workflows = Array.from(memoryStore.values());
  }

  // Sort by most recent first
  workflows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Optional search filter (cap at 200 chars to prevent DoS via large search strings)
  if (search) {
    const q = search.slice(0, 200).toLowerCase();
    workflows = workflows.filter(
      (w) =>
        w.decomposition.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
    );
  }

  return workflows.slice(0, limit);
}

// ─── DELETE ───
export async function deleteWorkflow(id: string): Promise<boolean> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    await kv.del(`workflow:${id}`);
    // SREM is atomic — no race condition
    await kv.srem("workflow:ids", id);
    return true;
  }

  if (backend === "blob") {
    const blob = (await getBlob())!;
    try {
      const { blobs } = await blob.list({
        prefix: `${BLOB_PREFIX}${id}.json`,
      });
      if (blobs.length > 0) {
        await blob.del(blobs[0].url);
      }
      return true;
    } catch {
      return false;
    }
  }

  return memoryStore.delete(id);
}
