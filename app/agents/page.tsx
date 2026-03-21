"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";

// ── Types ────────────────────────────────────────────────────────
interface ScanAgent {
  id: string;
  agent_id: string;
  token_id: string;
  chain_id: number;
  is_testnet: boolean;
  owner_address: string;
  name: string;
  description: string;
  image_url: string;
  is_verified: boolean;
  star_count: number;
  supported_protocols: string[];
  x402_supported: boolean;
  total_score: number;
  total_feedbacks: number;
  average_score: number;
  created_at: string;
}

// ── Chain display helpers ────────────────────────────────────────
const CHAIN_META: Record<number, { name: string; color: string; testnet: boolean }> = {
  // Mainnets
  1:        { name: "Ethereum",         color: "#627eea", testnet: false },
  8453:     { name: "Base",             color: "#3886f7", testnet: false },
  56:       { name: "BNB Chain",        color: "#f3ba2f", testnet: false },
  42161:    { name: "Arbitrum",         color: "#28a0f0", testnet: false },
  43114:    { name: "Avalanche",        color: "#e84142", testnet: false },
  42220:    { name: "Celo",             color: "#35d07f", testnet: false },
  2741:     { name: "Abstract",         color: "#7c3aed", testnet: false },
  10:       { name: "Optimism",         color: "#ff0420", testnet: false },
  137:      { name: "Polygon",          color: "#8247e5", testnet: false },
  100:      { name: "Gnosis",           color: "#04795b", testnet: false },
  101:      { name: "Solana",           color: "#9945ff", testnet: false },
  // Testnets
  11155111: { name: "Eth Sepolia",     color: "#627eea", testnet: true },
  84532:    { name: "Base Sepolia",     color: "#3886f7", testnet: true },
  10143:    { name: "Monad Testnet",    color: "#6366f1", testnet: true },
  103:      { name: "Solana Devnet",    color: "#9945ff", testnet: true },
  421614:   { name: "Arbitrum Sepolia", color: "#28a0f0", testnet: true },
  97:       { name: "BSC Testnet",      color: "#f3ba2f", testnet: true },
  11124:    { name: "Abstract Testnet", color: "#7c3aed", testnet: true },
  6343:     { name: "MegaETH Testnet",  color: "#14b8a6", testnet: true },
  43113:    { name: "Avalanche Fuji",   color: "#e84142", testnet: true },
};

function chainMeta(id: number) {
  return CHAIN_META[id] ?? { name: `Chain ${id}`, color: "#888", testnet: false };
}

function shortAddr(addr: string) {
  if (!addr || addr.length < 10) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ══════════════════════════════════════════════════════════════════

type FilterMode = "all" | "mainnet" | "testnet" | number;

export default function AgentsPage() {
  const [agents, setAgents] = useState<ScanAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterMode>(84532);

  useEffect(() => {
    fetch("/api/agents-list?limit=100")
      .then((r) => r.json())
      .then((d) => {
        setAgents(d.data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // Build the list of chains that actually have agents
  const chainOptions = useMemo(() => {
    const map = new Map<number, { name: string; color: string; count: number; testnet: boolean }>();
    for (const a of agents) {
      const meta = chainMeta(a.chain_id);
      const existing = map.get(a.chain_id);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(a.chain_id, { name: meta.name, color: meta.color, count: 1, testnet: meta.testnet });
      }
    }
    return Array.from(map.entries()).sort((a, b) => b[1].count - a[1].count);
  }, [agents]);

  // Filter agents
  const filtered = useMemo(() => {
    if (filter === "all") return agents;
    if (filter === "mainnet") return agents.filter((a) => !a.is_testnet && !chainMeta(a.chain_id).testnet);
    if (filter === "testnet") return agents.filter((a) => a.is_testnet || chainMeta(a.chain_id).testnet);
    return agents.filter((a) => a.chain_id === filter);
  }, [agents, filter]);

  const mainnetCount = agents.filter((a) => !a.is_testnet && !chainMeta(a.chain_id).testnet).length;
  const testnetCount = agents.filter((a) => a.is_testnet || chainMeta(a.chain_id).testnet).length;

  return (
    <main>
      <section className="section" style={{ paddingTop: 48 }}>
        <div className="container">

          {/* Header */}
          <div className="section-header">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 className="section-title">Agent Directory</h1>
                <p className="section-sub">
                  {agents.length} agent{agents.length !== 1 ? "s" : ""} registered across all chains · Reading live from{" "}
                  <a
                    href="https://8004scan.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    8004scan.io ↗
                  </a>
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span className="tag" style={{ color: "var(--green)", borderColor: "#22c55e44", background: "#22c55e11" }}>
                  ● {agents.length} registered
                </span>
                <span className="tag">
                  🔴 Live from chain
                </span>
                <Link href="/agents/register" className="btn btn-primary" style={{ fontSize: "0.8125rem", padding: "8px 18px" }}>
                  + Register Agent
                </Link>
              </div>
            </div>
          </div>

          {/* ── Chain Filters ─────────────────────────────────────── */}
          <div style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            marginBottom: 20,
            alignItems: "center",
          }}>
            {/* All / Mainnet / Testnet */}
            <FilterPill
              label={`All Chains (${agents.length})`}
              active={filter === "all"}
              color="#888"
              onClick={() => setFilter("all")}
            />
            <FilterPill
              label={`Mainnet (${mainnetCount})`}
              active={filter === "mainnet"}
              color="#22c55e"
              onClick={() => setFilter("mainnet")}
            />
            <FilterPill
              label={`Testnet (${testnetCount})`}
              active={filter === "testnet"}
              color="#f59e0b"
              onClick={() => setFilter("testnet")}
            />

            {/* Divider */}
            <div style={{ width: 1, height: 24, background: "var(--border)", margin: "0 4px" }} />

            {/* Per-chain filters */}
            {chainOptions.map(([chainId, meta]) => (
              <FilterPill
                key={chainId}
                label={`${meta.name} (${meta.count})`}
                active={filter === chainId}
                color={meta.color}
                onClick={() => setFilter(filter === chainId ? "all" : chainId)}
              />
            ))}
          </div>

          {/* Agent Table */}
          {loading ? (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 16 }}>⏳</div>
              <p style={{ color: "var(--text-secondary)" }}>Loading agents from 8004scan.io…</p>
            </div>
          ) : filtered.length > 0 ? (
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

              {/* Table body */}
              <div style={{ overflowX: "auto" }}>
                {filtered.map((agent) => {
                  const chain = chainMeta(agent.chain_id);
                  const protocols = agent.supported_protocols || [];
                  const hasCustom = protocols.length === 0;

                  return (
                    <Link
                      key={agent.agent_id}
                      href={`/agents/${agent.token_id}?chain=${agent.chain_id}`}
                      className="table-row-hover"
                      style={{
                        display: "grid",
                        gridTemplateColumns: "2.2fr 120px 110px 70px 80px 70px 130px 50px 110px",
                        padding: "12px 20px",
                        borderBottom: "1px solid var(--border)",
                        alignItems: "center",
                        transition: "background 0.15s",
                        minWidth: 900,
                        textDecoration: "none",
                        color: "inherit",
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
                            <img src={agent.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }} />
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
                          borderRadius: 6, background: `${chain.color}22`,
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
                          protocols.slice(0, 3).map(p => (
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
                      </div>

                      {/* Score */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <span style={{ fontSize: "0.8125rem", color: "#f59e0b" }}>⚡</span>
                        <span style={{ fontSize: "0.8125rem", fontWeight: 600 }}>
                          {agent.total_score ? Math.round(agent.total_score) : 0}
                        </span>
                      </div>

                      {/* Feedback */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        💬 {agent.total_feedbacks}
                      </div>

                      {/* Stars */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.8125rem", color: "var(--text-secondary)" }}>
                        ☆ {agent.star_count}
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
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="card" style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: "2rem", marginBottom: 16 }}>🤖</div>
              <h2 style={{ fontFamily: "var(--font-head)", fontSize: "1.25rem", marginBottom: 10 }}>
                {agents.length > 0 ? "No agents on this chain" : "No agents registered yet"}
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                {agents.length > 0
                  ? "Try selecting a different chain or view all."
                  : "Be the first to register an ERC-8004 agent identity."}
              </p>
              {agents.length > 0 ? (
                <button
                  className="btn btn-primary"
                  onClick={() => setFilter("all")}
                >
                  View all chains →
                </button>
              ) : (
                <Link href="/agents/register" className="btn btn-primary">
                  Register your agent →
                </Link>
              )}
            </div>
          )}

        </div>
      </section>
    </main>
  );
}

// ── Filter Pill Component ────────────────────────────────────────

function FilterPill({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: "0.6875rem",
        fontWeight: 600,
        padding: "5px 14px",
        borderRadius: 20,
        border: `1px solid ${active ? color : "var(--border)"}`,
        background: active ? `${color}22` : "transparent",
        color: active ? color : "var(--text-muted)",
        cursor: "pointer",
        transition: "all 0.2s",
        whiteSpace: "nowrap",
      }}
    >
      {active && <span style={{ marginRight: 4 }}>●</span>}
      {label}
    </button>
  );
}
