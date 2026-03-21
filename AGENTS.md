# AGENTS.md — Lineage Trust Engine

## What Lineage Is

Lineage is a **decentralized, live trust engine** for AI agents on Ethereum. It continuously scores agents based on three computed layers:

- **Agent Trust** — derived from on-chain ERC-8004 feedback and platform-level reviews
- **Human Trust** — derived from Ethos credibility scores and ENS identity verification (up to 20 fixed points)
- **Link Trust** — derived from the relationship history between a human and an agent

Scores are event-driven, not request-time. When anything changes — new feedback, Ethos score shift, link creation — Lineage recalculates affected scores and stores a new snapshot.

## Capabilities

### API Endpoints (15 total)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/v1/scores/:id` | Latest Lineage Score (on-demand computation) |
| GET | `/api/v1/scores/:id/history` | Score snapshots over time |
| GET | `/api/v1/scores/:id/explanation` | Human-readable key factors |
| GET | `/api/v1/links/:id` | Link detail |
| POST | `/api/v1/feedback` | Submit platform feedback → recompute |
| GET | `/api/v1/agents/:t/:c/profile` | Full agent profile (score + links + proofs + tasks + disputes) |
| GET | `/api/v1/agents/:t/:c/links` | All links for an agent |
| POST | `/api/v1/tasks` | Report task completion |
| GET | `/api/v1/agents/:t/:c/tasks` | Task history + success rate |
| POST | `/api/v1/disputes` | Open a dispute |
| GET | `/api/v1/disputes/:id` | View dispute |
| GET | `/api/v1/agents/:t/:c/disputes` | Agent's disputes |
| GET | `/api/v1/trust-check/:t/:c` | Quick PASS/FAIL trust check |
| POST/GET | `/api/v1/webhooks` | Register/list webhooks |
| GET | `/api/v1/badges/:t/:c` | SVG score badge |

### SDK

```typescript
import { Lineage } from "@lineage/sdk";
const lineage = new Lineage({ apiUrl: "https://lineage.app" });

// Check trust before interacting with another agent
const check = await lineage.checkTrust(42, 84532);
if (check.trusted) {
  // Safe to delegate work
}

// Get full profile
const profile = await lineage.getAgentProfile(1, 84532);

// Report completed work
await lineage.reportTask({
  agentTokenId: 1,
  taskType: "data-analysis",
  outcome: "success"
});
```

## Architecture

- **Runtime**: Next.js API routes + standalone worker process
- **Database**: SQLite (Drizzle ORM) — stores only Lineage-owned data
- **External Data**: Ethos, 8004scan, Etherscan APIs fetched on-demand
- **Event Bus**: eventemitter3 — typed events drive recomputation
- **Indexers**: ERC-8004 watcher, Link Registry watcher, Ethos poller
- **Scoring**: Weighted formula (38% Agent + 37% Human + 25% Link) × Confidence + ENS bonus

## For Agent Judges

To evaluate Lineage, check:

1. **Score computation**: `GET /api/v1/scores/1:84532` — returns a computed score with full breakdown
2. **Explanation**: `GET /api/v1/scores/1:84532/explanation` — human-readable factors
3. **Trust check**: `GET /api/v1/trust-check/1/84532` — PASS/FAIL for agent-to-agent trust
4. **Agent profile**: `GET /api/v1/agents/1/84532/profile` — unified view of everything
5. **Badge**: `GET /api/v1/badges/1/84532` — embeddable SVG score badge

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 |
| Language | TypeScript |
| Chain | Base Sepolia (EVM) |
| Standard | ERC-8004 |
| Identity | ENS, Ethos Network |
| Database | SQLite + Drizzle ORM |
| SDK | `@lineage/sdk` (TypeScript) |
| APIs | Etherscan, CoinGecko, 8004scan, Ethos |
