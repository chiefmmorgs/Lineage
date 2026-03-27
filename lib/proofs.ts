import { createPublicClient, http, verifyMessage, type Address } from "viem";
import { mainnet } from "viem/chains";
import { db, now } from "./db/index";
import { proofs } from "./db/schema";
import { eq, and } from "drizzle-orm";

// ── Types ────────────────────────────────────────────────────────

export type ProofType = "ethos" | "ens" | "unverified";

export type AgentRole = "creator" | "operator" | "owner";

export interface ProofRecord {
  agentTokenId: number;
  proofType: ProofType;
  /** ENS name or ETHOS profile ID */
  value: string;
  /** Wallet that signed the proof */
  wallet: string;
  /** The EIP-191 signature from the prover */
  signature: string;
  /** Role of the prover */
  role: AgentRole;
  /** Unix timestamp of when the proof was created */
  timestamp: number;
  /** Whether the proof has been verified */
  verified: boolean;
}

export interface ResolvedIdentity {
  /** Best proof available (highest in hierarchy) */
  proof: ProofRecord | null;
  /** ETHOS proof if available */
  ethosProof: ProofRecord | null;
  /** ENS proof if available */
  ensProof: ProofRecord | null;
  /** All proofs for this agent */
  allProofs: ProofRecord[];
  /** Display label for the UI */
  displayLabel: string;
  /** Proof status label */
  statusLabel: string;
  /** Whether any proof is verified */
  isVerified: boolean;
}

// ── Role labels ──────────────────────────────────────────────────

export const ROLE_CONFIG: Record<AgentRole, { label: string; color: string; description: string }> = {
  creator: {
    label: "Creator",
    color: "#818cf8",
    description: "The human who built this agent",
  },
  operator: {
    label: "Operator",
    color: "#22c55e",
    description: "The human who runs this agent",
  },
  owner: {
    label: "Owner of Agent NFT",
    color: "#f59e0b",
    description: "The wallet that holds the ERC-8004 token",
  },
};

// ── ENS Verification ─────────────────────────────────────────────

/**
 * Build the message that must be signed for ENS proof.
 */
export function buildEnsProofMessage(agentTokenId: number, ensName: string): string {
  return `I verify ownership of agent #${agentTokenId} via ${ensName}`;
}

/**
 * Resolve an ENS name to its owner wallet address.
 */
export async function resolveEnsOwner(ensName: string): Promise<string | null> {
  try {
    const mainnetClient = createPublicClient({
      chain: mainnet,
      transport: http(),
    });
    const address = await mainnetClient.getEnsAddress({ name: ensName });
    return address ?? null;
  } catch {
    return null;
  }
}

/**
 * Verify an ENS proof:
 *  1. Resolve the ENS name → get the wallet address
 *  2. Verify the signature was signed by that wallet
 *  3. Check that the message matches the expected format
 */
export async function verifyEnsProof(params: {
  agentTokenId: number;
  ensName: string;
  wallet: string;
  signature: `0x${string}`;
}): Promise<{
  valid: boolean;
  error?: string;
  resolvedAddress?: string;
}> {
  const { agentTokenId, ensName, wallet, signature } = params;

  // 1. Resolve ENS
  const resolvedAddress = await resolveEnsOwner(ensName);
  if (!resolvedAddress) {
    return { valid: false, error: `Could not resolve ENS name: ${ensName}` };
  }

  // 2. Check wallet matches resolved address
  if (resolvedAddress.toLowerCase() !== wallet.toLowerCase()) {
    return {
      valid: false,
      error: `Signing wallet ${wallet.slice(0, 10)}... does not match ENS resolved address ${resolvedAddress.slice(0, 10)}...`,
      resolvedAddress,
    };
  }

  // 3. Verify signature
  const message = buildEnsProofMessage(agentTokenId, ensName);
  try {
    const isValid = await verifyMessage({
      address: wallet as Address,
      message,
      signature,
    });
    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }
  } catch {
    return { valid: false, error: "Signature verification failed" };
  }

  return { valid: true, resolvedAddress };
}

// ── Proof CRUD ───────────────────────────────────────────────────

/**
 * Store a verified proof in the database.
 */
export async function storeProof(proof: ProofRecord): Promise<void> {
  // Remove existing proof of the same type for this agent
  db.delete(proofs)
    .where(and(
      eq(proofs.agentTokenId, proof.agentTokenId),
      eq(proofs.proofType, proof.proofType)
    ))
    .run();

  db.insert(proofs).values({
    agentTokenId: proof.agentTokenId,
    proofType: proof.proofType,
    value: proof.value,
    wallet: proof.wallet,
    signature: proof.signature,
    verified: proof.verified,
    createdAt: now(),
  }).run();
}

/**
 * Get all proofs for a specific agent from the database.
 */
export async function getProofsForAgent(agentTokenId: number): Promise<ProofRecord[]> {
  const result = db.select().from(proofs)
    .where(eq(proofs.agentTokenId, agentTokenId))
    .all();

  return result.map(p => ({
    agentTokenId: p.agentTokenId,
    proofType: p.proofType as ProofType,
    value: p.value,
    wallet: p.wallet,
    signature: p.signature || "",
    role: "creator", // Default or look up if needed
    timestamp: p.createdAt,
    verified: p.verified,
  }));
}

/**
 * Resolve the full identity for an agent, applying the proof hierarchy.
 */
export async function resolveIdentity(
  agentTokenId: number,
  hasEthosLink: boolean = false,
  ethosProfileId?: number,
): Promise<ResolvedIdentity> {
  const allProofs = await getProofsForAgent(agentTokenId);

  const ethosProof = allProofs.find((p) => p.proofType === "ethos" && p.verified) ?? null;
  const ensProof = allProofs.find((p) => p.proofType === "ens" && p.verified) ?? null;

  // Auto-create ETHOS proof record if agent has an active ETHOS link
  let effectiveEthosProof = ethosProof;
  if (!ethosProof && hasEthosLink && ethosProfileId) {
    effectiveEthosProof = {
      agentTokenId,
      proofType: "ethos",
      value: `profileId:${ethosProfileId}`,
      wallet: "",
      signature: "",
      role: "creator",
      timestamp: now(),
      verified: true,
    };
  }

  // Apply hierarchy: ETHOS > ENS > Unverified
  let proof: ProofRecord | null = null;
  let displayLabel = "Unverified claimed owner";
  let statusLabel = "Unverified";
  let isVerified = false;

  if (effectiveEthosProof) {
    proof = effectiveEthosProof;
    displayLabel = `Verified via ETHOS`;
    statusLabel = "✓ Verified";
    isVerified = true;
  } else if (ensProof) {
    proof = ensProof;
    displayLabel = `Verified via ENS: ${ensProof.value}`;
    statusLabel = "✓ Verified";
    isVerified = true;
  }

  return {
    proof,
    ethosProof: effectiveEthosProof,
    ensProof,
    allProofs,
    displayLabel,
    statusLabel,
    isVerified,
  };
}
