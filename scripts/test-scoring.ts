/**
 * ============================================================
 *  Lineage Scoring Engine — Full Test Suite
 * ============================================================
 *
 *  Simulates real human and agent scenarios to validate
 *  every formula, safeguard, and edge case.
 *
 *  Run: npx tsx scripts/test-scoring.ts
 * ============================================================
 */

import {
  computeLineageScore,
  buildScoringInput,
  normalizeEthos,
  feedbackValidity,
  filterValidFeedback,
  type ScoringInput,
  type FeedbackEntry,
  type LinkEntry,
  type LineageScoreBreakdown,
} from "../lib/scoring";

// ── Helpers ──────────────────────────────────────────────────────

let totalTests = 0;
let passed = 0;
let failed = 0;
const issues: string[] = [];

function assert(condition: boolean, name: string, detail?: string) {
  totalTests++;
  if (condition) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    const msg = `  ❌ ${name}${detail ? ` — ${detail}` : ""}`;
    console.log(msg);
    issues.push(msg);
  }
}

function assertRange(value: number, min: number, max: number, name: string) {
  assert(
    value >= min && value <= max,
    `${name}: ${value.toFixed(1)} in [${min}, ${max}]`,
    `got ${value.toFixed(2)}`
  );
}

function section(title: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

function scenario(name: string) {
  console.log(`\n  ── ${name} ──`);
}

// ── Scenario Builders ────────────────────────────────────────────

/** A brand new agent with no data at all */
function newEmptyAgent(): ScoringInput {
  return {
    ethosScore: 1200,
    ethosProfileExists: false,
    humanVerified: false,
    proofType: "unverified",
    proofAge: 0,
    feedback: [],
    links: [],
    agentAge: 0,
    totalInteractions: 0,
    successfulInteractions: 0,
  };
}

/** Trusted human creator with ETHOS, strong feedback */
function trustedCreatorAgent(): ScoringInput {
  return {
    ethosScore: 2200,
    ethosProfileExists: true,
    humanVerified: true,
    proofType: "ethos",
    proofAge: 180 * 24 * 3600, // 6 months
    feedback: Array.from({ length: 15 }, (_, i) => ({
      score: 4 + (i % 2),           // 4-5 star ratings
      reviewerEthosScore: 1400 + i * 50,
      hasPaymentProof: true,
      interactionDepth: 70 + i,
      ageSeconds: i * 24 * 3600,
      isRevoked: false,
    })),
    links: [{
      role: "creator" as const,
      ageSeconds: 180 * 24 * 3600,
      sharedSuccessRate: 85,
      scopeCompliance: 90,
      disputeCount: 0,
      isRevoked: false,
    }],
    agentAge: 180 * 24 * 3600,
    totalInteractions: 100,
    successfulInteractions: 92,
  };
}

/** Spammy agent with fake reviews from low-credibility accounts */
function spamAgent(): ScoringInput {
  return {
    ethosScore: 400,
    ethosProfileExists: false,
    humanVerified: false,
    proofType: "unverified",
    proofAge: 0,
    feedback: Array.from({ length: 50 }, () => ({
      score: 5,                      // all 5-star (suspicious)
      reviewerEthosScore: 200,       // very low credibility reviewers
      hasPaymentProof: false,
      interactionDepth: 5,           // shallow interactions
      ageSeconds: 100,               // all very recent
      isRevoked: false,
    })),
    links: [],
    agentAge: 7 * 24 * 3600,        // 1 week old
    totalInteractions: 50,
    successfulInteractions: 50,
  };
}

/** ENS-verified creator, moderate feedback */
function ensVerifiedAgent(): ScoringInput {
  return {
    ethosScore: 1500,
    ethosProfileExists: true,
    humanVerified: false,
    proofType: "ens",
    proofAge: 90 * 24 * 3600,
    feedback: Array.from({ length: 8 }, (_, i) => ({
      score: 3 + (i % 3),           // 3-5 star range
      reviewerEthosScore: 1200 + i * 100,
      hasPaymentProof: i % 2 === 0,
      interactionDepth: 50,
      ageSeconds: i * 7 * 24 * 3600,
      isRevoked: false,
    })),
    links: [{
      role: "creator" as const,
      ageSeconds: 90 * 24 * 3600,
      sharedSuccessRate: 70,
      scopeCompliance: 75,
      disputeCount: 1,
      isRevoked: false,
    }],
    agentAge: 120 * 24 * 3600,
    totalInteractions: 30,
    successfulInteractions: 24,
  };
}

/** High-credibility agent but negative feedback */
function negativelyRatedAgent(): ScoringInput {
  return {
    ethosScore: 1800,
    ethosProfileExists: true,
    humanVerified: true,
    proofType: "ethos",
    proofAge: 60 * 24 * 3600,
    feedback: Array.from({ length: 12 }, (_, i) => ({
      score: 1 + (i % 2),           // 1-2 star ratings
      reviewerEthosScore: 1600 + i * 30,
      hasPaymentProof: true,
      interactionDepth: 80,
      ageSeconds: i * 3 * 24 * 3600,
      isRevoked: false,
    })),
    links: [{
      role: "creator" as const,
      ageSeconds: 60 * 24 * 3600,
      sharedSuccessRate: 30,
      scopeCompliance: 40,
      disputeCount: 5,
      isRevoked: false,
    }],
    agentAge: 60 * 24 * 3600,
    totalInteractions: 50,
    successfulInteractions: 15,
  };
}

/** Delegated operator scenario — different creator and operator */
function delegatedOperatorAgent(): ScoringInput {
  return {
    ethosScore: 1900,
    ethosProfileExists: true,
    humanVerified: true,
    proofType: "ethos",
    proofAge: 120 * 24 * 3600,
    feedback: Array.from({ length: 10 }, (_, i) => ({
      score: 4,
      reviewerEthosScore: 1400 + i * 40,
      hasPaymentProof: true,
      interactionDepth: 60,
      ageSeconds: i * 5 * 24 * 3600,
      isRevoked: false,
    })),
    links: [
      {
        role: "creator" as const,
        ageSeconds: 200 * 24 * 3600,
        sharedSuccessRate: 80,
        scopeCompliance: 85,
        disputeCount: 0,
        isRevoked: false,
      },
      {
        role: "operator" as const,
        ageSeconds: 90 * 24 * 3600,
        sharedSuccessRate: 75,
        scopeCompliance: 80,
        disputeCount: 1,
        isRevoked: false,
      },
    ],
    agentAge: 200 * 24 * 3600,
    totalInteractions: 80,
    successfulInteractions: 72,
  };
}

/** Mixed reviews — realistic agent with good and bad */
function mixedReviewAgent(): ScoringInput {
  return {
    ethosScore: 1350,
    ethosProfileExists: true,
    humanVerified: false,
    proofType: "ens",
    proofAge: 30 * 24 * 3600,
    feedback: [
      { score: 5, reviewerEthosScore: 2000, hasPaymentProof: true, interactionDepth: 90, ageSeconds: 2 * 24 * 3600, isRevoked: false },
      { score: 5, reviewerEthosScore: 1800, hasPaymentProof: true, interactionDepth: 85, ageSeconds: 5 * 24 * 3600, isRevoked: false },
      { score: 4, reviewerEthosScore: 1500, hasPaymentProof: true, interactionDepth: 70, ageSeconds: 10 * 24 * 3600, isRevoked: false },
      { score: 1, reviewerEthosScore: 1600, hasPaymentProof: true, interactionDepth: 80, ageSeconds: 15 * 24 * 3600, isRevoked: false },
      { score: 2, reviewerEthosScore: 1400, hasPaymentProof: false, interactionDepth: 40, ageSeconds: 20 * 24 * 3600, isRevoked: false },
      { score: 3, reviewerEthosScore: 1200, hasPaymentProof: false, interactionDepth: 30, ageSeconds: 25 * 24 * 3600, isRevoked: false },
    ],
    links: [{
      role: "creator" as const,
      ageSeconds: 45 * 24 * 3600,
      sharedSuccessRate: 60,
      scopeCompliance: 65,
      disputeCount: 2,
      isRevoked: false,
    }],
    agentAge: 45 * 24 * 3600,
    totalInteractions: 20,
    successfulInteractions: 14,
  };
}

/** Very old agent with revoked links — trust decay test */
function revokedLinksAgent(): ScoringInput {
  return {
    ethosScore: 1100,
    ethosProfileExists: true,
    humanVerified: false,
    proofType: "unverified",
    proofAge: 0,
    feedback: Array.from({ length: 5 }, (_, i) => ({
      score: 3,
      reviewerEthosScore: 1300,
      hasPaymentProof: false,
      interactionDepth: 40,
      ageSeconds: 300 * 24 * 3600,   // very old feedback
      isRevoked: false,
    })),
    links: [
      { role: "creator" as const, ageSeconds: 300 * 24 * 3600, sharedSuccessRate: 50, scopeCompliance: 50, disputeCount: 3, isRevoked: true },
      { role: "operator" as const, ageSeconds: 200 * 24 * 3600, sharedSuccessRate: 40, scopeCompliance: 45, disputeCount: 2, isRevoked: true },
      { role: "owner" as const, ageSeconds: 100 * 24 * 3600, sharedSuccessRate: 60, scopeCompliance: 60, disputeCount: 0, isRevoked: false },
    ],
    agentAge: 300 * 24 * 3600,
    totalInteractions: 10,
    successfulInteractions: 6,
  };
}

// ── Tests ────────────────────────────────────────────────────────

function testEthosNormalization() {
  section("1. ETHOS NORMALIZATION");

  scenario("Boundary values");
  assert(normalizeEthos(0) <= 5, "Ethos 0 → near 0");
  assert(normalizeEthos(1200) === 50, "Ethos 1200 → exactly 50 (neutral)");
  assert(normalizeEthos(2800) === 100, "Ethos 2800 → 100 (max)");

  scenario("Intermediate values");
  assertRange(normalizeEthos(600), 10, 30, "Ethos 600 (low trust)");
  assertRange(normalizeEthos(1600), 60, 80, "Ethos 1600 (above neutral)");
  assertRange(normalizeEthos(2200), 80, 100, "Ethos 2200 (high trust)");

  scenario("Below 0 and above 2800");
  assert(normalizeEthos(-500) === 0, "Ethos -500 → clamped to 0");
  assert(normalizeEthos(5000) === 100, "Ethos 5000 → clamped to 100");
}

function testAntiSpamFilter() {
  section("2. ANTI-SPAM VALIDITY FILTER");

  scenario("High-credibility review with payment proof");
  const goodReview: FeedbackEntry = {
    score: 4,
    reviewerEthosScore: 2000,
    hasPaymentProof: true,
    interactionDepth: 80,
    ageSeconds: 7 * 24 * 3600,
    isRevoked: false,
  };
  const goodValidity = feedbackValidity(goodReview);
  assert(goodValidity > 50, `Good review validity: ${goodValidity.toFixed(1)} (should pass)`);

  scenario("Low-credibility spam review");
  const spamReview: FeedbackEntry = {
    score: 5,
    reviewerEthosScore: 100,
    hasPaymentProof: false,
    interactionDepth: 2,
    ageSeconds: 100,
    isRevoked: false,
  };
  const spamValidity = feedbackValidity(spamReview);
  assert(spamValidity < 50, `Spam review validity: ${spamValidity.toFixed(1)} (should be filtered)`);

  scenario("Borderline review — neutral user, no payment");
  const borderlineReview: FeedbackEntry = {
    score: 3,
    reviewerEthosScore: 1200,
    hasPaymentProof: false,
    interactionDepth: 50,
    ageSeconds: 30 * 24 * 3600,
    isRevoked: false,
  };
  const borderValidity = feedbackValidity(borderlineReview);
  console.log(`  ℹ️  Borderline validity: ${borderValidity.toFixed(1)} (threshold: 50)`);

  scenario("Bulk spam filtering");
  const spamBatch: FeedbackEntry[] = Array.from({ length: 20 }, () => ({
    ...spamReview,
  }));
  const goodBatch: FeedbackEntry[] = Array.from({ length: 5 }, () => ({
    ...goodReview,
  }));
  const mixed = [...spamBatch, ...goodBatch];
  const { valid, filteredCount } = filterValidFeedback(mixed);
  assert(filteredCount >= 15, `Filtered ${filteredCount} spam reviews from 25 total`);
  assert(valid.length <= 10, `Only ${valid.length} reviews passed filter`);
}

function testScenarios() {
  section("3. SCORING SCENARIOS — HUMANS & AGENTS");

  // ── Scenario 1: Empty agent ──
  scenario("New agent (no data at all)");
  const emptyScore = computeLineageScore(newEmptyAgent());
  console.log(`  📊 Score: ${emptyScore.displayedScore.toFixed(1)} | Grade: ${emptyScore.grade} | ${emptyScore.label}`);
  assertRange(emptyScore.displayedScore, 0, 40, "Empty agent should score low");
  assertRange(emptyScore.confidence, 0, 0.5, "Empty agent low confidence");
  assertRange(emptyScore.agentTrust.total, 40, 55, "Empty agent near-neutral agent trust");

  // ── Scenario 2: Trusted creator ──
  scenario("Trusted creator (Ethos 2200, 15 good reviews, 6mo history)");
  const trustedScore = computeLineageScore(trustedCreatorAgent());
  console.log(`  📊 Score: ${trustedScore.displayedScore.toFixed(1)} | Grade: ${trustedScore.grade} | ${trustedScore.label}`);
  assertRange(trustedScore.displayedScore, 50, 100, "Trusted creator should score high");
  assertRange(trustedScore.humanTrust.total, 60, 100, "High human trust");
  assertRange(trustedScore.agentTrust.erc8004Normalized, 70, 100, "Good reviews → high ERC8004");

  // ── Scenario 3: Spammy agent ──
  scenario("Spammy agent (Ethos 400, 50 fake 5-star reviews, no payment proof)");
  const spamScore = computeLineageScore(spamAgent());
  console.log(`  📊 Score: ${spamScore.displayedScore.toFixed(1)} | Grade: ${spamScore.grade} | ${spamScore.label}`);
  console.log(`  🛡  Filtered ${spamScore.feedbackFiltered} spam reviews, used ${spamScore.feedbackUsed}`);
  assertRange(spamScore.displayedScore, 0, 35, "Spam agent capped low");
  assert(spamScore.feedbackFiltered > 30, "Most spam reviews should be filtered");

  // ── Scenario 4: ENS-verified moderate ──
  scenario("ENS-verified agent (Ethos 1500, 8 mixed reviews)");
  const ensScore = computeLineageScore(ensVerifiedAgent());
  console.log(`  📊 Score: ${ensScore.displayedScore.toFixed(1)} | Grade: ${ensScore.grade} | ${ensScore.label}`);
  assertRange(ensScore.displayedScore, 25, 65, "ENS verified should be mid-range");
  assert(ensScore.humanTrust.identityProofStrength === 70, "ENS proof strength = 70");

  // ── Scenario 5: Negatively rated ──
  scenario("Negatively rated agent (Ethos 1800 but 1-2 star reviews)");
  const negScore = computeLineageScore(negativelyRatedAgent());
  console.log(`  📊 Score: ${negScore.displayedScore.toFixed(1)} | Grade: ${negScore.grade} | ${negScore.label}`);
  assertRange(negScore.agentTrust.erc8004Normalized, 0, 35, "Bad reviews → low ERC8004 score");
  assert(negScore.displayedScore < trustedScore.displayedScore, "Neg agent < trusted agent");

  // ── Scenario 6: Delegated operator ──
  scenario("Delegated operator (creator + operator, both linked)");
  const delegatedScore = computeLineageScore(delegatedOperatorAgent());
  console.log(`  📊 Score: ${delegatedScore.displayedScore.toFixed(1)} | Grade: ${delegatedScore.grade} | ${delegatedScore.label}`);
  assertRange(delegatedScore.linkTrust.total, 40, 100, "Multi-link agent should have good link trust");

  // ── Scenario 7: Mixed reviews ──
  scenario("Mixed reviews (5★, 5★, 4★, 1★, 2★, 3★)");
  const mixedScore = computeLineageScore(mixedReviewAgent());
  console.log(`  📊 Score: ${mixedScore.displayedScore.toFixed(1)} | Grade: ${mixedScore.grade} | ${mixedScore.label}`);
  assertRange(mixedScore.agentTrust.erc8004Normalized, 40, 75, "Mixed reviews → mid ERC8004");

  // ── Scenario 8: Revoked links ──
  scenario("Revoked links agent (2 revoked, 1 active, old feedback)");
  const revokedScore = computeLineageScore(revokedLinksAgent());
  console.log(`  📊 Score: ${revokedScore.displayedScore.toFixed(1)} | Grade: ${revokedScore.grade} | ${revokedScore.label}`);
  assertRange(revokedScore.linkTrust.revocationStability, 20, 50, "Low revocation stability");
}

function testSafeguards() {
  section("4. HARD SAFEGUARDS");

  scenario("Ethos < 800 → cap final at 60");
  const lowEthos = computeLineageScore({
    ...trustedCreatorAgent(),
    ethosScore: 700,
  });
  assert(lowEthos.lineageScore <= 60, `Low Ethos cap: lineage=${lowEthos.lineageScore.toFixed(1)} (capped at 60)`);

  scenario("No identity proof → confidence reduced by 20%");
  const withProof = computeLineageScore({ ...ensVerifiedAgent() });
  const withoutProof = computeLineageScore({ ...ensVerifiedAgent(), proofType: "unverified" });
  assert(
    withoutProof.confidence < withProof.confidence,
    `No proof confidence ${withoutProof.confidence.toFixed(2)} < with proof ${withProof.confidence.toFixed(2)}`
  );

  scenario(">30% low-credibility reviewers → penalty");
  const lowCredReviewers = computeLineageScore({
    ...trustedCreatorAgent(),
    feedback: Array.from({ length: 10 }, (_, i) => ({
      score: 5,
      reviewerEthosScore: i < 5 ? 200 : 1500, // 50% low credibility
      hasPaymentProof: true,
      interactionDepth: 70,
      ageSeconds: i * 24 * 3600,
      isRevoked: false,
    })),
  });
  console.log(`  ℹ️  With low-cred reviewers: ${lowCredReviewers.displayedScore.toFixed(1)}`);
}

function testBuildScoringInput() {
  section("5. buildScoringInput HELPER");

  scenario("From aggregated contract data (what we actually have)");
  const input = buildScoringInput({
    ethosScore: 1600,
    ethosProfileExists: true,
    humanVerified: true,
    proofType: "ethos",
    proofAge: 60 * 24 * 3600,
    reviewCount: 5,
    averageScore: 400,       // 4.0/5 × 100
    linkCount: 1,
    linkAge: 30 * 24 * 3600,
    agentAge: 90 * 24 * 3600,
  });
  assert(input.feedback.length === 5, "Synthesized 5 feedback entries");
  assert(input.links.length === 1, "Created 1 link");
  assert(input.ethosScore === 1600, "Preserved Ethos score");

  const score = computeLineageScore(input);
  console.log(`  📊 Score: ${score.displayedScore.toFixed(1)} | Grade: ${score.grade}`);
  assertRange(score.displayedScore, 20, 80, "Moderate agent with good reviews");
}

function testEdgeCases() {
  section("6. EDGE CASES");

  scenario("All reviews revoked");
  const allRevoked = computeLineageScore({
    ...trustedCreatorAgent(),
    feedback: trustedCreatorAgent().feedback.map((f) => ({ ...f, isRevoked: true })),
  });
  console.log(`  📊 All revoked: ${allRevoked.displayedScore.toFixed(1)}`);
  assert(allRevoked.feedbackUsed === 0, "No feedback should be used");

  scenario("Extreme Ethos score (2800 max)");
  const maxEthos = computeLineageScore({
    ...trustedCreatorAgent(),
    ethosScore: 2800,
  });
  assert(maxEthos.humanTrust.ethosNormalized === 100, "Max Ethos → 100 normalized");

  scenario("Zero Ethos score");
  const zeroEthos = computeLineageScore({
    ...trustedCreatorAgent(),
    ethosScore: 0,
  });
  assertRange(zeroEthos.humanTrust.ethosNormalized, 0, 10, "Zero Ethos → near 0 normalized");

  scenario("Single review — high credibility");
  const singleReview = computeLineageScore({
    ...newEmptyAgent(),
    proofType: "ethos",
    ethosScore: 1800,
    ethosProfileExists: true,
    proofAge: 30 * 24 * 3600,
    feedback: [{
      score: 5,
      reviewerEthosScore: 2400,
      hasPaymentProof: true,
      interactionDepth: 100,
      ageSeconds: 3600,
      isRevoked: false,
    }],
    links: [{ role: "creator", ageSeconds: 30 * 24 * 3600, sharedSuccessRate: 90, scopeCompliance: 95, disputeCount: 0, isRevoked: false }],
  });
  console.log(`  📊 Single 5★ review: ${singleReview.displayedScore.toFixed(1)} | Grade: ${singleReview.grade}`);
}

function testScoreOrdering() {
  section("7. SCORE ORDERING — DO RANKINGS MAKE SENSE?");

  const scores = [
    { name: "Empty agent", score: computeLineageScore(newEmptyAgent()) },
    { name: "Spam agent", score: computeLineageScore(spamAgent()) },
    { name: "Revoked links", score: computeLineageScore(revokedLinksAgent()) },
    { name: "ENS verified", score: computeLineageScore(ensVerifiedAgent()) },
    { name: "Mixed reviews", score: computeLineageScore(mixedReviewAgent()) },
    { name: "Neg rated", score: computeLineageScore(negativelyRatedAgent()) },
    { name: "Delegated op", score: computeLineageScore(delegatedOperatorAgent()) },
    { name: "Trusted creator", score: computeLineageScore(trustedCreatorAgent()) },
  ];

  scores.sort((a, b) => a.score.displayedScore - b.score.displayedScore);

  console.log("\n  Ranking (lowest to highest):\n");
  scores.forEach((s, i) => {
    const bar = "█".repeat(Math.round(s.score.displayedScore / 3));
    console.log(
      `  ${(i + 1).toString().padStart(2)}. ${s.name.padEnd(18)} ` +
      `${s.score.displayedScore.toFixed(1).padStart(5)} ` +
      `${s.score.grade.padEnd(3)} ` +
      `${bar}`
    );
  });

  // Validate ordering makes sense
  const spamIdx = scores.findIndex((s) => s.name === "Spam agent");
  const trustedIdx = scores.findIndex((s) => s.name === "Trusted creator");
  assert(spamIdx < trustedIdx, "Spam agent should rank below trusted creator");

  const emptyIdx = scores.findIndex((s) => s.name === "Empty agent");
  assert(emptyIdx < trustedIdx, "Empty agent should rank below trusted creator");

  const negIdx = scores.findIndex((s) => s.name === "Neg rated");
  const delegatedIdx = scores.findIndex((s) => s.name === "Delegated op");
  assert(negIdx < delegatedIdx, "Negatively rated should rank below delegated operator");
}

function generateImprovementReport(scores: { name: string; score: LineageScoreBreakdown }[]) {
  section("8. IMPROVEMENT ANALYSIS");

  console.log("\n  Looking for potential issues in the scoring system...\n");

  const suggestions: string[] = [];

  for (const { name, score } of scores) {
    // Check if confidence is too low even for good data
    if (score.humanTrust.total > 70 && score.confidence < 0.4) {
      suggestions.push(`⚠️  ${name}: Human trust is high (${score.humanTrust.total.toFixed(0)}) but confidence is very low (${(score.confidence * 100).toFixed(0)}%). Consider increasing base confidence for verified users.`);
    }

    // Check if spam filter is too aggressive
    if (score.feedbackFiltered > score.feedbackUsed * 2) {
      suggestions.push(`⚠️  ${name}: Filtered ${score.feedbackFiltered} reviews but only used ${score.feedbackUsed}. Anti-spam may be too aggressive.`);
    }

    // Check if link trust is 0 for agents with active links
    if (score.linkTrust.total === 0 && score.humanTrust.total > 50) {
      suggestions.push(`ℹ️  ${name}: Link trust is 0 despite moderate human trust. Consider providing a base link score for linked agents.`);
    }

    // Check for score compression (everything lands in narrow range)
    if (score.displayedScore > 30 && score.displayedScore < 50) {
      suggestions.push(`ℹ️  ${name}: Score compressed to ${score.displayedScore.toFixed(1)} — mid-range clustering. Consider widening the score spread.`);
    }
  }

  if (suggestions.length === 0) {
    console.log("  ✅ No major issues found. Scoring system looks healthy.\n");
  } else {
    suggestions.forEach((s) => console.log(`  ${s}`));
    console.log(`\n  Found ${suggestions.length} suggestions for improvement.`);
  }
}

// ── Run All Tests ────────────────────────────────────────────────

console.log("\n");
console.log("╔══════════════════════════════════════════════════════════╗");
console.log("║  LINEAGE SCORING ENGINE — FULL TEST SUITE              ║");
console.log("║  Simulating humans, agents, and edge cases             ║");
console.log("╚══════════════════════════════════════════════════════════╝");

testEthosNormalization();
testAntiSpamFilter();
testScenarios();
testSafeguards();
testBuildScoringInput();
testEdgeCases();
testScoreOrdering();

// Generate improvement report
const allScenarios = [
  { name: "Empty", score: computeLineageScore(newEmptyAgent()) },
  { name: "Trusted", score: computeLineageScore(trustedCreatorAgent()) },
  { name: "Spam", score: computeLineageScore(spamAgent()) },
  { name: "ENS Verified", score: computeLineageScore(ensVerifiedAgent()) },
  { name: "Neg Rated", score: computeLineageScore(negativelyRatedAgent()) },
  { name: "Delegated", score: computeLineageScore(delegatedOperatorAgent()) },
  { name: "Mixed", score: computeLineageScore(mixedReviewAgent()) },
  { name: "Revoked", score: computeLineageScore(revokedLinksAgent()) },
];
generateImprovementReport(allScenarios);

// ── Summary ──────────────────────────────────────────────────────

section("RESULTS");
console.log(`\n  Total: ${totalTests} | ✅ Passed: ${passed} | ❌ Failed: ${failed}`);
if (failed > 0) {
  console.log("\n  Failed tests:");
  issues.forEach((i) => console.log(i));
}
console.log(`\n  ${failed === 0 ? "🎉 ALL TESTS PASSED!" : `⚠️  ${failed} TESTS FAILED — review above`}\n`);

process.exit(failed > 0 ? 1 : 0);
