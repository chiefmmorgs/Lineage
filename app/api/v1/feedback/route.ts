import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { feedback, scoreEvents } from "@/lib/db/schema";
import { eventBus } from "@/lib/engine/events";
import { verifySignature } from "@/lib/auth";

initializeDatabase();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentTokenId, chainId, reviewer, score, comment, signature, timestamp, category } = body;

    // 1. Basic Validation
    if (!agentTokenId || !chainId || !reviewer || !score || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: agentTokenId, chainId, reviewer, score, signature, timestamp" },
        { status: 400 }
      );
    }

    if (score < 1 || score > 5) {
      return NextResponse.json({ error: "Score must be 1–5" }, { status: 400 });
    }

    // 2. Signature Verification (Security)
    const isValid = await verifySignature({
      address: reviewer,
      signature,
      primaryType: "Feedback",
      message: {
        agentTokenId: BigInt(agentTokenId),
        score: Number(score),
        comment: comment || "",
        timestamp: BigInt(timestamp),
      },
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid EIP-712 signature" }, { status: 401 });
    }

    // 3. Stale Request Check (Prevent Replay)
    if (Math.abs(now() - Number(timestamp)) > 300) {
      return NextResponse.json({ error: "Request expired" }, { status: 400 });
    }

    const ts = now();

    // 4. Store feedback (Lineage-owned)
    const result = db.insert(feedback).values({
      agentTokenId: Number(agentTokenId),
      chainId: Number(chainId),
      reviewer: reviewer.toLowerCase(),
      score: Number(score),
      comment: comment || "",
      category: category || "general",
      signature,
      signerWallet: reviewer.toLowerCase(),
      createdAt: ts,
    }).run();

    // 5. Audit Log
    db.insert(scoreEvents).values({
      eventType: "platform.feedback",
      entityType: "agent",
      entityId: `${agentTokenId}:${chainId}`,
      source: "platform",
      data: JSON.stringify({ reviewer, score, category }),
      createdAt: ts,
    }).run();

    // 6. Push to Event Bus
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
    console.error("[API] Feedback submission error:", err);
    return NextResponse.json({ error: "Invalid request or internal error" }, { status: 400 });
  }
}
