/**
 * ============================================================
 *  @agenttrust/sdk — Read Module
 * ============================================================
 *
 *  Read-only queries against the AgentHumanLinkRegistry.
 *  No wallet or signer needed — works with a public client.
 * ============================================================
 */
import type { Address } from "viem";
import { type OnChainLink } from "./types.js";
export declare class ReadModule {
    private publicClient;
    private linkRegistry;
    constructor(publicClient: any, linkRegistry: Address);
    /**
     * Get all active links for a specific agent.
     *
     * @example
     * ```ts
     * const links = await sdk.read.getAgentLinks("0xAgent...", 1);
     * links.forEach(l => console.log(l.role, l.level));
     * ```
     */
    getAgentLinks(agentWallet: Address, agentTokenId: number): Promise<OnChainLink[]>;
    /**
     * Get all link IDs for a human wallet address.
     */
    getHumanLinkIds(humanWallet: Address): Promise<number[]>;
    /**
     * Get all link IDs for an Ethos profile.
     */
    getProfileLinkIds(ethosProfileId: number): Promise<number[]>;
    /**
     * Get a single link by ID.
     */
    getLink(linkId: number): Promise<OnChainLink | null>;
    /**
     * Check if a specific link is currently active (not revoked, not expired).
     */
    isLinkActive(linkId: number): Promise<boolean>;
    /**
     * Get the full link record for each link ID, in batch.
     */
    getLinksById(linkIds: number[]): Promise<OnChainLink[]>;
}
//# sourceMappingURL=read.d.ts.map