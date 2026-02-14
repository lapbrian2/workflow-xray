"use client";

import { useState, useEffect } from "react";
import type { Workflow } from "@/lib/types";
import WorkflowCard from "./workflow-card";

export default function WorkflowLibrary() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchWorkflows = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/workflows?${params}`);
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      console.error("Failed to fetch workflows:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = () => {
    setLoading(true);
    fetchWorkflows();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/workflows?id=${id}`, { method: "DELETE" });
    setWorkflows((w) => w.filter((wf) => wf.id !== id));
  };

  return (
    <div>
      {/* Search */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search workflows..."
          style={{
            flex: 1,
            padding: "8px 16px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--color-border)",
            fontFamily: "var(--font-body)",
            fontSize: 14,
            color: "var(--color-dark)",
            outline: "none",
            background: "var(--color-surface)",
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: "8px 24px",
            borderRadius: "var(--radius-sm)",
            border: "none",
            background: "var(--color-dark)",
            color: "#F0F2F5",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Search
        </button>
      </div>

      {/* Results */}
      {loading ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
            color: "var(--color-muted)",
            fontFamily: "var(--font-body)",
          }}
        >
          Loading workflows...
        </div>
      ) : workflows.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
          }}
        >
          <div
            style={{
              fontSize: 16,
              color: "var(--color-text)",
              fontFamily: "var(--font-body)",
              marginBottom: 8,
            }}
          >
            No workflows yet
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
            }}
          >
            Decompose a workflow to see it here.
          </div>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {workflows.map((w) => (
            <WorkflowCard key={w.id} workflow={w} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}
