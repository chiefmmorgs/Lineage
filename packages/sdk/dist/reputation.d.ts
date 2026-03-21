/**
 * ============================================================
 *  @agenttrust/sdk — Reputation Module
 * ============================================================
 *
 *  Read and write on-chain reputation for ERC-8004 agents.
 *  Uses the LineageReputationRegistry contract.
 * ============================================================
 */
import type { Address, WalletClient } from "viem";
import type { AgentReputation, AgentFeedback } from "./types.js";
export declare class ReputationModule {
    private publicClient;
    private reputationRegistry;
    constructor(publicClient: any, reputationRegistry: Address);
    /**
     * Get the aggregated reputation score for an agent.
     *
     * @returns `{ averageScore, reviewCount }` where averageScore is scaled by 100
     *          (e.g., 450 = 4.50 out of 5).
     *
     * @example
     * ```ts
     * const rep = await sdk.reputation.getScore(1);
     * console.log(`${(rep.averageScore / 100).toFixed(2)} (${rep.reviewCount} reviews)`);
     * ```
     */
    getScore(agentTokenId: number): Promise<AgentReputation>;
    /**
     * Get paginated feedback entries for an agent.
     *
     * @example
     * ```ts
     * const reviews = await sdk.reputation.getFeedback(1, 0, 10);
     * reviews.forEach(r => console.log(`${r.score}/5 by ${r.reviewer}`));
     * ```
     */
    getFeedback(agentTokenId: number, offset?: number, limit?: number): Promise<AgentFeedback[]>;
    /**
     * Check if a given reviewer has already reviewed an agent.
     */
    hasReviewed(agentTokenId: number, reviewer: Address): Promise<boolean>;
    /**
     * Submit (or update) a review for an agent.
     * Requires a wallet client with a connected account.
     *
     * @example
     * ```ts
     * const tx = await sdk.reputation.submitFeedback(walletClient, {
     *   agentTokenId: 1,
     *   score: 5,
     *   comment: "Excellent agent, highly reliable!",
     * });
     * console.log("Tx:", tx);
     * ```
     */
    submitFeedback(walletClient: WalletClient, params: {
        agentTokenId: number;
        score: number;
        comment: string;
    }): Promise<`0x${string}`>;
}
//# sourceMappingURL=reputation.d.ts.map