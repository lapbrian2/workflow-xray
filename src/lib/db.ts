import type { Workflow } from "./types";

// ─── In-memory fallback (local dev / when no cloud storage configured) ───
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

// Determine storage backend priority: KV > Blob > Memory
type StorageBackend = "kv" | "blob" | "memory";

async function getBackend(): Promise<StorageBackend> {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    return "kv";
  }
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    return "blob";
  }
  return "memory";
}

const BLOB_PREFIX = "workflows/";

// ─── SAVE ───
export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const backend = await getBackend();

  if (backend === "kv") {
    const kv = (await getKv())!;
    await kv.set(`workflow:${workflow.id}`, JSON.stringify(workflow));
    let ids: string[] = [];
    const raw = await kv.get("workflow:ids");
    if (Array.isArray(raw)) {
      ids = raw;
    } else if (typeof raw === "string") {
      try {
        ids = JSON.parse(raw);
      } catch {
        ids = [];
      }
    }
    if (!ids.includes(workflow.id)) {
      ids.push(workflow.id);
      await kv.set("workflow:ids", ids);
    }
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

  // Memory fallback
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
      const { blobs } = await blob.list({ prefix: `${BLOB_PREFIX}${id}.json` });
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
export async function listWorkflows(search?: string, limit = 100): Promise<Workflow[]> {
  const backend = await getBackend();
  let workflows: Workflow[] = [];

  if (backend === "kv") {
    const kv = (await getKv())!;
    let ids: string[] = [];
    const raw = await kv.get("workflow:ids");
    if (Array.isArray(raw)) {
      ids = raw;
    } else if (typeof raw === "string") {
      try {
        ids = JSON.parse(raw);
      } catch {
        ids = [];
      }
    }
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
    let ids: string[] = [];
    const raw = await kv.get("workflow:ids");
    if (Array.isArray(raw)) {
      ids = raw;
    } else if (typeof raw === "string") {
      try {
        ids = JSON.parse(raw);
      } catch {
        ids = [];
      }
    }
    const filtered = ids.filter((i) => i !== id);
    await kv.set("workflow:ids", filtered);
    return true;
  }

  if (backend === "blob") {
    const blob = (await getBlob())!;
    try {
      const { blobs } = await blob.list({ prefix: `${BLOB_PREFIX}${id}.json` });
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
