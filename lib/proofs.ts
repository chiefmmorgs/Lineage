/**
 * ============================================================
 *  Lineage — Identity Proof System
 * ============================================================
 *
 *  Proof hierarchy:
 *    1. Direct ETHOS proof  → "Verified via ETHOS"
 *    2. ENS proof           → "Verified via ENS: name.eth"
 *    3. Unverified          → "Unverified claimed owner"
 *
 *  ENS proof: The platform resolves the ENS name and checks
 *  that the signing wallet matches the wallet tied to the name.
 *  ENS proves control of the named wallet, not legal identity.
 * ============================================================
 */

import { createPublicClient, http, verifyMessage, type Address } from "viem";
import { mainnet } from "viem/chains";
import { promises as fs } from "fs";
import path from "path";

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

// ── Storage (file-based, can migrate to on-chain) ────────────────

const DATA_DIR = path.join(process.cwd(), "data");
const PROOFS_FILE = path.join(DATA_DIR, "proofs.json");

async function readProofsFile(): Promise<ProofRecord[]> {
  try {
    const data = await fs.readFile(PROOFS_FILE, "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function writeProofsFile(proofs: ProofRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(PROOFS_FILE, JSON.stringify(proofs, null, 2));
}

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
 * Store a verified proof.
 */
export async function storeProof(proof: ProofRecord): Promise<void> {
  const proofs = await readProofsFile();

  // Remove existing proof of the same type for this agent
  const filtered = proofs.filter(
    (p) => !(p.agentTokenId === proof.agentTokenId && p.proofType === proof.proofType)
  );

  filtered.push(proof);
  await writeProofsFile(filtered);
}

/**
 * Get all proofs for a specific agent.
 */
export async function getProofsForAgent(agentTokenId: number): Promise<ProofRecord[]> {
  const proofs = await readProofsFile();
  return proofs.filter((p) => p.agentTokenId === agentTokenId);
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
      timestamp: Date.now(),
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
