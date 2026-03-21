/**
 * ============================================================
 *  @agenttrust/sdk — Core Types
 * ============================================================
 *
 *  Shared types for the entire SDK. Maps directly to the
 *  AgentHumanLinkRegistry smart contract and ERC-8004.
 * ============================================================
 */
import type { Address, Hash, Hex } from "viem";
export declare enum Role {
    Creator = 0,
    Operator = 1,
    Maintainer = 2,
    Delegate = 3,
    Renter = 4
}
export type RoleName = "creator" | "operator" | "maintainer" | "delegate" | "renter";
export declare const ROLE_NAMES: Record<Role, RoleName>;
export declare const ROLE_WEIGHTS: Record<Role, number>;
export declare enum VerificationLevel {
    SelfClaim = 0,
    AgentConfirmation = 1,
    MutualVerification = 2
}
export type VerificationName = "self-claim" | "agent-confirmation" | "mutual-verification";
export declare const VERIFICATION_NAMES: Record<VerificationLevel, VerificationName>;
export declare enum LinkStatus {
    Active = 0,
    Revoked = 1
}
export interface OnChainLink {
    linkId: number;
    agentWallet: Address;
    agentTokenId: number;
    humanWallet: Address;
    ethosProfileId: number;
    role: Role;
    level: VerificationLevel;
    status: LinkStatus;
    createdAt: number;
    expiration: number;
    isExpired: boolean;
    isActive: boolean;
}
export interface AgentIdentity {
    tokenId: number;
    owner: Address;
    agentURI: string;
    ethosProfile: string;
    isActive: boolean;
}
export interface AgentRegistration {
    type: "https://eips.ethereum.org/EIPS/eip-8004#registration-v1";
    name: string;
    description: string;
    services: AgentService[];
    extensions?: {
        ethosProfileId?: string;
        linkRegistry?: string;
        linkStatus?: "unverified" | "self-claim" | "verified";
        [key: string]: unknown;
    };
}
export interface AgentService {
    type: string;
    url: string;
    description?: string;
}
export interface LinkPayload {
    agentTokenId: bigint;
    ethosProfileId: bigint;
    role: number;
    expiration: bigint;
    nonce: bigint;
    deadline: bigint;
}
export interface SignedProof {
    signer: Address;
    signature: Hex;
    payload: LinkPayload;
}
export interface LinkIntent {
    id: string;
    agentWallet: Address;
    agentTokenId: number;
    ethosProfileId: number;
    role: Role;
    expiration: number;
    humanProof: SignedProof | null;
    agentProof: SignedProof | null;
    status: "pending-human" | "pending-agent" | "ready" | "submitted" | "confirmed";
    createdAt: number;
}
export interface MintResult {
    txHash: Hash;
    agentId: number;
    agentWallet: Address;
    agentURI: string;
}
export interface SubmitResult {
    txHash: Hash;
    linkId: number;
    verificationLevel: VerificationLevel;
}
export interface AgentReputation {
    /** Average score scaled by 100 (e.g., 450 = 4.50 out of 5) */
    averageScore: number;
    /** Total number of reviews */
    reviewCount: number;
}
export interface AgentFeedback {
    reviewer: Address;
    agentTokenId: number;
    /** Score 1-5 */
    score: number;
    comment: string;
    /** Unix timestamp */
    timestamp: number;
}
export interface AgentTrustConfig {
    /** Chain ID (8453 for Base, 84532 for Base Sepolia) */
    chainId: number;
    /** RPC URL for the chain */
    rpcUrl: string;
    /** ERC-8004 Agent Registry contract address */
    agentRegistry: Address;
    /** AgentHumanLinkRegistry contract address */
    linkRegistry: Address;
    /** LineageReputationRegistry contract address (optional) */
    reputationRegistry?: Address;
}
//# sourceMappingURL=types.d.ts.map