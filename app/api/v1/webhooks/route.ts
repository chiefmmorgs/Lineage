/**
 * POST /api/v1/webhooks — Register a webhook
 * GET  /api/v1/webhooks — List registered webhooks
 *
 * Webhooks notify agents when:
 *   - score.changed
 *   - feedback.received
 *   - link.created
 *   - link.revoked
 *   - dispute.opened
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";

initializeDatabase();

// In-memory webhook store (will be persisted to DB in future)
// For now, this gives agents the ability to register and we can
// wire up the actual delivery in a subsequent iteration.

interface Webhook {
  id: number;
  agentTokenId: number;
  chainId: number;
  url: string;
  events: string[];
  secret: string;
  active: boolean;
  createdAt: number;
}

let nextId = 1;
const webhooks: Webhook[] = [];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentTokenId, chainId, url, events, secret } = body;

    if (!agentTokenId || !url || !events || !Array.isArray(events)) {
      return NextResponse.json(
        { error: "Missing required fields: agentTokenId, url, events[]" },
        { status: 400 }
      );
    }

    const validEvents = ["score.changed", "feedback.received", "link.created", "link.revoked", "dispute.opened"];
    const invalidEvents = events.filter((e: string) => !validEvents.includes(e));
    if (invalidEvents.length > 0) {
      return NextResponse.json(
        { error: `Invalid event types: ${invalidEvents.join(", ")}. Valid: ${validEvents.join(", ")}` },
        { status: 400 }
      );
    }

    const webhook: Webhook = {
      id: nextId++,
      agentTokenId: Number(agentTokenId),
      chainId: Number(chainId || 84532),
      url,
      events,
      secret: secret || "",
      active: true,
      createdAt: now(),
    };

    webhooks.push(webhook);

    return NextResponse.json({
      success: true,
      webhookId: webhook.id,
      message: "Webhook registered",
      events: webhook.events,
      note: "Webhook delivery is in preview. Events will be sent to your URL when triggered.",
    }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentTokenId = url.searchParams.get("agentTokenId");

  let filtered = webhooks;
  if (agentTokenId) {
    filtered = webhooks.filter(w => w.agentTokenId === Number(agentTokenId));
  }

  return NextResponse.json({
    total: filtered.length,
    webhooks: filtered.map(w => ({
      id: w.id,
      agentTokenId: w.agentTokenId,
      chainId: w.chainId,
      url: w.url,
      events: w.events,
      active: w.active,
      createdAt: new Date(w.createdAt * 1000).toISOString(),
    })),
  });
}

// Export for use by the event bus delivery system
export function getActiveWebhooks(): Webhook[] {
  return webhooks.filter(w => w.active);
}
