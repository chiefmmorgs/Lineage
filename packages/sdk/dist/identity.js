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
import { encodeFunctionData, decodeEventLog, } from "viem";
import { AGENT_REGISTRY_ABI } from "./constants.js";
export class IdentityModule {
    constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicClient, agentRegistry) {
        this.agentRegistry = agentRegistry;
        this.publicClient = publicClient;
    }
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
    async mintAgent(params) {
        const { signer, agentURI, ethosProfile = "" } = params;
        const [account] = await signer.getAddresses();
        const data = encodeFunctionData({
            abi: AGENT_REGISTRY_ABI,
            functionName: "mintAgent",
            args: [agentURI, ethosProfile],
        });
        const hash = await signer.sendTransaction({
            account,
            chain: null,
            to: this.agentRegistry,
            data,
        });
        // Wait for receipt and parse AgentMinted event
        const receipt = await this.publicClient.waitForTransactionReceipt({ hash });
        let agentId = 0;
        for (const log of receipt.logs) {
            try {
                const decoded = decodeEventLog({
                    abi: AGENT_REGISTRY_ABI,
                    data: log.data,
                    topics: log.topics,
                });
                if (decoded.eventName === "AgentMinted") {
                    agentId = Number(decoded.args.agentId);
                    break;
                }
            }
            catch {
                // not our event
            }
        }
        return {
            txHash: hash,
            agentId,
            agentWallet: account,
            agentURI,
        };
    }
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
    async updateAgentURI(params) {
        const { signer, agentId, newURI } = params;
        const [account] = await signer.getAddresses();
        const data = encodeFunctionData({
            abi: AGENT_REGISTRY_ABI,
            functionName: "setAgentURI",
            args: [BigInt(agentId), newURI],
        });
        const hash = await signer.sendTransaction({
            account,
            chain: null,
            to: this.agentRegistry,
            data,
        });
        await this.publicClient.waitForTransactionReceipt({ hash });
        return hash;
    }
    /**
     * Read a single agent's identity from the ERC-8004 registry.
     */
    async getAgent(tokenId) {
        try {
            const [owner, agentURI, ethosProfile, isActive] = await Promise.all([
                this.publicClient.readContract({
                    address: this.agentRegistry,
                    abi: AGENT_REGISTRY_ABI,
                    functionName: "ownerOf",
                    args: [BigInt(tokenId)],
                }),
                this.publicClient.readContract({
                    address: this.agentRegistry,
                    abi: AGENT_REGISTRY_ABI,
                    functionName: "agentURI",
                    args: [BigInt(tokenId)],
                }),
                this.publicClient.readContract({
                    address: this.agentRegistry,
                    abi: AGENT_REGISTRY_ABI,
                    functionName: "ethosProfile",
                    args: [BigInt(tokenId)],
                }),
                this.publicClient.readContract({
                    address: this.agentRegistry,
                    abi: AGENT_REGISTRY_ABI,
                    functionName: "isActive",
                    args: [BigInt(tokenId)],
                }),
            ]);
            return {
                tokenId,
                owner: owner,
                agentURI: agentURI,
                ethosProfile: ethosProfile,
                isActive: isActive,
            };
        }
        catch {
            return null;
        }
    }
}
//# sourceMappingURL=identity.js.map