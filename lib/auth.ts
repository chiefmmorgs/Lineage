/**
 * ============================================================
 *  Lineage — Authentication Utility (EIP-712)
 * ============================================================
 *
 *  Verifies signatures for platform operations:
 *    - Submit feedback
 *    - Report task
 *    - Register webhook
 *    - Open dispute
 * ============================================================
 */

import { verifyTypedData, type Address } from "viem";

export const LINEAGE_DOMAIN = {
  name: "Lineage Trust Engine",
  version: "1",
  chainId: 84532, // Base Sepolia
  verifyingContract: "0x0000000000000000000000000000000000000000" as Address, // Platform-level auth
} as const;

export const LINEAGE_TYPES = {
  Feedback: [
    { name: "agentTokenId", type: "uint256" },
    { name: "score", type: "uint8" },
    { name: "comment", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
  Task: [
    { name: "agentTokenId", type: "uint256" },
    { name: "taskType", type: "string" },
    { name: "outcome", type: "string" },
    { name: "timestamp", type: "uint256" },
  ],
  Webhook: [
    { name: "agentTokenId", type: "uint256" },
    { name: "url", type: "string" },
    { name: "events", type: "string[]" },
    { name: "timestamp", type: "uint256" },
  ],
} as const;

/**
 * Verify an EIP-712 signature for a platform operation.
 */
export async function verifySignature(params: {
  address: string;
  signature: `0x${string}`;
  primaryType: keyof typeof LINEAGE_TYPES;
  message: any; // Using any here to allow different message structures from our routes
}): Promise<boolean> {
  try {
    const isValid = await verifyTypedData({
      address: params.address as Address,
      domain: LINEAGE_DOMAIN,
      types: LINEAGE_TYPES,
      primaryType: params.primaryType,
      message: params.message,
      signature: params.signature,
    });
    return isValid;
  } catch (error) {
    console.error(`[AUTH] Signature verification failed:`, error);
    return false;
  }
}
