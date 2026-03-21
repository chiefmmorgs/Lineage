/**
 * ============================================================
 *  Lineage SDK — Client
 * ============================================================
 *
 *  TypeScript SDK for the Lineage Trust Engine API.
 *
 *  Usage:
 *    import { Lineage } from "@lineage/sdk";
 *    const lineage = new Lineage({ apiUrl: "https://lineage.app" });
 *    const score = await lineage.getScore("1:84532");
 * ============================================================
 */
import type { LineageConfig, LineageScore, ScoreHistoryResponse, ScoreExplanation, LinkDetail, AgentLinksResponse, FeedbackSubmission, FeedbackResponse, AgentProfile, TaskSubmission, TaskResponse, TaskHistoryResponse, DisputeSubmission, DisputeResponse, DisputeDetail, AgentDisputesResponse, TrustCheckResponse, WebhookRegistration, WebhookResponse, WebhookListResponse, LineageError } from "./types";
export declare class Lineage {
    private baseUrl;
    private timeout;
    private apiKey?;
    constructor(config?: LineageConfig);
    private request;
    /** Get the latest Lineage Score for an entity. */
    getScore(entityId: string): Promise<LineageScore>;
    /** Get an agent's score using token ID and chain ID. */
    getAgentScore(tokenId: number, chainId: number): Promise<LineageScore>;
    /** Get score history (snapshots over time). */
    getHistory(entityId: string, limit?: number): Promise<ScoreHistoryResponse>;
    /** Get a human-readable explanation of the current score. */
    getExplanation(entityId: string): Promise<ScoreExplanation>;
    /**
     * Get the full agent profile in one call:
     * score + links + proofs + tasks + disputes + feedback
     */
    getAgentProfile(tokenId: number, chainId: number): Promise<AgentProfile>;
    /** Get a specific link by its on-chain ID. */
    getLink(linkId: number): Promise<LinkDetail>;
    /** Get all links for an agent. */
    getAgentLinks(tokenId: number, chainId: number, status?: string): Promise<AgentLinksResponse>;
    /** Report a task completion. */
    reportTask(task: TaskSubmission): Promise<TaskResponse>;
    /** Get task history for an agent. */
    getAgentTasks(tokenId: number, chainId: number, limit?: number): Promise<TaskHistoryResponse>;
    /** Open a new dispute. */
    openDispute(dispute: DisputeSubmission): Promise<DisputeResponse>;
    /** View a specific dispute. */
    getDispute(disputeId: number): Promise<DisputeDetail>;
    /** Get all disputes for an agent. */
    getAgentDisputes(tokenId: number, chainId: number, status?: string): Promise<AgentDisputesResponse>;
    /** Submit platform-level feedback on an agent. */
    submitFeedback(feedback: FeedbackSubmission): Promise<FeedbackResponse>;
    /**
     * Quick trust check — returns PASS/FAIL.
     * Use before delegating work to another agent.
     *
     * @param threshold Minimum score to pass (default 40)
     */
    checkTrust(tokenId: number, chainId: number, threshold?: number): Promise<TrustCheckResponse>;
    /** Register a webhook for event notifications. */
    registerWebhook(webhook: WebhookRegistration): Promise<WebhookResponse>;
    /** List registered webhooks. */
    getWebhooks(agentTokenId?: number): Promise<WebhookListResponse>;
    /**
     * Get the URL for an agent's SVG score badge.
     * Embed in websites, READMEs, or A2A protocol responses.
     */
    getBadgeUrl(tokenId: number, chainId: number): string;
    /** Check if the API is reachable. */
    isHealthy(): Promise<boolean>;
    /** Get the base URL. */
    getApiUrl(): string;
}
export declare class LineageAPIError extends Error {
    status: number;
    details: LineageError;
    constructor(message: string, status: number, details: LineageError);
}
export type { LineageConfig, LineageScore, ScoreHistoryResponse, ScoreSnapshot, ScoreExplanation, ScoreBreakdown, ENSScoreDetail, LinkDetail, AgentLinksResponse, FeedbackSubmission, FeedbackResponse, AgentProfile, TaskSubmission, TaskResponse, TaskSummary, TaskHistoryResponse, DisputeSubmission, DisputeResponse, DisputeDetail, DisputeSummary, AgentDisputesResponse, TrustCheckResponse, WebhookEvent, WebhookRegistration, WebhookResponse, WebhookListResponse, LineageError, } from "./types";
//# sourceMappingURL=index.d.ts.map