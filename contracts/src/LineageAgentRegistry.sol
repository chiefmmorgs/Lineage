// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/**
 * ══════════════════════════════════════════════════════════════════
 *  LineageAgentRegistry — ERC-8004 Compliant Agent Identity Registry
 * ══════════════════════════════════════════════════════════════════
 *
 *  Implements the ERC-8004 Identity Registry:
 *    - ERC-721 based agent identity minting
 *    - agentURI for off-chain registration file
 *    - On-chain metadata (key/value pairs)
 *    - agentWallet with EIP-712 signature verification
 *    - Permissionless: anyone can mint an agent identity
 *
 *  Deployed on Base Sepolia for the Lineage platform.
 */
contract LineageAgentRegistry is ERC721URIStorage, EIP712 {
    using ECDSA for bytes32;

    // ── State ──────────────────────────────────────────────────

    uint256 private _nextTokenId = 1;

    /// @dev agentId => metadataKey => metadataValue
    mapping(uint256 => mapping(string => bytes)) private _metadata;

    /// @dev agentId => agentWallet address
    mapping(uint256 => address) private _agentWallets;

    // ── EIP-712 Types ──────────────────────────────────────────

    bytes32 private constant SET_WALLET_TYPEHASH =
        keccak256("SetAgentWallet(uint256 agentId,address newWallet,uint256 deadline)");

    // ── Structs ────────────────────────────────────────────────

    struct MetadataEntry {
        string metadataKey;
        bytes metadataValue;
    }

    // ── Events ─────────────────────────────────────────────────

    event Registered(uint256 indexed agentId, string agentURI, address indexed owner);
    event URIUpdated(uint256 indexed agentId, string newURI, address indexed updatedBy);
    event MetadataSet(
        uint256 indexed agentId,
        string indexed indexedMetadataKey,
        string metadataKey,
        bytes metadataValue
    );

    // ── Constructor ────────────────────────────────────────────

    constructor()
        ERC721("Lineage Agent Identity", "AGENT")
        EIP712("LineageAgentRegistry", "1")
    {}

    // ── Registration (Permissionless Mint) ──────────────────────

    /**
     * @notice Register a new agent with a URI and optional metadata.
     * @param agentURI The URI pointing to the agent registration file.
     * @param metadata Optional array of key/value metadata entries.
     * @return agentId The newly minted token ID.
     */
    function register(
        string calldata agentURI,
        MetadataEntry[] calldata metadata
    ) external returns (uint256 agentId) {
        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);

        if (bytes(agentURI).length > 0) {
            _setTokenURI(agentId, agentURI);
        }

        // Set default agentWallet to owner
        _agentWallets[agentId] = msg.sender;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(msg.sender));

        // Set additional metadata
        for (uint256 i = 0; i < metadata.length; i++) {
            require(
                keccak256(bytes(metadata[i].metadataKey)) != keccak256(bytes("agentWallet")),
                "Cannot set agentWallet via metadata"
            );
            _metadata[agentId][metadata[i].metadataKey] = metadata[i].metadataValue;
            emit MetadataSet(agentId, metadata[i].metadataKey, metadata[i].metadataKey, metadata[i].metadataValue);
        }

        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register a new agent with just a URI (no metadata).
     */
    function register(string calldata agentURI) external returns (uint256 agentId) {
        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);

        if (bytes(agentURI).length > 0) {
            _setTokenURI(agentId, agentURI);
        }

        _agentWallets[agentId] = msg.sender;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(msg.sender));
        emit Registered(agentId, agentURI, msg.sender);
    }

    /**
     * @notice Register a new agent with no URI (set later).
     */
    function register() external returns (uint256 agentId) {
        agentId = _nextTokenId++;
        _safeMint(msg.sender, agentId);

        _agentWallets[agentId] = msg.sender;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(msg.sender));
        emit Registered(agentId, "", msg.sender);
    }

    // ── URI Management ──────────────────────────────────────────

    /**
     * @notice Update the agent's registration URI.
     */
    function setAgentURI(uint256 agentId, string calldata newURI) external {
        require(_isAuthorized(_ownerOf(agentId), msg.sender, agentId), "Not owner or approved");
        _setTokenURI(agentId, newURI);
        emit URIUpdated(agentId, newURI, msg.sender);
    }

    /**
     * @notice Get the agentURI (alias for tokenURI).
     */
    function agentURI(uint256 agentId) external view returns (string memory) {
        return tokenURI(agentId);
    }

    // ── Agent Wallet Management ──────────────────────────────────

    /**
     * @notice Set the agentWallet with EIP-712 signature from the new wallet.
     * @param agentId The agent token ID.
     * @param newWallet The new wallet address.
     * @param deadline Timestamp by which the signature must be used.
     * @param signature EIP-712 signature from the newWallet address.
     */
    function setAgentWallet(
        uint256 agentId,
        address newWallet,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(_isAuthorized(_ownerOf(agentId), msg.sender, agentId), "Not owner or approved");
        require(block.timestamp <= deadline, "Signature expired");
        require(newWallet != address(0), "Invalid wallet");

        bytes32 structHash = keccak256(abi.encode(
            SET_WALLET_TYPEHASH,
            agentId,
            newWallet,
            deadline
        ));

        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        require(signer == newWallet, "Invalid signature");

        _agentWallets[agentId] = newWallet;
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(newWallet));
    }

    /**
     * @notice Get the agent wallet address.
     */
    function getAgentWallet(uint256 agentId) external view returns (address) {
        address wallet = _agentWallets[agentId];
        if (wallet == address(0)) {
            return _ownerOf(agentId);
        }
        return wallet;
    }

    /**
     * @notice Clear the agent wallet (resets to owner).
     */
    function unsetAgentWallet(uint256 agentId) external {
        require(_isAuthorized(_ownerOf(agentId), msg.sender, agentId), "Not owner or approved");
        delete _agentWallets[agentId];
        emit MetadataSet(agentId, "agentWallet", "agentWallet", abi.encode(address(0)));
    }

    // ── On-Chain Metadata ───────────────────────────────────────

    /**
     * @notice Get metadata for an agent.
     */
    function getMetadata(uint256 agentId, string memory metadataKey)
        external view returns (bytes memory)
    {
        if (keccak256(bytes(metadataKey)) == keccak256(bytes("agentWallet"))) {
            address wallet = _agentWallets[agentId];
            if (wallet == address(0)) wallet = _ownerOf(agentId);
            return abi.encode(wallet);
        }
        return _metadata[agentId][metadataKey];
    }

    /**
     * @notice Set metadata for an agent.
     */
    function setMetadata(
        uint256 agentId,
        string memory metadataKey,
        bytes memory metadataValue
    ) external {
        require(_isAuthorized(_ownerOf(agentId), msg.sender, agentId), "Not owner or approved");
        require(
            keccak256(bytes(metadataKey)) != keccak256(bytes("agentWallet")),
            "Use setAgentWallet()"
        );
        _metadata[agentId][metadataKey] = metadataValue;
        emit MetadataSet(agentId, metadataKey, metadataKey, metadataValue);
    }

    // ── Helpers ──────────────────────────────────────────────────

    /**
     * @notice Get the agentRegistry identifier string.
     */
    function agentRegistryId() external view returns (string memory) {
        return string(abi.encodePacked(
            "eip155:",
            _toString(block.chainid),
            ":",
            _toHexString(address(this))
        ));
    }

    /**
     * @notice Get next token ID (total supply + 1).
     */
    function nextTokenId() external view returns (uint256) {
        return _nextTokenId;
    }

    /**
     * @notice Total number of agents registered.
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId - 1;
    }

    /**
     * @notice Get the EIP-712 domain separator.
     */
    function getDomainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    // ── Transfer hook: clear agentWallet on transfer ─────────────

    function _update(address to, uint256 tokenId, address auth)
        internal override returns (address)
    {
        address from = super._update(to, tokenId, auth);
        // Clear agentWallet on transfer
        if (from != address(0) && to != address(0)) {
            delete _agentWallets[tokenId];
        }
        return from;
    }

    // ── Internal string helpers ──────────────────────────────────

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _toHexString(address addr) internal pure returns (string memory) {
        bytes memory s = new bytes(42);
        s[0] = "0";
        s[1] = "x";
        bytes memory hexChars = "0123456789abcdef";
        for (uint256 i = 0; i < 20; i++) {
            uint8 b = uint8(uint160(addr) >> (8 * (19 - i)));
            s[2 + i * 2] = hexChars[b >> 4];
            s[3 + i * 2] = hexChars[b & 0x0f];
        }
        return string(s);
    }
}
