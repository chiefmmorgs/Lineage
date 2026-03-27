import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { tasks, scoreEvents } from "@/lib/db/schema";
import { eventBus } from "@/lib/engine/events";
import { verifySignature } from "@/lib/auth";

initializeDatabase();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentTokenId, chainId, humanWallet, taskType, outcome, details, signature, timestamp } = body;

    // 1. Basic Validation
    if (!agentTokenId || !taskType || !outcome || !signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing required fields: agentTokenId, taskType, outcome, signature, timestamp" },
        { status: 400 }
      );
    }

    const signer = humanWallet || "system"; // If not provided, assume system or look up in future

    // 2. Signature Verification (Security)
    const isValid = await verifySignature({
      address: humanWallet || "", // Must be provided for agent/human tasks
      signature,
      primaryType: "Task",
      message: {
        agentTokenId: BigInt(agentTokenId),
        taskType,
        outcome,
        timestamp: BigInt(timestamp),
      },
    });

    if (!isValid && humanWallet) { // Only enforce if humanWallet provided
       return NextResponse.json({ error: "Invalid EIP-712 signature" }, { status: 401 });
    }

    const ts = now();
    const result = db.insert(tasks).values({
      agentTokenId: Number(agentTokenId),
      humanWallet: humanWallet || null,
      taskType,
      outcome,
      details: JSON.stringify(details || {}),
      signature,
      signerWallet: humanWallet || null,
      createdAt: ts,
    }).run();

    // Log event
    db.insert(scoreEvents).values({
      eventType: "task.completed",
      entityType: "agent",
      entityId: `${agentTokenId}:${chainId || 84532}`,
      source: "platform",
      data: JSON.stringify({ taskType, outcome, humanWallet }),
      createdAt: ts,
    }).run();

    // Emit to event bus
    eventBus.emit({
      type: "task.completed",
      agentTokenId: Number(agentTokenId),
      humanWallet: humanWallet || "system",
      outcome: outcome as any,
      timestamp: ts,
    });

    return NextResponse.json({
      success: true,
      taskId: result.lastInsertRowid,
      message: `Task reported: ${taskType} → ${outcome}`,
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Task reporting error:", error);
    return NextResponse.json({ error: "Invalid request or internal error" }, { status: 400 });
  }
}
