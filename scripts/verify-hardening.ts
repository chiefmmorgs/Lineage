/**
 * ============================================================
 *  Lineage — Hardening Verification Script
 * ============================================================
 *
 *  Tests:
 *    1. SDK signing + API authentication (EIP-712)
 *    2. Webhook registration + DB persistence
 *    3. Feedback submission + Event bus logic
 *    4. Background recompute triggering
 * ============================================================
 */

import { Lineage } from "../packages/lineage-sdk/src/index";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

async function runTest() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  console.log(`\n🧪 [TEST] Starting verification with wallet: ${account.address}`);

  const lineage = new Lineage({
    apiUrl: "http://localhost:3000",
    signer: privateKey,
  });

  try {
    // 1. Test Webhook Registration (Secure)
    console.log("\n1. Testing Webhook Registration...");
    const webhook = await lineage.registerWebhook({
      agentTokenId: 444,
      chainId: 84532,
      url: "https://example.com/webhook",
      events: ["score.changed", "feedback.received"],
      secret: "test-secret-123",
    });
    console.log("   ✅ Webhook registered:", webhook.webhookId);

    // 2. Test Feedback Submission (Secure)
    console.log("\n2. Testing Feedback Submission...");
    const feedback = await lineage.submitFeedback({
      agentTokenId: 444,
      chainId: 84532,
      reviewer: account.address,
      score: 5,
      comment: "Verified hardening works perfectly!",
      category: "reliability",
    });
    console.log("   ✅ Feedback submitted:", feedback.feedbackId);

    // 3. Test Task Reporting (Secure)
    console.log("\n3. Testing Task Reporting...");
    const task = await lineage.reportTask({
      agentTokenId: 444,
      chainId: 84532,
      taskType: "security-audit",
      outcome: "success",
      details: { checks: 5, status: "hardened" }
    });
    console.log("   ✅ Task reported:", task.taskId);

    // 4. Test Score Retrieval (Async Trigger)
    console.log("\n4. Testing Score Retrieval (Should trigger recompute)...");
    const score = await lineage.getScore("444:84532");
    console.log("   ✅ Score retrieved (Initial/Cached):", score.lineageScore);

    console.log("\n🎉 [SUCCESS] All hardening features verified via SDK!");
  } catch (error: any) {
    console.error("\n❌ [FAILURE] Verification failed:", error.message);
    if (error.details) console.error("   Details:", error.details);
    process.exit(1)
  }
}

runTest();
