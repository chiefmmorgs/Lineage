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
import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";
import { IdentityModule } from "./identity.js";
import { SignaturesModule } from "./signatures.js";
import { LinkModule } from "./link.js";
import { ReadModule } from "./read.js";
import { ReputationModule } from "./reputation.js";
import { DomainsModule } from "./domains.js";
const CHAIN_MAP = {
    8453: base,
    84532: baseSepolia,
};
export class AgentTrust {
    constructor(config) {
        this.config = config;
        const chain = CHAIN_MAP[config.chainId];
        if (!chain) {
            throw new Error(`Unsupported chainId: ${config.chainId}. Supported: ${Object.keys(CHAIN_MAP).join(", ")}`);
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const publicClient = createPublicClient({
            chain,
            transport: http(config.rpcUrl),
        });
        const agentRegistry = config.agentRegistry;
        const linkRegistry = config.linkRegistry;
        // Initialize modules
        this.identity = new IdentityModule(publicClient, agentRegistry);
        this.signatures = new SignaturesModule(publicClient, linkRegistry, config.chainId);
        this.link = new LinkModule(publicClient, linkRegistry, this.signatures);
        this.read = new ReadModule(publicClient, linkRegistry);
        this.domains = new DomainsModule(publicClient);
        // Reputation is optional — only initialize if address is provided
        const reputationRegistry = config.reputationRegistry;
        if (reputationRegistry) {
            this.reputation = new ReputationModule(publicClient, reputationRegistry);
        }
        else {
            // Provide a no-op module that returns empty results
            this.reputation = new ReputationModule(publicClient, "0x0000000000000000000000000000000000000000");
        }
    }
}
//# sourceMappingURL=sdk.js.map