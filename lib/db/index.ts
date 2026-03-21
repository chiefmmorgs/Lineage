/**
 * ============================================================
 *  Lineage — Database Connection (SQLite + Drizzle ORM)
 * ============================================================
 *
 *  Stores only Lineage-owned data:
 *    links, scores, events, feedback, proofs, tasks, disputes
 *
 *  External data (Ethos, ERC-8004) is fetched on-demand
 *  from their APIs — never duplicated here.
 * ============================================================
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// ── Database path ─────────────────────────────────────────────────

const DB_DIR = path.join(process.cwd(), "data");
const DB_PATH = process.env.LINEAGE_DB_PATH || path.join(DB_DIR, "lineage.db");

// Ensure data directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// ── Create connection ─────────────────────────────────────────────

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });

// ── Auto-migrate ──────────────────────────────────────────────────

export function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER NOT NULL UNIQUE,
      agent_token_id INTEGER NOT NULL,
      chain_id INTEGER NOT NULL DEFAULT 84532,
      human_wallet TEXT NOT NULL,
      agent_wallet TEXT NOT NULL,
      ethos_profile_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      level TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      expires_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS score_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      lineage_score REAL NOT NULL,
      confidence REAL NOT NULL,
      displayed_score REAL NOT NULL,
      grade TEXT NOT NULL,
      label TEXT NOT NULL,
      human_trust REAL NOT NULL DEFAULT 0,
      agent_trust REAL NOT NULL DEFAULT 0,
      link_trust REAL NOT NULL DEFAULT 0,
      previous_score REAL,
      reason TEXT NOT NULL DEFAULT 'initial',
      breakdown TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS score_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      source TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '{}',
      processed INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_token_id INTEGER NOT NULL,
      chain_id INTEGER NOT NULL,
      reviewer TEXT NOT NULL,
      score INTEGER NOT NULL,
      comment TEXT NOT NULL DEFAULT '',
      category TEXT DEFAULT 'general',
      is_valid INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proofs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_token_id INTEGER NOT NULL,
      proof_type TEXT NOT NULL,
      value TEXT NOT NULL,
      wallet TEXT NOT NULL,
      signature TEXT,
      verified INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_token_id INTEGER NOT NULL,
      human_wallet TEXT,
      task_type TEXT NOT NULL,
      outcome TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      link_id INTEGER,
      agent_token_id INTEGER,
      initiator TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      resolution TEXT,
      created_at INTEGER NOT NULL,
      resolved_at INTEGER
    );

    CREATE TABLE IF NOT EXISTS external_sync (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      chain_id INTEGER,
      last_block INTEGER NOT NULL DEFAULT 0,
      last_synced_at INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'idle',
      error_message TEXT
    );

    -- Performance indexes
    CREATE INDEX IF NOT EXISTS idx_links_agent ON links(agent_token_id);
    CREATE INDEX IF NOT EXISTS idx_links_human ON links(human_wallet);
    CREATE INDEX IF NOT EXISTS idx_score_snapshots_entity ON score_snapshots(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_score_events_entity ON score_events(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_agent ON feedback(agent_token_id);
    CREATE INDEX IF NOT EXISTS idx_proofs_agent ON proofs(agent_token_id);
  `);

  console.log("✅ Lineage database initialized at", DB_PATH);
}

// ── Helpers ───────────────────────────────────────────────────────

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function getStats() {
  const linkCount = db.get(sql`SELECT COUNT(*) as count FROM links`) as { count: number };
  const snapshotCount = db.get(sql`SELECT COUNT(*) as count FROM score_snapshots`) as { count: number };
  const eventCount = db.get(sql`SELECT COUNT(*) as count FROM score_events`) as { count: number };
  const feedbackCount = db.get(sql`SELECT COUNT(*) as count FROM feedback`) as { count: number };

  return {
    links: linkCount?.count ?? 0,
    scoreSnapshots: snapshotCount?.count ?? 0,
    scoreEvents: eventCount?.count ?? 0,
    feedback: feedbackCount?.count ?? 0,
  };
}
