import { privateKeyToAccount } from "viem/accounts";
import type { LocalAccount, Address } from "viem";

/**
 * ============================================================
 *  Lineage SDK — Client
 * ============================================================
 *
 *  TypeScript SDK for the Lineage Trust Engine API.
 * ============================================================
 */

import type {
  LineageConfig,
  LineageScore,
  ScoreHistoryResponse,
  ScoreExplanation,
  LinkDetail,
  AgentLinksResponse,
  FeedbackSubmission,
  FeedbackResponse,
  AgentProfile,
  TaskSubmission,
  TaskResponse,
  TaskHistoryResponse,
  DisputeSubmission,
  DisputeResponse,
  DisputeDetail,
  AgentDisputesResponse,
  TrustCheckResponse,
  WebhookRegistration,
  WebhookResponse,
  WebhookListResponse,
  LineageError,
} from "./types";

const LINEAGE_DOMAIN = {
  name: "Lineage Trust Engine",
  version: "1",
  chainId: 84532,
  verifyingContract: "0x0000000000000000000000000000000000000000" as Address,
} as const;

const LINEAGE_TYPES = {
  Feedback: [
    { name: "agentTokenId", type: "uint256" },
    { name: "score", type: "uint8" },
    { name: "comment", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
  Task: [
    { name: "agentTokenId", type: "uint256" },
    { name: "taskType", type: "string" },
    { name: "outcome", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
  Webhook: [
    { name: "agentTokenId", type: "uint256" },
    { name: "url", type: "string" },
    { name: "events", type: "string[]" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

export class Lineage {
  private baseUrl: string;
  private timeout: number;
  private apiKey?: string;
  private signer?: LocalAccount;

  constructor(config: LineageConfig = {}) {
    this.baseUrl = (config.apiUrl || "http://localhost:3000").replace(/\/$/, "");
    this.timeout = config.timeout || 10000;
    this.apiKey = config.apiKey;

    if (config.signer) {
      if (typeof config.signer === "string") {
        this.signer = privateKeyToAccount(config.signer);
      } else {
        this.signer = config.signer;
      }
    }
  }

  // ── Internal fetch wrapper ──────────────────────────────────────

  private async request<T>(path: string, options: RequestInit = {}, signingType?: keyof typeof LINEAGE_TYPES): Promise<T> {
    const url = `${this.baseUrl}/api/v1${path}`;
    
    let bodyData: any = options.body ? JSON.parse(options.body as string) : {};

    // Auto-sign if signer and signingType provided
    if (this.signer && signingType) {
      const timestamp = Math.floor(Date.now() / 1000);
      bodyData.timestamp = timestamp;

      let message: any = {};
      if (signingType === "Feedback") {
        message = {
          agentTokenId: BigInt(bodyData.agentTokenId),
          score: bodyData.score,
          comment: bodyData.comment || "",
          timestamp: BigInt(timestamp),
        };
      } else if (signingType === "Task") {
        message = {
          agentTokenId: BigInt(bodyData.agentTokenId),
          taskType: bodyData.taskType,
          outcome: bodyData.outcome,
          timestamp: BigInt(timestamp),
        };
      } else if (signingType === "Webhook") {
        message = {
          agentTokenId: BigInt(bodyData.agentTokenId),
          url: bodyData.url,
          events: bodyData.events,
          timestamp: BigInt(timestamp),
        };
        bodyData.signerWallet = this.signer.address;
      }

      const signature = await this.signer.signTypedData({
        domain: LINEAGE_DOMAIN,
        types: LINEAGE_TYPES,
        primaryType: signingType,
        message,
      });

      bodyData.signature = signature;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
      ...((options.headers as Record<string, string>) || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
      body: (options.method === "POST" || options.method === "PUT") ? JSON.stringify(bodyData) : undefined,
      signal: AbortSignal.timeout(this.timeout),
    });

    const data = await res.json();

    if (!res.ok) {
      const err = data as LineageError;
      throw new LineageAPIError(err.error || `HTTP ${res.status}`, res.status, err);
    }

    return data as T;
  }

  // ── Scores ──────────────────────────────────────────────────────

  /** Get the latest Lineage Score for an entity. */
  async getScore(entityId: string): Promise<LineageScore> {
    return this.request<LineageScore>(`/scores/${encodeURIComponent(entityId)}`);
  }

  /** Get an agent's score using token ID and chain ID. */
  async getAgentScore(tokenId: number, chainId: number): Promise<LineageScore> {
    return this.getScore(`${tokenId}:${chainId}`);
  }

  /** Get score history (snapshots over time). */
  async getHistory(entityId: string, limit = 50): Promise<ScoreHistoryResponse> {
    return this.request<ScoreHistoryResponse>(
      `/scores/${encodeURIComponent(entityId)}/history?limit=${Math.min(limit, 200)}`
    );
  }

  /** Get a human-readable explanation of the current score. */
  async getExplanation(entityId: string): Promise<ScoreExplanation> {
    return this.request<ScoreExplanation>(
      `/scores/${encodeURIComponent(entityId)}/explanation`
    );
  }

  // ── Agent Profile ───────────────────────────────────────────────

  /**
   * Get the full agent profile in one call:
   * score + links + proofs + tasks + disputes + feedback
   */
  async getAgentProfile(tokenId: number, chainId: number): Promise<AgentProfile> {
    return this.request<AgentProfile>(`/agents/${tokenId}/${chainId}/profile`);
  }

  // ── Links ───────────────────────────────────────────────────────

  /** Get a specific link by its on-chain ID. */
  async getLink(linkId: number): Promise<LinkDetail> {
    return this.request<LinkDetail>(`/links/${linkId}`);
  }

  /** Get all links for an agent. */
  async getAgentLinks(tokenId: number, chainId: number, status?: string): Promise<AgentLinksResponse> {
    const qs = status ? `?status=${status}` : "";
    return this.request<AgentLinksResponse>(`/agents/${tokenId}/${chainId}/links${qs}`);
  }

  // ── Tasks ───────────────────────────────────────────────────────

  /** Report a task completion. */
  async reportTask(task: TaskSubmission): Promise<TaskResponse> {
    return this.request<TaskResponse>("/tasks", {
      method: "POST",
      body: JSON.stringify(task),
    }, "Task");
  }

  /** Get task history for an agent. */
  async getAgentTasks(tokenId: number, chainId: number, limit = 50): Promise<TaskHistoryResponse> {
    return this.request<TaskHistoryResponse>(`/agents/${tokenId}/${chainId}/tasks?limit=${limit}`);
  }

  // ── Disputes ────────────────────────────────────────────────────

  /** Open a new dispute. */
  async openDispute(dispute: DisputeSubmission): Promise<DisputeResponse> {
    return this.request<DisputeResponse>("/disputes", {
      method: "POST",
      body: JSON.stringify(dispute),
    });
  }

  /** View a specific dispute. */
  async getDispute(disputeId: number): Promise<DisputeDetail> {
    return this.request<DisputeDetail>(`/disputes/${disputeId}`);
  }

  /** Get all disputes for an agent. */
  async getAgentDisputes(tokenId: number, chainId: number, status?: string): Promise<AgentDisputesResponse> {
    const qs = status ? `?status=${status}` : "";
    return this.request<AgentDisputesResponse>(`/agents/${tokenId}/${chainId}/disputes${qs}`);
  }

  // ── Feedback ────────────────────────────────────────────────────

  /** Submit platform-level feedback on an agent. */
  async submitFeedback(feedback: FeedbackSubmission): Promise<FeedbackResponse> {
    return this.request<FeedbackResponse>("/feedback", {
      method: "POST",
      body: JSON.stringify(feedback),
    }, "Feedback");
  }

  // ── Trust Check ─────────────────────────────────────────────────

  /**
   * Quick trust check — returns PASS/FAIL.
   * Use before delegating work to another agent.
   *
   * @param threshold Minimum score to pass (default 40)
   */
  async checkTrust(tokenId: number, chainId: number, threshold = 40): Promise<TrustCheckResponse> {
    return this.request<TrustCheckResponse>(
      `/trust-check/${tokenId}/${chainId}?threshold=${threshold}`
    );
  }

  // ── Webhooks ────────────────────────────────────────────────────

  /** Register a webhook for event notifications. */
  async registerWebhook(webhook: WebhookRegistration): Promise<WebhookResponse> {
    return this.request<WebhookResponse>("/webhooks", {
      method: "POST",
      body: JSON.stringify(webhook),
    }, "Webhook");
  }

  /** List registered webhooks. */
  async getWebhooks(agentTokenId?: number): Promise<WebhookListResponse> {
    const qs = agentTokenId ? `?agentTokenId=${agentTokenId}` : "";
    return this.request<WebhookListResponse>(`/webhooks${qs}`);
  }

  // ── Badges ──────────────────────────────────────────────────────

  /**
   * Get the URL for an agent's SVG score badge.
   * Embed in websites, READMEs, or A2A protocol responses.
   */
  getBadgeUrl(tokenId: number, chainId: number): string {
    return `${this.baseUrl}/api/v1/badges/${tokenId}/${chainId}`;
  }

  // ── Utilities ───────────────────────────────────────────────────

  /** Check if the API is reachable. */
  async isHealthy(): Promise<boolean> {
    try {
      await fetch(`${this.baseUrl}/api/v1/scores/health`, {
        signal: AbortSignal.timeout(3000),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Get the base URL. */
  getApiUrl(): string {
    return this.baseUrl;
  }
}

// ── Custom error class ────────────────────────────────────────────

export class LineageAPIError extends Error {
  public status: number;
  public details: LineageError;

  constructor(message: string, status: number, details: LineageError) {
    super(message);
    this.name = "LineageAPIError";
    this.status = status;
    this.details = details;
  }
}

// ── Re-exports ────────────────────────────────────────────────────

export type {
  LineageConfig,
  LineageScore,
  ScoreHistoryResponse,
  ScoreSnapshot,
  ScoreExplanation,
  ScoreBreakdown,
  ENSScoreDetail,
  LinkDetail,
  AgentLinksResponse,
  FeedbackSubmission,
  FeedbackResponse,
  AgentProfile,
  TaskSubmission,
  TaskResponse,
  TaskSummary,
  TaskHistoryResponse,
  DisputeSubmission,
  DisputeResponse,
  DisputeDetail,
  DisputeSummary,
  AgentDisputesResponse,
  TrustCheckResponse,
  WebhookEvent,
  WebhookRegistration,
  WebhookResponse,
  WebhookListResponse,
  LineageError,
} from "./types";
