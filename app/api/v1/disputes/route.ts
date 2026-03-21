/**
 * POST /api/v1/disputes — Open a new dispute
 *
 * Body: { linkId?, agentTokenId?, initiator, reason }
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { disputes, scoreEvents } from "@/lib/db/schema";
import { eventBus } from "@/lib/engine/events";

initializeDatabase();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { linkId, agentTokenId, initiator, reason } = body;

    if (!initiator || !reason) {
      return NextResponse.json(
        { error: "Missing required fields: initiator, reason" },
        { status: 400 }
      );
    }

    if (!linkId && !agentTokenId) {
      return NextResponse.json(
        { error: "Must provide either linkId or agentTokenId" },
        { status: 400 }
      );
    }

    const ts = now();

    const result = db.insert(disputes).values({
      linkId: linkId ? Number(linkId) : null,
      agentTokenId: agentTokenId ? Number(agentTokenId) : null,
      initiator: initiator.toLowerCase(),
      reason,
      status: "open",
      createdAt: ts,
    }).run();

    // Log event
    db.insert(scoreEvents).values({
      eventType: "dispute.opened",
      entityType: linkId ? "link" : "agent",
      entityId: linkId ? `link:${linkId}` : `agent:${agentTokenId}`,
      source: "platform",
      data: JSON.stringify({ initiator, reason }),
      createdAt: ts,
    }).run();

    return NextResponse.json({
      success: true,
      disputeId: result.lastInsertRowid,
      status: "open",
      message: "Dispute opened",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
