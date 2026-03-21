# @agenttrust/sdk

Headless SDK for the **Mutual Verification Protocol** — linking ERC-8004 agent identities to Ethos human reputation profiles.

No dashboard required. Agents, platforms, and builders can mint, verify, and publish their relationships programmatically.

## Install

```bash
npm install @agenttrust/sdk viem
```

## Quick Start

```ts
import { AgentTrust, Role } from "@agenttrust/sdk";
import { createWalletClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

const sdk = new AgentTrust({
  chainId: 84532,
  rpcUrl: "https://sepolia.base.org",
  agentRegistry: "0x20969E25aFF0c3E95e4c656401a1abbF93b9C6D2",
  linkRegistry: "0xYourDeployedLinkRegistry",
});
```

## Modules

### `sdk.identity` — ERC-8004 Agent Registration

```ts
// Mint a new agent
const result = await sdk.identity.mintAgent({
  signer: agentWalletClient,
  agentURI: "ipfs://QmAgentRegistration...",
  ethosProfile: "profileId:88",
});
console.log(`Agent #${result.agentId} minted at ${result.txHash}`);

// Update registration URI
await sdk.identity.updateAgentURI({
  signer: ownerWalletClient,
  agentId: 1,
  newURI: "ipfs://QmUpdated...",
});

// Read agent identity
const agent = await sdk.identity.getAgent(1);
```

### `sdk.link` — Mutual Verification Protocol

#### Embedded Mode (same runtime, both wallets available)

```ts
// 1. Human signs creator claim
const humanProof = await sdk.link.signHumanClaim({
  signer: creatorWallet,
  agentId: 1,
  ethosProfileId: 88,
  role: Role.Creator,
});

// 2. Agent wallet confirms
const agentProof = await sdk.link.signAgentConfirmation({
  signer: agentWallet,
  agentId: 1,
  ethosProfileId: 88,
  role: Role.Creator,
});

// 3. Submit verified link (Level 3 Mutual Verification)
const result = await sdk.link.submitVerifiedLink({
  submitter: agentWallet,
  agentWallet: "0xAgent...",
  humanProof,
  agentProof,
});
```

#### Intent Mode (separate runtimes, async handshake)

```ts
// Creator's app
const intent = await sdk.link.createIntent({
  humanSigner: creatorWallet,
  agentWallet: "0xAgent...",
  agentId: 1,
  ethosProfileId: 88,
  role: Role.Creator,
});
// Serialize and send intent to agent service...

// Agent's runtime
const accepted = await sdk.link.acceptIntent(intent, {
  signer: agentWallet,
});

// Either side finalizes
const result = await sdk.link.finalizeIntent(accepted, {
  submitter: agentWallet,
});
```

#### Renting (time-bounded links)

```ts
const humanProof = await sdk.link.signHumanClaim({
  signer: renterWallet,
  agentId: 1,
  ethosProfileId: 42,
  role: Role.Renter,
  expiration: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
});
```

#### Revocation

```ts
await sdk.link.revokeLink({
  signer: humanOrAgentWallet,
  linkId: 1,
});
```

### `sdk.read` — Query Links (read-only)

```ts
// All active links for an agent
const links = await sdk.read.getAgentLinks("0xAgent...", 1);

// All link IDs for a human wallet
const ids = await sdk.read.getHumanLinkIds("0xHuman...");

// All link IDs for an Ethos profile
const profileIds = await sdk.read.getProfileLinkIds(88);

// Single link
const link = await sdk.read.getLink(1);

// Check if active
const active = await sdk.read.isLinkActive(1);
```

### `sdk.signatures` — Low-level EIP-712

```ts
// Build payload manually
const payload = await sdk.signatures.buildPayload({
  signerAddress: "0x...",
  agentTokenId: 1,
  ethosProfileId: 88,
  role: Role.Creator,
});

// Sign with any wallet
const proof = await sdk.signatures.sign(walletClient, payload);
```

## Architecture

```
@agenttrust/sdk
├── AgentTrust          Main SDK class
├── IdentityModule      ERC-8004 mint, update, read
├── LinkModule          Sign, submit, revoke, upgrade, intents
├── SignaturesModule    EIP-712 typed data signing
├── ReadModule          Read-only queries
├── types.ts            Shared types and enums
└── constants.ts        ABIs and EIP-712 definitions
```

## Roles

| Role | Enum | Weight | Duration |
|------|------|--------|----------|
| Creator | `Role.Creator` | 100% | Permanent |
| Operator | `Role.Operator` | 80% | Permanent |
| Maintainer | `Role.Maintainer` | 50% | Permanent |
| Delegate | `Role.Delegate` | 30% | Permanent |
| Renter | `Role.Renter` | 20% | Time-bounded |

## Verification Levels

| Level | Name | Evidence |
|-------|------|----------|
| 0 | Self Claim | Human signature only |
| 1 | Agent Confirmation | Agent signature only |
| 2 | Mutual Verification | Both signatures ✓ |

## Agent Registration JSON

The SDK encourages embedding trust metadata in the ERC-8004 registration file:

```json
{
  "type": "https://eips.ethereum.org/EIPS/eip-8004#registration-v1",
  "name": "Siggy Agent",
  "description": "Community agent",
  "services": [],
  "extensions": {
    "ethosProfileId": "88",
    "linkRegistry": "0xLinkRegistry",
    "linkStatus": "verified"
  }
}
```

## License

MIT
