/**
 * ============================================================
 *  @agenttrust/sdk — Main Entry
 * ============================================================
 *
 *  AgentTrust SDK
 *
 *  A headless npm SDK that wraps ERC-8004 registration and the
 *  dual-signature link protocol, so creators and agents can
 *  mint, verify, and publish their relationship programmatically
 *  without using a dashboard.
 *
 *  @example
 *  ```ts
 *  import { AgentTrust, Role } from "@agenttrust/sdk";
 *
 *  const sdk = new AgentTrust({
 *    chainId: 84532,
 *    rpcUrl: "https://sepolia.base.org",
 *    agentRegistry: "0x20969E25aFF0c3E95e4c656401a1abbF93b9C6D2",
 *    linkRegistry: "0xYourLinkRegistry",
 *  });
 *
 *  // Mint an agent
 *  const agent = await sdk.identity.mintAgent({
 *    signer: agentWallet,
 *    agentURI: "ipfs://Qm...",
 *  });
 *
 *  // Creator signs
 *  const humanProof = await sdk.link.signHumanClaim({
 *    signer: humanWallet,
 *    agentId: agent.agentId,
 *    ethosProfileId: 88,
 *    role: Role.Creator,
 *  });
 *
 *  // Agent confirms
 *  const agentProof = await sdk.link.signAgentConfirmation({
 *    signer: agentWallet,
 *    agentId: agent.agentId,
 *    ethosProfileId: 88,
 *    role: Role.Creator,
 *  });
 *
 *  // Submit
 *  await sdk.link.submitVerifiedLink({
 *    submitter: agentWallet,
 *    agentWallet: agent.agentWallet,
 *    humanProof,
 *    agentProof,
 *  });
 *  ```
 * ============================================================
 */
import type { AgentTrustConfig } from "./types.js";
import { IdentityModule } from "./identity.js";
import { SignaturesModule } from "./signatures.js";
import { LinkModule } from "./link.js";
import { ReadModule } from "./read.js";
import { ReputationModule } from "./reputation.js";
import { DomainsModule } from "./domains.js";
export declare class AgentTrust {
    /** ERC-8004 agent identity — mint, update, read */
    readonly identity: IdentityModule;
    /** Creator/operator verification — sign, submit, revoke */
    readonly link: LinkModule;
    /** EIP-712 typed data signing */
    readonly signatures: SignaturesModule;
    /** Read-only queries — agent links, profile links */
    readonly read: ReadModule;
    /** On-chain reputation — scores, reviews, feedback */
    readonly reputation: ReputationModule;
    /** Domain name resolution — ENS, Basenames */
    readonly domains: DomainsModule;
    /** The SDK configuration */
    readonly config: AgentTrustConfig;
    constructor(config: AgentTrustConfig);
}
//# sourceMappingURL=sdk.d.ts.map