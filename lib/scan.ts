/**
 * ============================================================
 *  Lineage — 8004scan.io API Integration
 * ============================================================
 *
 *  8004scan.io is the official ERC-8004 agent indexer.
 *  It indexes all agents across all chains in real time.
 *
 *  Endpoints:
 *    GET /api/v1/public/agents                     — list agents (paginated)
 *    GET /api/v1/public/agents/search              — search by name/description
 *    GET /api/v1/public/agents/:chainId/:tokenId   — specific agent
 *    GET /api/v1/public/accounts/:address/agents    — agents owned by a wallet
 *    GET /api/v1/public/stats                      — platform statistics
 *    GET /api/v1/public/chains                     — supported chains
 *    GET /api/v1/public/feedbacks                  — feedback data
 * ============================================================
 */

const API_BASE = "https://8004scan.io/api/v1/public";

// ── Types from the API ──────────────────────────────────────────

export interface ScanAgent {
  id: string;                       // internal UUID
  agent_id: string;                 // "chainId:contract:tokenId"
  token_id: string;
  chain_id: number;
  chain_type: string;               // "evm"
  contract_address: string;
  is_testnet: boolean;
  owner_address: string;
  owner_ens: string | null;
  owner_username: string | null;
  owner_avatar_url: string | null;
  owner_publisher_tier: string | null;
  owner_certified_name: string | null;
  name: string;
  description: string;
  image_url: string;
  is_verified: boolean;
  star_count: number;
  supported_protocols: string[];    // ["A2A", "MCP", "OASF", "Web"]
  x402_supported: boolean;
  total_score: number;
  rank: number | null;
  health_score: number | null;
  total_feedbacks: number;
  average_score: number;
  cross_chain_versions: string | null;
  created_at: string;               // ISO date
  updated_at: string;
}

export interface ScanPagination {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface ScanResponse {
  data: ScanAgent[];
  meta: {
    version: string;
    timestamp: string;
    requestId: string;
    pagination: ScanPagination;
  };
}

export interface ScanChainStats {
  chain_id: number;
  name: string;
  is_testnet: boolean;
  total_agents: number;
  daily_new_agents: number;
  total_feedbacks: number;
  daily_feedbacks: number;
  average_feedback_score: number | null;
  mcp_agents: number;
  a2a_agents: number;
  oasf_agents: number;
}

export interface ScanStats {
  data: {
    total_agents: number;
    total_feedbacks: number;
    daily_new_agents: number;
    daily_feedbacks: number;
    chain_stats: ScanChainStats[];
    protocol_distribution: Record<string, number>;
    registration_stats: {
      total: number;
      resolved: number;
      unresolved: number;
      owner_verified: number;
      reciprocal_verified: number;
    };
  };
}

// ── Chain ID → display config ─────────────────────────────────────

const CHAIN_META: Record<number, { name: string; color: string; icon: string }> = {
  // Mainnets
  1:        { name: "Ethereum",         color: "#627eea", icon: "Ξ"  },
  8453:     { name: "Base",             color: "#3886f7", icon: "🔵" },
  56:       { name: "BNB Chain",        color: "#f3ba2f", icon: "⟐"  },
  42161:    { name: "Arbitrum",         color: "#28a0f0", icon: "◆"  },
  43114:    { name: "Avalanche",        color: "#e84142", icon: "▲"  },
  42220:    { name: "Celo",             color: "#35d07f", icon: "🟢" },
  2741:     { name: "Abstract",         color: "#7c3aed", icon: "◈"  },
  10:       { name: "Optimism",         color: "#ff0420", icon: "🔴" },
  137:      { name: "Polygon",          color: "#8247e5", icon: "⬡"  },
  100:      { name: "Gnosis",           color: "#04795b", icon: "🦉" },
  101:      { name: "Solana",           color: "#9945ff", icon: "◎"  },
  // Testnets
  11155111: { name: "Ethereum Sepolia", color: "#627eea", icon: "Ξ"  },
  84532:    { name: "Base Sepolia",     color: "#3886f7", icon: "🔵" },
  10143:    { name: "Monad Testnet",    color: "#6366f1", icon: "🟣" },
  103:      { name: "Solana Devnet",    color: "#9945ff", icon: "◎"  },
  421614:   { name: "Arbitrum Sepolia", color: "#28a0f0", icon: "◆"  },
  97:       { name: "BSC Testnet",      color: "#f3ba2f", icon: "⟐"  },
  11124:    { name: "Abstract Testnet", color: "#7c3aed", icon: "◈"  },
  6343:     { name: "MegaETH Testnet",  color: "#14b8a6", icon: "⚡" },
  43113:    { name: "Avalanche Fuji",   color: "#e84142", icon: "▲"  },
};

function chainMeta(chainId: number) {
  return CHAIN_META[chainId] ?? { name: `Chain ${chainId}`, color: "#888", icon: "⬡" };
}

// ── API Functions ─────────────────────────────────────────────────

/**
 * Fetch latest agents from 8004scan.io.
 * Returns up to `limit` agents, sorted by most recently created.
 */
export async function fetchAgents(params?: {
  page?: number;
  limit?: number;
}): Promise<ScanResponse> {
  const page = params?.page ?? 1;
  const limit = params?.limit ?? 20;

  const url = `${API_BASE}/agents?page=${page}&limit=${limit}`;
  const res = await fetch(url, {
    next: { revalidate: 30 },       // cache for 30s on server
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`8004scan API error: ${res.status}`);
  return res.json() as Promise<ScanResponse>;
}

/**
 * Search agents by name or description.
 */
export async function searchAgents(query: string, limit: number = 20): Promise<ScanResponse> {
  const url = `${API_BASE}/agents/search?q=${encodeURIComponent(query)}&limit=${limit}`;
  const res = await fetch(url, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`8004scan search error: ${res.status}`);
  return res.json() as Promise<ScanResponse>;
}

/**
 * Get a specific agent by chain ID and token ID.
 */
export async function fetchAgent(chainId: number, tokenId: number): Promise<ScanAgent | null> {
  const url = `${API_BASE}/agents/${chainId}/${tokenId}`;
  const res = await fetch(url, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  const data = await res.json();
  return data?.data ?? data ?? null;
}

/**
 * Fetch all agents owned by a specific wallet address.
 * This is crucial for the "My Agents" flow — connect wallet → see all agents.
 */
export async function fetchAgentsByWallet(address: string): Promise<ScanAgent[]> {
  const url = `${API_BASE}/accounts/${address.toLowerCase()}/agents`;
  const res = await fetch(url, {
    next: { revalidate: 15 },       // shorter cache for wallet lookups
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data?.data ?? [];
}

/**
 * Fetch platform-wide statistics.
 */
export async function fetchStats(): Promise<ScanStats | null> {
  const url = `${API_BASE}/stats`;
  const res = await fetch(url, {
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return null;
  return res.json() as Promise<ScanStats>;
}

/**
 * Fetch feedbacks for an agent.
 */
export async function fetchFeedbacks(chainId: number, tokenId: number): Promise<unknown[]> {
  const url = `${API_BASE}/feedbacks?chain_id=${chainId}&token_id=${tokenId}`;
  const res = await fetch(url, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data?.data ?? [];
}

// ── Convert to our MultiChainAgent format ─────────────────────────

import type { MultiChainAgent } from "./contracts";

/**
 * Convert a 8004scan agent to our internal MultiChainAgent format.
 */
export function scanToMultiChainAgent(agent: ScanAgent): MultiChainAgent {
  const meta = chainMeta(agent.chain_id);
  return {
    tokenId: Number(agent.token_id),
    chain: chainIdToSlug(agent.chain_id),
    chainName: meta.name,
    chainColor: meta.color,
    owner: agent.owner_address,
    name: agent.name || `Agent #${agent.token_id}`,
    description: agent.description || "",
    image: agent.image_url || "",
    agentURI: "",
    averageScore: Math.round(agent.average_score * 100),
    reviewCount: agent.total_feedbacks,
  };
}

function chainIdToSlug(chainId: number): string {
  const map: Record<number, string> = {
    1: "ethereum", 8453: "base", 56: "bnb", 42161: "arbitrum",
    43114: "avalanche", 42220: "celo", 2741: "abstract", 10: "optimism",
    137: "polygon", 100: "gnosis", 101: "solana",
    11155111: "ethereum-sepolia", 84532: "base-sepolia", 103: "solana-devnet",
  };
  return map[chainId] ?? `chain-${chainId}`;
}

/**
 * Fetch agents from 8004scan and convert to our format.
 * This is the primary way to discover real agents in production.
 */
export async function discoverAgentsVia8004Scan(limit: number = 50): Promise<MultiChainAgent[]> {
  try {
    const response = await fetchAgents({ limit });
    return response.data.map(scanToMultiChainAgent);
  } catch (e) {
    console.error("[8004scan] Failed to fetch agents:", e);
    return [];
  }
}

/**
 * Get total agent count across all chains.
 */
export async function getTotalAgentCount(): Promise<number> {
  try {
    const response = await fetchAgents({ limit: 1 });
    return response.meta.pagination.total;
  } catch {
    return 0;
  }
}

/**
 * Get chain display metadata (name, color, icon) for a chain ID.
 */
export function getChainMeta(chainId: number) {
  return chainMeta(chainId);
}

