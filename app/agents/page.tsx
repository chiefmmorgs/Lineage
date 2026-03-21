import Link from "next/link";
import { AGENT_REGISTRY_ADDRESS } from "@/lib/contracts";
import { fetchAgents, type ScanAgent } from "@/lib/scan";

export const revalidate = 30;

// ── Chain display helpers ────────────────────────────────────────
const CHAIN_META: Record<number, { name: string; color: string }> = {
  84532: { name: "Base Sepolia", color: "#3886f7" },
  11155111: { name: "Eth Sepolia", color: "#627eea" },
  8453: { name: "Base", color: "#3886f7" },
  1: { name: "Ethereum", color: "#627eea" },
  56: { name: "BNB Chain", color: "#f3ba2f" },
  42161: { name: "Arbitrum", color: "#28a0f0" },
  42220: { name: "Celo", color: "#35d07f" },
};

function chainMeta(id: number) {
  return CHAIN_META[id] ?? { name: `Chain ${id}`, color: "#888" };
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

export default async function AgentsPage() {
  // Fetch agents from 8004scan — Base Sepolia (chain 84532)
  let agents: ScanAgent[] = [];
  let total = 0;

  try {
    const response = await fetchAgents({ limit: 100 });
    agents = response.data;
    total = agents.length;
  } catch (e) {
    console.error("Failed to fetch agents:", e);
  }

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
                  {total} agent{total !== 1 ? "s" : ""} registered across all chains · Reading live from{" "}
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
                  ● {total} registered
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

          {/* Agent Table */}
          {agents.length > 0 ? (
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
                {agents.map((agent) => {
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
                No agents registered yet
              </h2>
              <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
                Be the first to register an ERC-8004 agent identity.
              </p>
              <Link href="/agents/register" className="btn btn-primary">
                Register your agent →
              </Link>
            </div>
          )}

        </div>
      </section>
    </main>
  );
}
