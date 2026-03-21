"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { ScanAgent } from "@/lib/scan";

// ── Chain display config ─────────────────────────────────────────

const CHAIN_META: Record<number, { name: string; color: string; bg: string }> = {
  1:        { name: "Ethereum",         color: "#a8b5ff", bg: "#627eea22" },
  8453:     { name: "Base",             color: "#6eaaff", bg: "#3886f722" },
  56:       { name: "BNB Smart Chain",  color: "#f3d06b", bg: "#f3ba2f22" },
  42161:    { name: "Arbitrum",         color: "#6ec6ff", bg: "#28a0f022" },
  43114:    { name: "Avalanche",        color: "#ff7b7b", bg: "#e8414222" },
  42220:    { name: "Celo",             color: "#5ee8a5", bg: "#35d07f22" },
  2741:     { name: "Abstract",         color: "#a78bfa", bg: "#7c3aed22" },
  101:      { name: "Solana",           color: "#c4a5ff", bg: "#9945ff22" },
  11155111: { name: "Eth Sepolia",     color: "#a8b5ff", bg: "#627eea22" },
  84532:    { name: "Base Sepolia",     color: "#6eaaff", bg: "#3886f722" },
  10143:    { name: "Monad",            color: "#a5a8ff", bg: "#6366f122" },
  103:      { name: "Solana Dev",       color: "#c4a5ff", bg: "#9945ff22" },
};

function chainInfo(chainId: number) {
  return CHAIN_META[chainId] ?? { name: `Chain ${chainId}`, color: "#999", bg: "#88888822" };
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return addr.slice(0, 6) + " \u2026 " + addr.slice(-4);
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ── Props ────────────────────────────────────────────────────────

interface HomeClientProps {
  agents: ScanAgent[];
  totalAgents: number;
}

type SortBy = "newest" | "oldest" | "score" | "feedbacks" | "stars";

// ══════════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════

export default function HomeClient({ agents, totalAgents }: HomeClientProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [chainFilter, setChainFilter] = useState<number | null>(null);
  const [showTestnets, setShowTestnets] = useState(false);

  // Available chains from the data
  const chains = useMemo(() => {
    const map = new Map<number, { id: number; name: string; count: number }>();
    for (const a of agents) {
      const entry = map.get(a.chain_id);
      if (entry) entry.count++;
      else map.set(a.chain_id, { id: a.chain_id, name: chainInfo(a.chain_id).name, count: 1 });
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [agents]);

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = agents;

    if (!showTestnets) list = list.filter(a => !a.is_testnet);
    if (chainFilter !== null) list = list.filter(a => a.chain_id === chainFilter);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(a =>
        a.name?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q) ||
        a.token_id?.includes(q) ||
        a.owner_address?.toLowerCase().includes(q)
      );
    }

    switch (sortBy) {
      case "newest":
        list = [...list].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case "oldest":
        list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case "score":
        list = [...list].sort((a, b) => (b.total_score || 0) - (a.total_score || 0));
        break;
      case "feedbacks":
        list = [...list].sort((a, b) => b.total_feedbacks - a.total_feedbacks);
        break;
      case "stars":
        list = [...list].sort((a, b) => b.star_count - a.star_count);
        break;
    }

    return list;
  }, [agents, search, sortBy, chainFilter, showTestnets]);

  // Newest agent timestamp for the live indicator
  const newestAgent = agents[0];
  const liveText = newestAgent ? `new agent registered ${timeAgo(newestAgent.created_at)}` : "";

  return (
    <section style={{ padding: "32px 0 64px" }}>
      <div className="container">

        {/* ── Header ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{
            fontFamily: "var(--font-head)", fontSize: "clamp(1.5rem, 3vw, 2rem)",
            fontWeight: 700, marginBottom: 6,
          }}>
            Agent Registry
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 8 }}>
            Discover and explore autonomous agents on the ERC-8004 registry
          </p>
          {liveText && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.75rem", color: "#22c55e" }}>
              <span style={{
                width: 7, height: 7, borderRadius: "50%", background: "#22c55e",
                display: "inline-block", boxShadow: "0 0 8px rgba(34,197,94,0.6)",
                animation: "pulse 2s infinite",
              }} />
              {liveText}
            </div>
          )}
        </div>

        {/* ── Search + Sort bar ────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 10, marginBottom: 20, alignItems: "stretch",
          flexWrap: "wrap",
        }}>
          {/* Search input */}
          <div style={{
            flex: 1, minWidth: 260, display: "flex", alignItems: "center",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "0 14px", gap: 8,
          }}>
            <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>🔍</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by agent name, description, skills, ID, or address"
              style={{
                flex: 1, background: "transparent", border: "none", outline: "none",
                color: "var(--text-primary)", fontSize: "0.8125rem", padding: "12px 0",
                fontFamily: "inherit",
              }}
            />
          </div>

          {/* Sort dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "10px 14px", color: "var(--text-primary)",
              fontSize: "0.8125rem", cursor: "pointer", fontFamily: "inherit",
              minWidth: 120,
            }}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="score">Top Score</option>
            <option value="feedbacks">Most Feedback</option>
            <option value="stars">Most Stars</option>
          </select>

          {/* Testnet toggle */}
          <button
            onClick={() => setShowTestnets(!showTestnets)}
            style={{
              background: showTestnets ? "rgba(129,140,248,0.15)" : "var(--bg-card)",
              border: `1px solid ${showTestnets ? "rgba(129,140,248,0.4)" : "var(--border)"}`,
              borderRadius: 10, padding: "10px 14px", cursor: "pointer",
              color: showTestnets ? "var(--accent)" : "var(--text-muted)",
              fontSize: "0.75rem", fontWeight: 600, whiteSpace: "nowrap",
            }}
          >
            🧪 Testnets
          </button>
        </div>

        {/* ── Chain filter pills ──────────────────────────────── */}
        <div style={{
          display: "flex", gap: 6, marginBottom: 20, overflowX: "auto",
          paddingBottom: 4, flexWrap: "wrap",
        }}>
          <button
            onClick={() => setChainFilter(null)}
            style={{
              padding: "5px 12px", borderRadius: 8, fontSize: "0.6875rem",
              fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
              background: chainFilter === null ? "rgba(129,140,248,0.15)" : "var(--bg-card)",
              border: `1px solid ${chainFilter === null ? "rgba(129,140,248,0.4)" : "var(--border)"}`,
              color: chainFilter === null ? "var(--accent)" : "var(--text-secondary)",
            }}
          >
            All Chains
          </button>
          {chains.map(c => {
            const meta = chainInfo(c.id);
            const isActive = chainFilter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setChainFilter(isActive ? null : c.id)}
                style={{
                  padding: "5px 12px", borderRadius: 8, fontSize: "0.6875rem",
                  fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                  background: isActive ? meta.bg : "var(--bg-card)",
                  border: `1px solid ${isActive ? meta.color + "66" : "var(--border)"}`,
                  color: isActive ? meta.color : "var(--text-secondary)",
                }}
              >
                {meta.name} ({c.count})
              </button>
            );
          })}
        </div>

        {/* ── Stats bar ──────────────────────────────────────── */}
        <div style={{
          display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap",
        }}>
          {[
            { label: "Total Agents", value: totalAgents.toLocaleString() },
            { label: "Showing", value: filtered.length.toLocaleString() },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1.25rem", color: "var(--accent)" }}>
                {s.value}
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════
            AGENT TABLE
        ═══════════════════════════════════════════════════════ */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 16, overflow: "hidden",
        }}>
          {/* Table header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "2.2fr 120px 110px 70px 80px 70px 130px 50px 110px",
            padding: "12px 20px",
            borderBottom: "1px solid var(--border)",
            fontSize: "0.6875rem", fontWeight: 600,
            color: "var(--text-muted)", textTransform: "uppercase",
            letterSpacing: "0.5px",
            minWidth: 900,
          }}>
            <span>Name</span>
            <span>Chain</span>
            <span>Service</span>
            <span>Score</span>
            <span>Feedback</span>
            <span>Stars</span>
            <span>Owner</span>
            <span>X402</span>
            <span>Created</span>
          </div>

          {/* Table body — scrollable */}
          <div style={{ overflowX: "auto" }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 48, textAlign: "center", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                No agents found matching your search.
              </div>
            ) : (
              filtered.map((agent) => {
                const chain = chainInfo(agent.chain_id);
                const protocols = agent.supported_protocols || [];
                const hasCustom = protocols.length === 0;

                return (
                  <div
                    key={agent.agent_id}
                    className="table-row-hover"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "2.2fr 120px 110px 70px 80px 70px 130px 50px 110px",
                      padding: "12px 20px",
                      borderBottom: "1px solid var(--border)",
                      alignItems: "center",
                      transition: "background 0.15s",
                      minWidth: 900,
                      cursor: "default",
                    }}
                  >
                    {/* Name */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: agent.image_url && !agent.image_url.includes("example.com")
                          ? "transparent" : "linear-gradient(135deg, var(--accent), var(--accent-alt))",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: "0.75rem", overflow: "hidden",
                      }}>
                        {agent.image_url && !agent.image_url.includes("example.com") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={agent.image_url}
                            alt=""
                            style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <span>{(agent.name || "?")[0]}</span>
                        )}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontWeight: 600, fontSize: "0.8125rem",
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {agent.name || `Agent #${agent.token_id}`}
                          <span style={{ color: "var(--text-muted)", fontWeight: 400, marginLeft: 4, fontSize: "0.75rem" }}>
                            #{agent.token_id}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Chain */}
                    <div>
                      <span style={{
                        fontSize: "0.625rem", padding: "3px 10px",
                        borderRadius: 6, background: chain.bg,
                        color: chain.color, fontWeight: 600,
                        display: "inline-flex", alignItems: "center", gap: 4,
                        whiteSpace: "nowrap",
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: chain.color, display: "inline-block" }} />
                        {chain.name}
                      </span>
                    </div>

                    {/* Service / Protocols */}
                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                      {hasCustom ? (
                        <span style={{
                          fontSize: "0.625rem", padding: "2px 8px", borderRadius: 4,
                          background: "rgba(255,255,255,0.06)", color: "var(--text-secondary)",
                          fontWeight: 600, textTransform: "uppercase",
                        }}>
                          CUSTOM
                        </span>
                      ) : (
                        protocols.map(p => (
                          <span key={p} style={{
                            fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4,
                            background: p === "MCP" ? "rgba(129,140,248,0.15)" :
                              p === "A2A" ? "rgba(34,197,94,0.15)" :
                              p === "OASF" ? "rgba(245,158,11,0.15)" :
                              "rgba(255,255,255,0.06)",
                            color: p === "MCP" ? "#818cf8" :
                              p === "A2A" ? "#22c55e" :
                              p === "OASF" ? "#f59e0b" : "var(--text-secondary)",
                            fontWeight: 600,
                          }}>
                            {p}
                          </span>
                        ))
                      )}
                      {protocols.length > 0 && (
                        <span style={{
                          fontSize: "0.6rem", padding: "2px 6px", borderRadius: 4,
                          color: "var(--text-muted)", fontWeight: 500,
                        }}>
                          +{protocols.length}
                        </span>
                      )}
                    </div>

                    {/* Score */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ fontSize: "0.8125rem", color: "#f59e0b" }}>⚡</span>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--text-primary)" }}>
                        {agent.total_score ? Math.round(agent.total_score) : 0}
                      </span>
                    </div>

                    {/* Feedback */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      <span style={{ opacity: 0.5 }}>💬</span>
                      {agent.total_feedbacks}
                    </div>

                    {/* Stars */}
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                      <span style={{ opacity: 0.5 }}>☆</span>
                      {agent.star_count}
                    </div>

                    {/* Owner */}
                    <div style={{
                      fontFamily: "monospace", fontSize: "0.6875rem",
                      color: "var(--text-muted)",
                    }}>
                      {shortAddr(agent.owner_address)}
                    </div>

                    {/* X402 */}
                    <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)", textAlign: "center" }}>
                      {agent.x402_supported ? "✓" : "-"}
                    </div>

                    {/* Created */}
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>
                      {agent.created_at ? timeAgo(agent.created_at) : "-"}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </section>
  );
}
