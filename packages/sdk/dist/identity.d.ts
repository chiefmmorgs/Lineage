/**
 * ============================================================
 *  @agenttrust/sdk — Identity Module
 * ============================================================
 *
 *  Wraps ERC-8004 agent registration:
 *    - mintAgent()   — Create a new agent identity
 *    - updateAgentURI() — Update the registration file
 *    - getAgent()    — Read agent identity
 * ============================================================
 */
import { type Address, type WalletClient } from "viem";
import type { AgentIdentity, MintResult } from "./types.js";
export declare class IdentityModule {
    private agentRegistry;
    private publicClient;
    constructor(publicClient: any, agentRegistry: Address);
    /**
     * Mint a new ERC-8004 agent identity.
     *
     * @example
     * ```ts
     * const result = await sdk.identity.mintAgent({
     *   signer: agentWalletClient,
     *   agentURI: "ipfs://QmAgent...",
     *   ethosProfile: "profileId:40028",
     * });
     * console.log(`Agent #${result.agentId} minted!`);
     * ```
     */
    mintAgent(params: {
        signer: WalletClient;
        agentURI: string;
        ethosProfile?: string;
    }): Promise<MintResult>;
    /**
     * Update the registration file URI for an existing agent.
     * Only the token owner can call this.
     *
     * @example
     * ```ts
     * await sdk.identity.updateAgentURI({
     *   signer: ownerWallet,
     *   agentId: 1,
     *   newURI: "ipfs://QmUpdated...",
     * });
     * ```
     */
    updateAgentURI(params: {
        signer: WalletClient;
        agentId: number;
        newURI: string;
    }): Promise<string>;
    /**
     * Read a single agent's identity from the ERC-8004 registry.
     */
    getAgent(tokenId: number): Promise<AgentIdentity | null>;
}
//# sourceMappingURL=identity.d.ts.map