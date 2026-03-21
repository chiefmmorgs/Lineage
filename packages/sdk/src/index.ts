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

// ── Main SDK class ───────────────────────────────────────────────
export { AgentTrust } from "./sdk.js";

// ── Modules (for advanced usage) ─────────────────────────────────
export { IdentityModule } from "./identity.js";
export { LinkModule } from "./link.js";
export { SignaturesModule } from "./signatures.js";
export { ReadModule } from "./read.js";
export { ReputationModule } from "./reputation.js";
export { DomainsModule, type DomainResolution } from "./domains.js";

// ── Types ────────────────────────────────────────────────────────
export {
  // Enums
  Role,
  VerificationLevel,
  LinkStatus,

  // Enum name maps
  ROLE_NAMES,
  ROLE_WEIGHTS,
  VERIFICATION_NAMES,

  // Type aliases
  type RoleName,
  type VerificationName,

  // Data shapes
  type AgentTrustConfig,
  type OnChainLink,
  type AgentIdentity,
  type AgentRegistration,
  type AgentService,
  type LinkPayload,
  type SignedProof,
  type LinkIntent,
  type MintResult,
  type SubmitResult,
  type AgentReputation,
  type AgentFeedback,
} from "./types.js";

// ── Constants ────────────────────────────────────────────────────
export {
  AGENT_REGISTRY_ABI,
  LINK_REGISTRY_ABI,
  REPUTATION_REGISTRY_ABI,
  LINK_EIP712_TYPES,
  buildEIP712Domain,
} from "./constants.js";
