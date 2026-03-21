/**
 * GET /api/v1/scores/[id]/explanation
 *
 * Returns a human-readable explanation of why this
 * entity has its current Lineage Score.
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { scoreSnapshots } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing entity ID" }, { status: 400 });
  }

  const parts = id.split(":");
  const entityType = parts.length === 2 && !isNaN(Number(parts[0])) ? "agent" : "human";

  const snapshot = db.select().from(scoreSnapshots)
    .where(and(
      eq(scoreSnapshots.entityType, entityType),
      eq(scoreSnapshots.entityId, id),
    ))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1)
    .get();

  if (!snapshot) {
    return NextResponse.json({ error: "No score found", entityId: id }, { status: 404 });
  }

  const breakdown = JSON.parse(snapshot.breakdown ?? "{}");

  // Generate human-readable key factors
  const factors: string[] = [];

  // Agent Trust factors
  if (snapshot.agentTrust >= 70) {
    factors.push(`Strong agent performance (${Math.round(snapshot.agentTrust)}/100 Agent Trust)`);
  } else if (snapshot.agentTrust >= 40) {
    factors.push(`Moderate agent performance (${Math.round(snapshot.agentTrust)}/100 Agent Trust)`);
  } else {
    factors.push(`Limited agent history (${Math.round(snapshot.agentTrust)}/100 Agent Trust)`);
  }

  if (breakdown.externalFeedbackCount > 0) {
    factors.push(`${breakdown.externalFeedbackCount} on-chain feedback${breakdown.externalFeedbackCount > 1 ? "s" : ""} (avg ${breakdown.avgFeedbackScore}/5)`);
  } else {
    factors.push("No on-chain feedback yet");
  }

  // Human Trust factors
  if (snapshot.humanTrust > 0) {
    if (snapshot.humanTrust >= 70) {
      factors.push(`Strong human credibility (${Math.round(snapshot.humanTrust)}/100 Human Trust)`);
    } else {
      factors.push(`Human credibility: ${Math.round(snapshot.humanTrust)}/100`);
    }
  }

  if (breakdown.hasEthos) {
    factors.push("Linked to verified Ethos profile");
  }

  if (breakdown.proofType && breakdown.proofType !== "unverified") {
    factors.push(`Identity verified via ${breakdown.proofType.toUpperCase()}`);
  }

  // ENS scoring factors
  if (breakdown.ensScore && breakdown.ensScore.total > 0) {
    const ens = breakdown.ensScore;
    factors.push(`🆔 ENS: ${ens.ensName} on ${ens.chainName} (+${ens.total}/20 points)`);
    if (ens.balance > 0) factors.push(`  💰 Balance tier: +${ens.balance} (wallet ~$${ens.walletBalance})`);
    if (ens.activity > 0) factors.push(`  📊 Activity tier: +${ens.activity} (${ens.txCount} txns)`);
    if (ens.bonus > 0) factors.push(`  🏆 Full activity bonus: +5`);
  }

  // Link Trust factors
  if (breakdown.linkCount > 0) {
    factors.push(`${breakdown.linkCount} active link${breakdown.linkCount > 1 ? "s" : ""}`);
    if (breakdown.mutualLinks > 0) {
      factors.push(`${breakdown.mutualLinks} mutual verification link${breakdown.mutualLinks > 1 ? "s" : ""}`);
    }
  } else {
    factors.push("No active links");
  }

  // Confidence
  if (snapshot.confidence >= 0.7) {
    factors.push(`High confidence (${Math.round(snapshot.confidence * 100)}%)`);
  } else if (snapshot.confidence >= 0.4) {
    factors.push(`Moderate confidence (${Math.round(snapshot.confidence * 100)}%) — more data needed`);
  } else {
    factors.push(`Low confidence (${Math.round(snapshot.confidence * 100)}%) — very limited data`);
  }

  return NextResponse.json({
    entityId: id,
    entityType,
    displayedScore: snapshot.displayedScore,
    grade: snapshot.grade,
    label: snapshot.label,
    keyFactors: factors,
    components: {
      humanTrust: Math.round(snapshot.humanTrust),
      agentTrust: Math.round(snapshot.agentTrust),
      linkTrust: Math.round(snapshot.linkTrust),
      confidence: Math.round(snapshot.confidence * 100),
    },
    formula: "Lineage Score = (0.38 × Agent Trust) + (0.37 × Human Trust) + (0.25 × Link Trust) × Confidence",
    lastUpdated: new Date(snapshot.createdAt * 1000).toISOString(),
  });
}
