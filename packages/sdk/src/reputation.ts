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
import { REPUTATION_REGISTRY_ABI } from "./constants.js";
import type { AgentReputation, AgentFeedback } from "./types.js";

export class ReputationModule {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private publicClient: any,
    private reputationRegistry: Address,
  ) {}

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
  async getScore(agentTokenId: number): Promise<AgentReputation> {
    try {
      const result = await this.publicClient.readContract({
        address: this.reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getAverageScore",
        args: [BigInt(agentTokenId)],
      }) as [bigint, bigint];
      return {
        averageScore: Number(result[0]),
        reviewCount: Number(result[1]),
      };
    } catch {
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
  async getFeedback(
    agentTokenId: number,
    offset: number = 0,
    limit: number = 20,
  ): Promise<AgentFeedback[]> {
    try {
      const results = await this.publicClient.readContract({
        address: this.reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "getFeedback",
        args: [BigInt(agentTokenId), BigInt(offset), BigInt(limit)],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any[];
      return results.map((f) => ({
        reviewer: f.reviewer as Address,
        agentTokenId: Number(f.agentTokenId),
        score: Number(f.score),
        comment: f.comment as string,
        timestamp: Number(f.timestamp),
      }));
    } catch {
      return [];
    }
  }

  /**
   * Check if a given reviewer has already reviewed an agent.
   */
  async hasReviewed(agentTokenId: number, reviewer: Address): Promise<boolean> {
    try {
      return (await this.publicClient.readContract({
        address: this.reputationRegistry,
        abi: REPUTATION_REGISTRY_ABI,
        functionName: "hasReviewed",
        args: [BigInt(agentTokenId), reviewer],
      })) as boolean;
    } catch {
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
  async submitFeedback(
    walletClient: WalletClient,
    params: {
      agentTokenId: number;
      score: number;
      comment: string;
    },
  ): Promise<`0x${string}`> {
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
      chain: (walletClient as any).chain,
    });
  }
}
