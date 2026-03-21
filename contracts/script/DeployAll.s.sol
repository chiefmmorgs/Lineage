// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/LineageAgentRegistry.sol";
import "../src/AgentHumanLinkRegistry.sol";
import "../src/LineageReputationRegistry.sol";

/**
 * Deploy all three Lineage contracts to Base Sepolia.
 *
 * Usage:
 *   PRIVATE_KEY=0x... forge script script/DeployAll.s.sol:DeployAll \
 *     --rpc-url https://sepolia.base.org \
 *     --broadcast
 */
contract DeployAll is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        LineageAgentRegistry agentRegistry = new LineageAgentRegistry();
        AgentHumanLinkRegistry linkRegistry = new AgentHumanLinkRegistry();
        LineageReputationRegistry reputationRegistry = new LineageReputationRegistry();

        vm.stopBroadcast();

        console.log("==============================================");
        console.log("  Lineage Contracts Deployed to Base Sepolia");
        console.log("==============================================");
        console.log("");
        console.log("  LineageAgentRegistry:       ", address(agentRegistry));
        console.log("  AgentHumanLinkRegistry:     ", address(linkRegistry));
        console.log("  LineageReputationRegistry:  ", address(reputationRegistry));
        console.log("");
        console.log("  Registry ID:", agentRegistry.agentRegistryId());
        console.log("==============================================");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Update addresses in lib/contracts.ts");
        console.log("  2. Verify on Blockscout:");
        console.log("     forge verify-contract <ADDR> LineageAgentRegistry --chain base-sepolia --verifier blockscout --verifier-url https://base-sepolia.blockscout.com/api/");
    }
}
