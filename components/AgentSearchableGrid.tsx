"use client";

import { useState, useMemo } from "react";

interface AgentSearchableGridProps {
  children: React.ReactNode[];
  agentData: Array<{ tokenId: number; name: string; wallet: string; description: string }>;
}

export default function AgentSearchableGrid({ children, agentData }: AgentSearchableGridProps) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");

  const filteredIndices = useMemo(() => {
    const q = query.toLowerCase().trim();
    let indices = agentData.map((_, i) => i);

    if (q) {
      indices = indices.filter((i) => {
        const a = agentData[i];
        return (
          a.name.toLowerCase().includes(q) ||
          a.wallet.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q) ||
          String(a.tokenId).includes(q)
        );
      });
    }

    if (sort === "oldest") {
      indices.sort((a, b) => agentData[a].tokenId - agentData[b].tokenId);
    } else {
      indices.sort((a, b) => agentData[b].tokenId - agentData[a].tokenId);
    }

    return indices;
  }, [query, sort, agentData]);

  return (
    <>
      <div style={{
        display: "flex",
        gap: 10,
        marginBottom: 20,
        flexWrap: "wrap",
        alignItems: "center",
      }}>
        <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
          <span style={{
            position: "absolute",
            left: 12,
            top: "50%",
            transform: "translateY(-50%)",
            fontSize: "0.875rem",
            color: "var(--text-muted)",
            pointerEvents: "none",
          }}>
            🔍
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search agents by name, token ID, or wallet..."
            className="input"
            style={{ width: "100%", paddingLeft: 36, fontSize: "0.875rem" }}
          />
        </div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="input"
          style={{ width: "auto", minWidth: 130, fontSize: "0.8125rem", cursor: "pointer" }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        {query && (
          <button
            onClick={() => setQuery("")}
            className="btn btn-ghost"
            style={{ fontSize: "0.8125rem", padding: "8px 14px" }}
          >
            Clear
          </button>
        )}
      </div>

      {query && (
        <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginBottom: 16 }}>
          Showing {filteredIndices.length} of {agentData.length} agents
        </div>
      )}

      {filteredIndices.length > 0 ? (
        <div className="grid-3">
          {filteredIndices.map((i) => children[i])}
        </div>
      ) : (
        <div className="card" style={{ padding: 48, textAlign: "center" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
          <p style={{ color: "var(--text-secondary)" }}>
            No agents match &quot;{query}&quot;
          </p>
        </div>
      )}
    </>
  );
}
