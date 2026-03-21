/**
 * ============================================================
 *  @agenttrust/sdk — Read Module
 * ============================================================
 *
 *  Read-only queries against the AgentHumanLinkRegistry.
 *  No wallet or signer needed — works with a public client.
 * ============================================================
 */
import { LINK_REGISTRY_ABI } from "./constants.js";
import { LinkStatus, } from "./types.js";
export class ReadModule {
    constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicClient, linkRegistry) {
        this.publicClient = publicClient;
        this.linkRegistry = linkRegistry;
    }
    /**
     * Get all active links for a specific agent.
     *
     * @example
     * ```ts
     * const links = await sdk.read.getAgentLinks("0xAgent...", 1);
     * links.forEach(l => console.log(l.role, l.level));
     * ```
     */
    async getAgentLinks(agentWallet, agentTokenId) {
        try {
            const raw = await this.publicClient.readContract({
                address: this.linkRegistry,
                abi: LINK_REGISTRY_ABI,
                functionName: "getActiveAgentLinks",
                args: [agentWallet, BigInt(agentTokenId)],
            });
            const now = Math.floor(Date.now() / 1000);
            return raw.map((l) => parseLink(l, now));
        }
        catch {
            return [];
        }
    }
    /**
     * Get all link IDs for a human wallet address.
     */
    async getHumanLinkIds(humanWallet) {
        try {
            const ids = await this.publicClient.readContract({
                address: this.linkRegistry,
                abi: LINK_REGISTRY_ABI,
                functionName: "getHumanLinks",
                args: [humanWallet],
            });
            return ids.map(Number);
        }
        catch {
            return [];
        }
    }
    /**
     * Get all link IDs for an Ethos profile.
     */
    async getProfileLinkIds(ethosProfileId) {
        try {
            const ids = await this.publicClient.readContract({
                address: this.linkRegistry,
                abi: LINK_REGISTRY_ABI,
                functionName: "getProfileLinks",
                args: [BigInt(ethosProfileId)],
            });
            return ids.map(Number);
        }
        catch {
            return [];
        }
    }
    /**
     * Get a single link by ID.
     */
    async getLink(linkId) {
        try {
            const raw = await this.publicClient.readContract({
                address: this.linkRegistry,
                abi: LINK_REGISTRY_ABI,
                functionName: "getLink",
                args: [BigInt(linkId)],
            });
            const now = Math.floor(Date.now() / 1000);
            return parseLink(raw, now);
        }
        catch {
            return null;
        }
    }
    /**
     * Check if a specific link is currently active (not revoked, not expired).
     */
    async isLinkActive(linkId) {
        try {
            return (await this.publicClient.readContract({
                address: this.linkRegistry,
                abi: LINK_REGISTRY_ABI,
                functionName: "isLinkActive",
                args: [BigInt(linkId)],
            }));
        }
        catch {
            return false;
        }
    }
    /**
     * Get the full link record for each link ID, in batch.
     */
    async getLinksById(linkIds) {
        const results = await Promise.all(linkIds.map((id) => this.getLink(id)));
        return results.filter((l) => l !== null);
    }
}
function parseLink(raw, nowSeconds) {
    const expiration = Number(raw.expiration);
    const isExpired = expiration > 0 && expiration < nowSeconds;
    const isRevoked = raw.status === LinkStatus.Revoked;
    return {
        linkId: Number(raw.linkId),
        agentWallet: raw.agentWallet,
        agentTokenId: Number(raw.agentTokenId),
        humanWallet: raw.humanWallet,
        ethosProfileId: Number(raw.ethosProfileId),
        role: raw.role,
        level: raw.level,
        status: raw.status,
        createdAt: Number(raw.createdAt),
        expiration,
        isExpired,
        isActive: !isRevoked && !isExpired,
    };
}
//# sourceMappingURL=read.js.map