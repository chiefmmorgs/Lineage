// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * ============================================================
 *  AgentHumanLinkRegistry
 * ============================================================
 *
 *  Mutual Verification Protocol for linking ERC-8004 Agent
 *  Identities to Ethos Human Reputation Profiles.
 *
 *  Verification Levels:
 *    Level 1 — Human Self Claim (humanSignature only)
 *    Level 2 — Agent Confirmation (agentSignature only)
 *    Level 3 — Mutual Verification (both signatures)
 *
 *  Supports time-bounded links (renting/delegation) via
 *  an `expiration` timestamp. Links with expiration > 0
 *  auto-expire and are treated as inactive after that time.
 *
 *  Deployed on Base Sepolia.
 * ============================================================
 */
contract AgentHumanLinkRegistry is EIP712 {
    using ECDSA for bytes32;

    // ── Roles ────────────────────────────────────────────────
    enum Role {
        Creator,    // 0 — Built the agent. 100% accountability.
        Operator,   // 1 — Runs it live. 80% accountability.
        Maintainer, // 2 — Maintains infra. 50% accountability.
        Delegate,   // 3 — Secondary operator. 30% accountability.
        Renter      // 4 — Temporary operator. Time-bounded.
    }

    // ── Verification levels ──────────────────────────────────
    enum VerificationLevel {
        SelfClaim,          // 0 — Only human signed
        AgentConfirmation,  // 1 — Only agent owner signed
        MutualVerification  // 2 — Both signed
    }

    // ── Link status ──────────────────────────────────────────
    enum Status {
        Active,   // 0
        Revoked   // 1
    }

    // ── Link storage ─────────────────────────────────────────
    struct Link {
        uint256 linkId;
        address agentWallet;       // Wallet holding the ERC-8004 token
        uint256 agentTokenId;      // ERC-8004 token ID
        address humanWallet;       // Ethos profile wallet
        uint256 ethosProfileId;    // Ethos profile ID
        Role role;
        VerificationLevel level;
        Status status;
        uint256 createdAt;
        uint256 expiration;        // 0 = permanent, >0 = unix timestamp
        bytes humanSignature;
        bytes agentSignature;
    }

    // ── State ────────────────────────────────────────────────
    uint256 private _nextLinkId = 1;

    mapping(uint256 => Link) public links;

    // agentWallet + tokenId => linkIds
    mapping(bytes32 => uint256[]) private _agentLinks;

    // humanWallet => linkIds
    mapping(address => uint256[]) private _humanLinks;

    // ethosProfileId => linkIds
    mapping(uint256 => uint256[]) private _profileLinks;

    // Nonces for replay protection
    mapping(address => uint256) public nonces;

    // ── EIP-712 typehash ─────────────────────────────────────
    bytes32 public constant LINK_TYPEHASH = keccak256(
        "LinkAgent(uint256 agentTokenId,uint256 ethosProfileId,uint8 role,uint256 expiration,uint256 nonce,uint256 deadline)"
    );

    // ── Events ───────────────────────────────────────────────
    event AgentLinked(
        uint256 indexed linkId,
        uint256 indexed agentTokenId,
        uint256 indexed ethosProfileId,
        address agentWallet,
        address humanWallet,
        Role role,
        VerificationLevel level,
        uint256 expiration
    );

    event AgentUnlinked(uint256 indexed linkId, address revokedBy);

    event LinkUpgraded(
        uint256 indexed linkId,
        VerificationLevel oldLevel,
        VerificationLevel newLevel
    );

    // ── Constructor ──────────────────────────────────────────
    constructor() EIP712("AgentHumanLinkRegistry", "1") {}

    // ── Core: Create a mutually verified link ────────────────
    /**
     * @notice Create a link between an agent and a human profile.
     * @param agentWallet      Wallet holding the ERC-8004 token
     * @param agentTokenId     The ERC-8004 token ID
     * @param ethosProfileId   The Ethos profile ID
     * @param role             Role enum (Creator, Operator, etc.)
     * @param expiration       Unix timestamp for link expiry (0 = permanent)
     * @param deadline         Signature validity deadline
     * @param humanSignature   EIP-712 signature from the Ethos profile wallet
     * @param agentSignature   EIP-712 signature from the agent token owner
     */
    function createVerifiedLink(
        address agentWallet,
        uint256 agentTokenId,
        uint256 ethosProfileId,
        Role role,
        uint256 expiration,
        uint256 deadline,
        bytes calldata humanSignature,
        bytes calldata agentSignature
    ) external returns (uint256 linkId) {
        require(block.timestamp <= deadline, "Signatures expired");
        require(
            expiration == 0 || expiration > block.timestamp,
            "Expiration must be in the future"
        );

        // Determine verification level
        VerificationLevel level;
        address humanSigner;
        address agentSigner;

        // Build the struct hash
        bytes32 structHash = keccak256(
            abi.encode(
                LINK_TYPEHASH,
                agentTokenId,
                ethosProfileId,
                uint8(role),
                expiration,
                nonces[msg.sender]++,
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);

        // Recover signers
        bool hasHuman = humanSignature.length > 0;
        bool hasAgent = agentSignature.length > 0;

        if (hasHuman && hasAgent) {
            humanSigner = ECDSA.recover(digest, humanSignature);
            agentSigner = ECDSA.recover(digest, agentSignature);
            level = VerificationLevel.MutualVerification;
        } else if (hasHuman) {
            humanSigner = ECDSA.recover(digest, humanSignature);
            agentSigner = address(0);
            level = VerificationLevel.SelfClaim;
        } else if (hasAgent) {
            humanSigner = address(0);
            agentSigner = ECDSA.recover(digest, agentSignature);
            level = VerificationLevel.AgentConfirmation;
        } else {
            // Direct call — caller is both human and agent
            humanSigner = msg.sender;
            agentSigner = msg.sender;
            level = (msg.sender == agentWallet)
                ? VerificationLevel.MutualVerification
                : VerificationLevel.SelfClaim;
        }

        // Validate signers
        if (hasHuman) {
            require(
                humanSigner != address(0),
                "Invalid human signature"
            );
        }
        if (hasAgent) {
            require(
                agentSigner == agentWallet,
                "Agent signature must come from agent wallet"
            );
        }

        // Store the link
        linkId = _nextLinkId++;
        links[linkId] = Link({
            linkId: linkId,
            agentWallet: agentWallet,
            agentTokenId: agentTokenId,
            humanWallet: hasHuman ? humanSigner : msg.sender,
            ethosProfileId: ethosProfileId,
            role: role,
            level: level,
            status: Status.Active,
            createdAt: block.timestamp,
            expiration: expiration,
            humanSignature: humanSignature,
            agentSignature: agentSignature
        });

        bytes32 agentKey = _agentKey(agentWallet, agentTokenId);
        _agentLinks[agentKey].push(linkId);
        _humanLinks[hasHuman ? humanSigner : msg.sender].push(linkId);
        _profileLinks[ethosProfileId].push(linkId);

        emit AgentLinked(
            linkId,
            agentTokenId,
            ethosProfileId,
            agentWallet,
            hasHuman ? humanSigner : msg.sender,
            role,
            level,
            expiration
        );
    }

    // ── Upgrade a link to mutual verification ────────────────
    /**
     * @notice Add the missing signature to upgrade a Level 1/2 link to Level 3.
     * @param linkId           The link to upgrade
     * @param signature        The missing signature (human or agent)
     * @param deadline         Signature validity deadline
     */
    function upgradeLink(
        uint256 linkId,
        bytes calldata signature,
        uint256 deadline
    ) external {
        Link storage link = links[linkId];
        require(link.linkId != 0, "Link does not exist");
        require(link.status == Status.Active, "Link is revoked");
        require(isLinkActive(linkId), "Link has expired");
        require(block.timestamp <= deadline, "Signature expired");
        require(
            link.level != VerificationLevel.MutualVerification,
            "Already mutually verified"
        );

        bytes32 structHash = keccak256(
            abi.encode(
                LINK_TYPEHASH,
                link.agentTokenId,
                link.ethosProfileId,
                uint8(link.role),
                link.expiration,
                nonces[msg.sender]++,
                deadline
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);

        VerificationLevel oldLevel = link.level;

        if (link.level == VerificationLevel.SelfClaim) {
            // Need agent signature
            require(
                signer == link.agentWallet,
                "Signer must be agent wallet"
            );
            link.agentSignature = signature;
        } else {
            // Need human signature
            link.humanSignature = signature;
            link.humanWallet = signer;
        }

        link.level = VerificationLevel.MutualVerification;

        emit LinkUpgraded(linkId, oldLevel, VerificationLevel.MutualVerification);
    }

    // ── Revoke a link ────────────────────────────────────────
    /**
     * @notice Revoke an active link. Can be called by the human or agent wallet.
     */
    function revokeLink(uint256 linkId) external {
        Link storage link = links[linkId];
        require(link.linkId != 0, "Link does not exist");
        require(link.status == Status.Active, "Already revoked");
        require(
            msg.sender == link.humanWallet || msg.sender == link.agentWallet,
            "Only human or agent wallet can revoke"
        );

        link.status = Status.Revoked;
        emit AgentUnlinked(linkId, msg.sender);
    }

    // ── Query functions ──────────────────────────────────────

    function isLinkActive(uint256 linkId) public view returns (bool) {
        Link storage link = links[linkId];
        if (link.status != Status.Active) return false;
        if (link.expiration > 0 && block.timestamp > link.expiration) return false;
        return true;
    }

    function getLink(uint256 linkId) external view returns (Link memory) {
        return links[linkId];
    }

    function getAgentLinks(
        address agentWallet,
        uint256 agentTokenId
    ) external view returns (uint256[] memory) {
        return _agentLinks[_agentKey(agentWallet, agentTokenId)];
    }

    function getActiveAgentLinks(
        address agentWallet,
        uint256 agentTokenId
    ) external view returns (Link[] memory) {
        uint256[] storage ids = _agentLinks[_agentKey(agentWallet, agentTokenId)];
        uint256 count;
        for (uint256 i; i < ids.length; i++) {
            if (isLinkActive(ids[i])) count++;
        }
        Link[] memory result = new Link[](count);
        uint256 j;
        for (uint256 i; i < ids.length; i++) {
            if (isLinkActive(ids[i])) {
                result[j++] = links[ids[i]];
            }
        }
        return result;
    }

    function getHumanLinks(address humanWallet) external view returns (uint256[] memory) {
        return _humanLinks[humanWallet];
    }

    function getProfileLinks(uint256 ethosProfileId) external view returns (uint256[] memory) {
        return _profileLinks[ethosProfileId];
    }

    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ── Internal ─────────────────────────────────────────────

    function _agentKey(address wallet, uint256 tokenId) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(wallet, tokenId));
    }
}
