// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {AgentHumanLinkRegistry} from "../src/AgentHumanLinkRegistry.sol";

contract AgentHumanLinkRegistryTest is Test {
    AgentHumanLinkRegistry public registry;

    address public human = vm.addr(1);
    address public agentOwner = vm.addr(2);
    address public renter = vm.addr(3);

    uint256 public humanPk = 1;
    uint256 public agentPk = 2;
    uint256 public renterPk = 3;

    function setUp() public {
        registry = new AgentHumanLinkRegistry();
    }

    // ── Direct call (same wallet = mutual verification) ─────

    function test_DirectCallSameWallet() public {
        vm.prank(human);
        uint256 linkId = registry.createVerifiedLink(
            human,        // agentWallet = humanWallet (same)
            1,            // agentTokenId
            88,           // ethosProfileId
            AgentHumanLinkRegistry.Role.Creator,
            0,            // no expiration
            block.timestamp + 3600,
            "",           // no human sig (direct call)
            ""            // no agent sig (direct call)
        );

        assertTrue(registry.isLinkActive(linkId));

        AgentHumanLinkRegistry.Link memory link = registry.getLink(linkId);
        assertEq(link.humanWallet, human);
        assertEq(link.agentWallet, human);
        assertEq(link.ethosProfileId, 88);
        assertEq(uint8(link.role), uint8(AgentHumanLinkRegistry.Role.Creator));
        // Same wallet = MutualVerification
        assertEq(uint8(link.level), uint8(AgentHumanLinkRegistry.VerificationLevel.MutualVerification));
    }

    // ── Direct call (different wallet = self claim) ─────────

    function test_DirectCallDifferentWallet() public {
        vm.prank(human);
        uint256 linkId = registry.createVerifiedLink(
            agentOwner,   // agentWallet != msg.sender
            1,
            88,
            AgentHumanLinkRegistry.Role.Creator,
            0,
            block.timestamp + 3600,
            "",
            ""
        );

        AgentHumanLinkRegistry.Link memory link = registry.getLink(linkId);
        assertEq(uint8(link.level), uint8(AgentHumanLinkRegistry.VerificationLevel.SelfClaim));
    }

    // ── Revocation ──────────────────────────────────────────

    function test_RevokeByHuman() public {
        vm.prank(human);
        uint256 linkId = registry.createVerifiedLink(
            human, 1, 88,
            AgentHumanLinkRegistry.Role.Creator,
            0, block.timestamp + 3600, "", ""
        );

        assertTrue(registry.isLinkActive(linkId));

        vm.prank(human);
        registry.revokeLink(linkId);

        assertFalse(registry.isLinkActive(linkId));
    }

    function test_RevokeByNonPartyReverts() public {
        vm.prank(human);
        uint256 linkId = registry.createVerifiedLink(
            human, 1, 88,
            AgentHumanLinkRegistry.Role.Creator,
            0, block.timestamp + 3600, "", ""
        );

        vm.prank(renter); // random address
        vm.expectRevert("Only human or agent wallet can revoke");
        registry.revokeLink(linkId);
    }

    // ── Expiration (renting) ────────────────────────────────

    function test_ExpirationAutoInactive() public {
        vm.prank(renter);
        uint256 linkId = registry.createVerifiedLink(
            agentOwner, 1, 42,
            AgentHumanLinkRegistry.Role.Renter,
            block.timestamp + 86400, // 1 day
            block.timestamp + 3600,
            "", ""
        );

        assertTrue(registry.isLinkActive(linkId));

        // Fast forward 2 days
        vm.warp(block.timestamp + 172800);

        assertFalse(registry.isLinkActive(linkId));
    }

    // ── Query functions ─────────────────────────────────────

    function test_GetActiveAgentLinks() public {
        vm.startPrank(human);
        registry.createVerifiedLink(
            human, 1, 88,
            AgentHumanLinkRegistry.Role.Creator,
            0, block.timestamp + 3600, "", ""
        );
        registry.createVerifiedLink(
            human, 1, 99,
            AgentHumanLinkRegistry.Role.Operator,
            0, block.timestamp + 3600, "", ""
        );
        vm.stopPrank();

        AgentHumanLinkRegistry.Link[] memory links = registry.getActiveAgentLinks(human, 1);
        assertEq(links.length, 2);
    }

    function test_GetHumanLinks() public {
        vm.prank(human);
        registry.createVerifiedLink(
            human, 1, 88,
            AgentHumanLinkRegistry.Role.Creator,
            0, block.timestamp + 3600, "", ""
        );

        uint256[] memory ids = registry.getHumanLinks(human);
        assertEq(ids.length, 1);
    }

    function test_GetProfileLinks() public {
        vm.prank(human);
        registry.createVerifiedLink(
            human, 1, 88,
            AgentHumanLinkRegistry.Role.Creator,
            0, block.timestamp + 3600, "", ""
        );

        uint256[] memory ids = registry.getProfileLinks(88);
        assertEq(ids.length, 1);
    }

    // ── Expired link not in active results ──────────────────

    function test_ExpiredLinkFilteredFromActive() public {
        vm.prank(renter);
        registry.createVerifiedLink(
            agentOwner, 1, 42,
            AgentHumanLinkRegistry.Role.Renter,
            block.timestamp + 100, // expires soon
            block.timestamp + 3600,
            "", ""
        );

        AgentHumanLinkRegistry.Link[] memory before = registry.getActiveAgentLinks(agentOwner, 1);
        assertEq(before.length, 1);

        vm.warp(block.timestamp + 200);

        AgentHumanLinkRegistry.Link[] memory after_ = registry.getActiveAgentLinks(agentOwner, 1);
        assertEq(after_.length, 0);
    }
}
