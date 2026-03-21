import { ROLE_LABELS, type LinkRole } from "@/lib/lineage";
import { readAgentLinks, readReputation, AGENT_REGISTRY_ADDRESS, LINK_REGISTRY_ADDRESS, type OnChainLink } from "@/lib/contracts";
import { getScore, getProfileByUserkey, formatWei, scoreLevelMeta } from "@/lib/ethos";
import { resolveIdentity, ROLE_CONFIG, type AgentRole } from "@/lib/proofs";
import { computeLineageScore, buildScoringInput } from "@/lib/scoring";
import ScoreBadge from "@/components/ScoreBadge";
import ScoreBreakdown from "@/components/ScoreBreakdown";
import Link from "next/link";
import { type ScanAgent } from "@/lib/scan";

const EMOJIS = ["🤖", "🛡", "📦", "🔍", "✅", "💬", "🧠", "⚡", "🎯", "🔗"];

const CHAIN_META: Record<number, { name: string; color: string }> = {
  84532: { name: "Base Sepolia", color: "#3886f7" },
  11155111: { name: "Eth Sepolia", color: "#627eea" },
  8453: { name: "Base", color: "#3886f7" },
  1: { name: "Ethereum", color: "#627eea" },
  56: { name: "BNB Chain", color: "#f3ba2f" },
  42161: { name: "Arbitrum", color: "#28a0f0" },
  42220: { name: "Celo", color: "#35d07f" },
  2741: { name: "Abstract", color: "#7c3aed" },
  10: { name: "Optimism", color: "#ff0420" },
  43114: { name: "Avalanche", color: "#e84142" },
  10143: { name: "Monad", color: "#836ef9" },
  137: { name: "Polygon", color: "#8247e5" },
  324: { name: "zkSync", color: "#4e529a" },
};

// ── Fetch agent from 8004scan API ──
async function fetchAgentFromScan(tokenId: number, preferredChain?: number): Promise<ScanAgent | null> {
  // If a preferred chain is given (from directory link), try it first
  const allChains = [84532, 11155111, 8453, 1, 56, 42161, 42220, 2741, 10143, 43114];
  const chainsToTry = preferredChain
    ? [preferredChain, ...allChains.filter(c => c !== preferredChain)]
    : allChains;

  for (const chainId of chainsToTry) {
    try {
      const res = await fetch(
        `https://8004scan.io/api/v1/public/agents/${chainId}/${tokenId}`,
        { next: { revalidate: 30 } }
      );
      if (res.ok) {
        const data = await res.json();
        const agent = data?.data ?? data;
        if (agent?.token_id) return agent as ScanAgent;
      }
    } catch {
      // Continue to next chain
    }
  }
  return null;
}

export default async function AgentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ chain?: string }>;
}) {
  const { id } = await params;
  const { chain: chainHint } = await searchParams;
  const tokenId = parseInt(id, 10);

  if (isNaN(tokenId)) {
    return <NotFoundPage />;
  }

  // If chain_id was passed from the directory, try that first
  const preferredChain = chainHint ? parseInt(chainHint, 10) : undefined;
  const scanAgent = await fetchAgentFromScan(tokenId, preferredChain);
  if (!scanAgent) {
    return <NotFoundPage />;
  }

  const chain = CHAIN_META[scanAgent.chain_id] ?? { name: `Chain ${scanAgent.chain_id}`, color: "#888" };
  const protocols = scanAgent.supported_protocols || [];

  // Try to fetch on-chain links and reputation (may not exist for all agents)
  let links: OnChainLink[] = [];
  let reputation = { reviewCount: 0, averageScore: 0 };
  try {
    links = await readAgentLinks(scanAgent.owner_address, tokenId);
  } catch { /* No links */ }
  try {
    reputation = await readReputation(tokenId);
  } catch { /* No reputation */ }

  // Find role-specific links
  const creatorLink = links.find((l) => l.role === "creator") ?? links[0] ?? null;
  const operatorLink = links.find((l) => l.role === "operator") ?? null;
  const allLinks = links;

  // Resolve creator's Ethos data
  const creatorEthosKey = creatorLink
    ? `profileId:${creatorLink.ethosProfileId}`
    : null;

  const [creatorScore, creatorProfile] = creatorEthosKey
    ? await Promise.all([
        getScore(creatorEthosKey),
        getProfileByUserkey(creatorEthosKey),
      ])
    : [null, null];

  const creatorMeta = creatorScore ? scoreLevelMeta(creatorScore.level) : null;
  const emoji = EMOJIS[tokenId % EMOJIS.length];

  // Resolve proof identity (hierarchy: ETHOS > ENS > Unverified)
  const hasEthosLink = !!creatorLink && !!creatorProfile;
  const identity = await resolveIdentity(
    tokenId,
    hasEthosLink,
    creatorLink?.ethosProfileId
  );

  // Determine roles present
  const roles: { role: AgentRole; wallet: string; source: string }[] = [];
  if (creatorLink) {
    roles.push({ role: "creator", wallet: creatorLink.humanWallet, source: "Link Registry" });
  }
  if (operatorLink) {
    roles.push({ role: "operator", wallet: operatorLink.humanWallet, source: "Link Registry" });
  }
  roles.push({ role: "owner", wallet: scanAgent.owner_address, source: "ERC-8004 NFT" });

  // Compute Lineage Score
  const scoringInput = buildScoringInput({
    ethosScore: creatorScore?.score ?? 1200,
    ethosProfileExists: !!creatorProfile,
    humanVerified: creatorProfile?.user.humanVerificationStatus === "VERIFIED",
    proofType: identity.proof?.proofType ?? "unverified",
    proofAge: identity.proof?.timestamp ? Math.floor(Date.now() / 1000) - identity.proof.timestamp : 0,
    reviewCount: reputation.reviewCount,
    averageScore: reputation.averageScore,
    linkCount: allLinks.length,
    linkAge: allLinks[0]?.createdAt ? Math.floor(Date.now() / 1000) - allLinks[0].createdAt : 0,
    agentAge: 0,
  });
  const lineageScore = computeLineageScore(scoringInput);

  return (
    <main>
      <div className="container">

        {/* Back nav */}
        <div style={{ paddingTop: 32, marginBottom: 28 }}>
          <Link href="/agents" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "0.875rem" }}>
            ← All Agents
          </Link>
        </div>

        {/* ═══════════════════════════════════════════════════════
            PANEL A: Agent ERC-8004 Identity
        ═══════════════════════════════════════════════════════ */}
        <PanelLabel
          letter="A"
          label="Agent Identity"
          sub={`ERC-8004 · ${chain.name} · Token #${tokenId}`}
          color="var(--accent)"
          liveTag
        />
        <div className="card" style={{ padding: 28, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: scanAgent.image_url && !scanAgent.image_url.includes("example.com")
                ? "transparent"
                : "linear-gradient(135deg, var(--accent), var(--accent-alt))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.75rem", flexShrink: 0, overflow: "hidden",
            }}>
              {scanAgent.image_url && !scanAgent.image_url.includes("example.com") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={scanAgent.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : emoji}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                <h1 style={{ fontFamily: "var(--font-head)", fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.5px" }}>
                  {scanAgent.name || `Agent #${tokenId}`}
                </h1>
                <span className="tag">ERC-8004</span>
                <span style={{
                  fontSize: "0.625rem", padding: "3px 10px",
                  borderRadius: 6, background: `${chain.color}22`,
                  color: chain.color, fontWeight: 600,
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: chain.color, display: "inline-block" }} />
                  {chain.name}
                </span>
                <span className="tag" style={{ color: "var(--green)" }}>
                  ● Registered
                </span>
                {reputation.reviewCount > 0 && (
                  <Link href={`/reputation?agent=${tokenId}`} className="tag" style={{ color: "#facc15", borderColor: "#facc1544", background: "#facc1511", textDecoration: "none" }}>
                    {"★".repeat(Math.round(reputation.averageScore / 100))}{" "}
                    {(reputation.averageScore / 100).toFixed(1)} ({reputation.reviewCount})
                  </Link>
                )}
              </div>
              {scanAgent.description && (
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 8 }}>
                  {scanAgent.description}
                </p>
              )}

              {/* Protocols */}
              {protocols.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                  {protocols.map(p => (
                    <span key={p} style={{
                      fontSize: "0.6875rem", padding: "3px 10px", borderRadius: 5, fontWeight: 600,
                      background: p === "MCP" ? "rgba(129,140,248,0.15)" :
                        p === "A2A" ? "rgba(34,197,94,0.15)" :
                        p === "OASF" ? "rgba(245,158,11,0.15)" :
                        "rgba(255,255,255,0.06)",
                      color: p === "MCP" ? "#818cf8" :
                        p === "A2A" ? "#22c55e" :
                        p === "OASF" ? "#f59e0b" : "var(--text-secondary)",
                    }}>{p}</span>
                  ))}
                </div>
              )}

              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", fontFamily: "monospace", marginBottom: 4 }}>
                ERC-8004 ID: eip155:{scanAgent.chain_id}:{scanAgent.contract_address?.slice(0, 10)}...#{tokenId}
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", fontFamily: "monospace" }}>
                Owner: {scanAgent.owner_address}
              </p>

              {/* Stats from 8004scan */}
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                {[
                  { label: "Score", val: scanAgent.total_score ? Math.round(scanAgent.total_score) : 0, icon: "⚡", color: "#f59e0b" },
                  { label: "Feedback", val: scanAgent.total_feedbacks ?? 0, icon: "💬", color: "var(--text-secondary)" },
                  { label: "Stars", val: scanAgent.star_count ?? 0, icon: "☆", color: "var(--text-secondary)" },
                ].map(s => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: "0.8125rem" }}>
                    <span>{s.icon}</span>
                    <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{s.val}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: "0.6875rem" }}>{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Contract links */}
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <a
              href={`https://8004scan.io/agents/${scanAgent.chain_id}/${tokenId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tag"
              style={{ fontSize: "0.8125rem", padding: "5px 12px" }}
            >
              View on 8004scan ↗
            </a>
            {scanAgent.chain_id === 84532 && (
              <a
                href={`https://base-sepolia.blockscout.com/token/${AGENT_REGISTRY_ADDRESS}/instance/${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="tag"
                style={{ fontSize: "0.8125rem", padding: "5px 12px" }}
              >
                Token on Blockscout ↗
              </a>
            )}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════
            LINEAGE SCORE BREAKDOWN
        ═══════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", marginLeft: 28 }}>
          <div style={{ width: 2, height: 32, background: "linear-gradient(to bottom, var(--accent), var(--accent-alt))", borderRadius: 2 }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Unified trust score
          </div>
        </div>

        <PanelLabel
          letter="★"
          label="Lineage Score"
          sub="ERC-8004 × Ethos · Normalized trust computation"
          color={lineageScore.color}
          liveTag
        />
        <div style={{ marginBottom: 12 }}>
          <ScoreBreakdown breakdown={lineageScore} />
        </div>

        {/* ═══════════════════════════════════════════════════════
            PANEL B: Human Proof — Identity Card
        ═══════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", marginLeft: 28 }}>
          <div style={{ width: 2, height: 32, background: "linear-gradient(to bottom, var(--accent), var(--accent-alt))", borderRadius: 2 }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            Human proof layer
          </div>
        </div>

        <PanelLabel
          letter="B"
          label="Human Proof"
          sub={identity.displayLabel}
          color={identity.isVerified ? "#22c55e" : "#94a3b8"}
          liveTag
        />
        <div className="card" style={{
          padding: 28, marginBottom: 12,
          borderColor: identity.isVerified ? "rgba(34,197,94,0.25)" : undefined,
          boxShadow: identity.isVerified ? "0 0 40px rgba(34,197,94,0.08)" : undefined,
        }}>

          {/* Proof status badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
            padding: "14px 18px", borderRadius: 12,
            background: identity.isVerified ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.02)",
            border: `1px solid ${identity.isVerified ? "rgba(34,197,94,0.15)" : "var(--border)"}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: identity.isVerified ? "rgba(34,197,94,0.12)" : "rgba(148,163,184,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1rem",
            }}>
              {identity.isVerified ? "✓" : "?"}
            </div>
            <div>
              <div style={{
                fontSize: "0.875rem", fontWeight: 600,
                color: identity.isVerified ? "#22c55e" : "var(--text-secondary)",
              }}>
                {identity.statusLabel}
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {identity.displayLabel}
              </div>
            </div>
          </div>

          {/* Identity card fields */}
          <div style={{
            display: "grid", gap: 14,
            padding: "18px 20px", borderRadius: 12,
            background: "rgba(255,255,255,0.02)", border: "1px solid var(--border)",
          }}>
            {/* Owner proof */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Owner proof</span>
              <span style={{ fontWeight: 600, fontFamily: "monospace" }}>
                {identity.ensProof
                  ? identity.ensProof.value
                  : identity.ethosProof
                    ? `ETHOS #${identity.ethosProof.value.replace("profileId:", "")}`
                    : `${scanAgent.owner_address.slice(0, 10)}...${scanAgent.owner_address.slice(-4)}`
                }
              </span>
            </div>

            {/* Proof type */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Proof type</span>
              <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: "0.75rem", letterSpacing: "0.5px" }}>
                {identity.proof?.proofType === "ethos" ? "ETHOS" :
                 identity.proof?.proofType === "ens" ? "ENS" :
                 "None"}
              </span>
            </div>

            {/* Status */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Status</span>
              <span style={{
                fontWeight: 600,
                color: identity.isVerified ? "#22c55e" : "#eab308",
              }}>
                {identity.isVerified ? "✓ Verified" : "Unverified"}
              </span>
            </div>

            {/* Linked human profile */}
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8125rem" }}>
              <span style={{ color: "var(--text-muted)" }}>Linked human profile</span>
              <span style={{ fontWeight: 600 }}>
                {creatorProfile
                  ? creatorProfile.user.displayName
                  : identity.ensProof
                    ? identity.ensProof.value
                    : "—"
                }
              </span>
            </div>
          </div>

          {/* Roles */}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: "0.6875rem", fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 10 }}>
              Roles
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {roles.map((r) => {
                const config = ROLE_CONFIG[r.role];
                return (
                  <div key={r.role} style={{
                    padding: "8px 14px", borderRadius: 10,
                    background: config.color + "12",
                    border: `1px solid ${config.color}33`,
                    display: "flex", flexDirection: "column", gap: 2,
                  }}>
                    <div style={{ fontSize: "0.75rem", fontWeight: 700, color: config.color }}>
                      {config.label}
                    </div>
                    <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {r.wallet.slice(0, 8)}...{r.wallet.slice(-4)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Verify via ENS link */}
          {!identity.isVerified && (
            <div style={{ marginTop: 20, textAlign: "center" }}>
              <Link
                href={`/verify/ens?agent=${tokenId}`}
                className="btn btn-primary"
                style={{ padding: "10px 24px", fontSize: "0.875rem" }}
              >
                Verify via ENS →
              </Link>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 8 }}>
                Prove ownership by signing with your ENS wallet
              </div>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            PANEL C: Accountability Links
        ═══════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", marginLeft: 28 }}>
          <div style={{ width: 2, height: 32, background: "linear-gradient(to bottom, var(--accent), #e879f955)", borderRadius: 2 }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {creatorEthosKey ? `Linked to Ethos · ${creatorEthosKey}` : "On-chain attestation links"}
          </div>
        </div>

        <PanelLabel
          letter="C"
          label="Accountability Links"
          sub={`AgentHumanLinkRegistry · ${allLinks.length} active link${allLinks.length !== 1 ? "s" : ""}`}
          color={allLinks.length > 0 ? (ROLE_LABELS[allLinks[0].role as LinkRole]?.color || "#94a3b8") : "#94a3b8"}
          liveTag
        />
        <div className="card" style={{ padding: 24, marginBottom: 12 }}>
          {allLinks.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {allLinks.map((link, i) => {
                const roleInfo = ROLE_LABELS[link.role as LinkRole] || { label: link.role, color: "#818cf8", desc: "" };
                return (
                  <div key={i} style={{ padding: 16, borderRadius: "var(--radius-sm)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <span style={{
                        padding: "3px 10px", borderRadius: "999px", fontSize: "0.75rem", fontWeight: 600,
                        color: roleInfo.color, background: roleInfo.color + "18", border: `1px solid ${roleInfo.color}44`,
                      }}>
                        {roleInfo.label}
                      </span>
                      <span className="tag" style={{ color: "var(--green)" }}>
                        ● {link.status}
                      </span>
                      <Link
                        href={`/explorer/link/${link.linkId}`}
                        style={{ fontSize: "0.75rem", color: "var(--accent)", marginLeft: "auto" }}
                      >
                        View Link #{link.linkId} →
                      </Link>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
                      <RegistryField label="Human Wallet" value={`${link.humanWallet.slice(0, 10)}…${link.humanWallet.slice(-6)}`} mono />
                      <RegistryField label="Ethos Profile ID" value={`#${link.ethosProfileId}`} mono />
                      <RegistryField label="Agent Token ID" value={`#${link.agentTokenId}`} mono />
                      <RegistryField label="Signed at" value={link.createdAt > 0 ? new Date(link.createdAt * 1000).toLocaleString() : "—"} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 24 }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginBottom: 12 }}>
                This agent has no active accountability links yet.
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
                The creator can sign an attestation at{" "}
                <Link href="/creator/link" style={{ color: "var(--accent)" }}>
                  /creator/link
                </Link>
              </p>
            </div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════════
            PANEL D: Creator Reputation (ETHOS)
        ═══════════════════════════════════════════════════════ */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 0", marginLeft: 28 }}>
          <div style={{ width: 2, height: 32, background: "linear-gradient(to bottom, #e879f955, #e879f9)", borderRadius: 2 }} />
          <div style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
            {creatorProfile ? "Ethos credibility data" : "No Ethos link"}
          </div>
        </div>

        <PanelLabel
          letter="D"
          label="Creator Reputation"
          sub="Ethos Network · Live credibility data"
          color="#e879f9"
          liveTag
        />
        <div
          className="card"
          style={{
            padding: 28, marginBottom: 48,
            borderColor: creatorMeta?.color ? creatorMeta.color + "55" : undefined,
            boxShadow: creatorMeta ? `0 0 40px ${creatorMeta.glow}` : undefined,
          }}
        >
          {creatorProfile ? (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 20, flexWrap: "wrap", marginBottom: 24 }}>
                {creatorProfile.user.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={creatorProfile.user.avatarUrl}
                    alt={creatorProfile.user.displayName}
                    style={{ width: 64, height: 64, borderRadius: "50%", border: "2px solid var(--border)", objectFit: "cover" }}
                  />
                ) : (
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, var(--accent), var(--accent-alt))", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "1.375rem" }}>
                    {creatorProfile.user.displayName[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 6 }}>
                    <span style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "1.1875rem" }}>
                      {creatorProfile.user.displayName}
                    </span>
                    {creatorProfile.user.username && (
                      <span style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>@{creatorProfile.user.username}</span>
                    )}
                    {creatorProfile.user.humanVerificationStatus === "VERIFIED" && (
                      <span className="tag" style={{ color: "var(--green)", borderColor: "#22c55e44", background: "#22c55e11" }}>✓ Human verified</span>
                    )}
                    <span className="tag" style={{ color: "#e879f9", borderColor: "#e879f944", background: "#e879f911" }}>Verified via ETHOS</span>
                  </div>
                  {creatorProfile.user.description && (
                    <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: 12 }}>
                      {creatorProfile.user.description}
                    </p>
                  )}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    {creatorScore && <ScoreBadge score={creatorScore.score} level={creatorScore.level} />}
                    <a
                      href={creatorProfile.user.links.profile}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-ghost"
                      style={{ padding: "6px 14px", fontSize: "0.8125rem" }}
                    >
                      View on Ethos ↗
                    </a>
                  </div>
                </div>
              </div>

              <div className="stats-row" style={{ paddingTop: 20, borderTop: "1px solid var(--border)" }}>
                <div className="stat">
                  <span className="stat-value" style={{ color: "var(--green)" }}>{creatorProfile.user.stats.review.received.positive}</span>
                  <span className="stat-label">Positive reviews</span>
                </div>
                <div className="stat">
                  <span className="stat-value" style={{ color: "var(--red)" }}>{creatorProfile.user.stats.review.received.negative}</span>
                  <span className="stat-label">Negative reviews</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{creatorProfile.user.stats.vouch.received.count}</span>
                  <span className="stat-label">Vouches received</span>
                </div>
                <div className="stat">
                  <span className="stat-value">{formatWei(Number(creatorProfile.user.stats.vouch.received.amountWeiTotal))}</span>
                  <span className="stat-label">ETH staked on them</span>
                </div>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: 20 }}>
              <p style={{ color: "var(--text-muted)", fontSize: "0.875rem" }}>
                No Ethos profile data available for this agent&apos;s creator.
              </p>
              <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem", marginTop: 8 }}>
                The creator can connect their Ethos profile at{" "}
                <a href="https://app.ethos.network" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent)" }}>
                  app.ethos.network ↗
                </a>
              </p>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}

// ── Sub-components ──────────────────────────────────────────────

function NotFoundPage() {
  return (
    <main className="container" style={{ padding: "96px 24px", textAlign: "center" }}>
      <h1 style={{ fontFamily: "var(--font-head)", fontSize: "2rem" }}>Agent not found</h1>
      <p style={{ color: "var(--text-secondary)", marginTop: 12, marginBottom: 24 }}>
        This token ID doesn&apos;t exist on the ERC-8004 Identity Registry or 8004scan.
      </p>
      <Link href="/agents" className="btn btn-ghost">← Back to directory</Link>
    </main>
  );
}

function PanelLabel({ letter, label, sub, color, liveTag }: { letter: string; label: string; sub: string; color: string; liveTag?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
      <div style={{ width: 28, height: 28, borderRadius: 8, background: color + "22", border: `1px solid ${color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font-head)", fontSize: "0.8125rem", fontWeight: 700, color, flexShrink: 0 }}>
        {letter}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: "var(--font-head)", fontWeight: 600, fontSize: "0.9375rem" }}>{label}</div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{sub}</div>
      </div>
      {liveTag && (
        <span className="tag" style={{ fontSize: "0.625rem", color: "var(--green)", borderColor: "#22c55e33", background: "#22c55e0a" }}>
          🔴 LIVE
        </span>
      )}
    </div>
  );
}

function RegistryField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", letterSpacing: "0.5px", textTransform: "uppercase", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: "0.875rem", fontFamily: mono ? "monospace" : undefined, color: "var(--text-primary)", fontWeight: 500 }}>{value}</div>
    </div>
  );
}
