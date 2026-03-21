/**
 * GET /api/v1/scores/[id]/history
 *
 * Returns score snapshots over time for an entity.
 * Query params: ?limit=50 (default 50, max 200)
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
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);

  if (!id) {
    return NextResponse.json({ error: "Missing entity ID" }, { status: 400 });
  }

  const parts = id.split(":");
  const entityType = parts.length === 2 && !isNaN(Number(parts[0])) ? "agent" : "human";

  const snapshots = db.select().from(scoreSnapshots)
    .where(and(
      eq(scoreSnapshots.entityType, entityType),
      eq(scoreSnapshots.entityId, id),
    ))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(limit)
    .all();

  return NextResponse.json({
    entityId: id,
    entityType,
    count: snapshots.length,
    history: snapshots.map(s => ({
      displayedScore: s.displayedScore,
      lineageScore: s.lineageScore,
      confidence: s.confidence,
      grade: s.grade,
      humanTrust: s.humanTrust,
      agentTrust: s.agentTrust,
      linkTrust: s.linkTrust,
      previousScore: s.previousScore,
      reason: s.reason,
      timestamp: new Date(s.createdAt * 1000).toISOString(),
    })),
  });
}
