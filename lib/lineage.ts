/**
 * ============================================================
 *  LINEAGE DATA LAYER — lib/lineage.ts
 * ============================================================
 *
 *  Reads from three independent sources and composes them
 *  into a single unified view:
 *
 *   1. ERC-8004 Identity Registry   → agent identity
 *   2. Ethos Network API            → creator credibility
 *   3. CreatorLinkRegistry          → the relationship between them
 *
 *  The three sources are NEVER merged. They are read separately
 *  and displayed as distinct panels.
 * ============================================================
 */

import { getScore, getProfileByUserkey, type EthosScore, type EthosUser } from "./ethos";

// ── Role mapping ──────────────────────────────────────────────────

export type LinkRole = "creator" | "operator" | "trainer" | "maintainer" | "delegate" | "renter";
export type LinkStatus = "active" | "revoked";

/** Mirrors the AgentHumanLinkRegistry.Link struct */
export interface LinkRecord {
  linkId:         number;
  agentWallet:    string;
  agentTokenId:   number;
  humanWallet:    string;
  ethosProfileId: number;
  role:           LinkRole;
  status:         LinkStatus;
  createdAt:      number;
}

/** What we read from the ERC-8004 Identity Registry (on-chain) */
export interface AgentIdentity {
  tokenId:      number;
  agentWallet:  string;
  agentURI:     string;      // IPFS/HTTPS pointing to registration JSON
  isActive:     boolean;
  registryId:   string;      // "eip155:8453:<address>"
  // From the registration file (off-chain JSON at agentURI)
  name:         string;
  description:  string;
  services:     { name: string; endpoint: string }[];
  supportedTrust: string[];
}

/** What we read from the Ethos Network API */
export interface CreatorCredibility {
  wallet:         string;
  ethosProfileId: number;
  displayName:    string;
  username:       string | null;
  avatarUrl:      string;
  description:    string | null;
  score:          EthosScore | null;
  stats: {
    positiveReviews: number;
    negativeReviews: number;
    neutralReviews:  number;
    vouchesReceived: number;
    vouchesGiven:    number;
    ethStakedOnThem: number; // wei
  };
  humanVerified: boolean;
  ethosProfileUrl: string;
}

/** The relationship from CreatorLinkRegistry */
export interface AccountabilityLink {
  linkId:     number;
  role:       LinkRole;
  status:     LinkStatus;
  timestamp:  number;
}

/** The composed Lineage view — three panels, clearly separated */
export interface LineageView {
  agent:        AgentIdentity;
  creator:      CreatorCredibility;
  link:         AccountabilityLink;
  // derived signal: how much of the agent's activity should flow back to creator
  accountabilityWeight: number; // 0–1 · creator=1.0, operator=0.8, trainer=0.5, maintainer=0.3
}

// ── Role accountability weights ───────────────────────────────────

const ROLE_WEIGHTS: Record<LinkRole, number> = {
  creator:    1.0,
  operator:   0.8,
  trainer:    0.5,
  maintainer: 0.3,
  delegate:   0.3,
  renter:     0.2,
};

export function getRoleWeight(role: LinkRole): number {
  return ROLE_WEIGHTS[role];
}

export const ROLE_LABELS: Record<LinkRole, { label: string; desc: string; color: string }> = {
  creator: {
    label: "Creator",
    desc:  "Original builder. Fully accountable for the agent's existence and training.",
    color: "#c084fc",
  },
  operator: {
    label: "Operator",
    desc:  "Currently operating the agent. Accountable for live behavior.",
    color: "#818cf8",
  },
  trainer: {
    label: "Trainer",
    desc:  "Fine-tuned or trained the model. Accountable for training data quality.",
    color: "#60a5fa",
  },
  maintainer: {
    label: "Maintainer",
    desc:  "Maintains infrastructure. Accountable for uptime and configuration.",
    color: "#34d399",
  },
  delegate: {
    label: "Delegate",
    desc:  "Secondary operator. Limited accountability.",
    color: "#94a3b8",
  },
  renter: {
    label: "Renter",
    desc:  "Temporary operator. Time-bounded link that auto-expires.",
    color: "#f59e0b",
  },
};

// ── Mock registry reads ────────────────────────────────────────────
// In production these are viem calls to the deployed CreatorLinkRegistry contract.
// Replace with real contract reads once deployed.

async function readLinksForAgent(
  agentWallet: string,
  agentTokenId: number,
): Promise<LinkRecord[]> {
  // TODO: replace with viem publicClient.readContract({ functionName: "getActiveAgentLinks", ... })
  const MOCK_LINKS: LinkRecord[] = [
    {
      linkId:         1,
      agentWallet,
      agentTokenId,
      humanWallet:    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      ethosProfileId: 452,
      role:           "creator",
      status:         "active",
      createdAt:      1741200000,
    },
  ];
  return MOCK_LINKS.filter((l) => l.status === "active");
}

async function readLinksForCreator(
  ethosProfileId: number,
): Promise<LinkRecord[]> {
  // TODO: replace with viem call to getEthosProfileLinks(ethosProfileId)
  const MOCK: LinkRecord[] = [
    {
      linkId:         1,
      agentWallet:    "0xAgentAAAA",
      agentTokenId:   1,
      humanWallet:    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      ethosProfileId,
      role:           "creator",
      status:         "active",
      createdAt:      1741200000,
    },
    {
      linkId:         2,
      agentWallet:    "0xAgentBBBB",
      agentTokenId:   2,
      humanWallet:    "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
      ethosProfileId,
      role:           "creator",
      status:         "active",
      createdAt:      1741300000,
    },
  ];
  return MOCK.filter((l) => l.status === "active");
}

// ── Compose functions used by the Next.js pages ───────────────────

/**
 * Build a full LineageView for a single agent.
 * Reads identity, credibility, and relationship independently.
 */
export async function buildLineageView(
  agentMock: AgentIdentity,
): Promise<LineageView | null> {
  const links = await readLinksForAgent(agentMock.agentWallet, agentMock.tokenId);
  if (links.length === 0) return null;

  // Use the creator link as primary (highest accountability weight)
  const primaryLink = links.find((l) => l.role === "creator") ?? links[0];

  // Fetch creator's Ethos data in parallel
  const userkey = `profileId:${primaryLink.ethosProfileId}`;
  const [score, profile] = await Promise.all([
    getScore(userkey),
    getProfileByUserkey(userkey),
  ]);

  const creator: CreatorCredibility = {
    wallet:         primaryLink.humanWallet,
    ethosProfileId: primaryLink.ethosProfileId,
    displayName:    profile?.user.displayName ?? primaryLink.humanWallet.slice(0, 8) + "…",
    username:       profile?.user.username ?? null,
    avatarUrl:      profile?.user.avatarUrl ?? "",
    description:    profile?.user.description ?? null,
    score,
    stats: {
      positiveReviews: profile?.user.stats.review.received.positive ?? 0,
      negativeReviews: profile?.user.stats.review.received.negative ?? 0,
      neutralReviews:  profile?.user.stats.review.received.neutral  ?? 0,
      vouchesReceived: profile?.user.stats.vouch.received.count ?? 0,
      vouchesGiven:    profile?.user.stats.vouch.given.count ?? 0,
      ethStakedOnThem: Number(profile?.user.stats.vouch.received.amountWeiTotal ?? 0),
    },
    humanVerified:   profile?.user.humanVerificationStatus === "VERIFIED",
    ethosProfileUrl: profile?.user.links.profile ?? `https://app.ethos.network/profile/${primaryLink.humanWallet}`,
  };

  return {
    agent:  agentMock,
    creator,
    link: {
      linkId:    primaryLink.linkId,
      role:      primaryLink.role,
      status:    primaryLink.status,
      timestamp: primaryLink.createdAt,
    },
    accountabilityWeight: getRoleWeight(primaryLink.role),
  };
}

/**
 * Get all agents linked to a given Ethos profile, with their full view data.
 */
export async function getLineageByEthosProfile(
  ethosProfileId: number,
): Promise<LinkRecord[]> {
  return readLinksForCreator(ethosProfileId);
}
