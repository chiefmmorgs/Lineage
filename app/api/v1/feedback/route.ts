/**
 * POST /api/v1/feedback
 *
 * Submit platform-level feedback on an agent.
 * This is separate from on-chain ERC-8004 feedback.
 *
 * Body: { agentTokenId, chainId, reviewer, score, comment?, category? }
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { feedback, scoreEvents } from "@/lib/db/schema";
import { eventBus } from "@/lib/engine/events";

initializeDatabase();

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const { agentTokenId, chainId, reviewer, score, comment, category } = body;

    // Validate
    if (!agentTokenId || !chainId || !reviewer || !score) {
      return NextResponse.json(
        { error: "Missing required fields: agentTokenId, chainId, reviewer, score" },
        { status: 400 }
      );
    }

    if (score < 1 || score > 5) {
      return NextResponse.json({ error: "Score must be 1–5" }, { status: 400 });
    }

    const ts = now();

    // Store feedback (Lineage-owned)
    const result = db.insert(feedback).values({
      agentTokenId: Number(agentTokenId),
      chainId: Number(chainId),
      reviewer: reviewer.toLowerCase(),
      score: Number(score),
      comment: comment || "",
      category: category || "general",
      createdAt: ts,
    }).run();

    // Log event
    db.insert(scoreEvents).values({
      eventType: "platform.feedback",
      entityType: "agent",
      entityId: `${agentTokenId}:${chainId}`,
      source: "platform",
      data: JSON.stringify({ reviewer, score, category }),
      createdAt: ts,
    }).run();

    // Emit to trigger recomputation
    eventBus.emit({
      type: "agent.feedback",
      agentTokenId: Number(agentTokenId),
      chainId: Number(chainId),
      reviewer: reviewer.toLowerCase(),
      score: Number(score),
      comment: comment || "",
      timestamp: ts,
    });

    return NextResponse.json({
      success: true,
      feedbackId: result.lastInsertRowid,
      message: "Feedback submitted — score recalculation triggered",
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
