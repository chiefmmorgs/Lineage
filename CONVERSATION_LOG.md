# Lineage — Conversation Log (Human-Agent Collaboration)

**Project**: Lineage — Decentralized Trust Engine for AI Agents  
**Human**: chiefmmorgs  
**Agent Harness**: openclaw  
**Model**: claude-sonnet-4-6  
**Dates**: March 11–21, 2026  

---

## Session 1 — Architecture & Vision (March 11–13)

**Human**: Defined Lineage's purpose — not a static registry, a live trust engine. Ethos-based Human Trust, ERC-8004-based Agent Trust, relationship-based Link Trust. Outlined how update engine works: event-driven recalculation, not request-time. External data stays external.

**Agent**: Researched ERC-8004, Ethos API, and 8004scan.io. Audited existing codebase (chains.ts, contracts.ts, scoring.ts, etc.). Built implementation plan with phased delivery.

### Decisions Made:
- External-first architecture — Ethos/ERC-8004 data fetched on-demand, never stored locally
- SQLite + Drizzle ORM for Lineage-owned data only
- eventemitter3 (already in deps) for typed event bus
- Next.js API routes + standalone worker process (no separate server)

---

## Session 2 — Phase A: Database + Event Bus (March 13–17)

**Human**: Reviewed and approved implementation plan.

**Agent**: Built foundation:
- `lib/db/schema.ts` — 8 tables: links, score_snapshots, score_events, feedback, proofs, tasks, disputes, external_sync
- `lib/db/index.ts` — SQLite + WAL mode + auto-migration
- `lib/engine/events.ts` — Typed event bus with 10 event types
- `scripts/seed.ts` — Lightweight DB initializer (no external data seeding)

---

## Session 3 — Phase B: Indexers + Recomputation (March 17–19)

**Agent**: Built event-driven engine:
- `lib/engine/indexers/erc8004.ts` — Emit-only indexer, watches AgentRegistered + FeedbackSubmitted
- `lib/engine/indexers/links.ts` — Watches AgentLinked/LinkRevoked, stores in DB
- `lib/engine/indexers/ethos.ts` — Polls Ethos API every 60s, in-memory cache for delta detection
- `lib/engine/recompute.ts` — Core engine: fetches Ethos + 8004scan live, computes Agent Trust + Human Trust + Link Trust, stores snapshots
- `scripts/worker.ts` — Standalone process running all indexers + event bus

### Key Design Decision:
- Weighted formula: `(0.38 × Agent Trust + 0.37 × Human Trust + 0.25 × Link Trust) × Confidence`

---

## Session 4 — Phase C: API Endpoints (March 19–20)

**Agent**: Built 5 REST API endpoints:
- `GET /api/v1/scores/[id]` — Score with on-demand computation
- `GET /api/v1/scores/[id]/history` — Time-series snapshots (pagination)
- `GET /api/v1/scores/[id]/explanation` — Human-readable key factors
- `GET /api/v1/links/[id]` — Link detail
- `POST /api/v1/feedback` — Platform feedback → score recomputation

---

## Session 5 — ENS Fixed-Point Scoring (March 20–21)

**Human**: Defined ENS scoring spec — up to 20 fixed points added to Human Trust before the weighted formula:
- Verified ENS name: +5 pts
- Wallet balance ≥$1000: +5 pts, ≥$500: +3, ≥$200: +2
- Transaction activity ≥1000 txns: +5, ≥500: +2
- Full activity bonus (both highest tiers): +5

**Human**: Provided Etherscan API key for wallet balance + tx count across all EVM chains.

**Agent**: Built `lib/engine/ens-scoring.ts`:
- Etherscan API integration across 13 EVM chains
- CoinGecko for native token → USD price conversion
- Integrated into recompute.ts Human Trust computation
- Updated explanation endpoint with ENS breakdown

---

## Session 6 — Phase D: SDK (March 21)

**Agent**: Built `packages/lineage-sdk/`:
- `src/types.ts` — 12 typed interfaces
- `src/index.ts` — Client class with 7 methods wrapping all 5 endpoints
- `package.json` + `tsconfig.json`
- `README.md` — Full API reference with code examples
- Build: SDK compiled to dist/ with declarations + source maps

---

## Session 7 — Agent Platform Gap Analysis (March 21)

**Human**: "Think like an agent, then a developer — what do agents need on this platform?"

**Agent**: Audited full codebase from agent developer perspective. Identified 8 missing capabilities across 3 priority tiers:
- P1: Agent profile, links-by-agent, task reporting, disputes (DB tables existed, no API)
- P2: Trust check, webhooks
- P3: Score badges

**Human**: Approved gap analysis.

**Agent**: Built 10 new endpoints in one session:
1. `GET /agents/:t/:c/profile` — Unified agent profile
2. `GET /agents/:t/:c/links` — Agent's links
3. `POST /tasks` — Report task completion
4. `GET /agents/:t/:c/tasks` — Task history + success rate
5. `POST /disputes` — Open a dispute
6. `GET /disputes/:id` — View dispute
7. `GET /agents/:t/:c/disputes` — Agent's disputes
8. `GET /trust-check/:t/:c` — Quick PASS/FAIL trust check
9. `POST/GET /webhooks` — Register/list webhooks
10. `GET /badges/:t/:c` — SVG score badge

Updated SDK: 7 → 17 methods, 12 → 28 types.

**Final build: 31 routes, 0 errors.**

---

## Session 8 — Hackathon Submission Prep (March 21)

**Human**: Wants to submit Lineage to The Synthesis hackathon.

**Agent**:
- Confirmed Lineage maps directly to "Agents that trust" track
- Pushed code to GitHub: https://github.com/chiefmmorgs/Lineage
- Created `AGENTS.md` for agentic judges
- Identified 5 relevant tracks (Open Track, ERC-8004, Base, ENS Identity, ENS Open Integration)
- Prepared full Devfolio submission payload

---

## Tools & Resources Used

**Tools**: Next.js, viem, Drizzle ORM, SQLite, better-sqlite3, eventemitter3, p-queue  
**APIs**: Etherscan, CoinGecko, 8004scan.io, Ethos Network  
**Standards**: ERC-8004, EIP-712  
**Chains**: Base Sepolia, Ethereum, + 11 more EVM chains  
**Skills**: web-search, find-skills  

## Summary

Built a complete decentralized trust engine from scratch over 8 sessions. The system continuously scores AI agents using three trust layers (Agent, Human, Link), integrates with 4 external APIs, supports 13 EVM chains for ENS scoring, exposes 15 REST API endpoints, and ships with a TypeScript SDK. All 31 routes compile with 0 errors.
