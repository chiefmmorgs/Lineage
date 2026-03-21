/**
 * ============================================================
 *  @agenttrust/sdk — Domains Module
 * ============================================================
 *
 *  Resolve ENS (.eth), Basenames (.base.eth), and other
 *  domain names to wallet addresses. Works cross-chain.
 * ============================================================
 */
import { type Address } from "viem";
/**
 * Result of a domain resolution attempt.
 */
export interface DomainResolution {
    name: string;
    address: Address | null;
    chain: string;
    resolver: string;
}
export declare class DomainsModule {
    private publicClient;
    constructor(publicClient: any);
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
    resolve(name: string): Promise<DomainResolution>;
    /**
     * Resolve an ENS name (.eth) on Ethereum mainnet.
     */
    resolveEns(name: string): Promise<DomainResolution>;
    /**
     * Resolve a Basename (.base.eth) using the Base L2 universal resolver.
     */
    resolveBasename(name: string): Promise<DomainResolution>;
    /**
     * Check if a domain name is in a supported format.
     */
    isSupported(name: string): boolean;
}
//# sourceMappingURL=domains.d.ts.map