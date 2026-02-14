import type { Workflow } from "./types";

// In-memory store fallback for local dev / when KV is not configured
const memoryStore = new Map<string, Workflow>();

async function getKv() {
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    const { kv } = await import("@vercel/kv");
    return kv;
  }
  return null;
}

export async function saveWorkflow(workflow: Workflow): Promise<void> {
  const kv = await getKv();
  if (kv) {
    await kv.set(`workflow:${workflow.id}`, JSON.stringify(workflow));
    // Maintain an index of all workflow IDs
    const ids: string[] = (await kv.get("workflow:ids")) || [];
    if (!ids.includes(workflow.id)) {
      ids.push(workflow.id);
      await kv.set("workflow:ids", JSON.stringify(ids));
    }
  } else {
    memoryStore.set(workflow.id, workflow);
  }
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const kv = await getKv();
  if (kv) {
    const raw = await kv.get<string>(`workflow:${id}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }
  return memoryStore.get(id) || null;
}

export async function listWorkflows(
  search?: string
): Promise<Workflow[]> {
  const kv = await getKv();
  let workflows: Workflow[] = [];

  if (kv) {
    const ids: string[] = (await kv.get("workflow:ids")) || [];
    const results = await Promise.all(
      ids.map((id) => getWorkflow(id))
    );
    workflows = results.filter(Boolean) as Workflow[];
  } else {
    workflows = Array.from(memoryStore.values());
  }

  // Sort by most recent first
  workflows.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Optional search filter
  if (search) {
    const q = search.toLowerCase();
    workflows = workflows.filter(
      (w) =>
        w.decomposition.title.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q)
    );
  }

  return workflows;
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  const kv = await getKv();
  if (kv) {
    await kv.del(`workflow:${id}`);
    const ids: string[] = (await kv.get("workflow:ids")) || [];
    const filtered = ids.filter((i) => i !== id);
    await kv.set("workflow:ids", JSON.stringify(filtered));
    return true;
  }
  return memoryStore.delete(id);
}
