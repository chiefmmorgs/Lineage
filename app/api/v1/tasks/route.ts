/**
 * POST /api/v1/tasks — Report a task completion
 * GET  /api/v1/tasks — Not implemented (use agent-specific endpoint)
 *
 * Body: { agentTokenId, chainId, humanWallet?, taskType, outcome, details? }
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { tasks, scoreEvents } from "@/lib/db/schema";
import { eventBus } from "@/lib/engine/events";

initializeDatabase();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentTokenId, chainId, humanWallet, taskType, outcome, details } = body;

    if (!agentTokenId || !taskType || !outcome) {
      return NextResponse.json(
        { error: "Missing required fields: agentTokenId, taskType, outcome" },
        { status: 400 }
      );
    }

    const validOutcomes = ["success", "failure", "partial"];
    if (!validOutcomes.includes(outcome)) {
      return NextResponse.json(
        { error: `outcome must be one of: ${validOutcomes.join(", ")}` },
        { status: 400 }
      );
    }

    const ts = now();

    const result = db.insert(tasks).values({
      agentTokenId: Number(agentTokenId),
      humanWallet: humanWallet || null,
      taskType,
      outcome,
      details: JSON.stringify(details || {}),
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

    // Emit to event bus (future: trigger score recomputation)
    eventBus.emit({
      type: "agent.feedback",
      agentTokenId: Number(agentTokenId),
      chainId: Number(chainId || 84532),
      reviewer: humanWallet || "system",
      score: outcome === "success" ? 5 : outcome === "partial" ? 3 : 1,
      comment: `Task: ${taskType} — ${outcome}`,
      timestamp: ts,
    });

    return NextResponse.json({
      success: true,
      taskId: result.lastInsertRowid,
      message: `Task reported: ${taskType} → ${outcome}`,
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
