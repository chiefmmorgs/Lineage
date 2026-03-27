/**
 * ============================================================
 *  Lineage — Typed Event Bus
 * ============================================================
 *
 *  Central nervous system of the trust engine.
 *  All indexers emit events → event bus → recomputation engine.
 *
 *  Uses eventemitter3 (already in deps) with full TypeScript typing.
 * ============================================================
 */

import EventEmitter from "eventemitter3";

// ── Event Types ───────────────────────────────────────────────────

export interface AgentRegisteredEvent {
  type: "agent.registered";
  agentTokenId: number;
  chainId: number;
  owner: string;
  name: string;
  timestamp: number;
}

export interface AgentFeedbackEvent {
  type: "agent.feedback";
  agentTokenId: number;
  chainId: number;
  reviewer: string;
  score: number;
  comment: string;
  txHash?: string;
  timestamp: number;
}

export interface LinkCreatedEvent {
  type: "link.created";
  linkId: number;
  agentTokenId: number;
  humanWallet: string;
  agentWallet: string;
  role: string;
  level: string;
  timestamp: number;
}

export interface LinkRevokedEvent {
  type: "link.revoked";
  linkId: number;
  timestamp: number;
}

export interface LinkUpgradedEvent {
  type: "link.upgraded";
  linkId: number;
  previousLevel: string;
  newLevel: string;
  timestamp: number;
}

export interface EthosUpdatedEvent {
  type: "ethos.updated";
  wallet: string;
  previousScore: number;
  newScore: number;
  timestamp: number;
}

export interface ProofVerifiedEvent {
  type: "proof.verified";
  agentTokenId: number;
  proofType: string; // ethos | ens | basename
  value: string;
  wallet: string;
  timestamp: number;
}

export interface ScoreRecomputedEvent {
  type: "score.recomputed";
  entityType: "agent" | "human" | "link";
  entityId: string;
  previousScore: number;
  newScore: number;
  reason: string;
  timestamp: number;
}

export interface TaskCompletedEvent {
  type: "task.completed";
  agentTokenId: number;
  humanWallet: string;
  outcome: "success" | "failure" | "partial";
  timestamp: number;
}

export interface DisputeEvent {
  type: "dispute.opened" | "dispute.resolved";
  disputeId: number;
  linkId?: number;
  agentTokenId?: number;
  status: string;
  timestamp: number;
}

export interface AgentRecomputeEvent {
  type: "agent.recompute";
  agentTokenId: number;
  chainId: number;
  reason: string; // on_demand | refresh | feedback | link
  timestamp: number;
}

// ── Union type ────────────────────────────────────────────────────

export type LineageEvent =
  | AgentRegisteredEvent
  | AgentFeedbackEvent
  | LinkCreatedEvent
  | LinkRevokedEvent
  | LinkUpgradedEvent
  | EthosUpdatedEvent
  | ProofVerifiedEvent
  | ScoreRecomputedEvent
  | TaskCompletedEvent
  | DisputeEvent
  | AgentRecomputeEvent;

// Extract event type strings
export type LineageEventType = LineageEvent["type"];

// Map from event type string to the corresponding event interface
type EventMap = {
  "agent.registered": AgentRegisteredEvent;
  "agent.feedback": AgentFeedbackEvent;
  "link.created": LinkCreatedEvent;
  "link.revoked": LinkRevokedEvent;
  "link.upgraded": LinkUpgradedEvent;
  "ethos.updated": EthosUpdatedEvent;
  "proof.verified": ProofVerifiedEvent;
  "score.recomputed": ScoreRecomputedEvent;
  "task.completed": TaskCompletedEvent;
  "dispute.opened": DisputeEvent;
  "dispute.resolved": DisputeEvent;
  "agent.recompute": AgentRecomputeEvent;
};

// ── Singleton Event Bus ───────────────────────────────────────────

class LineageEventBus {
  private emitter = new EventEmitter();
  private eventLog: { event: LineageEvent; timestamp: number }[] = [];

  /**
   * Emit an event to all subscribers.
   * Also logs it for debugging and audit trail.
   */
  emit(event: LineageEvent): void {
    this.eventLog.push({ event, timestamp: Date.now() });

    // Keep only last 1000 events in memory
    if (this.eventLog.length > 1000) {
      this.eventLog = this.eventLog.slice(-500);
    }

    console.log(`[EVENT] ${event.type}`, JSON.stringify(event).slice(0, 200));
    this.emitter.emit(event.type, event);
    this.emitter.emit("*", event); // wildcard listeners
  }

  /**
   * Subscribe to a specific event type.
   */
  on<T extends keyof EventMap>(eventType: T, handler: (event: EventMap[T]) => void): void {
    this.emitter.on(eventType, handler as (...args: unknown[]) => void);
  }

  /**
   * Subscribe to ALL events (wildcard).
   */
  onAny(handler: (event: LineageEvent) => void): void {
    this.emitter.on("*", handler as (...args: unknown[]) => void);
  }

  /**
   * Subscribe once to a specific event type.
   */
  once<T extends keyof EventMap>(eventType: T, handler: (event: EventMap[T]) => void): void {
    this.emitter.once(eventType, handler as (...args: unknown[]) => void);
  }

  /**
   * Remove a listener.
   */
  off<T extends keyof EventMap>(eventType: T, handler: (event: EventMap[T]) => void): void {
    this.emitter.off(eventType, handler as (...args: unknown[]) => void);
  }

  /**
   * Get recent events (for debugging / admin UI).
   */
  getRecentEvents(count = 50): { event: LineageEvent; timestamp: number }[] {
    return this.eventLog.slice(-count);
  }

  /**
   * Get event counts by type (for monitoring).
   */
  getEventStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    for (const { event } of this.eventLog) {
      stats[event.type] = (stats[event.type] ?? 0) + 1;
    }
    return stats;
  }

  /**
   * Remove all listeners (for testing / shutdown).
   */
  removeAll(): void {
    this.emitter.removeAllListeners();
    this.eventLog = [];
  }
}

// Export singleton
export const eventBus = new LineageEventBus();
