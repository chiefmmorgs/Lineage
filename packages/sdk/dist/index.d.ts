/**
 * @agenttrust/sdk
 *
 * Headless SDK for the Mutual Verification Protocol.
 * Links ERC-8004 agent identities to Ethos human reputation profiles.
 *
 * @example
 * ```ts
 * import { AgentTrust, Role } from "@agenttrust/sdk";
 * ```
 */
export { AgentTrust } from "./sdk.js";
export { IdentityModule } from "./identity.js";
export { LinkModule } from "./link.js";
export { SignaturesModule } from "./signatures.js";
export { ReadModule } from "./read.js";
export { ReputationModule } from "./reputation.js";
export { DomainsModule, type DomainResolution } from "./domains.js";
export { Role, VerificationLevel, LinkStatus, ROLE_NAMES, ROLE_WEIGHTS, VERIFICATION_NAMES, type RoleName, type VerificationName, type AgentTrustConfig, type OnChainLink, type AgentIdentity, type AgentRegistration, type AgentService, type LinkPayload, type SignedProof, type LinkIntent, type MintResult, type SubmitResult, type AgentReputation, type AgentFeedback, } from "./types.js";
export { AGENT_REGISTRY_ABI, LINK_REGISTRY_ABI, REPUTATION_REGISTRY_ABI, LINK_EIP712_TYPES, buildEIP712Domain, } from "./constants.js";
//# sourceMappingURL=index.d.ts.map