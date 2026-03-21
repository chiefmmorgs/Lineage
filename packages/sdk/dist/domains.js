/**
 * ============================================================
 *  @agenttrust/sdk — Domains Module
 * ============================================================
 *
 *  Resolve ENS (.eth), Basenames (.base.eth), and other
 *  domain names to wallet addresses. Works cross-chain.
 * ============================================================
 */
import { createPublicClient, http, } from "viem";
import { mainnet } from "viem/chains";
export class DomainsModule {
    constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    publicClient) {
        this.publicClient = publicClient;
    }
    /**
     * Resolve any supported domain name to a wallet address.
     * Automatically detects the domain type and routes to the correct resolver.
     *
     * Supported:
     *   - `.eth` — ENS on Ethereum mainnet
     *   - `.base.eth` — Basenames on Base L2
     *
     * @example
     * ```ts
     * const result = await sdk.domains.resolve("vitalik.eth");
     * console.log(result.address); // "0xd8dA6BF..."
     *
     * const base = await sdk.domains.resolve("myagent.base.eth");
     * console.log(base.address); // "0x..."
     * ```
     */
    async resolve(name) {
        const normalized = name.trim().toLowerCase();
        if (normalized.endsWith(".base.eth")) {
            return this.resolveBasename(normalized);
        }
        else if (normalized.endsWith(".eth")) {
            return this.resolveEns(normalized);
        }
        return {
            name: normalized,
            address: null,
            chain: "unknown",
            resolver: "none",
        };
    }
    /**
     * Resolve an ENS name (.eth) on Ethereum mainnet.
     */
    async resolveEns(name) {
        try {
            const mainnetClient = createPublicClient({
                chain: mainnet,
                transport: http(),
            });
            const address = await mainnetClient.getEnsAddress({ name });
            return {
                name,
                address: address ?? null,
                chain: "ethereum",
                resolver: "ens",
            };
        }
        catch {
            return { name, address: null, chain: "ethereum", resolver: "ens" };
        }
    }
    /**
     * Resolve a Basename (.base.eth) using the Base L2 universal resolver.
     */
    async resolveBasename(name) {
        try {
            const { normalize } = await import("viem/ens");
            const normalized = normalize(name);
            const address = await this.publicClient.getEnsAddress({
                name: normalized,
                universalResolverAddress: "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD",
            });
            return {
                name,
                address: address ?? null,
                chain: "base",
                resolver: "basenames",
            };
        }
        catch {
            return { name, address: null, chain: "base", resolver: "basenames" };
        }
    }
    /**
     * Check if a domain name is in a supported format.
     */
    isSupported(name) {
        const n = name.trim().toLowerCase();
        return n.endsWith(".eth") || n.endsWith(".base.eth");
    }
}
//# sourceMappingURL=domains.js.map