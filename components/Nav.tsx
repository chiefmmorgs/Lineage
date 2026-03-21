"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useEthosProfile } from "@/hooks/useEthosProfile";

export default function Nav() {
  const path = usePathname();
  const { login, ready, authenticated, user, logout } = usePrivy();
  const { profile, loading: ethosLoading } = useEthosProfile();

  const links = [
    { href: "/",           label: "⬡ Home" },
    { href: "/agents",     label: "Agents" },
    { href: "/explorer",   label: "Explorer" },
    { href: "/reputation", label: "Reputation" },
    { href: "/creator",    label: "Creators" },
  ];

  // Display name: Ethos username > X handle > truncated wallet
  const displayId = profile?.username
    ? `@${profile.username}`
    : user?.twitter?.username
      ? `@${user.twitter.username}`
      : user?.wallet?.address
        ? `${user.wallet.address.slice(0, 6)}…${user.wallet.address.slice(-4)}`
        : "Connected";

  return (
    <nav className="nav">
      <div className="container">
        <div className="nav-inner">

          <Link href="/" className="nav-logo" style={{ display: "flex", flexDirection: "column", lineHeight: 1.2, textDecoration: "none" }}>
            <span>⬡ Lineage Explorer</span>
            <span style={{ fontSize: "0.5625rem", fontWeight: 400, opacity: 0.5, WebkitTextFillColor: "var(--text-muted)", background: "none", WebkitBackgroundClip: "unset" }}>ERC-8004 Agent Identity</span>
          </Link>

          <div className="nav-links">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`nav-link${
                  l.href === "/" ? (path === "/" ? " active" : "") :
                  path.startsWith(l.href) ? " active" : ""
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Auth area */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!ready ? (
              <div className="btn btn-ghost" style={{ padding: "8px 18px", fontSize: "0.875rem", opacity: 0.5 }}>
                …
              </div>
            ) : authenticated ? (
              <>
                {/* Ethos score badge */}
                {profile?.score != null && (
                  <div
                    className="score-badge"
                    style={{
                      borderColor: levelColor(profile.level) + "55",
                      background: levelColor(profile.level) + "15",
                      color: levelColor(profile.level),
                    }}
                  >
                    <span style={{ fontSize: "0.65rem" }}>⬡</span>
                    {profile.score}
                  </div>
                )}
                {ethosLoading && (
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                    loading ethos…
                  </span>
                )}
                <Link
                  href="/creator/link"
                  className="btn btn-primary"
                  style={{ padding: "8px 18px", fontSize: "0.875rem" }}
                >
                  Link your agent
                </Link>
                <button
                  onClick={() => logout()}
                  className="nav-user-btn"
                  title="Sign out"
                >
                  {profile?.avatarUrl ? (
                    <img
                      src={profile.avatarUrl}
                      alt=""
                      style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div className="nav-user-avatar">
                      {displayId.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="nav-user-label">{displayId}</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => login()}
                className="btn btn-primary"
                id="nav-connect-wallet"
                style={{ padding: "8px 18px", fontSize: "0.875rem" }}
              >
                Connect
              </button>
            )}
          </div>

        </div>
      </div>
    </nav>
  );
}

function levelColor(level: string | null | undefined): string {
  const map: Record<string, string> = {
    untrusted: "#ef4444",
    questionable: "#f97316",
    neutral: "#94a3b8",
    known: "#60a5fa",
    established: "#818cf8",
    reputable: "#a78bfa",
    exemplary: "#c084fc",
    distinguished: "#e879f9",
    revered: "#f0abfc",
    renowned: "#ffffff",
  };
  return map[level ?? ""] ?? "#818cf8";
}
