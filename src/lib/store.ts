"use client";

import { create } from "zustand";
import type { Workflow } from "./types";

interface AppState {
  // Input
  inputMode: "freeform" | "structured";
  setInputMode: (mode: "freeform" | "structured") => void;

  // Decomposition
  isDecomposing: boolean;
  setIsDecomposing: (v: boolean) => void;
  error: string | null;
  setError: (e: string | null) => void;

  // X-Ray view
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  activeTab: "flow" | "gaps" | "health";
  setActiveTab: (tab: "flow" | "gaps" | "health") => void;

  // Library
  workflows: Workflow[];
  setWorkflows: (w: Workflow[]) => void;
}

export const useStore = create<AppState>((set) => ({
  inputMode: "freeform",
  setInputMode: (mode) => set({ inputMode: mode }),

  isDecomposing: false,
  setIsDecomposing: (v) => set({ isDecomposing: v }),
  error: null,
  setError: (e) => set({ error: e }),

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),
  activeTab: "flow",
  setActiveTab: (tab) => set({ activeTab: tab }),

  workflows: [],
  setWorkflows: (w) => set({ workflows: w }),
}));
