/**
 * ScoreBreakdown — Public-facing scoring UI
 *
 * Shows the Lineage Score with a full breakdown:
 *   - Displayed Score (big number + grade)
 *   - Three pillars: Human Trust, Agent Trust, Link Trust
 *   - Confidence multiplier
 *   - Anti-spam stats
 */

import type { LineageScoreBreakdown } from "@/lib/scoring";

interface Props {
  breakdown: LineageScoreBreakdown;
}

export default function ScoreBreakdown({ breakdown }: Props) {
  const {
    displayedScore,
    lineageScore,
    confidence,
    grade,
    label,
    color,
    humanTrust,
    agentTrust,
    linkTrust,
    feedbackFiltered,
    feedbackUsed,
  } = breakdown;

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, overflow: "hidden",
    }}>

      {/* ── Header: Big Score ─────────────────────────── */}
      <div style={{
        padding: "24px 28px",
        background: `linear-gradient(135deg, ${color}08, ${color}15)`,
        borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", gap: 20,
      }}>
        {/* Score circle */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          background: `conic-gradient(${color} ${displayedScore * 3.6}deg, rgba(255,255,255,0.05) 0deg)`,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <div style={{
            width: 58, height: 58, borderRadius: "50%",
            background: "var(--bg-base)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexDirection: "column",
          }}>
            <span style={{ fontSize: "1.375rem", fontWeight: 800, color, lineHeight: 1 }}>
              {Math.round(displayedScore)}
            </span>
            <span style={{ fontSize: "0.5rem", color: "var(--text-muted)", letterSpacing: "0.5px" }}>
              /100
            </span>
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{
              fontFamily: "var(--font-head)", fontSize: "1.125rem",
              fontWeight: 700, color,
            }}>
              {grade}
            </span>
            <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>{label}</span>
          </div>
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            Lineage Score: {lineageScore.toFixed(1)} × {(confidence * 100).toFixed(0)}% confidence
          </div>
        </div>
      </div>

      {/* ── Three Pillars ─────────────────────────────── */}
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
        gap: 0,
      }}>
        {/* Human Trust */}
        <PillarCard
          title="Human Trust"
          weight="37%"
          score={humanTrust.total}
          icon="👤"
          color="#818cf8"
          rows={[
            { label: "Ethos Score", value: humanTrust.ethosNormalized, weight: "65%" },
            { label: "Identity Proof", value: humanTrust.identityProofStrength, weight: "20%" },
            { label: "History", value: humanTrust.historyScore, weight: "15%" },
          ]}
        />

        {/* Agent Trust */}
        <PillarCard
          title="Agent Trust"
          weight="38%"
          score={agentTrust.total}
          icon="🤖"
          color="#22c55e"
          rows={[
            { label: "ERC-8004 Score", value: agentTrust.erc8004Normalized, weight: "60%" },
            { label: "Reliability", value: agentTrust.reliabilityMetrics, weight: "25%" },
            { label: "Review Confidence", value: agentTrust.feedbackConfidence, weight: "15%" },
          ]}
          border
        />

        {/* Link Trust */}
        <PillarCard
          title="Link Trust"
          weight="25%"
          score={linkTrust.total}
          icon="🔗"
          color="#f59e0b"
          rows={[
            { label: "Shared Success", value: linkTrust.sharedSuccess, weight: "30%" },
            { label: "Scope", value: linkTrust.scopeCompliance, weight: "25%" },
            { label: "Disputes", value: linkTrust.disputeScore, weight: "20%" },
            { label: "Age", value: linkTrust.relationshipAge, weight: "15%" },
            { label: "Stability", value: linkTrust.revocationStability, weight: "10%" },
          ]}
        />
      </div>

      {/* ── Footer: Confidence + Anti-spam ────────────── */}
      <div style={{
        padding: "14px 28px",
        borderTop: "1px solid var(--border)",
        display: "flex", justifyContent: "space-between",
        fontSize: "0.6875rem", color: "var(--text-muted)",
      }}>
        <div style={{ display: "flex", gap: 16 }}>
          <span>
            Confidence: <strong style={{ color: "var(--text-secondary)" }}>
              {(confidence * 100).toFixed(0)}%
            </strong>
          </span>
          <span>
            Reviews used: <strong style={{ color: "var(--text-secondary)" }}>
              {feedbackUsed}
            </strong>
          </span>
          {feedbackFiltered > 0 && (
            <span>
              Filtered (spam): <strong style={{ color: "#ef4444" }}>
                {feedbackFiltered}
              </strong>
            </span>
          )}
        </div>
        <span style={{ fontSize: "0.625rem", opacity: 0.6 }}>
          Powered by ERC-8004 × Ethos
        </span>
      </div>
    </div>
  );
}

// ── Pillar sub-component ────────────────────────────────────────

function PillarCard({ title, weight, score, icon, color, rows, border }: {
  title: string;
  weight: string;
  score: number;
  icon: string;
  color: string;
  rows: { label: string; value: number; weight: string }[];
  border?: boolean;
}) {
  return (
    <div style={{
      padding: "20px 18px",
      borderLeft: border ? "1px solid var(--border)" : undefined,
      borderRight: border ? "1px solid var(--border)" : undefined,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        <span style={{ fontSize: "0.875rem" }}>{icon}</span>
        <span style={{ fontSize: "0.75rem", fontWeight: 700 }}>{title}</span>
        <span style={{
          fontSize: "0.5625rem", padding: "1px 5px", borderRadius: 4,
          background: `${color}15`, color, fontWeight: 600,
          marginLeft: "auto",
        }}>
          {weight}
        </span>
      </div>

      {/* Score bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: "0.6875rem", marginBottom: 4,
        }}>
          <span style={{ fontWeight: 700, color }}>{score.toFixed(0)}</span>
          <span style={{ color: "var(--text-muted)" }}>/100</span>
        </div>
        <div style={{
          height: 4, borderRadius: 2,
          background: "rgba(255,255,255,0.06)",
        }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${clamp(score, 0, 100)}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            transition: "width 0.6s ease",
          }} />
        </div>
      </div>

      {/* Breakdown rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((row) => (
          <div key={row.label} style={{
            display: "flex", alignItems: "center", gap: 6,
            fontSize: "0.625rem",
          }}>
            <span style={{ color: "var(--text-muted)", flex: 1, minWidth: 0 }}>
              {row.label}
            </span>
            <span style={{
              fontWeight: 600, color: "var(--text-secondary)",
              width: 28, textAlign: "right",
            }}>
              {row.value.toFixed(0)}
            </span>
            <span style={{
              fontSize: "0.5rem", color: "var(--text-muted)",
              width: 24, textAlign: "right", opacity: 0.7,
            }}>
              ×{row.weight}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
