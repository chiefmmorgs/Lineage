/**
 * GET /api/v1/scores/[id]
 *
 * Returns the latest Lineage Score for an entity.
 * Entity ID format: "tokenId:chainId" for agents, wallet for humans.
 *
 * If no snapshot exists, triggers an on-demand recomputation.
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { scoreSnapshots } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { recomputeAgentScore } from "@/lib/engine/recompute";

// Initialize DB on first import
initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!id) {
    return NextResponse.json({ error: "Missing entity ID" }, { status: 400 });
  }

  // Parse entity ID — "tokenId:chainId" for agents
  const parts = id.split(":");
  const isAgent = parts.length === 2 && !isNaN(Number(parts[0])) && !isNaN(Number(parts[1]));

  // Try to get existing snapshot
  let snapshot = db.select().from(scoreSnapshots)
    .where(and(
      eq(scoreSnapshots.entityType, isAgent ? "agent" : "human"),
      eq(scoreSnapshots.entityId, id),
    ))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1)
    .get();

  // If no snapshot and it's an agent, compute on-demand
  if (!snapshot && isAgent) {
    const tokenId = parseInt(parts[0], 10);
    const chainId = parseInt(parts[1], 10);
    await recomputeAgentScore(tokenId, chainId, "on_demand");

    snapshot = db.select().from(scoreSnapshots)
      .where(and(
        eq(scoreSnapshots.entityType, "agent"),
        eq(scoreSnapshots.entityId, id),
      ))
      .orderBy(desc(scoreSnapshots.createdAt))
      .limit(1)
      .get();
  }

  if (!snapshot) {
    return NextResponse.json({ error: "No score found", entityId: id }, { status: 404 });
  }

  const breakdown = JSON.parse(snapshot.breakdown ?? "{}");

  return NextResponse.json({
    entityId: id,
    entityType: snapshot.entityType,
    lineageScore: snapshot.lineageScore,
    confidence: snapshot.confidence,
    displayedScore: snapshot.displayedScore,
    grade: snapshot.grade,
    label: snapshot.label,
    humanTrust: snapshot.humanTrust,
    agentTrust: snapshot.agentTrust,
    linkTrust: snapshot.linkTrust,
    previousScore: snapshot.previousScore,
    reason: snapshot.reason,
    breakdown,
    lastUpdated: new Date(snapshot.createdAt * 1000).toISOString(),
  });
}
