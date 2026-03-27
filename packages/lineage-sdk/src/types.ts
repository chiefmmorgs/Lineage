import type { LocalAccount } from "viem";

/**
 * ============================================================
 *  Lineage SDK — Type Definitions
 * ============================================================
 *
 *  All response shapes from the Lineage API.
 * ============================================================
 */

// ── Score ──────────────────────────────────────────────────────────

export interface LineageScore {
  entityId: string;
  entityType: "agent" | "human";
  lineageScore: number;
  confidence: number;
  displayedScore: number;
  grade: string;
  label: string;
  humanTrust: number;
  agentTrust: number;
  linkTrust: number;
  previousScore: number | null;
  reason: string;
  breakdown: ScoreBreakdown;
  lastUpdated: string;
}

export interface ScoreBreakdown {
  externalFeedbackCount: number;
  platformFeedbackCount: number;
  avgFeedbackScore: number;
  linkCount: number;
  mutualLinks: number;
  hasEthos: boolean;
  proofType: string;
  color: string;
  ensScore: ENSScoreDetail | null;
}

export interface ENSScoreDetail {
  total: number;
  verified: number;
  balance: number;
  activity: number;
  bonus: number;
  ensName: string;
  chainName: string;
  walletBalance: number;
  txCount: number;
}

// ── Score History ─────────────────────────────────────────────────

export interface ScoreHistoryResponse {
  entityId: string;
  entityType: string;
  count: number;
  history: ScoreSnapshot[];
}

export interface ScoreSnapshot {
  displayedScore: number;
  lineageScore: number;
  confidence: number;
  grade: string;
  humanTrust: number;
  agentTrust: number;
  linkTrust: number;
  previousScore: number | null;
  reason: string;
  timestamp: string;
}

// ── Score Explanation ──────────────────────────────────────────────

export interface ScoreExplanation {
  entityId: string;
  entityType: string;
  displayedScore: number;
  grade: string;
  label: string;
  keyFactors: string[];
  components: {
    humanTrust: number;
    agentTrust: number;
    linkTrust: number;
    confidence: number;
  };
  formula: string;
  lastUpdated: string;
}

// ── Link ──────────────────────────────────────────────────────────

export interface LinkDetail {
  linkId: number;
  agentTokenId: number;
  chainId: number;
  humanWallet: string;
  agentWallet: string;
  ethosProfileId: number;
  role: string;
  level: string;
  status: string;
  expiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AgentLinksResponse {
  tokenId: number;
  total: number;
  active: number;
  revoked: number;
  links: LinkDetail[];
}

// ── Feedback ──────────────────────────────────────────────────────

export interface FeedbackSubmission {
  agentTokenId: number;
  chainId: number;
  reviewer: string;
  score: 1 | 2 | 3 | 4 | 5;
  comment?: string;
  category?: "general" | "reliability" | "accuracy" | "speed";
  /** EIP-712 signature (auto-signed if signer provided) */
  signature?: string;
  /** Unix timestamp in seconds */
  timestamp?: number;
}

export interface FeedbackResponse {
  success: boolean;
  feedbackId: number;
  message: string;
}

// ── Agent Profile ─────────────────────────────────────────────────

export interface AgentProfile {
  tokenId: number;
  chainId: number;
  name: string;
  description: string;
  image: string;
  owner: string;
  isVerified: boolean;
  registeredAt: string | null;
  score: {
    displayedScore: number;
    lineageScore: number;
    confidence: number;
    grade: string;
    label: string;
    humanTrust: number;
    agentTrust: number;
    linkTrust: number;
    lastUpdated: string;
  } | null;
  links: {
    total: number;
    active: number;
    items: Array<{
      linkId: number;
      humanWallet: string;
      role: string;
      level: string;
      status: string;
      createdAt: string;
    }>;
  };
  proofs: Array<{
    type: string;
    value: string;
    verified: boolean;
  }>;
  tasks: TaskSummary;
  disputes: DisputeSummary;
  platformFeedback: {
    total: number;
    avgScore: number;
  };
}

// ── Tasks ─────────────────────────────────────────────────────────

export interface TaskSubmission {
  agentTokenId: number;
  chainId?: number;
  humanWallet?: string;
  taskType: string;
  outcome: "success" | "failure" | "partial";
  details?: Record<string, unknown>;
  /** EIP-712 signature (auto-signed if signer provided) */
  signature?: string;
  /** Unix timestamp in seconds */
  timestamp?: number;
}

export interface TaskResponse {
  success: boolean;
  taskId: number;
  message: string;
}

export interface TaskSummary {
  total: number;
  success: number;
  failure: number;
  partial: number;
  successRate: number;
}

export interface TaskHistoryResponse {
  tokenId: number;
  summary: TaskSummary;
  tasks: Array<{
    id: number;
    taskType: string;
    outcome: string;
    humanWallet: string | null;
    details: Record<string, unknown>;
    createdAt: string;
  }>;
}

// ── Disputes ──────────────────────────────────────────────────────

export interface DisputeSubmission {
  linkId?: number;
  agentTokenId?: number;
  initiator: string;
  reason: string;
  /** EIP-712 signature (auto-signed if signer provided) */
  signature?: string;
  /** Unix timestamp in seconds */
  timestamp?: number;
}

export interface DisputeResponse {
  success: boolean;
  disputeId: number;
  status: string;
  message: string;
}

export interface DisputeDetail {
  id: number;
  linkId: number | null;
  agentTokenId: number | null;
  initiator: string;
  reason: string;
  status: string;
  resolution: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DisputeSummary {
  total: number;
  open: number;
  resolved: number;
  dismissed: number;
}

export interface AgentDisputesResponse {
  tokenId: number;
  total: number;
  open: number;
  resolved: number;
  disputes: DisputeDetail[];
}

// ── Trust Check ───────────────────────────────────────────────────

export interface TrustCheckResponse {
  tokenId: number;
  chainId: number;
  trusted: boolean;
  score: number;
  grade: string;
  confidence: number;
  threshold: number;
  reason: string;
  message: string;
  checkedAt: string;
}

// ── Webhooks ──────────────────────────────────────────────────────

export type WebhookEvent = "score.changed" | "feedback.received" | "link.created" | "link.revoked" | "dispute.opened";

export interface WebhookRegistration {
  agentTokenId: number;
  chainId?: number;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  /** EIP-712 signature (auto-signed if signer provided) */
  signature?: string;
  /** Unix timestamp in seconds */
  timestamp?: number;
  /** Wallet that signs the registration */
  signerWallet?: string;
}

export interface WebhookResponse {
  success: boolean;
  webhookId: number;
  message: string;
  events: string[];
}

export interface WebhookListResponse {
  total: number;
  webhooks: Array<{
    id: number;
    agentTokenId: number;
    chainId: number;
    url: string;
    events: string[];
    active: boolean;
    createdAt: string;
  }>;
}

// ── SDK Config ────────────────────────────────────────────────────

export interface LineageConfig {
  /** Base URL for the Lineage API (default: http://localhost:3000) */
  apiUrl?: string;
  /** Request timeout in milliseconds (default: 10000) */
  timeout?: number;
  /** Optional API key for identification */
  apiKey?: string;
  /** Optional private key or Viem account for EIP-712 signing of agent operations */
  signer?: `0x${string}` | LocalAccount;
}

// ── Error ─────────────────────────────────────────────────────────

export interface LineageError {
  error: string;
  entityId?: string;
  linkId?: number;
}
