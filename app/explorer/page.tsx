"use client";

import { useState } from "react";
import Link from "next/link";
import {
  readHumanLinks,
  readProfileLinks,
  readAgentLinks,
  readLinksBatch,
  LINK_REGISTRY_ADDRESS,
  type OnChainLink,
} from "@/lib/contracts";

// ── Helpers ──────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  creator: "#818cf8",
  operator: "#60a5fa",
  maintainer: "#34d399",
  delegate: "#f59e0b",
  renter: "#f472b6",
};

const LEVEL_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  "self-claim": { label: "Self Claim", color: "#f59e0b", icon: "◑" },
  "agent-confirmation": { label: "Agent Confirmed", color: "#60a5fa", icon: "◕" },
  "mutual-verification": { label: "Mutual Verification", color: "#34d399", icon: "●" },
};

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

function timeAgo(unix: number) {
  const diff = Math.floor(Date.now() / 1000) - unix;
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Page ─────────────────────────────────────────────────────────

export default function ExplorerPage() {
  const [searchType, setSearchType] = useState<"wallet" | "profile" | "agent">("wallet");
  const [query, setQuery] = useState("");
  const [agentTokenId, setAgentTokenId] = useState("");
  const [links, setLinks] = useState<OnChainLink[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Filtered results
  const filteredLinks = links.filter((link) => {
    if (filterRole !== "all" && link.role !== filterRole) return false;
    if (filterLevel !== "all" && link.level !== filterLevel) return false;
    if (filterStatus === "active" && (link.status !== "active" || link.isExpired)) return false;
    if (filterStatus === "revoked" && link.status !== "revoked") return false;
    if (filterStatus === "expired" && !link.isExpired) return false;
    return true;
  });

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSearched(true);
    setLinks([]);

    try {
      if (searchType === "wallet") {
        if (!query.startsWith("0x") || query.length !== 42) {
          setError("Enter a valid wallet address (0x…)");
          setLoading(false);
          return;
        }
        const ids = await readHumanLinks(query);
        if (ids.length === 0) {
          setLinks([]);
        } else {
          const results = await readLinksBatch(ids);
          setLinks(results);
        }
      } else if (searchType === "profile") {
        const profileId = parseInt(query);
        if (isNaN(profileId) || profileId <= 0) {
          setError("Enter a valid Ethos profile ID (number)");
          setLoading(false);
          return;
        }
        const ids = await readProfileLinks(profileId);
        if (ids.length === 0) {
          setLinks([]);
        } else {
          const results = await readLinksBatch(ids);
          setLinks(results);
        }
      } else if (searchType === "agent") {
        if (!query.startsWith("0x") || query.length !== 42) {
          setError("Enter a valid agent wallet address (0x…)");
          setLoading(false);
          return;
        }
        const tokenId = parseInt(agentTokenId);
        if (isNaN(tokenId) || tokenId <= 0) {
          setError("Enter a valid agent token ID (number)");
          setLoading(false);
          return;
        }
        const results = await readAgentLinks(query, tokenId);
        setLinks(results);
      }
    } catch (err) {
      setError("Failed to fetch links. Check the input and try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main>
      <section className="section" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <div className="container" style={{ maxWidth: 860 }}>

          {/* ── Header ─────────────────────────────────── */}
          <div style={{ marginBottom: 40 }}>
            <div className="hero-eyebrow animate-up" style={{ marginBottom: 12 }}>
              <span>⬡</span> On-Chain Link Explorer
            </div>
            <h1 style={{
              fontFamily: "var(--font-head)", fontSize: "clamp(1.5rem, 4vw, 2rem)",
              fontWeight: 700, background: "linear-gradient(135deg, #818cf8, #e879f9)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              marginBottom: 8
            }}>
              Explore Verified Links
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9375rem", maxWidth: 560 }}>
              Search by wallet address, Ethos profile ID, or agent identity to see all on-chain
              links from the AgentHumanLinkRegistry.
            </p>
          </div>

          {/* ── Search form ─────────────────────────────── */}
          <form onSubmit={handleSearch} style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)", padding: 24, marginBottom: 32
          }}>
            {/* Search type tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
              {([
                { key: "wallet" as const, label: "Human Wallet", icon: "👤" },
                { key: "profile" as const, label: "Ethos Profile", icon: "⭐" },
                { key: "agent" as const, label: "Agent Identity", icon: "🤖" },
              ]).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setSearchType(tab.key); setQuery(""); setAgentTokenId(""); setSearched(false); setLinks([]); }}
                  style={{
                    padding: "8px 16px", borderRadius: 8, border: "1px solid",
                    borderColor: searchType === tab.key ? "var(--accent)" : "var(--border)",
                    background: searchType === tab.key ? "rgba(129,140,248,0.1)" : "transparent",
                    color: searchType === tab.key ? "var(--accent)" : "var(--text-secondary)",
                    fontWeight: 500, fontSize: "0.8125rem", cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Input fields */}
            <div style={{ display: "flex", gap: 12 }}>
              <input
                type="text"
                placeholder={
                  searchType === "wallet" ? "0x… human wallet address" :
                  searchType === "profile" ? "Ethos profile ID (e.g. 88)" :
                  "0x… agent wallet address"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  flex: 1, padding: "10px 14px", borderRadius: 8,
                  border: "1px solid var(--border)", background: "var(--bg-subtle)",
                  color: "var(--text-primary)", fontSize: "0.875rem",
                  fontFamily: searchType !== "profile" ? "var(--font-mono)" : "inherit",
                }}
              />
              {searchType === "agent" && (
                <input
                  type="text"
                  placeholder="Token ID"
                  value={agentTokenId}
                  onChange={(e) => setAgentTokenId(e.target.value)}
                  style={{
                    width: 100, padding: "10px 14px", borderRadius: 8,
                    border: "1px solid var(--border)", background: "var(--bg-subtle)",
                    color: "var(--text-primary)", fontSize: "0.875rem",
                    fontFamily: "var(--font-mono)",
                  }}
                />
              )}
              <button
                type="submit"
                disabled={loading || !query}
                className="btn btn-primary"
                style={{ padding: "10px 24px", fontSize: "0.875rem" }}
              >
                {loading ? "Searching…" : "Search"}
              </button>
            </div>

            {error && (
              <div style={{ marginTop: 12, color: "#ef4444", fontSize: "0.8125rem" }}>
                ⚠ {error}
              </div>
            )}
          </form>

          {/* ── Results ─────────────────────────────── */}
          {searched && !loading && (
            <div>
              <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                marginBottom: 16
              }}>
                <h2 style={{
                  fontFamily: "var(--font-head)", fontSize: "1rem",
                  fontWeight: 600, color: "var(--text-primary)"
                }}>
                  {links.length === 0 ? "No links found" :
                    `${filteredLinks.length} of ${links.length} link${links.length !== 1 ? "s" : ""}`}
                </h2>
                {links.length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="input" style={{ width: "auto", fontSize: "0.75rem", padding: "4px 8px" }}>
                      <option value="all">All Roles</option>
                      <option value="creator">Creator</option>
                      <option value="operator">Operator</option>
                      <option value="maintainer">Maintainer</option>
                      <option value="delegate">Delegate</option>
                      <option value="renter">Renter</option>
                    </select>
                    <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} className="input" style={{ width: "auto", fontSize: "0.75rem", padding: "4px 8px" }}>
                      <option value="all">All Levels</option>
                      <option value="self-claim">Self Claim</option>
                      <option value="agent-confirmation">Agent Confirmed</option>
                      <option value="mutual-verification">Mutual Verification</option>
                    </select>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="input" style={{ width: "auto", fontSize: "0.75rem", padding: "4px 8px" }}>
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="revoked">Revoked</option>
                      <option value="expired">Expired</option>
                    </select>
                  </div>
                )}
              </div>

              {links.length === 0 && (
                <div style={{
                  padding: 40, textAlign: "center", background: "var(--bg-card)",
                  border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                }}>
                  <div style={{ fontSize: "2rem", marginBottom: 12 }}>🔍</div>
                  <div style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                    No verified links found for this query.<br />
                    Links appear here after they are submitted on-chain via the{" "}
                    <Link href="/creator/link" style={{ color: "var(--accent)" }}>
                      Link page
                    </Link>{" "}
                    or the SDK.
                  </div>
                </div>
              )}

              {/* Link cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filteredLinks.map((link) => {
                  const role = link.role;
                  const roleColor = ROLE_COLORS[role] ?? "#818cf8";
                  const lvl = LEVEL_LABELS[link.level] ?? LEVEL_LABELS["self-claim"];
                  const isActive = link.status === "active" && !link.isExpired;

                  return (
                    <Link
                      key={link.linkId}
                      href={`/explorer/link/${link.linkId}`}
                      style={{ textDecoration: "none" }}
                    >
                      <div style={{
                        background: "var(--bg-card)", border: "1px solid var(--border)",
                        borderRadius: "var(--radius-lg)", padding: "20px 24px",
                        display: "grid", gridTemplateColumns: "auto 1fr auto",
                        gap: 20, alignItems: "center",
                        transition: "all 0.2s ease", cursor: "pointer",
                      }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = roleColor + "55";
                          e.currentTarget.style.background = "var(--bg-subtle)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = "var(--border)";
                          e.currentTarget.style.background = "var(--bg-card)";
                        }}
                      >
                        {/* Link ID badge */}
                        <div style={{
                          width: 44, height: 44, borderRadius: 12,
                          background: roleColor + "18", border: `1px solid ${roleColor}33`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontFamily: "var(--font-mono)", fontSize: "0.8125rem",
                          fontWeight: 700, color: roleColor,
                        }}>
                          #{link.linkId}
                        </div>

                        {/* Middle: details */}
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            display: "flex", gap: 8, alignItems: "center",
                            marginBottom: 4, flexWrap: "wrap",
                          }}>
                            {/* Role pill */}
                            <span style={{
                              padding: "2px 8px", borderRadius: 6,
                              background: roleColor + "18", color: roleColor,
                              fontSize: "0.6875rem", fontWeight: 600,
                              textTransform: "uppercase", letterSpacing: "0.5px",
                            }}>
                              {role}
                            </span>
                            {/* Verification level */}
                            <span style={{
                              fontSize: "0.75rem", color: lvl.color,
                              fontWeight: 500,
                            }}>
                              {lvl.icon} {lvl.label}
                            </span>
                            {/* Status */}
                            <span style={{
                              fontSize: "0.6875rem",
                              color: isActive ? "#34d399" : "#ef4444",
                              fontWeight: 500,
                            }}>
                              {isActive ? "● Active" : link.isExpired ? "◌ Expired" : "✕ Revoked"}
                            </span>
                          </div>

                          {/* Addresses */}
                          <div style={{
                            display: "flex", gap: 16, fontSize: "0.8125rem",
                            color: "var(--text-secondary)",
                          }}>
                            <span>
                              👤 <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                                {shortAddr(link.humanWallet)}
                              </span>
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>→</span>
                            <span>
                              🤖 <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
                                {shortAddr(link.agentWallet)}
                              </span>
                              <span style={{ color: "var(--text-muted)", marginLeft: 4 }}>
                                #{link.agentTokenId}
                              </span>
                            </span>
                          </div>
                        </div>

                        {/* Right: timestamp + arrow */}
                        <div style={{ textAlign: "right" }}>
                          <div style={{
                            fontSize: "0.75rem", color: "var(--text-muted)",
                            marginBottom: 4,
                          }}>
                            {link.createdAt > 0 ? timeAgo(link.createdAt) : "—"}
                          </div>
                          <div style={{ fontSize: "1rem", color: "var(--text-muted)" }}>→</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Quick links ─────────────────────────────── */}
          <div style={{
            marginTop: 40, padding: 24, background: "var(--bg-card)",
            border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
          }}>
            <div style={{
              fontSize: "0.75rem", fontWeight: 600, textTransform: "uppercase",
              letterSpacing: "1px", color: "var(--text-muted)", marginBottom: 16,
            }}>
              Quick Actions
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <Link href="/creator/link" className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}>
                Create a link →
              </Link>
              <Link href="/agents" className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}>
                Browse agents →
              </Link>
              <a
                href={`https://base-sepolia.blockscout.com/address/${LINK_REGISTRY_ADDRESS}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-ghost"
                style={{ fontSize: "0.8125rem" }}
              >
                View contract on Blockscout ↗
              </a>
            </div>
          </div>

        </div>
      </section>
    </main>
  );
}
