/**
 * ============================================================
 *  @agenttrust/sdk — Reputation Module
 * ============================================================
 *
 *  Read and write on-chain reputation for ERC-8004 agents.
 *  Uses the LineageReputationRegistry contract.
 * ============================================================
 */
import { REPUTATION_REGISTRY_ABI } from "./constants.js";
export class ReputationModule {
    constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicClient, reputationRegistry) {
        this.publicClient = publicClient;
        this.reputationRegistry = reputationRegistry;
    }
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
    async getScore(agentTokenId) {
        try {
            const result = await this.publicClient.readContract({
                address: this.reputationRegistry,
                abi: REPUTATION_REGISTRY_ABI,
                functionName: "getAverageScore",
                args: [BigInt(agentTokenId)],
            });
            return {
                averageScore: Number(result[0]),
                reviewCount: Number(result[1]),
            };
        }
        catch {
            return { averageScore: 0, reviewCount: 0 };
        }
    }
    /**
     * Get paginated feedback entries for an agent.
     *
     * @example
     * ```ts
     * const reviews = await sdk.reputation.getFeedback(1, 0, 10);
     * reviews.forEach(r => console.log(`${r.score}/5 by ${r.reviewer}`));
     * ```
     */
    async getFeedback(agentTokenId, offset = 0, limit = 20) {
        try {
            const results = await this.publicClient.readContract({
                address: this.reputationRegistry,
                abi: REPUTATION_REGISTRY_ABI,
                functionName: "getFeedback",
                args: [BigInt(agentTokenId), BigInt(offset), BigInt(limit)],
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            });
            return results.map((f) => ({
                reviewer: f.reviewer,
                agentTokenId: Number(f.agentTokenId),
                score: Number(f.score),
                comment: f.comment,
                timestamp: Number(f.timestamp),
            }));
        }
        catch {
            return [];
        }
    }
    /**
     * Check if a given reviewer has already reviewed an agent.
     */
    async hasReviewed(agentTokenId, reviewer) {
        try {
            return (await this.publicClient.readContract({
                address: this.reputationRegistry,
                abi: REPUTATION_REGISTRY_ABI,
                functionName: "hasReviewed",
                args: [BigInt(agentTokenId), reviewer],
            }));
        }
        catch {
            return false;
        }
    }
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
    async submitFeedback(walletClient, params) {
        if (params.score < 1 || params.score > 5) {
            throw new Error("Score must be between 1 and 5");
        }
        const [account] = await walletClient.getAddresses();
        return walletClient.writeContract({
            address: this.reputationRegistry,
            abi: REPUTATION_REGISTRY_ABI,
            functionName: "submitFeedback",
            args: [BigInt(params.agentTokenId), params.score, params.comment],
            account,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            chain: walletClient.chain,
        });
    }
}
//# sourceMappingURL=reputation.js.map