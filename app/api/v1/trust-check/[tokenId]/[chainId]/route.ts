/**
 * GET /api/v1/trust-check/[tokenId]/[chainId]
 *
 * Quick trust check — returns PASS/FAIL with score.
 * Used by agents to check if another agent is trustworthy
 * before delegating work or interacting.
 *
 * Query: ?threshold=40 (minimum score to PASS, default 40)
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { scoreSnapshots } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { recomputeAgentScore } from "@/lib/engine/recompute";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string; chainId: string }> }
) {
  const { tokenId: tid, chainId: cid } = await params;
  const tokenId = parseInt(tid, 10);
  const chainId = parseInt(cid, 10);
  const url = new URL(request.url);
  const threshold = parseInt(url.searchParams.get("threshold") || "40", 10);

  if (isNaN(tokenId) || isNaN(chainId)) {
    return NextResponse.json({ error: "Invalid tokenId or chainId" }, { status: 400 });
  }

  const entityId = `${tokenId}:${chainId}`;

  // Get or compute score
  let snapshot = db.select().from(scoreSnapshots)
    .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1)
    .get();

  if (!snapshot) {
    await recomputeAgentScore(tokenId, chainId, "trust_check");
    snapshot = db.select().from(scoreSnapshots)
      .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
      .orderBy(desc(scoreSnapshots.createdAt))
      .limit(1)
      .get();
  }

  if (!snapshot) {
    return NextResponse.json({
      tokenId, chainId,
      trusted: false,
      reason: "no_score",
      message: "Agent has no score data available",
    });
  }

  const score = snapshot.displayedScore;
  const confidence = snapshot.confidence;
  const passed = score >= threshold && confidence >= 0.3;

  // Determine reason
  let reason = "passed";
  if (score < threshold) reason = "score_below_threshold";
  else if (confidence < 0.3) reason = "low_confidence";

  return NextResponse.json({
    tokenId,
    chainId,
    trusted: passed,
    score: Math.round(score),
    grade: snapshot.grade,
    confidence: Math.round(confidence * 100),
    threshold,
    reason,
    message: passed
      ? `Agent is trusted (score: ${Math.round(score)}, grade: ${snapshot.grade})`
      : `Agent did not pass trust check (${reason})`,
    checkedAt: new Date().toISOString(),
  });
}
