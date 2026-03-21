/**
 * GET /api/v1/agents/[tokenId]/[chainId]/tasks
 *
 * Returns task history for an agent.
 * Query: ?limit=50&outcome=success (optional filters)
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { tasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string; chainId: string }> }
) {
  const { tokenId: tid } = await params;
  const tokenId = parseInt(tid, 10);
  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
  const outcomeFilter = url.searchParams.get("outcome");

  if (isNaN(tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }

  let agentTasks = db.select().from(tasks)
    .where(eq(tasks.agentTokenId, tokenId))
    .orderBy(desc(tasks.createdAt))
    .limit(limit)
    .all();

  if (outcomeFilter) {
    agentTasks = agentTasks.filter(t => t.outcome === outcomeFilter);
  }

  const allTasks = db.select().from(tasks)
    .where(eq(tasks.agentTokenId, tokenId))
    .all();

  return NextResponse.json({
    tokenId,
    summary: {
      total: allTasks.length,
      success: allTasks.filter(t => t.outcome === "success").length,
      failure: allTasks.filter(t => t.outcome === "failure").length,
      partial: allTasks.filter(t => t.outcome === "partial").length,
      successRate: allTasks.length > 0
        ? Math.round((allTasks.filter(t => t.outcome === "success").length / allTasks.length) * 100)
        : 0,
    },
    tasks: agentTasks.map(t => ({
      id: t.id,
      taskType: t.taskType,
      outcome: t.outcome,
      humanWallet: t.humanWallet,
      details: JSON.parse(t.details || "{}"),
      createdAt: new Date(t.createdAt * 1000).toISOString(),
    })),
  });
}
