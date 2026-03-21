// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/LineageAgentRegistry.sol";

contract DeployAgentRegistry is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        LineageAgentRegistry registry = new LineageAgentRegistry();

        vm.stopBroadcast();

        console.log("========================================");
        console.log("LineageAgentRegistry deployed to:", address(registry));
        console.log("Chain ID:", block.chainid);
        console.log("Registry ID:", registry.agentRegistryId());
        console.log("========================================");
        console.log("");
        console.log("Next steps:");
        console.log("1. Update AGENT_REGISTRY_ADDRESS in lib/contracts.ts");
        console.log("2. Anyone can now call register() to mint an agent");
    }
}
