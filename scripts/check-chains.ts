import { createPublicClient, http, parseAbi } from "viem";
import { mainnet, base, arbitrum, avalanche, bsc } from "viem/chains";

const abi = parseAbi([
  "function totalSupply() view returns (uint256)",
]);
const registry = "0x8004A169FB4a3325136EB29fA0ceB6D2e539a432" as const;

type ChainCheck = { name: string; chain: any; rpc: string };
const chains: ChainCheck[] = [
  { name: "Ethereum", chain: mainnet, rpc: "https://eth.llamarpc.com" },
  { name: "Base", chain: base, rpc: "https://mainnet.base.org" },
  { name: "Arbitrum", chain: arbitrum, rpc: "https://arb1.arbitrum.io/rpc" },
  { name: "Avalanche", chain: avalanche, rpc: "https://api.avax.network/ext/bc/C/rpc" },
  { name: "BNB", chain: bsc, rpc: "https://bsc-dataseed.binance.org" },
];

async function main() {
  for (const { name, chain, rpc } of chains) {
    try {
      const c = createPublicClient({ chain, transport: http(rpc) });
      const ts = await c.readContract({
        address: registry,
        abi,
        functionName: "totalSupply",
      });
      console.log(`${name}: ${ts} agents`);
    } catch (e: any) {
      console.log(`${name}: ERROR - ${e.message?.slice(0, 100)}`);
    }
  }
}

main();
