import { getRecentProfiles, getScore, formatWei } from "@/lib/ethos";
import ScoreBadge from "@/components/ScoreBadge";
import Link from "next/link";

export default async function CreatorsPage() {
  const profiles = await getRecentProfiles(12);

  return (
    <main>
      <section className="section" style={{ paddingTop: 56 }}>
        <div className="container">
          <div className="section-header">
            <h1 className="section-title">Creator Profiles</h1>
            <p className="section-sub">
              Creators register their AI agents and stake their Ethos reputation on them.
              Every agent they deploy is traceable back to their credibility score, vouches, and on-chain history.
            </p>
          </div>

          {profiles.length > 0 ? (
            <div className="grid-3">
              {profiles.map((entry) => (
                <Link
                  key={entry.profile.id}
                  href={`/creator/${entry.user.userkeys[0]}`}
                  className="card agent-card"
                >
                  <div className="agent-card-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={entry.user.avatarUrl}
                        alt={entry.user.displayName}
                        className="profile-avatar"
                        style={{ width: 52, height: 52 }}
                      />
                      <div>
                        <div className="agent-name">{entry.user.displayName}</div>
                        <div className="agent-id">
                          {entry.user.username ? `@${entry.user.username}` : `Profile #${entry.profile.id}`}
                        </div>
                      </div>
                    </div>
                    <ScoreBadge score={entry.user.score} level={entry.user.score >= 1600 ? "reputable" : entry.user.score >= 800 ? "established" : "known"} size="sm" />
                  </div>

                  {entry.user.description && (
                    <p className="agent-desc">{entry.user.description}</p>
                  )}

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span className="tag">
                      ✅ {entry.user.stats.review.received.positive} reviews
                    </span>
                    <span className="tag">
                      🤝 {entry.user.stats.vouch.received.count} vouches
                    </span>
                    <span className="tag">
                      💎 {formatWei(Number(entry.user.stats.vouch.received.amountWeiTotal))}
                    </span>
                  </div>

                  {entry.user.humanVerificationStatus === "VERIFIED" && (
                    <div className="vouch-bar">
                      <span className="vouch-dot" />
                      Human verified
                    </div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <CreatorFallback />
          )}
        </div>
      </section>
    </main>
  );
}

function CreatorFallback() {
  /* Static preview when Ethos API is unreachable (e.g. offline dev) */
  const STATIC = [
    { name: "vitalik.eth", handle: "@VitalikButerin", score: 2640, level: "renowned" as const, reviews: 182, vouches: 94 },
    { name: "chief.eth",   handle: "@chief",           score: 1420, level: "established" as const, reviews: 34,  vouches: 12 },
    { name: "0xBuilder",  handle: "@0xBuilder",        score: 980,  level: "known" as const,        reviews: 11,  vouches: 6  },
  ];
  return (
    <div className="grid-3">
      {STATIC.map((c) => (
        <div key={c.name} className="card agent-card" style={{ opacity: 0.7 }}>
          <div className="agent-card-top">
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: "50%",
                  background: "linear-gradient(135deg, var(--accent), var(--accent-alt))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff", fontWeight: 700, fontSize: "1.1rem",
                }}
              >
                {c.name[0]}
              </div>
              <div>
                <div className="agent-name">{c.name}</div>
                <div className="agent-id">{c.handle}</div>
              </div>
            </div>
            <ScoreBadge score={c.score} level={c.level} size="sm" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <span className="tag">✅ {c.reviews} reviews</span>
            <span className="tag">🤝 {c.vouches} vouches</span>
          </div>
        </div>
      ))}
    </div>
  );
}
