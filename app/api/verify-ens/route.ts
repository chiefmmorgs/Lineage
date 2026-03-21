/**
 * POST /api/verify-ens
 *
 * Verifies ENS ownership proof for an agent.
 * Body: { agentTokenId, ensName, wallet, signature, role }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyEnsProof,
  storeProof,
  type AgentRole,
  type ProofRecord,
} from "@/lib/proofs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { agentTokenId, ensName, wallet, signature, role } = body;

    // Validate inputs
    if (!agentTokenId || !ensName || !wallet || !signature) {
      return NextResponse.json(
        { error: "Missing required fields: agentTokenId, ensName, wallet, signature" },
        { status: 400 }
      );
    }

    if (!ensName.endsWith(".eth")) {
      return NextResponse.json(
        { error: "ENS name must end with .eth" },
        { status: 400 }
      );
    }

    const validRoles: AgentRole[] = ["creator", "operator", "owner"];
    const proofRole: AgentRole = validRoles.includes(role) ? role : "owner";

    // Verify the ENS proof
    const result = await verifyEnsProof({
      agentTokenId: Number(agentTokenId),
      ensName: ensName.toLowerCase().trim(),
      wallet,
      signature: signature as `0x${string}`,
    });

    if (!result.valid) {
      return NextResponse.json(
        { error: result.error, resolvedAddress: result.resolvedAddress },
        { status: 400 }
      );
    }

    // Store the verified proof
    const proof: ProofRecord = {
      agentTokenId: Number(agentTokenId),
      proofType: "ens",
      value: ensName.toLowerCase().trim(),
      wallet: wallet.toLowerCase(),
      signature,
      role: proofRole,
      timestamp: Math.floor(Date.now() / 1000),
      verified: true,
    };

    await storeProof(proof);

    return NextResponse.json({
      success: true,
      proof: {
        agentTokenId: proof.agentTokenId,
        proofType: proof.proofType,
        ensName: proof.value,
        role: proof.role,
        verified: proof.verified,
      },
    });
  } catch (error) {
    console.error("ENS verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
