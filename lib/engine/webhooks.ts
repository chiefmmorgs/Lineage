/**
 * ============================================================
 *  Lineage — Webhook Delivery Engine
 * ============================================================
 *
 *  Listens for events on the event bus and dispatches them
 *  to all registered and active webhooks.
 *
 *  Security: Payloads are signed with the webhook secret.
 * ============================================================
 */

import { db } from "../db/index";
import { webhooks } from "../db/schema";
import { eventBus, LineageEvent } from "./events";
import crypto from "crypto";

/**
 * Start the webhook delivery engine.
 * Subscribes to the event bus and triggers deliveries.
 */
export function startWebhookEngine(): void {
  console.log("   🔗 Webhook engine started — listening for events...");

  eventBus.onAny(async (event: LineageEvent) => {
    try {
      await deliverEvent(event);
    } catch (error) {
       // Log but don't crash the worker
       console.error(`[WEBHOOK] Delivery loop error:`, error);
    }
  });
}

/**
 * Deliver a single event to all interested webhooks.
 */
async function deliverEvent(event: LineageEvent): Promise<void> {
  const allWebhooks = db.select().from(webhooks).all();
  
  const interested = allWebhooks.filter(w => {
    if (!w.isActive) return false;
    try {
      const events = JSON.parse(w.events) as string[];
      // Check for exact type match or wildcard (future)
      return events.includes(event.type) || events.includes("*");
    } catch {
      return false;
    }
  });

  if (interested.length === 0) return;

  console.log(`[WEBHOOK] Event ${event.type} triggered ${interested.length} deliveries`);

  for (const webhook of interested) {
    // Fire and forget (or add to a retry queue in future)
    dispatchWebhook(webhook, event).catch(err => {
      console.error(`[WEBHOOK] Failed to deliver to ${webhook.url}:`, err.message);
    });
  }
}

/**
 * Perform the actual HTTP POST to the agent's URL.
 */
async function dispatchWebhook(webhook: any, event: LineageEvent): Promise<void> {
  const payload = JSON.stringify({
    webhookId: webhook.id,
    event: event.type,
    data: event,
    timestamp: Date.now(),
  });

  // Security: Sign payload with secret
  const hmac = crypto.createHmac("sha256", webhook.secret);
  const signature = hmac.update(payload).digest("hex");

  const response = await fetch(webhook.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Lineage-Signature": signature,
      "X-Lineage-Event": event.type,
      "User-Agent": "Lineage-Webhook-Delivery/1.0",
    },
    body: payload,
    signal: AbortSignal.timeout(5000), // 5s timeout
  });

  if (!response.ok) {
     throw new Error(`HTTP ${response.status}`);
  }
}
