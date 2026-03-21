// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {AgentHumanLinkRegistry} from "../src/AgentHumanLinkRegistry.sol";

/**
 * Deploy the AgentHumanLinkRegistry to Base Sepolia.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url https://sepolia.base.org \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify
 *
 * Or with a keystore:
 *   forge script script/Deploy.s.sol:DeployScript \
 *     --rpc-url https://sepolia.base.org \
 *     --account deployer \
 *     --broadcast
 */
contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();

        AgentHumanLinkRegistry registry = new AgentHumanLinkRegistry();

        console.log("===========================================");
        console.log("  AgentHumanLinkRegistry deployed!");
        console.log("  Address:", address(registry));
        console.log("  Chain:   Base Sepolia (84532)");
        console.log("===========================================");
        console.log("");
        console.log("Next steps:");
        console.log("  1. Update LINK_REGISTRY_ADDRESS in lib/contracts.ts");
        console.log("  2. Update linkRegistry in packages/sdk constants");
        console.log("  3. Verify on Basescan:");
        console.log("     forge verify-contract <ADDRESS> AgentHumanLinkRegistry --chain base-sepolia");

        vm.stopBroadcast();
    }
}
