/**
 * GET /api/v1/disputes/[id]
 *
 * View a specific dispute.
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { disputes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const disputeId = parseInt(id, 10);

  if (isNaN(disputeId)) {
    return NextResponse.json({ error: "Invalid dispute ID" }, { status: 400 });
  }

  const dispute = db.select().from(disputes)
    .where(eq(disputes.id, disputeId))
    .get();

  if (!dispute) {
    return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
  }

  return NextResponse.json({
    id: dispute.id,
    linkId: dispute.linkId,
    agentTokenId: dispute.agentTokenId,
    initiator: dispute.initiator,
    reason: dispute.reason,
    status: dispute.status,
    resolution: dispute.resolution,
    createdAt: new Date(dispute.createdAt * 1000).toISOString(),
    resolvedAt: dispute.resolvedAt ? new Date(dispute.resolvedAt * 1000).toISOString() : null,
  });
}
