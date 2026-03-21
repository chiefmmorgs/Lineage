/**
 * GET /api/v1/agents/[tokenId]/[chainId]/disputes
 *
 * Returns all disputes for an agent.
 * Query: ?status=open (optional filter)
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { disputes } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string; chainId: string }> }
) {
  const { tokenId: tid } = await params;
  const tokenId = parseInt(tid, 10);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  if (isNaN(tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }

  let agentDisputes = db.select().from(disputes)
    .where(eq(disputes.agentTokenId, tokenId))
    .orderBy(desc(disputes.createdAt))
    .all();

  if (statusFilter) {
    agentDisputes = agentDisputes.filter(d => d.status === statusFilter);
  }

  return NextResponse.json({
    tokenId,
    total: agentDisputes.length,
    open: agentDisputes.filter(d => d.status === "open").length,
    resolved: agentDisputes.filter(d => d.status === "resolved").length,
    disputes: agentDisputes.map(d => ({
      id: d.id,
      linkId: d.linkId,
      initiator: d.initiator,
      reason: d.reason,
      status: d.status,
      resolution: d.resolution,
      createdAt: new Date(d.createdAt * 1000).toISOString(),
      resolvedAt: d.resolvedAt ? new Date(d.resolvedAt * 1000).toISOString() : null,
    })),
  });
}
