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
import { LINK_REGISTRY_ABI, LINK_EIP712_TYPES, buildEIP712Domain } from "./constants.js";
export class SignaturesModule {
    constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicClient, linkRegistry, chainId) {
        this.linkRegistry = linkRegistry;
        this.publicClient = publicClient;
        this.domain = buildEIP712Domain(chainId, linkRegistry);
    }
    /**
     * Get the current nonce for a wallet (used in EIP-712 replay protection).
     */
    async getNonce(wallet) {
        try {
            return (await this.publicClient.readContract({
                address: this.linkRegistry,
                abi: LINK_REGISTRY_ABI,
                functionName: "nonces",
                args: [wallet],
            }));
        }
        catch {
            return BigInt(0);
        }
    }
    /**
     * Build the EIP-712 payload for signing.
     * Both human and agent wallets sign the exact same payload.
     */
    async buildPayload(params) {
        const nonce = await this.getNonce(params.signerAddress);
        const now = Math.floor(Date.now() / 1000);
        return {
            agentTokenId: BigInt(params.agentTokenId),
            ethosProfileId: BigInt(params.ethosProfileId),
            role: params.role,
            expiration: BigInt(params.expiration ?? 0),
            nonce,
            deadline: BigInt(now + (params.deadlineSeconds ?? 3600)),
        };
    }
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
    async sign(signer, payload) {
        const [account] = await signer.getAddresses();
        const signature = await signer.signTypedData({
            account,
            domain: this.domain,
            types: LINK_EIP712_TYPES,
            primaryType: "LinkAgent",
            message: {
                agentTokenId: payload.agentTokenId,
                ethosProfileId: payload.ethosProfileId,
                role: payload.role,
                expiration: payload.expiration,
                nonce: payload.nonce,
                deadline: payload.deadline,
            },
        });
        return {
            signer: account,
            signature: signature,
            payload,
        };
    }
}
//# sourceMappingURL=signatures.js.map