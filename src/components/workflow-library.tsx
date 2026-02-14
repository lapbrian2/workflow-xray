"use client";

import { useState, useEffect } from "react";
import type { Workflow } from "@/lib/types";
import WorkflowCard from "./workflow-card";

export default function WorkflowLibrary() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = async () => {
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/workflows?${params}`);
      if (!res.ok) throw new Error("Failed to load workflows");
      const data = await res.json();
      setWorkflows(data.workflows || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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

      {/* Loading — skeleton cards */}
      {loading && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: 16,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                padding: 16,
                borderRadius: "var(--radius-lg)",
                border: "1px solid var(--color-border)",
                background: "var(--color-surface)",
              }}
            >
              <div
                style={{
                  height: 16,
                  width: "70%",
                  background: "var(--color-border)",
                  borderRadius: 4,
                  marginBottom: 12,
                  animation: `pulse-slow 1.5s ease ${i * 0.15}s infinite`,
                }}
              />
              <div
                style={{
                  height: 12,
                  width: "50%",
                  background: "var(--color-border)",
                  borderRadius: 4,
                  marginBottom: 16,
                  animation: `pulse-slow 1.5s ease ${i * 0.15 + 0.1}s infinite`,
                }}
              />
              <div style={{ display: "flex", gap: 8 }}>
                {[40, 56, 48].map((w, j) => (
                  <div
                    key={j}
                    style={{
                      height: 20,
                      width: w,
                      background: "var(--color-border)",
                      borderRadius: 4,
                      animation: `pulse-slow 1.5s ease ${i * 0.15 + 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error — with retry */}
      {!loading && error && (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "#FDF0EE",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 20,
            }}
          >
            !
          </div>
          <div
            style={{
              fontSize: 15,
              color: "#C0392B",
              fontFamily: "var(--font-body)",
              marginBottom: 8,
            }}
          >
            {error}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              marginBottom: 16,
            }}
          >
            Check your connection and try again.
          </div>
          <button
            onClick={() => {
              setLoading(true);
              fetchWorkflows();
            }}
            style={{
              padding: "8px 24px",
              borderRadius: "var(--radius-sm)",
              border: "none",
              background: "var(--color-accent)",
              color: "#fff",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty — no workflows yet (initial) */}
      {!loading && !error && workflows.length === 0 && !search && (
        <div
          style={{
            textAlign: "center",
            padding: "64px 24px",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: "var(--color-border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              fontSize: 20,
              color: "var(--color-muted)",
            }}
          >
            &#x2731;
          </div>
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
      )}

      {/* Partial — search returned no results */}
      {!loading && !error && workflows.length === 0 && search && (
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
            No results for &ldquo;{search}&rdquo;
          </div>
          <div
            style={{
              fontSize: 13,
              color: "var(--color-muted)",
              fontFamily: "var(--font-body)",
              marginBottom: 16,
            }}
          >
            Try a different search term or clear your filter.
          </div>
          <button
            onClick={() => {
              setSearch("");
              setLoading(true);
              fetchWorkflows();
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--color-text)",
              cursor: "pointer",
            }}
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Success — workflow grid */}
      {!loading && !error && workflows.length > 0 && (
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
