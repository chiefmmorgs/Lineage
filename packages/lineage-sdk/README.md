# @lineage/sdk

TypeScript SDK for the **Lineage Trust Engine** — unified trust scoring for agents and humans.

Lineage computes scores from three layers:
- **Agent Trust** — ERC-8004 on-chain feedback + platform feedback
- **Human Trust** — Ethos credibility + ENS identity (up to 20 fixed points)
- **Link Trust** — Mutual verification, relationship age, compliance

## Install

```bash
npm install @lineage/sdk
```

## Quick Start

```typescript
import { Lineage } from "@lineage/sdk";

const lineage = new Lineage({
  apiUrl: "https://your-lineage-instance.com",
});

// Get an agent's score
const score = await lineage.getAgentScore(1, 84532);
console.log(score.displayedScore); // 72
console.log(score.grade);          // "B+"
console.log(score.confidence);     // 0.85

// Get score breakdown
console.log(score.humanTrust);  // 78
console.log(score.agentTrust);  // 65
console.log(score.linkTrust);   // 71

// Check ENS scoring
if (score.breakdown.ensScore) {
  console.log(score.breakdown.ensScore.total);    // 15
  console.log(score.breakdown.ensScore.ensName);  // "chief.eth"
}
```

## API Reference

### `new Lineage(config)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiUrl` | `string` | `http://localhost:3000` | Base URL of your Lineage instance |
| `timeout` | `number` | `10000` | Request timeout in ms |
| `apiKey` | `string` | — | Optional API key |

### Methods

#### `getScore(entityId)` → `LineageScore`

Get the latest score. Triggers on-demand computation if no score exists.

```typescript
const score = await lineage.getScore("1:84532");
// score.displayedScore, score.grade, score.label
// score.humanTrust, score.agentTrust, score.linkTrust
```

#### `getAgentScore(tokenId, chainId)` → `LineageScore`

Convenience wrapper for agents.

```typescript
const score = await lineage.getAgentScore(1, 84532);
```

#### `getHistory(entityId, limit?)` → `ScoreHistoryResponse`

Get score snapshots over time.

```typescript
const history = await lineage.getHistory("1:84532", 20);
history.history.forEach(snapshot => {
  console.log(snapshot.timestamp, snapshot.displayedScore, snapshot.reason);
});
```

#### `getExplanation(entityId)` → `ScoreExplanation`

Human-readable key factors explaining the current score.

```typescript
const why = await lineage.getExplanation("1:84532");
why.keyFactors.forEach(factor => console.log(factor));
// "Strong agent performance (72/100 Agent Trust)"
// "12 on-chain feedbacks (avg 4.2/5)"
// "🆔 ENS: chief.eth on Ethereum (+15/20 points)"
// "High confidence (85%)"
```

#### `getLink(linkId)` → `LinkDetail`

Get link details.

```typescript
const link = await lineage.getLink(1);
console.log(link.role);    // "creator"
console.log(link.level);   // "mutual-verification"
console.log(link.status);  // "active"
```

#### `submitFeedback(feedback)` → `FeedbackResponse`

Submit platform-level feedback (triggers score recomputation).

```typescript
await lineage.submitFeedback({
  agentTokenId: 1,
  chainId: 84532,
  reviewer: "0x1234...",
  score: 4,
  comment: "Fast and reliable",
  category: "reliability",
});
```

#### `isHealthy()` → `boolean`

Check if the API is reachable.

## Error Handling

```typescript
import { Lineage, LineageAPIError } from "@lineage/sdk";

try {
  const score = await lineage.getScore("999:84532");
} catch (err) {
  if (err instanceof LineageAPIError) {
    console.log(err.status);   // 404
    console.log(err.message);  // "No score found"
    console.log(err.details);  // { error: "No score found", entityId: "999:84532" }
  }
}
```

## Score Formula

```
Lineage Score = (0.38 × Agent Trust + 0.37 × Human Trust + 0.25 × Link Trust) × Confidence
```

ENS contributes up to 20 fixed points to Human Trust:

| Component | Max | Condition |
|-----------|:---:|-----------|
| ENS Verification | +5 | Verified ENS name |
| Wallet Balance | +5 | ≥$1000 on ENS chain |
| Transaction Activity | +5 | ≥1000 txns |
| Full Activity Bonus | +5 | Both highest tiers |

## License

MIT
