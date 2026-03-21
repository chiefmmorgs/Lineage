/**
 * ============================================================
 *  @agenttrust/sdk — Link Module
 * ============================================================
 *
 *  The heart of the Mutual Verification Protocol.
 *
 *  Supports two modes:
 *
 *    Embedded mode (same runtime):
 *      sdk.link.signHumanClaim(...)
 *      sdk.link.signAgentConfirmation(...)
 *      sdk.link.submitVerifiedLink(...)
 *
 *    Intent mode (separate runtimes):
 *      creator: sdk.link.createIntent(...)
 *      agent:   sdk.link.acceptIntent(intent, ...)
 *      either:  sdk.link.finalizeIntent(intent, ...)
 * ============================================================
 */

import {
  type Address,
  type WalletClient,
  type Hex,
  encodeFunctionData,
} from "viem";
import { LINK_REGISTRY_ABI } from "./constants.js";
import { SignaturesModule } from "./signatures.js";
import type {
  Role,
  SignedProof,
  SubmitResult,
  LinkIntent,
  LinkPayload,
} from "./types.js";

export class LinkModule {
  constructor(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private publicClient: any,
    private linkRegistry: Address,
    private signatures: SignaturesModule,
  ) {}

  // ── Embedded mode: direct signing ──────────────────────────

  /**
   * Human wallet signs a creator/operator claim.
   *
   * @example
   * ```ts
   * const humanProof = await sdk.link.signHumanClaim({
   *   signer: humanWallet,
   *   agentId: 1,
   *   ethosProfileId: 88,
   *   role: Role.Creator,
   * });
   * ```
   */
  async signHumanClaim(params: {
    signer: WalletClient;
    agentId: number;
    ethosProfileId: number;
    role: Role;
    expiration?: number;
  }): Promise<SignedProof> {
    const [account] = await params.signer.getAddresses();

    const payload = await this.signatures.buildPayload({
      signerAddress: account,
      agentTokenId: params.agentId,
      ethosProfileId: params.ethosProfileId,
      role: params.role,
      expiration: params.expiration,
    });

    return this.signatures.sign(params.signer, payload);
  }

  /**
   * Agent wallet signs confirmation of the human claim.
   *
   * @example
   * ```ts
   * const agentProof = await sdk.link.signAgentConfirmation({
   *   signer: agentWallet,
   *   agentId: 1,
   *   ethosProfileId: 88,
   *   role: Role.Creator,
   * });
   * ```
   */
  async signAgentConfirmation(params: {
    signer: WalletClient;
    agentId: number;
    ethosProfileId: number;
    role: Role;
    expiration?: number;
  }): Promise<SignedProof> {
    const [account] = await params.signer.getAddresses();

    const payload = await this.signatures.buildPayload({
      signerAddress: account,
      agentTokenId: params.agentId,
      ethosProfileId: params.ethosProfileId,
      role: params.role,
      expiration: params.expiration,
    });

    return this.signatures.sign(params.signer, payload);
  }

  /**
   * Submit a verified link with both proofs to the registry.
   *
   * @example
   * ```ts
   * const result = await sdk.link.submitVerifiedLink({
   *   submitter: anyWalletClient,
   *   agentWallet: "0x...",
   *   humanProof,
   *   agentProof,
   * });
   * ```
   */
  async submitVerifiedLink(params: {
    submitter: WalletClient;
    agentWallet: Address;
    humanProof: SignedProof;
    agentProof?: SignedProof | null;
  }): Promise<SubmitResult> {
    const { submitter, agentWallet, humanProof, agentProof } = params;
    const [account] = await submitter.getAddresses();

    const payload = humanProof.payload;

    const data = encodeFunctionData({
      abi: LINK_REGISTRY_ABI,
      functionName: "createVerifiedLink",
      args: [
        agentWallet,
        payload.agentTokenId,
        payload.ethosProfileId,
        payload.role,
        payload.expiration,
        payload.deadline,
        humanProof.signature,
        (agentProof?.signature ?? "0x") as Hex,
      ],
    });

    const hash = await submitter.sendTransaction({
      account,
      chain: null,
      to: this.linkRegistry,
      data,
    });

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash });

    // Parse linkId from event logs (simplified)
    let linkId = 0;
    for (const log of receipt.logs) {
      if (log.topics[0] && log.topics[1]) {
        // AgentLinked event — linkId is topic[1]
        linkId = Number(BigInt(log.topics[1]));
        break;
      }
    }

    const level = agentProof ? 2 : 0; // MutualVerification or SelfClaim

    return {
      txHash: hash,
      linkId,
      verificationLevel: level,
    };
  }

  // ── Intent mode: async two-wallet flow ─────────────────────

  /**
   * Create a link intent. The human signs first, producing a
   * portable intent object that can be passed to the agent.
   *
   * @example
   * ```ts
   * // Creator's app
   * const intent = await sdk.link.createIntent({
   *   humanSigner: creatorWallet,
   *   agentWallet: "0xAgent...",
   *   agentId: 1,
   *   ethosProfileId: 88,
   *   role: Role.Creator,
   * });
   * // Pass intent to agent service...
   * ```
   */
  async createIntent(params: {
    humanSigner: WalletClient;
    agentWallet: Address;
    agentId: number;
    ethosProfileId: number;
    role: Role;
    expiration?: number;
  }): Promise<LinkIntent> {
    const humanProof = await this.signHumanClaim({
      signer: params.humanSigner,
      agentId: params.agentId,
      ethosProfileId: params.ethosProfileId,
      role: params.role,
      expiration: params.expiration,
    });

    const intentId = [
      params.agentId,
      params.ethosProfileId,
      params.role,
      Date.now(),
    ].join("-");

    return {
      id: intentId,
      agentWallet: params.agentWallet,
      agentTokenId: params.agentId,
      ethosProfileId: params.ethosProfileId,
      role: params.role,
      expiration: params.expiration ?? 0,
      humanProof,
      agentProof: null,
      status: "pending-agent",
      createdAt: Math.floor(Date.now() / 1000),
    };
  }

  /**
   * Agent accepts an intent by signing the confirmation.
   *
   * @example
   * ```ts
   * // Agent's runtime
   * const accepted = await sdk.link.acceptIntent(intent, {
   *   signer: agentWallet,
   * });
   * ```
   */
  async acceptIntent(
    intent: LinkIntent,
    params: { signer: WalletClient },
  ): Promise<LinkIntent> {
    const agentProof = await this.signAgentConfirmation({
      signer: params.signer,
      agentId: intent.agentTokenId,
      ethosProfileId: intent.ethosProfileId,
      role: intent.role,
      expiration: intent.expiration,
    });

    return {
      ...intent,
      agentProof,
      status: "ready",
    };
  }

  /**
   * Finalize an intent by submitting both proofs on-chain.
   *
   * @example
   * ```ts
   * const result = await sdk.link.finalizeIntent(intent, {
   *   submitter: anyWalletClient,
   * });
   * ```
   */
  async finalizeIntent(
    intent: LinkIntent,
    params: { submitter: WalletClient },
  ): Promise<SubmitResult> {
    if (!intent.humanProof) {
      throw new Error("Intent missing human proof");
    }

    return this.submitVerifiedLink({
      submitter: params.submitter,
      agentWallet: intent.agentWallet,
      humanProof: intent.humanProof,
      agentProof: intent.agentProof,
    });
  }

  // ── Revocation ─────────────────────────────────────────────

  /**
   * Revoke an existing link. Can be called by either
   * the human wallet or the agent wallet.
   */
  async revokeLink(params: {
    signer: WalletClient;
    linkId: number;
  }): Promise<string> {
    const [account] = await params.signer.getAddresses();

    const data = encodeFunctionData({
      abi: LINK_REGISTRY_ABI,
      functionName: "revokeLink",
      args: [BigInt(params.linkId)],
    });

    const hash = await params.signer.sendTransaction({
      account,
      chain: null,
      to: this.linkRegistry,
      data,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }

  // ── Upgrade ────────────────────────────────────────────────

  /**
   * Upgrade a Level 1 or Level 2 link to Level 3 by adding
   * the missing signature.
   */
  async upgradeLink(params: {
    signer: WalletClient;
    linkId: number;
    payload: LinkPayload;
  }): Promise<string> {
    const proof = await this.signatures.sign(params.signer, params.payload);
    const [account] = await params.signer.getAddresses();

    const data = encodeFunctionData({
      abi: LINK_REGISTRY_ABI,
      functionName: "upgradeLink",
      args: [BigInt(params.linkId), proof.signature, params.payload.deadline],
    });

    const hash = await params.signer.sendTransaction({
      account,
      chain: null,
      to: this.linkRegistry,
      data,
    });

    await this.publicClient.waitForTransactionReceipt({ hash });
    return hash;
  }
}
