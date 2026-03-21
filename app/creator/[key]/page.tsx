import { getScore, getProfileByUserkey, formatWei, scoreLevelMeta } from "@/lib/ethos";
import ScoreBadge from "@/components/ScoreBadge";
import Link from "next/link";

/* Agents linked to this creator — in production, query contract events */
const CREATOR_AGENTS: Record<string, { id: number; name: string; emoji: string; desc: string; rep: number }[]> = {
  default: [
    { id: 1, name: "SentinelBot", emoji: "🛡", desc: "On-chain watchdog, monitors contract anomalies.", rep: 92 },
    { id: 2, name: "ArkaiveBot",  emoji: "📦", desc: "Archives memory checkpoints to Bitcoin via Stacks.", rep: 88 },
  ],
};

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  const userkey = decodeURIComponent(key);

  const [score, profile] = await Promise.all([
    getScore(userkey),
    getProfileByUserkey(userkey),
  ]);

  const meta = score ? scoreLevelMeta(score.level) : null;
  const agents = CREATOR_AGENTS["default"];
  const user = profile?.user;

  return (
    <main>
      <div className="container">

        {/* Back */}
        <div style={{ paddingTop: 32, marginBottom: 8 }}>
          <Link href="/creator" className="btn btn-ghost" style={{ padding: "8px 16px", fontSize: "0.875rem" }}>
            ← All Creators
          </Link>
        </div>

        {/* Profile hero */}
        <div className="profile-hero">
          {user?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="profile-avatar"
            />
          ) : (
            <div
              className="profile-avatar"
              style={{
                background: "linear-gradient(135deg, var(--accent), var(--accent-alt))",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: "2rem",
              }}
            >
              {userkey[0]?.toUpperCase() ?? "?"}
            </div>
          )}

          <div className="profile-meta">
            <h1 className="profile-name">
              {user?.displayName ?? userkey}
            </h1>
            {user?.username && (
              <p className="profile-handle">@{user.username}</p>
            )}
            {user?.description && (
              <p className="profile-bio">{user.description}</p>
            )}

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              {score ? (
                <ScoreBadge score={score.score} level={score.level} />
              ) : (
                <span className="tag">Ethos score unavailable</span>
              )}
              {user?.humanVerificationStatus === "VERIFIED" && (
                <span className="tag" style={{ color: "var(--green)", borderColor: "var(--green)44", background: "#22c55e11" }}>
                  ✓ Human verified
                </span>
              )}
              <a
                href={`https://app.ethos.network/profile/${userkey.replace("address:", "").replace("profileId:", "")}`}
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

        {/* Ethos stats */}
        {user && (
          <div className="card" style={{ padding: 28, marginBottom: 28, borderColor: meta?.color + "44", boxShadow: meta ? `0 0 40px ${meta.glow}` : undefined }}>
            <div className="stats-row">
              <div className="stat">
                <span className="stat-value" style={{ color: meta?.color }}>{score?.score ?? "—"}</span>
                <span className="stat-label">Credibility Score</span>
              </div>
              <div className="stat">
                <span className="stat-value">{user.stats.review.received.positive}</span>
                <span className="stat-label">Positive Reviews</span>
              </div>
              <div className="stat">
                <span className="stat-value" style={{ color: "var(--red)" }}>{user.stats.review.received.negative}</span>
                <span className="stat-label">Negative Reviews</span>
              </div>
              <div className="stat">
                <span className="stat-value">{user.stats.vouch.received.count}</span>
                <span className="stat-label">Vouches Received</span>
              </div>
              <div className="stat">
                <span className="stat-value">{formatWei(Number(user.stats.vouch.received.amountWeiTotal))}</span>
                <span className="stat-label">ETH Staked on Them</span>
              </div>
              <div className="stat">
                <span className="stat-value">{user.xpTotal.toLocaleString()}</span>
                <span className="stat-label">XP Total</span>
              </div>
            </div>
          </div>
        )}

        <div className="divider" style={{ margin: "32px 0" }} />

        {/* Agents created by this creator */}
        <div style={{ marginBottom: 48 }}>
          <div className="section-header" style={{ marginBottom: 28 }}>
            <h2 className="section-title" style={{ fontSize: "1.375rem" }}>Agents by this Creator</h2>
            <p className="section-sub" style={{ fontSize: "0.9rem" }}>
              These agents carry their own ERC-8004 identity on Base but are permanently linked back to this creator&apos;s Ethos score. Their actions reflect on this profile.
            </p>
          </div>

          <div className="grid-3">
            {agents.map((agent) => (
              <Link key={agent.id} href={`/agents/${agent.id}`} className="card agent-card">
                <div className="agent-card-top">
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div className="agent-avatar" style={{ width: 44, height: 44, fontSize: "1.1rem" }}>
                      {agent.emoji}
                    </div>
                    <div>
                      <div className="agent-name" style={{ fontSize: "0.9375rem" }}>{agent.name}</div>
                      <div className="agent-id">Agent #{agent.id}</div>
                    </div>
                  </div>
                  <span style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: "1rem", color: "var(--accent)" }}>
                    {agent.rep}
                  </span>
                </div>
                <p className="agent-desc">{agent.desc}</p>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </main>
  );
}
