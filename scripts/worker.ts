/**
 * ============================================================
 *  Lineage — Worker Process
 * ============================================================
 *
 *  Standalone process that runs alongside Next.js:
 *    1. Initialize database
 *    2. Start recomputation engine (event bus listener)
 *    3. Start ERC-8004 indexer
 *    4. Start Link Registry indexer
 *    5. Start Ethos poller
 *
 *  Run: npx tsx scripts/worker.ts
 * ============================================================
 */

import { initializeDatabase, getStats } from "../lib/db/index";
import { startRecomputeEngine, stopRecomputeEngine } from "../lib/engine/recompute";
import { startERC8004Indexer, stopERC8004Indexer } from "../lib/engine/indexers/erc8004";
import { startLinkIndexer, stopLinkIndexer } from "../lib/engine/indexers/links";
import { startEthosPoller, stopEthosPoller } from "../lib/engine/indexers/ethos";
import { eventBus } from "../lib/engine/events";

// ── Banner ────────────────────────────────────────────────────────

console.log(`
╔═══════════════════════════════════════════════╗
║         LINEAGE — Trust Engine Worker         ║
╠═══════════════════════════════════════════════╣
║  Real-time trust scoring for agents + humans  ║
║  ERC-8004 + Ethos + Link Trust                ║
╚═══════════════════════════════════════════════╝
`);

// ── Initialize ────────────────────────────────────────────────────

console.log("1. Initializing database...");
initializeDatabase();

const stats = getStats();
console.log(`   📊 Current: ${stats.links} links, ${stats.scoreSnapshots} snapshots, ${stats.scoreEvents} events\n`);

// ── Start engines ─────────────────────────────────────────────────

console.log("2. Starting recomputation engine...");
startRecomputeEngine();

console.log("\n3. Starting indexers...");
startERC8004Indexer();
startLinkIndexer();
startEthosPoller();

console.log("\n✅ Worker running. Press Ctrl+C to stop.\n");

// ── Event monitoring ──────────────────────────────────────────────

// Print event stats every 5 minutes
setInterval(() => {
  const eventStats = eventBus.getEventStats();
  const dbStats = getStats();
  const totalEvents = Object.values(eventStats).reduce((a, b) => a + b, 0);

  if (totalEvents > 0) {
    console.log(`\n📊 [STATUS] Events: ${totalEvents} total | DB: ${dbStats.links} links, ${dbStats.scoreSnapshots} snapshots`);
    for (const [type, count] of Object.entries(eventStats)) {
      console.log(`   ${type}: ${count}`);
    }
  }
}, 5 * 60 * 1000);

// ── Graceful shutdown ─────────────────────────────────────────────

function shutdown() {
  console.log("\n\n🛑 Shutting down...");
  stopERC8004Indexer();
  stopLinkIndexer();
  stopEthosPoller();
  stopRecomputeEngine();
  console.log("✅ Worker stopped cleanly.\n");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep process alive
setInterval(() => {}, 1 << 30);
