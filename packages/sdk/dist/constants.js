/**
 * ============================================================
 *  @agenttrust/sdk — Constants & ABIs
 * ============================================================
 */
import { parseAbi } from "viem";
// ── ERC-8004 Agent Registry ABI ──────────────────────────────────
export const AGENT_REGISTRY_ABI = parseAbi([
    "function mintAgent(string agentURI, string ethosProfile) returns (uint256)",
    "function setAgentURI(uint256 agentId, string agentURI)",
    "function ownerOf(uint256 tokenId) view returns (address)",
    "function agentURI(uint256 agentId) view returns (string)",
    "function ethosProfile(uint256 agentId) view returns (string)",
    "function isActive(uint256 agentId) view returns (bool)",
    "function balanceOf(address owner) view returns (uint256)",
    "event AgentMinted(uint256 indexed agentId, address indexed creator, string ethosProfile, string agentURI)",
    "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
]);
// ── AgentHumanLinkRegistry ABI ───────────────────────────────────
export const LINK_REGISTRY_ABI = parseAbi([
    // Write
    "function createVerifiedLink(address agentWallet, uint256 agentTokenId, uint256 ethosProfileId, uint8 role, uint256 expiration, uint256 deadline, bytes humanSignature, bytes agentSignature) returns (uint256)",
    "function upgradeLink(uint256 linkId, bytes signature, uint256 deadline)",
    "function revokeLink(uint256 linkId)",
    // Read
    "function getLink(uint256 linkId) view returns ((uint256 linkId, address agentWallet, uint256 agentTokenId, address humanWallet, uint256 ethosProfileId, uint8 role, uint8 level, uint8 status, uint256 createdAt, uint256 expiration, bytes humanSignature, bytes agentSignature))",
    "function getAgentLinks(address agentWallet, uint256 agentTokenId) view returns (uint256[])",
    "function getActiveAgentLinks(address agentWallet, uint256 agentTokenId) view returns ((uint256 linkId, address agentWallet, uint256 agentTokenId, address humanWallet, uint256 ethosProfileId, uint8 role, uint8 level, uint8 status, uint256 createdAt, uint256 expiration, bytes humanSignature, bytes agentSignature)[])",
    "function getHumanLinks(address humanWallet) view returns (uint256[])",
    "function getProfileLinks(uint256 ethosProfileId) view returns (uint256[])",
    "function isLinkActive(uint256 linkId) view returns (bool)",
    "function nonces(address) view returns (uint256)",
    "function getDomainSeparator() view returns (bytes32)",
    "function totalLinks() view returns (uint256)",
]);
// ── LineageReputationRegistry ABI ────────────────────────────────
export const REPUTATION_REGISTRY_ABI = parseAbi([
    "function submitFeedback(uint256 agentTokenId, uint8 score, string comment)",
    "function getAverageScore(uint256 agentTokenId) view returns (uint256 avg, uint256 count)",
    "function getFeedbackAt(uint256 agentTokenId, uint256 index) view returns ((address reviewer, uint256 agentTokenId, uint8 score, string comment, uint256 timestamp, bool exists))",
    "function getFeedback(uint256 agentTokenId, uint256 offset, uint256 limit) view returns ((address reviewer, uint256 agentTokenId, uint8 score, string comment, uint256 timestamp, bool exists)[])",
    "function getReviewCount(uint256 agentTokenId) view returns (uint256)",
    "function getReviewByReviewer(uint256 agentTokenId, address reviewer) view returns ((address reviewer, uint256 agentTokenId, uint8 score, string comment, uint256 timestamp, bool exists))",
    "function hasReviewed(uint256 agentTokenId, address reviewer) view returns (bool)",
    "event FeedbackSubmitted(uint256 indexed agentTokenId, address indexed reviewer, uint8 score, string comment)",
    "event FeedbackUpdated(uint256 indexed agentTokenId, address indexed reviewer, uint8 oldScore, uint8 newScore, string comment)",
]);
// ── EIP-712 ──────────────────────────────────────────────────────
export const LINK_EIP712_TYPES = {
    LinkAgent: [
        { name: "agentTokenId", type: "uint256" },
        { name: "ethosProfileId", type: "uint256" },
        { name: "role", type: "uint8" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
    ],
};
/**
 * Build the EIP-712 domain for a given chain and registry address.
 */
export function buildEIP712Domain(chainId, linkRegistry) {
    return {
        name: "AgentHumanLinkRegistry",
        version: "1",
        chainId,
        verifyingContract: linkRegistry,
    };
}
//# sourceMappingURL=constants.js.map