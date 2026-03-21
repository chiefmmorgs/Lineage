/**
 * ============================================================
 *  Lineage — Multi-Chain Configuration
 * ============================================================
 *
 *  Official ERC-8004 registries are deployed at the same
 *  addresses across most EVM chains via CREATE2.
 * ============================================================
 */

import { createPublicClient, http, type PublicClient, type Chain } from "viem";
import {
  mainnet, base, arbitrum, avalanche, bsc, celo,
  baseSepolia, sepolia,
} from "viem/chains";

// ── Official ERC-8004 addresses (CREATE2 — same across all mainnets) ──

export const OFFICIAL_IDENTITY_REGISTRY = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;
export const OFFICIAL_REPUTATION_REGISTRY = "0x8004BAa17C55a88189AE136b182e5fdA19dE9b63" as const;

// Testnets use different addresses
export const TESTNET_IDENTITY_REGISTRY = "0x8004A818BFB912233c491871b3d84c89A494BD9e" as const;
export const TESTNET_REPUTATION_REGISTRY = "0x8004B663056A597Dffe9eCcC1965A193B7388713" as const;

// ── Chain definition ────────────────────────────────────────────

export interface ChainConfig {
  id: string;
  name: string;
  chainId: number;
  color: string;
  icon: string;
  rpcUrl: string;
  identityRegistry: string;
  reputationRegistry: string;
  blockExplorer: string;
  viemChain: Chain;
  isTestnet?: boolean;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  // ── Mainnets (from official erc-8004/erc-8004-contracts repo) ──
  {
    id: "ethereum",
    name: "Ethereum",
    chainId: 1,
    color: "#627eea",
    icon: "Ξ",
    rpcUrl: "https://eth.llamarpc.com",
    identityRegistry: OFFICIAL_IDENTITY_REGISTRY,
    reputationRegistry: OFFICIAL_REPUTATION_REGISTRY,
    blockExplorer: "https://etherscan.io",
    viemChain: mainnet,
  },
  {
    id: "base",
    name: "Base",
    chainId: 8453,
    color: "#3886f7",
    icon: "🔵",
    rpcUrl: "https://mainnet.base.org",
    identityRegistry: OFFICIAL_IDENTITY_REGISTRY,
    reputationRegistry: OFFICIAL_REPUTATION_REGISTRY,
    blockExplorer: "https://basescan.org",
    viemChain: base,
  },
  {
    id: "bnb",
    name: "BNB Chain",
    chainId: 56,
    color: "#f3ba2f",
    icon: "⟐",
    rpcUrl: "https://bsc-dataseed.binance.org",
    identityRegistry: OFFICIAL_IDENTITY_REGISTRY,
    reputationRegistry: OFFICIAL_REPUTATION_REGISTRY,
    blockExplorer: "https://bscscan.com",
    viemChain: bsc,
  },
  {
    id: "arbitrum",
    name: "Arbitrum",
    chainId: 42161,
    color: "#28a0f0",
    icon: "◆",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    identityRegistry: OFFICIAL_IDENTITY_REGISTRY,
    reputationRegistry: OFFICIAL_REPUTATION_REGISTRY,
    blockExplorer: "https://arbiscan.io",
    viemChain: arbitrum,
  },
  {
    id: "avalanche",
    name: "Avalanche",
    chainId: 43114,
    color: "#e84142",
    icon: "▲",
    rpcUrl: "https://api.avax.network/ext/bc/C/rpc",
    identityRegistry: OFFICIAL_IDENTITY_REGISTRY,
    reputationRegistry: OFFICIAL_REPUTATION_REGISTRY,
    blockExplorer: "https://snowtrace.io",
    viemChain: avalanche,
  },
  {
    id: "celo",
    name: "Celo",
    chainId: 42220,
    color: "#35d07f",
    icon: "🟢",
    rpcUrl: "https://forno.celo.org",
    identityRegistry: OFFICIAL_IDENTITY_REGISTRY,
    reputationRegistry: OFFICIAL_REPUTATION_REGISTRY,
    blockExplorer: "https://celoscan.io",
    viemChain: celo,
  },

  // ── Testnets ──
  {
    id: "ethereum-sepolia",
    name: "Ethereum Sepolia",
    chainId: 11155111,
    color: "#627eea",
    icon: "Ξ",
    rpcUrl: "https://rpc.sepolia.org",
    identityRegistry: TESTNET_IDENTITY_REGISTRY,
    reputationRegistry: TESTNET_REPUTATION_REGISTRY,
    blockExplorer: "https://sepolia.etherscan.io",
    viemChain: sepolia,
    isTestnet: true,
  },
  {
    id: "base-sepolia",
    name: "Base Sepolia",
    chainId: 84532,
    color: "#3886f7",
    icon: "🔵",
    rpcUrl: "https://sepolia.base.org",
    identityRegistry: TESTNET_IDENTITY_REGISTRY,
    reputationRegistry: TESTNET_REPUTATION_REGISTRY,
    blockExplorer: "https://sepolia.basescan.org",
    viemChain: baseSepolia,
    isTestnet: true,
  },
];

// ── Helpers ──────────────────────────────────────────────────────

const clientCache = new Map<string, PublicClient>();

export function getChainClient(chainId: string): PublicClient {
  if (clientCache.has(chainId)) return clientCache.get(chainId)!;

  const chain = SUPPORTED_CHAINS.find((c) => c.id === chainId);
  if (!chain) throw new Error(`Unknown chain: ${chainId}`);

  const client = createPublicClient({
    chain: chain.viemChain,
    transport: http(chain.rpcUrl),
  }) as PublicClient;

  clientCache.set(chainId, client);
  return client;
}

export function getChainById(chainId: string): ChainConfig | undefined {
  return SUPPORTED_CHAINS.find((c) => c.id === chainId);
}

export function getMainnetChains(): ChainConfig[] {
  return SUPPORTED_CHAINS.filter((c) => !c.isTestnet);
}

export function getTestnetChains(): ChainConfig[] {
  return SUPPORTED_CHAINS.filter((c) => c.isTestnet);
}
