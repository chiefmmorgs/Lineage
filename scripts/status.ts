import { initializeDatabase, getStats } from "../lib/db/index";

async function main() {
  try {
    initializeDatabase();
    const stats = getStats();
    console.log("\n📊 Lineage Service Status");
    console.log("========================");
    console.log(`Links:          ${stats.links}`);
    console.log(`Score Snapshots: ${stats.scoreSnapshots}`);
    console.log(`Score Events:    ${stats.scoreEvents}`);
    console.log(`Feedback:       ${stats.feedback}`);
    console.log("========================\n");
  } catch (error) {
    console.error("Error getting service stats:", error);
  }
}

main();
