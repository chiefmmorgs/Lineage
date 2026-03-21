/**
 * ============================================================
 *  Lineage — Recomputation Engine
 * ============================================================
 *
 *  Listens to the event bus and recalculates scores.
 *
 *  External data (Ethos scores, ERC-8004 feedback) is fetched
 *  on-demand from their APIs — never stored locally.
 *
 *  Only Lineage-owned data is read from the DB:
 *    links, platform feedback, proofs, disputes
 * ============================================================
 */

import { db, now } from "../db/index";
import { links, feedback, scoreSnapshots, proofs, scoreEvents } from "../db/schema";
import { eventBus } from "./events";
import { calculateENSScore, type ENSScore } from "./ens-scoring";
import { eq, and, desc } from "drizzle-orm";

// ── External data fetchers ────────────────────────────────────────

const ETHOS_API = "https://api.ethos.network/v1";
const SCAN_API = "https://8004scan.io/api/v1/public";

/** Fetch Ethos score for a profile (live from Ethos API) */
async function fetchEthosScore(profileId: number): Promise<{
  score: number;
  verified: boolean;
} | null> {
  try {
    const [scoreRes, profileRes] = await Promise.all([
      fetch(`${ETHOS_API}/score/profileId:${profileId}`, { signal: AbortSignal.timeout(5000) }),
      fetch(`${ETHOS_API}/profile/profileId:${profileId}`, { signal: AbortSignal.timeout(5000) }),
    ]);

    const score = scoreRes.ok
      ? (await scoreRes.json())?.data?.score ?? 1200
      : 1200;

    const verified = profileRes.ok
      ? (await profileRes.json())?.data?.user?.humanVerificationStatus === "VERIFIED"
      : false;

    return { score, verified };
  } catch {
    return null;
  }
}

/** Fetch ERC-8004 agent feedback stats (live from 8004scan) */
async function fetchAgentFeedback(tokenId: number, chainId: number): Promise<{
  avgScore: number;
  feedbackCount: number;
  totalScore: number;
} | null> {
  try {
    const res = await fetch(`${SCAN_API}/agents/${chainId}/${tokenId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const agent = data?.data ?? data;

    return {
      avgScore: agent?.average_feedback_score ?? 0,
      feedbackCount: agent?.total_feedbacks ?? 0,
      totalScore: agent?.total_score ?? 0,
    };
  } catch {
    return null;
  }
}

// ── Score computation ─────────────────────────────────────────────

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function normalizeEthos(ethosScore: number): number {
  return clamp(((ethosScore - 1200) / 1600) * 100 + 50, 0, 100);
}

function identityProofStrength(proofType: string): number {
  if (proofType === "ethos") return 95;
  if (proofType === "ens" || proofType === "basename") return 75;
  return 15;
}

/**
 * Compute Human Trust with ENS fixed-point addition.
 * ENS points (0–20) are added directly BEFORE the weighted formula.
 * This is a direct point addition, not a percentage weight.
 */
function computeHumanTrust(
  ethosScore: number,
  proofType: string,
  hasProfile: boolean,
  verified: boolean,
  ensPoints: number = 0,
): number {
  const ethos = normalizeEthos(ethosScore);
  const proof = identityProofStrength(proofType);
  const history = hasProfile ? (verified ? 80 : 50) : 10;
  const base = clamp(ethos * 0.65 + proof * 0.20 + history * 0.15, 0, 100);
  // ENS points added directly — up to 20 points on a 0–100 scale
  return clamp(base + ensPoints, 0, 100);
}

function computeAgentTrust(avgScore: number, feedbackCount: number): number {
  const erc8004 = avgScore > 0 ? clamp((avgScore - 1) * 25, 0, 100) : 30;
  const reliability = clamp(Math.min(feedbackCount / 20, 1) * 100, 0, 100);
  const confidence = feedbackCount > 10 ? 90 : feedbackCount > 5 ? 70 : feedbackCount > 2 ? 50 : 20;
  return clamp(erc8004 * 0.60 + reliability * 0.25 + confidence * 0.15, 0, 100);
}

function computeLinkTrust(activeCount: number, mutualCount: number, revokedCount: number, avgAgeSeconds: number): number {
  const sharedSuccess = activeCount > 0 ? clamp((mutualCount / activeCount) * 100, 0, 100) : 0;
  const compliance = activeCount > 0 ? clamp(((activeCount - revokedCount) / activeCount) * 100, 0, 100) : 0;
  const dispute = 100;
  const age = clamp(Math.min(avgAgeSeconds / (90 * 86400), 1) * 100, 0, 100);
  const stability = revokedCount === 0 ? 100 : clamp(100 - revokedCount * 20, 0, 100);

  return clamp(sharedSuccess * 0.30 + compliance * 0.25 + dispute * 0.20 + age * 0.15 + stability * 0.10, 0, 100);
}

function computeConfidence(feedbackCount: number, linkCount: number, hasEthos: boolean): number {
  let c = 0.1;
  if (hasEthos) c += 0.25;
  c += Math.min(feedbackCount / 15, 1) * 0.35;
  c += Math.min(linkCount / 5, 1) * 0.20;
  c += 0.10;
  return clamp(c, 0, 1);
}

function gradeFromScore(score: number): { grade: string; label: string; color: string } {
  if (score >= 90) return { grade: "A+", label: "Exceptional", color: "#22c55e" };
  if (score >= 80) return { grade: "A",  label: "Excellent",   color: "#34d399" };
  if (score >= 70) return { grade: "B+", label: "Very Good",   color: "#60a5fa" };
  if (score >= 60) return { grade: "B",  label: "Good",        color: "#818cf8" };
  if (score >= 50) return { grade: "C+", label: "Fair",        color: "#f59e0b" };
  if (score >= 40) return { grade: "C",  label: "Developing",  color: "#fb923c" };
  if (score >= 30) return { grade: "D",  label: "Low",         color: "#ef4444" };
  return { grade: "F", label: "New", color: "#6b7280" };
}

// ── Recompute score for an agent ──────────────────────────────────

export async function recomputeAgentScore(tokenId: number, chainId: number, reason: string) {
  const entityId = `${tokenId}:${chainId}`;
  const ts = now();

  // 1. Fetch live ERC-8004 data from 8004scan (external)
  const externalFeedback = await fetchAgentFeedback(tokenId, chainId);
  const avgScore = externalFeedback?.avgScore ?? 0;
  const externalFeedbackCount = externalFeedback?.feedbackCount ?? 0;

  // 2. Get platform feedback from our DB (Lineage-owned)
  const platformFeedback = db.select().from(feedback)
    .where(and(eq(feedback.agentTokenId, tokenId), eq(feedback.isValid, true)))
    .all();

  const totalFeedbackCount = externalFeedbackCount + platformFeedback.length;

  // 3. Get links from our DB (Lineage-owned)
  const agentLinks = db.select().from(links)
    .where(eq(links.agentTokenId, tokenId))
    .all();
  const activeLinks = agentLinks.filter(l => l.status === "active");
  const mutualLinks = activeLinks.filter(l => l.level === "mutual-verification");
  const revokedLinks = agentLinks.filter(l => l.status === "revoked");
  const avgLinkAge = activeLinks.length > 0
    ? activeLinks.reduce((sum, l) => sum + (ts - l.createdAt), 0) / activeLinks.length
    : 0;

  // 4. Fetch Ethos data for linked humans (external, on-demand)
  let humanTrust = 0;
  let hasEthos = false;
  let bestProofType = "unverified";
  let ensScore: ENSScore | null = null;

  if (activeLinks.length > 0) {
    const profileIds = [...new Set(activeLinks.map(l => l.ethosProfileId).filter(id => id > 0))];

    // Check for ENS proofs (Lineage-owned) and compute ENS score
    const agentProofs = db.select().from(proofs)
      .where(eq(proofs.agentTokenId, tokenId))
      .all();
    const bestProof = agentProofs.find(p => p.proofType === "ethos")
      || agentProofs.find(p => p.proofType === "ens")
      || agentProofs.find(p => p.proofType === "basename");
    if (bestProof) bestProofType = bestProof.proofType;

    // If there's a verified ENS proof, compute ENS fixed-point score
    const ensProof = agentProofs.find(p => p.proofType === "ens" && p.verified);
    if (ensProof) {
      ensScore = await calculateENSScore(ensProof.wallet, ensProof.value, chainId);
    }

    for (const profileId of profileIds) {
      const ethosData = await fetchEthosScore(profileId);
      if (ethosData) {
        hasEthos = true;

        const ht = computeHumanTrust(
          ethosData.score,
          bestProofType,
          true,
          ethosData.verified,
          ensScore?.total ?? 0,
        );
        humanTrust = Math.max(humanTrust, ht);
      }
    }

    // If no Ethos profile but has ENS, still add ENS points
    if (!hasEthos && ensScore && ensScore.total > 0) {
      humanTrust = computeHumanTrust(1200, bestProofType, false, false, ensScore.total);
    }
  }

  // 5. Compute component scores
  const agentTrust = computeAgentTrust(avgScore, totalFeedbackCount);
  const linkTrust = computeLinkTrust(activeLinks.length, mutualLinks.length, revokedLinks.length, avgLinkAge);
  const confidence = computeConfidence(totalFeedbackCount, activeLinks.length, hasEthos);

  // 6. Final weighted score
  const lineageScore = clamp(agentTrust * 0.38 + humanTrust * 0.37 + linkTrust * 0.25, 0, 100);
  const displayedScore = Math.round(lineageScore * confidence);
  const { grade, label, color } = gradeFromScore(displayedScore);

  // 7. Get previous score for delta tracking
  const lastSnapshot = db.select().from(scoreSnapshots)
    .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1)
    .get();
  const previousScore = lastSnapshot?.displayedScore ?? null;

  // 8. Store snapshot (Lineage-owned)
  db.insert(scoreSnapshots).values({
    entityType: "agent",
    entityId,
    lineageScore: Math.round(lineageScore * 100) / 100,
    confidence: Math.round(confidence * 1000) / 1000,
    displayedScore,
    grade,
    label,
    humanTrust: Math.round(humanTrust * 100) / 100,
    agentTrust: Math.round(agentTrust * 100) / 100,
    linkTrust: Math.round(linkTrust * 100) / 100,
    previousScore,
    reason,
    breakdown: JSON.stringify({
      externalFeedbackCount,
      platformFeedbackCount: platformFeedback.length,
      avgFeedbackScore: Math.round(avgScore * 100) / 100,
      linkCount: activeLinks.length,
      mutualLinks: mutualLinks.length,
      hasEthos,
      proofType: bestProofType,
      color,
      ensScore: ensScore ? {
        total: ensScore.total,
        verified: ensScore.verified,
        balance: ensScore.balance,
        activity: ensScore.activity,
        bonus: ensScore.bonus,
        ensName: ensScore.ensName,
        chainName: ensScore.chainName,
        walletBalance: ensScore.walletBalance,
        txCount: ensScore.txCount,
      } : null,
    }),
    createdAt: ts,
  }).run();

  // 9. Emit
  eventBus.emit({
    type: "score.recomputed",
    entityType: "agent",
    entityId,
    previousScore: previousScore ?? 0,
    newScore: displayedScore,
    reason,
    timestamp: ts,
  });

  const delta = previousScore !== null ? displayedScore - previousScore : 0;
  console.log(`  [SCORE] Agent ${entityId}: ${displayedScore} (${grade}) [Δ${delta > 0 ? "+" : ""}${delta}] — ${reason}`);
}

// ── Event handlers ────────────────────────────────────────────────

function handleAgentFeedback(event: { agentTokenId: number; chainId: number }) {
  recomputeAgentScore(event.agentTokenId, event.chainId, "new_feedback");
}

function handleAgentRegistered(event: { agentTokenId: number; chainId: number }) {
  recomputeAgentScore(event.agentTokenId, event.chainId, "agent_registered");
}

function handleLinkCreated(event: { agentTokenId: number }) {
  // Look up which chain from the link itself
  const link = db.select().from(links)
    .where(eq(links.agentTokenId, event.agentTokenId))
    .get();
  const chainId = link?.chainId ?? 84532;
  recomputeAgentScore(event.agentTokenId, chainId, "link_created");
}

function handleLinkRevoked(event: { linkId: number }) {
  const link = db.select().from(links)
    .where(eq(links.linkId, event.linkId))
    .get();
  if (link) {
    recomputeAgentScore(link.agentTokenId, link.chainId, "link_revoked");
  }
}

function handleEthosUpdated(event: { wallet: string }) {
  const humanLinks = db.select().from(links)
    .where(eq(links.humanWallet, event.wallet))
    .all();
  for (const link of humanLinks) {
    recomputeAgentScore(link.agentTokenId, link.chainId, "ethos_score_changed");
  }
}

function handleProofVerified(event: { agentTokenId: number }) {
  const link = db.select().from(links)
    .where(eq(links.agentTokenId, event.agentTokenId))
    .get();
  const chainId = link?.chainId ?? 84532;
  recomputeAgentScore(event.agentTokenId, chainId, "proof_verified");
}

// ── Wire event bus ────────────────────────────────────────────────

export function startRecomputeEngine() {
  eventBus.on("agent.feedback", handleAgentFeedback);
  eventBus.on("agent.registered", handleAgentRegistered);
  eventBus.on("link.created", handleLinkCreated);
  eventBus.on("link.revoked", handleLinkRevoked);
  eventBus.on("ethos.updated", handleEthosUpdated);
  eventBus.on("proof.verified", handleProofVerified);
  console.log("[RECOMPUTE] Engine started — external data fetched on-demand");
}

export function stopRecomputeEngine() {
  eventBus.off("agent.feedback", handleAgentFeedback);
  eventBus.off("agent.registered", handleAgentRegistered);
  eventBus.off("link.created", handleLinkCreated);
  eventBus.off("link.revoked", handleLinkRevoked);
  eventBus.off("ethos.updated", handleEthosUpdated);
  eventBus.off("proof.verified", handleProofVerified);
  console.log("[RECOMPUTE] Engine stopped");
}
