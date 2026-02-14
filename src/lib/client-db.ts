"use client";

import type { Workflow } from "./types";

const STORAGE_KEY = "workflow-xray:workflows";

function getAll(): Workflow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Workflow[];
  } catch {
    return [];
  }
}

function setAll(workflows: Workflow[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
  } catch {
    // Storage full or unavailable — silently fail
  }
}

export function saveWorkflowLocal(workflow: Workflow): void {
  const all = getAll();
  const existing = all.findIndex((w) => w.id === workflow.id);
  if (existing >= 0) {
    all[existing] = workflow;
  } else {
    all.unshift(workflow);
  }
  setAll(all);
}

export function getWorkflowLocal(id: string): Workflow | null {
  const all = getAll();
  return all.find((w) => w.id === id) || null;
}

export function listWorkflowsLocal(search?: string): Workflow[] {
  let workflows = getAll();

  // Sort by most recent first
  workflows.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

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

export function deleteWorkflowLocal(id: string): void {
  const all = getAll().filter((w) => w.id !== id);
  setAll(all);
}

/**
 * Merge server workflows with local — server wins on conflicts
 */
export function mergeWithServer(serverWorkflows: Workflow[]): Workflow[] {
  const local = getAll();
  const serverIds = new Set(serverWorkflows.map((w) => w.id));

  // Add any local-only workflows to the result
  const localOnly = local.filter((w) => !serverIds.has(w.id));

  const merged = [...serverWorkflows, ...localOnly];
  merged.sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  // Update localStorage with merged data
  setAll(merged);

  return merged;
}
