/**
 * ============================================================
 *  LIVE CONTRACT CLIENT — lib/contracts.ts
 * ============================================================
 *
 *  Reads from the deployed contracts on Base Sepolia:
 *    - LineageAgentRegistry: 0x76A9EE21C345d77e3169B9EF6adD6A67B4791a74
 *    - AgentHumanLinkRegistry: 0xB50016197a28215937554f02611520f81150c4F2
 *
 *  Uses viem public client (read-only, no private key needed).
 * ============================================================
 */

import { createPublicClient, http, parseAbi, keccak256, encodePacked, type Address } from "viem";
import { baseSepolia } from "viem/chains";

// ── Deployed addresses ────────────────────────────────────────────

/**
 * ERC-8004 Identity Registry — Official Testnet
 * Real ERC-8004 Identity Registry on Base Sepolia
 * Registry: eip155:84532:0x8004A818BFB912233c491871b3d84c89A494BD9e
 */
export const AGENT_REGISTRY_ADDRESS: Address = "0x8004A818BFB912233c491871b3d84c89A494BD9e";

/**
 * AgentHumanLinkRegistry — Mutual Verification Protocol
 * Deployed to Base Sepolia on 2026-03-17 (v2 — with duplicate prevention + totalLinks)
 */
export const LINK_REGISTRY_ADDRESS: Address  = "0x2D08B11A87C45d0d9b93C010aF969a34Aa4B0F07";

/**
 * LineageReputationRegistry — On-Chain Agent Feedback & Scoring
 * Deployed to Base Sepolia on 2026-03-17
 */
export const REPUTATION_REGISTRY_ADDRESS: Address = "0x212353bA03c82aB3C70844D9FfF748c13144D978";

// ── Public client (read-only) ─────────────────────────────────────

export const client = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

// ── ABIs ──────────────────────────────────────────────────────────

export const AGENT_REGISTRY_ABI = parseAbi([
  // ERC-721 base
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenURI(uint256 tokenId) view returns (string)",

  // ERC-8004 Identity Registry
  "function register(string agentURI) returns (uint256 agentId)",
  "function register() returns (uint256 agentId)",
  "function agentURI(uint256 agentId) view returns (string)",
  "function setAgentURI(uint256 agentId, string newURI)",
  "function agentRegistryId() view returns (string)",
  "function nextTokenId() view returns (uint256)",
  "function totalSupply() view returns (uint256)",

  // Agent Wallet
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function setAgentWallet(uint256 agentId, address newWallet, uint256 deadline, bytes signature)",
  "function unsetAgentWallet(uint256 agentId)",

  // On-chain Metadata
  "function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)",
  "function setMetadata(uint256 agentId, string metadataKey, bytes metadataValue)",

  // Events
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
  "event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy)",
  "event MetadataSet(uint256 indexed agentId, string indexed indexedMetadataKey, string metadataKey, bytes metadataValue)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);

/**
 * AgentHumanLinkRegistry ABI — Mutual Verification Protocol
 * Supports dual EIP-712 signatures, roles, expiration, upgrade, and revocation.
 */
export const LINK_REGISTRY_ABI = parseAbi([
  // Write functions
  "function createVerifiedLink(address agentWallet, uint256 agentTokenId, uint256 ethosProfileId, uint8 role, uint256 expiration, uint256 deadline, bytes humanSignature, bytes agentSignature) returns (uint256)",
  "function upgradeLink(uint256 linkId, bytes signature, uint256 deadline)",
  "function revokeLink(uint256 linkId)",

  // Read functions
  "function getLink(uint256 linkId) view returns ((uint256 linkId, address agentWallet, uint256 agentTokenId, address humanWallet, uint256 ethosProfileId, uint8 role, uint8 level, uint8 status, uint256 createdAt, uint256 expiration, bytes humanSignature, bytes agentSignature))",
  "function getAgentLinks(address agentWallet, uint256 agentTokenId) view returns (uint256[])",
  "function getActiveAgentLinks(address agentWallet, uint256 agentTokenId) view returns ((uint256 linkId, address agentWallet, uint256 agentTokenId, address humanWallet, uint256 ethosProfileId, uint8 role, uint8 level, uint8 status, uint256 createdAt, uint256 expiration, bytes humanSignature, bytes agentSignature)[])",
  "function getHumanLinks(address humanWallet) view returns (uint256[])",
  "function getProfileLinks(uint256 ethosProfileId) view returns (uint256[])",
  "function isLinkActive(uint256 linkId) view returns (bool)",
  "function nonces(address) view returns (uint256)",
  "function getDomainSeparator() view returns (bytes32)",
  "function totalLinks() view returns (uint256)",
]);

/**
 * LineageReputationRegistry ABI — On-Chain Agent Feedback & Scoring
 */
export const REPUTATION_REGISTRY_ABI = parseAbi([
  "function submitFeedback(uint256 agentTokenId, uint8 score, string comment)",
  "function getAverageScore(uint256 agentTokenId) view returns (uint256 avg, uint256 count)",
  "function getFeedbackAt(uint256 agentTokenId, uint256 index) view returns ((address reviewer, uint256 agentTokenId, uint8 score, string comment, uint256 timestamp, bool exists))",
  "function getFeedback(uint256 agentTokenId, uint256 offset, uint256 limit) view returns ((address reviewer, uint256 agentTokenId, uint8 score, string comment, uint256 timestamp, bool exists)[])",
  "function getReviewCount(uint256 agentTokenId) view returns (uint256)",
  "function getReviewByReviewer(uint256 agentTokenId, address reviewer) view returns ((address reviewer, uint256 agentTokenId, uint8 score, string comment, uint256 timestamp, bool exists))",
  "function hasReviewed(uint256 agentTokenId, address reviewer) view returns (bool)",
  "event FeedbackSubmitted(uint256 indexed agentTokenId, address indexed reviewer, uint8 score, string comment)",
  "event FeedbackUpdated(uint256 indexed agentTokenId, address indexed reviewer, uint8 oldScore, uint8 newScore, string comment)",
]);

// ── Role enum mapping ─────────────────────────────────────────────

const ROLES = ["creator", "operator", "maintainer", "delegate", "renter"] as const;
export type ContractRole = (typeof ROLES)[number];

export function roleFromIndex(i: number): ContractRole {
  return ROLES[i] ?? "creator";
}

export function roleToIndex(role: ContractRole): number {
  return ROLES.indexOf(role);
}

// ── Verification level mapping ────────────────────────────────────

const VERIFICATION_LEVELS = ["self-claim", "agent-confirmation", "mutual-verification"] as const;
export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export function verificationFromIndex(i: number): VerificationLevel {
  return VERIFICATION_LEVELS[i] ?? "self-claim";
}

// ── On-chain types ────────────────────────────────────────────────

export interface OnChainAgent {
  tokenId: number;
  owner: string;
  agentURI: string;
  agentWallet: string;
  name: string;              // parsed from agentURI JSON if available
  description: string;       // parsed from agentURI JSON if available
  image: string;             // parsed from agentURI JSON if available
}

export interface OnChainLink {
  linkId: number;
  agentWallet: string;
  agentTokenId: number;
  humanWallet: string;
  ethosProfileId: number;
  role: ContractRole;
  level: VerificationLevel;
  status: "active" | "revoked";
  createdAt: number;
  expiration: number;          // 0 = permanent, >0 = unix timestamp
  isExpired: boolean;          // Computed: true if expiration < now
}

/**
 * Generates a unique, unguessable hash for a link URL using its immutable properties.
 * E.g., returns "1-0xabcdef1234567890"
 */
export function generateLinkHash(link: OnChainLink): string {
  const hash = keccak256(
    encodePacked(
      ["uint256", "address", "uint256", "address", "uint256"],
      [
        BigInt(link.linkId),
        link.agentWallet as Address,
        BigInt(link.agentTokenId),
        link.humanWallet as Address,
        BigInt(link.ethosProfileId)
      ]
    )
  );
  return `${link.linkId}-${hash.slice(0, 18)}`;
}

export interface OnChainReputation {
  averageScore: number;   // Scaled by 100 (e.g., 450 = 4.50)
  reviewCount: number;
}

export interface OnChainFeedback {
  reviewer: string;
  agentTokenId: number;
  score: number;          // 1–5
  comment: string;
  timestamp: number;
}

// ── EIP-712 Domain & Types for signing ────────────────────────────

export const LINK_EIP712_DOMAIN = {
  name: "AgentHumanLinkRegistry",
  version: "1",
  chainId: baseSepolia.id,
  verifyingContract: LINK_REGISTRY_ADDRESS,
} as const;

export const LINK_EIP712_TYPES = {
  LinkAgent: [
    { name: "agentTokenId", type: "uint256" },
    { name: "ethosProfileId", type: "uint256" },
    { name: "role", type: "uint8" },
    { name: "expiration", type: "uint256" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
} as const;

/**
 * Build the EIP-712 message payload for signing.
 * Both the human wallet and the agent wallet must sign
 * the same payload to achieve Level 3 Mutual Verification.
 */
export function buildLinkPayload(params: {
  agentTokenId: bigint;
  ethosProfileId: bigint;
  role: number;
  expiration: bigint;
  nonce: bigint;
  deadline: bigint;
}) {
  return {
    domain: LINK_EIP712_DOMAIN,
    types: LINK_EIP712_TYPES,
    primaryType: "LinkAgent" as const,
    message: {
      agentTokenId: params.agentTokenId,
      ethosProfileId: params.ethosProfileId,
      role: params.role,
      expiration: params.expiration,
      nonce: params.nonce,
      deadline: params.deadline,
    },
  };
}

// ── Read functions ────────────────────────────────────────────────

/**
 * Parse the agentURI JSON to extract name/description/image.
 * Handles HTTPS URLs, IPFS, and data: URIs.
 */
async function parseAgentURI(uri: string): Promise<{ name: string; description: string; image: string }> {
  const empty = { name: "", description: "", image: "" };
  if (!uri) return empty;

  try {
    let json: string;

    if (uri.startsWith("data:application/json;base64,")) {
      // Decode base64 data URI
      json = atob(uri.slice("data:application/json;base64,".length));
    } else if (uri.startsWith("data:application/json,")) {
      json = decodeURIComponent(uri.slice("data:application/json,".length));
    } else if (uri.startsWith("http")) {
      const res = await fetch(uri, { signal: AbortSignal.timeout(3000) });
      json = await res.text();
    } else {
      return empty;
    }

    const parsed = JSON.parse(json);
    return {
      name: parsed.name || "",
      description: parsed.description || "",
      image: parsed.image || "",
    };
  } catch {
    return empty;
  }
}

/** Read a single agent's on-chain identity by tokenId */
export async function readAgent(tokenId: number): Promise<OnChainAgent | null> {
  try {
    const [owner, uri, agentWallet] = await Promise.all([
      client.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        functionName: "ownerOf",
        args: [BigInt(tokenId)],
      }),
      client.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        functionName: "agentURI",
        args: [BigInt(tokenId)],
      }),
      client.readContract({
        address: AGENT_REGISTRY_ADDRESS,
        abi: AGENT_REGISTRY_ABI,
        functionName: "getAgentWallet",
        args: [BigInt(tokenId)],
      }),
    ]);

    const agentURI = uri as string;
    const meta = await parseAgentURI(agentURI);

    return {
      tokenId,
      owner: owner as string,
      agentURI,
      agentWallet: agentWallet as string,
      name: meta.name,
      description: meta.description,
      image: meta.image,
    };
  } catch {
    return null;
  }
}

/** Read on-chain metadata by key */
export async function readAgentMetadata(tokenId: number, key: string): Promise<string> {
  try {
    const result = await client.readContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: "getMetadata",
      args: [BigInt(tokenId), key],
    });
    return result as string;
  } catch {
    return "";
  }
}

/** Get total number of registered agents */
export async function getNextTokenId(): Promise<number> {
  try {
    const id = await client.readContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: "nextTokenId",
    });
    return Number(id as bigint);
  } catch {
    return 1;
  }
}

/** Read the nonce for a wallet (needed for EIP-712 signing) */
export async function readNonce(wallet: string): Promise<bigint> {
  try {
    const nonce = await client.readContract({
      address: LINK_REGISTRY_ADDRESS,
      abi: LINK_REGISTRY_ABI,
      functionName: "nonces",
      args: [wallet as Address],
    });
    return nonce as bigint;
  } catch {
    return BigInt(0);
  }
}

/** Read all active links for a given agent wallet + tokenId */
export async function readAgentLinks(agentWallet: string, tokenId: number): Promise<OnChainLink[]> {
  try {
    const links = await client.readContract({
      address: LINK_REGISTRY_ADDRESS,
      abi: LINK_REGISTRY_ABI,
      functionName: "getActiveAgentLinks",
      args: [agentWallet as Address, BigInt(tokenId)],
    });

    const now = Math.floor(Date.now() / 1000);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (links as unknown as Array<{
      linkId: bigint;
      agentWallet: string;
      agentTokenId: bigint;
      humanWallet: string;
      ethosProfileId: bigint;
      role: number;
      level: number;
      status: number;
      createdAt: bigint;
      expiration: bigint;
    }>).map((l) => ({
      linkId: Number(l.linkId),
      agentWallet: l.agentWallet,
      agentTokenId: Number(l.agentTokenId),
      humanWallet: l.humanWallet,
      ethosProfileId: Number(l.ethosProfileId),
      role: roleFromIndex(l.role),
      level: verificationFromIndex(l.level),
      status: l.status === 0 ? "active" as const : "revoked" as const,
      createdAt: Number(l.createdAt),
      expiration: Number(l.expiration),
      isExpired: Number(l.expiration) > 0 && Number(l.expiration) < now,
    }));
  } catch {
    return [];
  }
}

/** Read all links associated with a human wallet */
export async function readHumanLinks(humanWallet: string): Promise<number[]> {
  try {
    const ids = await client.readContract({
      address: LINK_REGISTRY_ADDRESS,
      abi: LINK_REGISTRY_ABI,
      functionName: "getHumanLinks",
      args: [humanWallet as Address],
    });
    return (ids as bigint[]).map(Number);
  } catch {
    return [];
  }
}

/** Read all links associated with an Ethos profile */
export async function readProfileLinks(profileId: number): Promise<number[]> {
  try {
    const ids = await client.readContract({
      address: LINK_REGISTRY_ADDRESS,
      abi: LINK_REGISTRY_ABI,
      functionName: "getProfileLinks",
      args: [BigInt(profileId)],
    });
    return (ids as bigint[]).map(Number);
  } catch {
    return [];
  }
}

/** Read a single link by ID */
export async function readLink(linkId: number): Promise<OnChainLink | null> {
  try {
    const l = await client.readContract({
      address: LINK_REGISTRY_ADDRESS,
      abi: LINK_REGISTRY_ABI,
      functionName: "getLink",
      args: [BigInt(linkId)],
    }) as unknown as {
      linkId: bigint;
      agentWallet: string;
      agentTokenId: bigint;
      humanWallet: string;
      ethosProfileId: bigint;
      role: number;
      level: number;
      status: number;
      createdAt: bigint;
      expiration: bigint;
    };

    if (Number(l.linkId) === 0) return null;

    const now = Math.floor(Date.now() / 1000);
    return {
      linkId: Number(l.linkId),
      agentWallet: l.agentWallet,
      agentTokenId: Number(l.agentTokenId),
      humanWallet: l.humanWallet,
      ethosProfileId: Number(l.ethosProfileId),
      role: roleFromIndex(l.role),
      level: verificationFromIndex(l.level),
      status: l.status === 0 ? "active" as const : "revoked" as const,
      createdAt: Number(l.createdAt),
      expiration: Number(l.expiration),
      isExpired: Number(l.expiration) > 0 && Number(l.expiration) < now,
    };
  } catch {
    return null;
  }
}

/** Batch-read links by IDs */
export async function readLinksBatch(linkIds: number[]): Promise<OnChainLink[]> {
  const results = await Promise.all(linkIds.map((id) => readLink(id)));
  return results.filter((l): l is OnChainLink => l !== null);
}

/**
 * Discover all minted agents by using nextTokenId to know the upper bound.
 * The contract starts minting at tokenId 1 and increments.
 */
export async function discoverAllAgents(): Promise<OnChainAgent[]> {
  const nextId = await getNextTokenId();
  const agents: OnChainAgent[] = [];

  // Fetch in parallel batches of 10
  for (let start = 1; start < nextId; start += 10) {
    const batch = [];
    for (let id = start; id < Math.min(start + 10, nextId); id++) {
      batch.push(readAgent(id));
    }
    const results = await Promise.all(batch);
    for (const agent of results) {
      if (agent) agents.push(agent);
    }
  }

  return agents;
}

// ── Reputation Read Functions ─────────────────────────────────────

/** Read reputation score for an agent */
export async function readReputation(agentTokenId: number): Promise<OnChainReputation> {
  try {
    const result = await client.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getAverageScore",
      args: [BigInt(agentTokenId)],
    }) as [bigint, bigint];
    return {
      averageScore: Number(result[0]),
      reviewCount: Number(result[1]),
    };
  } catch {
    return { averageScore: 0, reviewCount: 0 };
  }
}

/** Read paginated feedback for an agent */
export async function readFeedback(
  agentTokenId: number,
  offset: number = 0,
  limit: number = 20
): Promise<OnChainFeedback[]> {
  try {
    const results = await client.readContract({
      address: REPUTATION_REGISTRY_ADDRESS,
      abi: REPUTATION_REGISTRY_ABI,
      functionName: "getFeedback",
      args: [BigInt(agentTokenId), BigInt(offset), BigInt(limit)],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any[];
    return results.map((f) => ({
      reviewer: f.reviewer as string,
      agentTokenId: Number(f.agentTokenId),
      score: Number(f.score),
      comment: f.comment as string,
      timestamp: Number(f.timestamp),
    }));
  } catch {
    return [];
  }
}

/** Get total agents registered (totalSupply) */
export async function getTotalAgents(): Promise<number> {
  try {
    const total = await client.readContract({
      address: AGENT_REGISTRY_ADDRESS,
      abi: AGENT_REGISTRY_ABI,
      functionName: "totalSupply",
    });
    return Number(total as bigint);
  } catch {
    return 0;
  }
}

/** Get total links created */
export async function getTotalLinks(): Promise<number> {
  try {
    const total = await client.readContract({
      address: LINK_REGISTRY_ADDRESS,
      abi: LINK_REGISTRY_ABI,
      functionName: "totalLinks",
    });
    return Number(total as bigint);
  } catch {
    return 0;
  }
}

// ── Domain Resolution Helpers ─────────────────────────────────────

/** Resolve an ENS name (.eth) to an address */
export async function resolveEns(name: string): Promise<string | null> {
  try {
    const { createPublicClient: createMainnetClient, http: createHttp } = await import("viem");
    const { mainnet } = await import("viem/chains");
    const mainnetClient = createMainnetClient({
      chain: mainnet,
      transport: createHttp(),
    });
    const address = await mainnetClient.getEnsAddress({ name });
    return address ?? null;
  } catch {
    return null;
  }
}

/** Resolve a Basename (.base.eth) to an address using Base L2 resolver */
export async function resolveBasename(name: string): Promise<string | null> {
  try {
    const { normalize } = await import("viem/ens");
    const normalized = normalize(name);
    const address = await client.getEnsAddress({
      name: normalized,
      universalResolverAddress: "0xC6d566A56A1aFf6508b41f6c90ff131615583BCD" as Address,
    });
    return address ?? null;
  } catch {
    return null;
  }
}

// ── Multi-Chain Agent Discovery ───────────────────────────────────

import {
  SUPPORTED_CHAINS,
  getChainClient,
  type ChainConfig,
} from "./chains";

/** Official ERC-8004 Identity Registry ABI (from real contracts) */
const OFFICIAL_REGISTRY_ABI = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function tokenURI(uint256 tokenId) view returns (string)",
  "function getAgentWallet(uint256 agentId) view returns (address)",
  "function getMetadata(uint256 agentId, string metadataKey) view returns (bytes)",
  "event Registered(uint256 indexed agentId, string agentURI, address indexed owner)",
]);

/**
 * Official ERC-8004 Reputation Registry ABI (from real contracts)
 * - getSummary requires client addresses (anti-Sybil)
 * - value is int128 with valueDecimals
 * - getClients returns all unique client addresses for an agent
 */
const OFFICIAL_REPUTATION_ABI = parseAbi([
  "function getSummary(uint256 agentId, address[] clientAddresses, string tag1, string tag2) view returns (uint64 count, int128 summaryValue, uint8 summaryValueDecimals)",
  "function getClients(uint256 agentId) view returns (address[])",
  "function readFeedback(uint256 agentId, address clientAddress, uint64 feedbackIndex) view returns (int128 value, uint8 valueDecimals, string tag1, string tag2, bool isRevoked)",
  "function getLastIndex(uint256 agentId, address clientAddress) view returns (uint64)",
]);

export interface MultiChainAgent {
  tokenId: number;
  chain: string;          // chain id (e.g. "ethereum", "base")
  chainName: string;
  chainColor: string;
  owner: string;
  name: string;
  description: string;
  image: string;
  agentURI: string;
  averageScore: number;
  reviewCount: number;
}

/**
 * Discover agents on a specific chain's official ERC-8004 registry.
 *
 * The real contracts don't have totalSupply(), so we probe ownerOf()
 * starting from ID 0 upward. When ownerOf reverts, we've found all agents.
 * We batch in parallel groups of 10 and stop when an entire batch fails.
 */
export async function discoverAgentsOnChain(
  chainConfig: ChainConfig,
  limit: number = 50,
): Promise<MultiChainAgent[]> {
  try {
    const chainClient = getChainClient(chainConfig.id);
    const registryAddress = chainConfig.identityRegistry as Address;
    const reputationAddress = chainConfig.reputationRegistry as Address;

    const agents: MultiChainAgent[] = [];
    let consecutiveFailures = 0;

    for (let id = 0; id < limit && consecutiveFailures < 10; id++) {
      try {
        const owner = await chainClient.readContract({
          address: registryAddress,
          abi: OFFICIAL_REGISTRY_ABI,
          functionName: "ownerOf",
          args: [BigInt(id)],
        }) as string;

        consecutiveFailures = 0; // valid agent found, reset

        // Fetch URI
        let uri = "";
        try {
          uri = await chainClient.readContract({
            address: registryAddress,
            abi: OFFICIAL_REGISTRY_ABI,
            functionName: "tokenURI",
            args: [BigInt(id)],
          }) as string;
        } catch { /* no URI */ }

        // Parse agent URI (JSON metadata)
        let name = `Agent #${id}`;
        let description = "";
        let image = "";
        try {
          let json: string;
          if (uri.startsWith("data:application/json;base64,")) {
            json = atob(uri.slice("data:application/json;base64,".length));
          } else if (uri.startsWith("data:application/json,")) {
            json = decodeURIComponent(uri.slice("data:application/json,".length));
          } else if (uri.startsWith("{")) {
            json = uri;
          } else if (uri.startsWith("http") || uri.startsWith("ipfs://")) {
            const fetchUrl = uri.startsWith("ipfs://")
              ? `https://ipfs.io/ipfs/${uri.slice(7)}`
              : uri;
            const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(3000) });
            json = await res.text();
          } else {
            json = "{}";
          }
          const parsed = JSON.parse(json);
          name = parsed.name || name;
          description = parsed.description || "";
          image = parsed.image || "";
        } catch { /* keep defaults */ }

        // Read reputation using real getSummary + getClients
        let averageScore = 0;
        let reviewCount = 0;
        try {
          // First get all clients who left feedback
          const clients = await chainClient.readContract({
            address: reputationAddress,
            abi: OFFICIAL_REPUTATION_ABI,
            functionName: "getClients",
            args: [BigInt(id)],
          }) as string[];

          if (clients && clients.length > 0) {
            // Then get summary across all clients
            const summary = await chainClient.readContract({
              address: reputationAddress,
              abi: OFFICIAL_REPUTATION_ABI,
              functionName: "getSummary",
              args: [BigInt(id), clients as readonly `0x${string}`[], "", ""],
            }) as unknown as [bigint, bigint, number];

            reviewCount = Number(summary[0]);
            const rawValue = Number(summary[1]);
            const decimals = summary[2];
            averageScore = reviewCount > 0
              ? Math.round((rawValue / Math.pow(10, decimals)) * 100) // normalize to 0-500 range
              : 0;
          }
        } catch { /* no reputation data */ }

        agents.push({
          tokenId: id,
          chain: chainConfig.id,
          chainName: chainConfig.name,
          chainColor: chainConfig.color,
          owner: owner as string,
          name,
          description,
          image,
          agentURI: uri,
          averageScore,
          reviewCount,
        });
      } catch {
        consecutiveFailures++;
      }
    }

    return agents;
  } catch {
    return [];
  }
}

/**
 * Discover agents from all supported chains.
 * Fetches from each chain in parallel and merges results.
 */
export async function discoverAllChainsAgents(
  chainFilter?: string,
  includeTestnets: boolean = true,
): Promise<MultiChainAgent[]> {
  const chains = SUPPORTED_CHAINS.filter((c) => {
    if (chainFilter && chainFilter !== "all" && c.id !== chainFilter) return false;
    if (!includeTestnets && c.isTestnet) return false;
    return true;
  });

  // For our Base Sepolia custom contracts, use existing discoverAllAgents
  const results = await Promise.all(
    chains.map(async (chain) => {
      if (chain.id === "base-sepolia") {
        // Use our custom contracts
        const agents = await discoverAllAgents();
        return agents.map((a) => ({
          tokenId: a.tokenId,
          chain: "base-sepolia",
          chainName: "Base Sepolia",
          chainColor: "#3886f7",
          owner: a.owner,
          name: a.name || `Agent #${a.tokenId}`,
          description: a.description || "",
          image: a.image || "",
          agentURI: a.agentURI,
          averageScore: 0,
          reviewCount: 0,
        } as MultiChainAgent));
      }
      return discoverAgentsOnChain(chain, 50);
    })
  );

  return results.flat();
}
