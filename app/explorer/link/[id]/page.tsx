import { readLink, LINK_REGISTRY_ADDRESS, generateLinkHash } from "@/lib/contracts";
import Link from "next/link";

// ── Helpers ──────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; color: string; weight: string; desc: string }> = {
  creator:    { label: "Creator",    color: "#818cf8", weight: "100%", desc: "Built the agent. Full accountability." },
  operator:   { label: "Operator",   color: "#60a5fa", weight: "80%",  desc: "Runs the agent live. High responsibility." },
  maintainer: { label: "Maintainer", color: "#34d399", weight: "50%",  desc: "Maintains infrastructure. Shared responsibility." },
  delegate:   { label: "Delegate",   color: "#f59e0b", weight: "30%",  desc: "Secondary operator with limited scope." },
  renter:     { label: "Renter",     color: "#f472b6", weight: "Time-bound", desc: "Temporary operator. Link expires automatically." },
};

const LEVEL_META: Record<string, { label: string; color: string; icon: string; desc: string }> = {
  "self-claim":           { label: "Level 1 — Self Claim",          color: "#f59e0b", icon: "◑", desc: "Only the human wallet has signed. The agent has not confirmed the relationship." },
  "agent-confirmation":   { label: "Level 2 — Agent Confirmed",    color: "#60a5fa", icon: "◕", desc: "Only the agent wallet has signed. The human hasn't claimed yet." },
  "mutual-verification":  { label: "Level 3 — Mutual Verification", color: "#34d399", icon: "●", desc: "Both the human wallet and agent wallet signed. This is the strongest proof." },
};

function formatDate(unix: number) {
  if (!unix) return "—";
  return new Date(unix * 1000).toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

function shortAddr(addr: string) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

// ── Page ─────────────────────────────────────────────────────────

export const revalidate = 30; // re-fetch every 30s

export default async function LinkDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const linkId = parseInt(id);
  const link = await readLink(linkId);

  if (!link) {
    return (
      <main>
        <section className="section" style={{ paddingTop: 48 }}>
          <div className="container" style={{ maxWidth: 700, textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: "3rem", marginBottom: 16 }}>🔗</div>
            <h1 style={{ fontFamily: "var(--font-head)", fontSize: "1.5rem", fontWeight: 700, marginBottom: 8 }}>
              Link #{linkId} not found
            </h1>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
              This link ID doesn&apos;t exist in the registry. It may not have been created yet.
            </p>
            <Link href="/explorer" className="btn btn-ghost">
              ← Back to explorer
            </Link>
          </div>
        </section>
      </main>
    );
  }

  const role = ROLE_META[link.role] ?? ROLE_META.creator;
  const level = LEVEL_META[link.level] ?? LEVEL_META["self-claim"];
  const isActive = link.status === "active" && !link.isExpired;
  const blockscoutUrl = `https://base-sepolia.blockscout.com/address/${LINK_REGISTRY_ADDRESS}`;

  return (
    <main>
      <section className="section" style={{ paddingTop: 48, paddingBottom: 64 }}>
        <div className="container" style={{ maxWidth: 700 }}>

          {/* ── Back link ─────────────── */}
          <Link href="/explorer" style={{
            fontSize: "0.8125rem", color: "var(--text-muted)",
            textDecoration: "none", display: "inline-flex", gap: 6,
            marginBottom: 24
          }}>
            ← Back to explorer
          </Link>

          {/* ── Header card ─────────────── */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: "var(--radius-xl)", padding: "32px", marginBottom: 24,
            position: "relative", overflow: "hidden",
          }}>
            {/* Background glow */}
            <div style={{
              position: "absolute", top: -60, right: -60, width: 200, height: 200,
              borderRadius: "50%", background: `radial-gradient(circle, ${role.color}15, transparent 70%)`,
              pointerEvents: "none",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 500, marginBottom: 4 }}>
                  Verified Link
                </div>
                <h1 style={{
                  fontFamily: "var(--font-head)", fontSize: "1.75rem", fontWeight: 700,
                  color: "var(--text-primary)",
                }}>
                  Link <span style={{ color: role.color }}>#{link.linkId}</span>
                </h1>
              </div>

              {/* Status badge */}
              <div style={{
                padding: "6px 14px", borderRadius: 8,
                background: isActive ? "rgba(52,211,153,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${isActive ? "rgba(52,211,153,0.3)" : "rgba(239,68,68,0.3)"}`,
                color: isActive ? "#34d399" : "#ef4444",
                fontSize: "0.8125rem", fontWeight: 600,
              }}>
                {isActive ? "● Active" : link.isExpired ? "◌ Expired" : "✕ Revoked"}
              </div>
            </div>

            {/* Role + Level pills */}
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{
                padding: "6px 14px", borderRadius: 8,
                background: role.color + "15", border: `1px solid ${role.color}33`,
                color: role.color, fontWeight: 600, fontSize: "0.8125rem",
              }}>
                {role.label} · {role.weight}
              </div>
              <div style={{
                padding: "6px 14px", borderRadius: 8,
                background: level.color + "15", border: `1px solid ${level.color}33`,
                color: level.color, fontWeight: 600, fontSize: "0.8125rem",
              }}>
                {level.icon} {level.label}
              </div>
            </div>
          </div>

          {/* ── Details grid ─────────────── */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2,
            borderRadius: "var(--radius-lg)", overflow: "hidden",
            border: "1px solid var(--border)", marginBottom: 24,
          }}>
            {/* Human wallet */}
            <DetailCell
              label="Human Wallet"
              icon="👤"
              value={shortAddr(link.humanWallet)}
              mono
              sub={
                <a
                  href={`https://base-sepolia.blockscout.com/address/${link.humanWallet}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent)", fontSize: "0.6875rem" }}
                >
                  View on Blockscout ↗
                </a>
              }
            />
            {/* Agent wallet */}
            <DetailCell
              label="Agent Wallet"
              icon="🤖"
              value={shortAddr(link.agentWallet)}
              mono
              sub={
                <a
                  href={`https://base-sepolia.blockscout.com/address/${link.agentWallet}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent)", fontSize: "0.6875rem" }}
                >
                  View on Blockscout ↗
                </a>
              }
            />
            {/* Agent Token ID */}
            <DetailCell
              label="Agent Token ID"
              icon="🔢"
              value={`#${link.agentTokenId}`}
              sub={
                <Link href={`/agents/${link.agentTokenId}`} style={{ color: "var(--accent)", fontSize: "0.6875rem" }}>
                  View agent page →
                </Link>
              }
            />
            {/* Ethos Profile */}
            <DetailCell
              label="Ethos Profile ID"
              icon="⭐"
              value={`#${link.ethosProfileId}`}
              sub={
                <a
                  href={`https://app.ethos.network/profile/${link.ethosProfileId}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--accent)", fontSize: "0.6875rem" }}
                >
                  View on Ethos ↗
                </a>
              }
            />
            {/* Created */}
            <DetailCell
              label="Created"
              icon="📅"
              value={formatDate(link.createdAt)}
            />
            {/* Expiration */}
            <DetailCell
              label="Expiration"
              icon="⏳"
              value={link.expiration === 0 ? "Permanent" : formatDate(link.expiration)}
              sub={
                link.isExpired ? (
                  <span style={{ color: "#ef4444", fontSize: "0.6875rem", fontWeight: 500 }}>Expired</span>
                ) : link.expiration > 0 ? (
                  <span style={{ color: "#34d399", fontSize: "0.6875rem", fontWeight: 500 }}>Still active</span>
                ) : null
              }
            />
          </div>

          {/* ── Verification explanation ─── */}
          <div style={{
            background: level.color + "08", border: `1px solid ${level.color}22`,
            borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 24,
          }}>
            <div style={{
              fontFamily: "var(--font-head)", fontSize: "0.875rem",
              fontWeight: 600, color: level.color, marginBottom: 6,
            }}>
              {level.icon} {level.label}
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {level.desc}
            </p>
            {link.level !== "mutual-verification" && isActive && (
              <div style={{ marginTop: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <Link
                  href={`/upgrade?linkId=${generateLinkHash(link)}`}
                  className="btn btn-primary"
                  style={{ fontSize: "0.8125rem", padding: "8px 18px" }}
                >
                  🔗 Upgrade to Level 3 →
                </Link>
                <span style={{ fontSize: "0.8125rem", color: "var(--text-muted)" }}>
                  Add the missing agent signature to unlock Mutual Verification.
                </span>
              </div>
            )}
          </div>

          {/* ── Role explanation ─── */}
          <div style={{
            background: role.color + "08", border: `1px solid ${role.color}22`,
            borderRadius: "var(--radius-lg)", padding: "20px 24px", marginBottom: 24,
          }}>
            <div style={{
              fontFamily: "var(--font-head)", fontSize: "0.875rem",
              fontWeight: 600, color: role.color, marginBottom: 6,
            }}>
              {role.label} — {role.weight} accountability
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
              {role.desc}
            </p>
          </div>

          {/* ── External links ─── */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <a
              href={blockscoutUrl}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}
            >
              Registry on Blockscout ↗
            </a>
            <Link href={`/agents/${link.agentTokenId}`} className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}>
              Agent #{link.agentTokenId} page →
            </Link>
            <a
              href={`https://app.ethos.network/profile/${link.ethosProfileId}`}
              target="_blank" rel="noopener noreferrer"
              className="btn btn-ghost" style={{ fontSize: "0.8125rem" }}
            >
              Ethos Profile #{link.ethosProfileId} ↗
            </a>
          </div>

        </div>
      </section>
    </main>
  );
}

// ── Detail cell component ──

function DetailCell({
  label, icon, value, mono, sub,
}: {
  label: string;
  icon: string;
  value: string;
  mono?: boolean;
  sub?: React.ReactNode;
}) {
  return (
    <div style={{ padding: "16px 20px", background: "var(--bg-card)" }}>
      <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginBottom: 6, fontWeight: 500 }}>
        {icon} {label}
      </div>
      <div style={{
        fontSize: "0.9375rem", fontWeight: 600, color: "var(--text-primary)",
        fontFamily: mono ? "var(--font-mono)" : "inherit",
      }}>
        {value}
      </div>
      {sub && <div style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
