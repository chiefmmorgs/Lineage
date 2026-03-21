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
import { LINK_REGISTRY_ABI } from "./constants.js";
import {
  type OnChainLink,
  type Role,
  type VerificationLevel,
  LinkStatus,
} from "./types.js";

export class ReadModule {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private publicClient: any,
    private linkRegistry: Address,
  ) {}

  /**
   * Get all active links for a specific agent.
   *
   * @example
   * ```ts
   * const links = await sdk.read.getAgentLinks("0xAgent...", 1);
   * links.forEach(l => console.log(l.role, l.level));
   * ```
   */
  async getAgentLinks(
    agentWallet: Address,
    agentTokenId: number,
  ): Promise<OnChainLink[]> {
    try {
      const raw = await this.publicClient.readContract({
        address: this.linkRegistry,
        abi: LINK_REGISTRY_ABI,
        functionName: "getActiveAgentLinks",
        args: [agentWallet, BigInt(agentTokenId)],
      });

      const now = Math.floor(Date.now() / 1000);
      return (raw as unknown as RawLink[]).map((l) => parseLink(l, now));
    } catch {
      return [];
    }
  }

  /**
   * Get all link IDs for a human wallet address.
   */
  async getHumanLinkIds(humanWallet: Address): Promise<number[]> {
    try {
      const ids = await this.publicClient.readContract({
        address: this.linkRegistry,
        abi: LINK_REGISTRY_ABI,
        functionName: "getHumanLinks",
        args: [humanWallet],
      });
      return (ids as bigint[]).map(Number);
    } catch {
      return [];
    }
  }

  /**
   * Get all link IDs for an Ethos profile.
   */
  async getProfileLinkIds(ethosProfileId: number): Promise<number[]> {
    try {
      const ids = await this.publicClient.readContract({
        address: this.linkRegistry,
        abi: LINK_REGISTRY_ABI,
        functionName: "getProfileLinks",
        args: [BigInt(ethosProfileId)],
      });
      return (ids as bigint[]).map(Number);
    } catch {
      return [];
    }
  }

  /**
   * Get a single link by ID.
   */
  async getLink(linkId: number): Promise<OnChainLink | null> {
    try {
      const raw = await this.publicClient.readContract({
        address: this.linkRegistry,
        abi: LINK_REGISTRY_ABI,
        functionName: "getLink",
        args: [BigInt(linkId)],
      });

      const now = Math.floor(Date.now() / 1000);
      return parseLink(raw as unknown as RawLink, now);
    } catch {
      return null;
    }
  }

  /**
   * Check if a specific link is currently active (not revoked, not expired).
   */
  async isLinkActive(linkId: number): Promise<boolean> {
    try {
      return (await this.publicClient.readContract({
        address: this.linkRegistry,
        abi: LINK_REGISTRY_ABI,
        functionName: "isLinkActive",
        args: [BigInt(linkId)],
      })) as boolean;
    } catch {
      return false;
    }
  }

  /**
   * Get the full link record for each link ID, in batch.
   */
  async getLinksById(linkIds: number[]): Promise<OnChainLink[]> {
    const results = await Promise.all(
      linkIds.map((id) => this.getLink(id)),
    );
    return results.filter((l): l is OnChainLink => l !== null);
  }
}

// ── Internal helpers ─────────────────────────────────────────────

interface RawLink {
  linkId: bigint;
  agentWallet: Address;
  agentTokenId: bigint;
  humanWallet: Address;
  ethosProfileId: bigint;
  role: number;
  level: number;
  status: number;
  createdAt: bigint;
  expiration: bigint;
}

function parseLink(raw: RawLink, nowSeconds: number): OnChainLink {
  const expiration = Number(raw.expiration);
  const isExpired = expiration > 0 && expiration < nowSeconds;
  const isRevoked = raw.status === LinkStatus.Revoked;

  return {
    linkId: Number(raw.linkId),
    agentWallet: raw.agentWallet,
    agentTokenId: Number(raw.agentTokenId),
    humanWallet: raw.humanWallet,
    ethosProfileId: Number(raw.ethosProfileId),
    role: raw.role as Role,
    level: raw.level as VerificationLevel,
    status: raw.status as LinkStatus,
    createdAt: Number(raw.createdAt),
    expiration,
    isExpired,
    isActive: !isRevoked && !isExpired,
  };
}
