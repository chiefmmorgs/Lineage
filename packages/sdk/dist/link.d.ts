/**
 * ============================================================
 *  @agenttrust/sdk — Link Module
 * ============================================================
 *
 *  The heart of the Mutual Verification Protocol.
 *
 *  Supports two modes:
 *
 *    Embedded mode (same runtime):
 *      sdk.link.signHumanClaim(...)
 *      sdk.link.signAgentConfirmation(...)
 *      sdk.link.submitVerifiedLink(...)
 *
 *    Intent mode (separate runtimes):
 *      creator: sdk.link.createIntent(...)
 *      agent:   sdk.link.acceptIntent(intent, ...)
 *      either:  sdk.link.finalizeIntent(intent, ...)
 * ============================================================
 */
import { type Address, type WalletClient } from "viem";
import { SignaturesModule } from "./signatures.js";
import type { Role, SignedProof, SubmitResult, LinkIntent, LinkPayload } from "./types.js";
export declare class LinkModule {
    private publicClient;
    private linkRegistry;
    private signatures;
    constructor(publicClient: any, linkRegistry: Address, signatures: SignaturesModule);
    /**
     * Human wallet signs a creator/operator claim.
     *
     * @example
     * ```ts
     * const humanProof = await sdk.link.signHumanClaim({
     *   signer: humanWallet,
     *   agentId: 1,
     *   ethosProfileId: 88,
     *   role: Role.Creator,
     * });
     * ```
     */
    signHumanClaim(params: {
        signer: WalletClient;
        agentId: number;
        ethosProfileId: number;
        role: Role;
        expiration?: number;
    }): Promise<SignedProof>;
    /**
     * Agent wallet signs confirmation of the human claim.
     *
     * @example
     * ```ts
     * const agentProof = await sdk.link.signAgentConfirmation({
     *   signer: agentWallet,
     *   agentId: 1,
     *   ethosProfileId: 88,
     *   role: Role.Creator,
     * });
     * ```
     */
    signAgentConfirmation(params: {
        signer: WalletClient;
        agentId: number;
        ethosProfileId: number;
        role: Role;
        expiration?: number;
    }): Promise<SignedProof>;
    /**
     * Submit a verified link with both proofs to the registry.
     *
     * @example
     * ```ts
     * const result = await sdk.link.submitVerifiedLink({
     *   submitter: anyWalletClient,
     *   agentWallet: "0x...",
     *   humanProof,
     *   agentProof,
     * });
     * ```
     */
    submitVerifiedLink(params: {
        submitter: WalletClient;
        agentWallet: Address;
        humanProof: SignedProof;
        agentProof?: SignedProof | null;
    }): Promise<SubmitResult>;
    /**
     * Create a link intent. The human signs first, producing a
     * portable intent object that can be passed to the agent.
     *
     * @example
     * ```ts
     * // Creator's app
     * const intent = await sdk.link.createIntent({
     *   humanSigner: creatorWallet,
     *   agentWallet: "0xAgent...",
     *   agentId: 1,
     *   ethosProfileId: 88,
     *   role: Role.Creator,
     * });
     * // Pass intent to agent service...
     * ```
     */
    createIntent(params: {
        humanSigner: WalletClient;
        agentWallet: Address;
        agentId: number;
        ethosProfileId: number;
        role: Role;
        expiration?: number;
    }): Promise<LinkIntent>;
    /**
     * Agent accepts an intent by signing the confirmation.
     *
     * @example
     * ```ts
     * // Agent's runtime
     * const accepted = await sdk.link.acceptIntent(intent, {
     *   signer: agentWallet,
     * });
     * ```
     */
    acceptIntent(intent: LinkIntent, params: {
        signer: WalletClient;
    }): Promise<LinkIntent>;
    /**
     * Finalize an intent by submitting both proofs on-chain.
     *
     * @example
     * ```ts
     * const result = await sdk.link.finalizeIntent(intent, {
     *   submitter: anyWalletClient,
     * });
     * ```
     */
    finalizeIntent(intent: LinkIntent, params: {
        submitter: WalletClient;
    }): Promise<SubmitResult>;
    /**
     * Revoke an existing link. Can be called by either
     * the human wallet or the agent wallet.
     */
    revokeLink(params: {
        signer: WalletClient;
        linkId: number;
    }): Promise<string>;
    /**
     * Upgrade a Level 1 or Level 2 link to Level 3 by adding
     * the missing signature.
     */
    upgradeLink(params: {
        signer: WalletClient;
        linkId: number;
        payload: LinkPayload;
    }): Promise<string>;
}
//# sourceMappingURL=link.d.ts.map