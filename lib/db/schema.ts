/**
 * ============================================================
 *  Lineage — Database Schema (Drizzle ORM + SQLite)
 * ============================================================
 *
 *  Lineage-owned data only.
 *  External data (Ethos scores, ERC-8004 agents) is fetched
 *  on-demand from their APIs — never duplicated here.
 *
 *  Tables:
 *    links             — human↔agent relationships (our registry)
 *    score_snapshots   — computed Lineage Scores over time
 *    score_events      — audit trail of what triggered recomputations
 *    feedback          — platform-level feedback (not ERC-8004 on-chain)
 *    proofs            — identity proofs (ENS, Basename, Ethos)
 *    tasks             — agent task outcomes
 *    disputes          — disputes on links or agents
 *    external_sync     — indexer cursor positions
 * ============================================================
 */

import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

// ── Links (Lineage-owned relationships) ───────────────────────────

export const links = sqliteTable("links", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  linkId: integer("link_id").notNull().unique(), // on-chain ID
  agentTokenId: integer("agent_token_id").notNull(),
  chainId: integer("chain_id").notNull().default(84532),
  humanWallet: text("human_wallet").notNull(),
  agentWallet: text("agent_wallet").notNull(),
  ethosProfileId: integer("ethos_profile_id").notNull(),
  role: text("role").notNull(), // creator | operator | maintainer | delegate | renter
  level: text("level").notNull(), // self-claim | agent-confirmation | mutual-verification
  status: text("status").notNull().default("active"), // active | revoked
  expiresAt: integer("expires_at").notNull().default(0), // 0 = permanent
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

// ── Score Snapshots (our computed scores) ─────────────────────────

export const scoreSnapshots = sqliteTable("score_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  entityType: text("entity_type").notNull(), // "agent" | "human" | "link"
  entityId: text("entity_id").notNull(), // "tokenId:chainId", wallet, or linkId
  lineageScore: real("lineage_score").notNull(),
  confidence: real("confidence").notNull(),
  displayedScore: real("displayed_score").notNull(),
  grade: text("grade").notNull(),
  label: text("label").notNull(),
  humanTrust: real("human_trust").notNull().default(0),
  agentTrust: real("agent_trust").notNull().default(0),
  linkTrust: real("link_trust").notNull().default(0),
  previousScore: real("previous_score"),
  reason: text("reason").notNull().default("initial"),
  breakdown: text("breakdown").notNull().default("{}"), // full JSON
  createdAt: integer("created_at").notNull(),
});

// ── Score Events (audit trail) ────────────────────────────────────

export const scoreEvents = sqliteTable("score_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eventType: text("event_type").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull(),
  source: text("source").notNull(), // erc8004 | ethos | link_registry | platform
  data: text("data").notNull().default("{}"),
  processed: integer("processed", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

// ── Platform Feedback (Lineage-specific, not ERC-8004 on-chain) ──

export const feedback = sqliteTable("feedback", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentTokenId: integer("agent_token_id").notNull(),
  chainId: integer("chain_id").notNull(),
  reviewer: text("reviewer").notNull(),
  score: integer("score").notNull(), // 1–5
  comment: text("comment").notNull().default(""),
  category: text("category").default("general"), // general | reliability | accuracy | speed
  isValid: integer("is_valid", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
});

// ── Identity Proofs ───────────────────────────────────────────────

export const proofs = sqliteTable("proofs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentTokenId: integer("agent_token_id").notNull(),
  proofType: text("proof_type").notNull(), // ethos | ens | basename
  value: text("value").notNull(),
  wallet: text("wallet").notNull(),
  signature: text("signature"),
  verified: integer("verified", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

// ── Task Outcomes ─────────────────────────────────────────────────

export const tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  agentTokenId: integer("agent_token_id").notNull(),
  humanWallet: text("human_wallet"),
  taskType: text("task_type").notNull(),
  outcome: text("outcome").notNull(), // success | failure | partial
  details: text("details").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
});

// ── Disputes ──────────────────────────────────────────────────────

export const disputes = sqliteTable("disputes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  linkId: integer("link_id"),
  agentTokenId: integer("agent_token_id"),
  initiator: text("initiator").notNull(),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // open | resolved | dismissed
  resolution: text("resolution"),
  createdAt: integer("created_at").notNull(),
  resolvedAt: integer("resolved_at"),
});

// ── External Sync Cursors ─────────────────────────────────────────

export const externalSync = sqliteTable("external_sync", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  source: text("source").notNull(), // erc8004 | link_registry | ethos
  chainId: integer("chain_id"),
  lastBlock: integer("last_block").notNull().default(0),
  lastSyncedAt: integer("last_synced_at").notNull(),
  status: text("status").notNull().default("idle"),
  errorMessage: text("error_message"),
});
