/**
 * ============================================================
 *  @agenttrust/sdk — Signatures Module
 * ============================================================
 *
 *  EIP-712 typed data signing for the Mutual Verification Protocol.
 *
 *  Both the human wallet and the agent wallet sign the same
 *  structured payload. The registry verifies both signatures
 *  match before recording a Level 3 Mutual Verification.
 * ============================================================
 */
import type { WalletClient, Address } from "viem";
import type { LinkPayload, SignedProof } from "./types.js";
export declare class SignaturesModule {
    private linkRegistry;
    private domain;
    private publicClient;
    constructor(publicClient: any, linkRegistry: Address, chainId: number);
    /**
     * Get the current nonce for a wallet (used in EIP-712 replay protection).
     */
    getNonce(wallet: Address): Promise<bigint>;
    /**
     * Build the EIP-712 payload for signing.
     * Both human and agent wallets sign the exact same payload.
     */
    buildPayload(params: {
        signerAddress: Address;
        agentTokenId: number;
        ethosProfileId: number;
        role: number;
        expiration?: number;
        deadlineSeconds?: number;
    }): Promise<LinkPayload>;
    /**
     * Sign a link payload with the given wallet.
     * Works for both human claims and agent confirmations.
     *
     * @example
     * ```ts
     * const payload = await sdk.signatures.buildPayload({
     *   signerAddress: "0x...",
     *   agentTokenId: 1,
     *   ethosProfileId: 88,
     *   role: Role.Creator,
     * });
     * const proof = await sdk.signatures.sign(walletClient, payload);
     * ```
     */
    sign(signer: WalletClient, payload: LinkPayload): Promise<SignedProof>;
}
//# sourceMappingURL=signatures.d.ts.map