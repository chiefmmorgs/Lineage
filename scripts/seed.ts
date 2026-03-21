/**
 * ============================================================
 *  Lineage — Database Init Script
 * ============================================================
 *
 *  Initializes the database with Lineage-owned tables.
 *  No external data is seeded — Ethos and ERC-8004 data
 *  is fetched on-demand from their APIs.
 *
 *  Run: npx tsx scripts/seed.ts
 * ============================================================
 */

import { initializeDatabase, getStats } from "../lib/db/index";

console.log("🌱 Lineage Database Init");
console.log("========================\n");

initializeDatabase();

const stats = getStats();
console.log(`\n📊 Tables ready:`);
console.log(`   Links:          ${stats.links}`);
console.log(`   Score snapshots: ${stats.scoreSnapshots}`);
console.log(`   Score events:    ${stats.scoreEvents}`);
console.log(`   Feedback:        ${stats.feedback}`);
console.log(`\n✅ Database ready at data/lineage.db`);
console.log(`   External data (Ethos, ERC-8004) fetched on-demand from their APIs.`);
