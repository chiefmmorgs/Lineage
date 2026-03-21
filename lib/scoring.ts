/**
 * ============================================================
 *  Lineage — Unified Trust Scoring Engine
 * ============================================================
 *
 *  ERC-8004 provides raw agent feedback.
 *  Ethos provides weighted human credibility (0–2800 ELO).
 *  Lineage normalizes, filters, and connects both into a
 *  unified trust score based on behavior, identity strength,
 *  and relationship history.
 *
 *  Core formula:
 *    Lineage Score = 0.38 × Agent Trust
 *                  + 0.37 × Human Trust
 *                  + 0.25 × Link Trust
 *
 *    Displayed Score = Lineage Score × Confidence
 * ============================================================
 */

// ── Types (JSON Schema equivalent) ──────────────────────────────

/** Raw input data collected from ERC-8004 + Ethos + Proofs */
export interface ScoringInput {
  // --- Human data (from Ethos) ---
  ethosScore: number;                  // 0–2800 ELO
  ethosProfileExists: boolean;
  humanVerified: boolean;              // Ethos human verification

  // --- Identity proof ---
  proofType: "ethos" | "ens" | "unverified";
  proofAge: number;                    // seconds since proof created

  // --- Agent feedback (from ERC-8004) ---
  feedback: FeedbackEntry[];

  // --- Link data ---
  links: LinkEntry[];

  // --- Agent operational data ---
  agentAge: number;                    // seconds since minted
  totalInteractions: number;
  successfulInteractions: number;
}

export interface FeedbackEntry {
  score: number;                       // 1–5 raw rating
  reviewerEthosScore: number;          // reviewer's Ethos score (0–2800)
  hasPaymentProof: boolean;
  interactionDepth: number;            // 0–100, how deep the interaction was
  ageSeconds: number;                  // how old the feedback is
  isRevoked: boolean;
}

export interface LinkEntry {
  role: "creator" | "operator" | "owner";
  ageSeconds: number;
  sharedSuccessRate: number;           // 0–100
  scopeCompliance: number;             // 0–100
  disputeCount: number;
  isRevoked: boolean;
}

/** Computed scores — the full breakdown */
export interface LineageScoreBreakdown {
  // --- Final composite ---
  lineageScore: number;                // 0–100  (what users see)
  confidence: number;                  // 0–1    (multiplier)
  displayedScore: number;              // lineageScore × confidence (shown publicly)

  // --- Component scores ---
  humanTrust: HumanTrustScore;
  agentTrust: AgentTrustScore;
  linkTrust: LinkTrustScore;

  // --- Meta ---
  grade: string;                       // "A+" to "F"
  label: string;                       // "Excellent", "Good", etc.
  color: string;                       // hex color for display
  feedbackFiltered: number;            // how many entries were filtered by anti-spam
  feedbackUsed: number;                // how many passed the validity filter
}

export interface HumanTrustScore {
  total: number;                       // 0–100
  ethosNormalized: number;             // 0–100
  identityProofStrength: number;       // 0–100
  historyScore: number;                // 0–100
  // Weights: 0.65 × ethos, 0.20 × proof, 0.15 × history
}

export interface AgentTrustScore {
  total: number;                       // 0–100
  erc8004Normalized: number;           // 0–100
  reliabilityMetrics: number;          // 0–100
  feedbackConfidence: number;          // 0–100
  // Weights: 0.60 × erc8004, 0.25 × reliability, 0.15 × confidence
}

export interface LinkTrustScore {
  total: number;                       // 0–100
  sharedSuccess: number;               // 0–100
  scopeCompliance: number;             // 0–100
  disputeScore: number;                // 0–100
  relationshipAge: number;             // 0–100
  revocationStability: number;         // 0–100
  // Weights: 0.30 × shared, 0.25 × scope, 0.20 × dispute, 0.15 × age, 0.10 × revocation
}

// ── Utilities ────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// ── Step 1: Normalize Ethos Score → 0–100 ───────────────────────

/**
 * Ethos: 0 → 2800, neutral at 1200
 * Formula: clamp(((score - 1200) / 1600) × 100 + 50, 0, 100)
 *   1200 → 50 (neutral)
 *   2800 → 100
 *      0 → ~0
 */
export function normalizeEthos(ethosScore: number): number {
  return clamp(((ethosScore - 1200) / 1600) * 100 + 50, 0, 100);
}

// ── Step 2: Anti-Spam Validity Filter ───────────────────────────

/**
 * Each feedback entry gets a validity score.
 * Only include feedback where Validity > VALIDITY_THRESHOLD.
 *
 * TUNED: Softened from original spec to avoid filtering legitimate
 * old feedback and feedback without payment proof.
 *
 * Validity = 0.45 × Reviewer Ethos Strength   (up from 0.4 — reviewer credibility matters most)
 *          + 0.15 × Payment Proof Presence     (down from 0.3 — many legit reviews have no payment)
 *          + 0.25 × Interaction Depth           (up from 0.2 — real interactions weigh more)
 *          + 0.15 × Age Factor                  (up from 0.1 — decay is gentler now)
 */
const VALIDITY_THRESHOLD = 35; // TUNED: down from 50 — less aggressive filtering

export function feedbackValidity(entry: FeedbackEntry): number {
  const reviewerStrength = normalizeEthos(entry.reviewerEthosScore);
  const paymentProof = entry.hasPaymentProof ? 100 : 0;
  const interactionDepth = clamp(entry.interactionDepth, 0, 100);

  // TUNED: Age decay extended from 90 days → 365 days
  // Old feedback from real users was being killed; now it decays gently over a year
  const maxAge = 365 * 24 * 3600;
  const ageFactor = clamp((1 - entry.ageSeconds / maxAge) * 100, 10, 100); // floor at 10, never fully zero

  return (
    0.45 * reviewerStrength +
    0.15 * paymentProof +
    0.25 * interactionDepth +
    0.15 * ageFactor
  );
}

/**
 * Filter feedback: only include entries with Validity > VALIDITY_THRESHOLD
 */
export function filterValidFeedback(
  feedback: FeedbackEntry[]
): { valid: FeedbackEntry[]; filteredCount: number } {
  const active = feedback.filter((f) => !f.isRevoked);
  const valid = active.filter((f) => feedbackValidity(f) > VALIDITY_THRESHOLD);
  return {
    valid,
    filteredCount: active.length - valid.length,
  };
}

// ── Step 3: Weighted Feedback Aggregation ────────────────────────

/**
 * Reviewer weight from Ethos:
 *   Weight = 0.5 + (Ethos Normalized / 200)
 *   Range: 0.5 (low credibility) → 1.0 (high credibility)
 */
function reviewerWeight(ethosScore: number): number {
  return 0.5 + normalizeEthos(ethosScore) / 200;
}

/**
 * Aggregate weighted feedback → Raw Agent Score
 * Then normalize to 0–100:
 *   Agent Normalized = clamp(50 + rawScore, 0, 100)
 *   where rawScore shifts from -50 to +50
 */
function aggregateFeedback(feedback: FeedbackEntry[]): number {
  if (feedback.length === 0) return 50; // neutral

  let weightedSum = 0;
  let totalWeight = 0;

  for (const f of feedback) {
    const w = reviewerWeight(f.reviewerEthosScore);
    // TUNED: Expanded scale from ±50 → ±55 for wider spread at extremes
    const normalized = (f.score - 3) * 27.5; // 1→-55, 2→-27.5, 3→0, 4→+27.5, 5→+55
    weightedSum += normalized * w;
    totalWeight += w;
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0;
  return clamp(50 + rawScore, 0, 100);
}

// ── Step 4: Compute Component Scores ─────────────────────────────

function computeHumanTrust(input: ScoringInput): HumanTrustScore {
  const ethosNormalized = normalizeEthos(input.ethosScore);

  // Identity proof strength: ethos=100, ens=70, unverified=10
  const identityProofStrength =
    input.proofType === "ethos" ? 100 :
    input.proofType === "ens" ? 70 :
    10;

  // History: based on proof age (longer = more trustworthy, up to 1 year)
  const maxProofAge = 365 * 24 * 3600;
  const historyScore = clamp((input.proofAge / maxProofAge) * 100, 0, 100);

  // Human Trust = 0.65 × Ethos + 0.20 × Proof + 0.15 × History
  const total =
    0.65 * ethosNormalized +
    0.20 * identityProofStrength +
    0.15 * historyScore;

  return {
    total: clamp(total, 0, 100),
    ethosNormalized,
    identityProofStrength,
    historyScore,
  };
}

function computeAgentTrust(input: ScoringInput, validFeedback: FeedbackEntry[]): AgentTrustScore {
  const erc8004Normalized = aggregateFeedback(validFeedback);

  // Reliability: success rate of interactions
  const reliabilityMetrics = input.totalInteractions > 0
    ? clamp((input.successfulInteractions / input.totalInteractions) * 100, 0, 100)
    : 50; // neutral if no data

  // Feedback confidence: volume + credibility + transaction proof
  const volumeScore = clamp(validFeedback.length * 10, 0, 100);
  const highCredPct = validFeedback.length > 0
    ? (validFeedback.filter((f) => normalizeEthos(f.reviewerEthosScore) > 60).length / validFeedback.length) * 100
    : 0;
  const txProofPct = validFeedback.length > 0
    ? (validFeedback.filter((f) => f.hasPaymentProof).length / validFeedback.length) * 100
    : 0;
  const feedbackConfidence = clamp(
    volumeScore * 0.4 + highCredPct * 0.35 + txProofPct * 0.25,
    0, 100
  );

  // Agent Trust = 0.60 × ERC8004 + 0.25 × Reliability + 0.15 × Confidence
  const total =
    0.60 * erc8004Normalized +
    0.25 * reliabilityMetrics +
    0.15 * feedbackConfidence;

  return {
    total: clamp(total, 0, 100),
    erc8004Normalized,
    reliabilityMetrics,
    feedbackConfidence,
  };
}

function computeLinkTrust(input: ScoringInput): LinkTrustScore {
  const activeLinks = input.links.filter((l) => !l.isRevoked);

  if (activeLinks.length === 0) {
    return {
      total: 0,
      sharedSuccess: 0,
      scopeCompliance: 0,
      disputeScore: 100,
      relationshipAge: 0,
      revocationStability: 100,
    };
  }

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

  const sharedSuccess = avg(activeLinks.map((l) => l.sharedSuccessRate));
  const scopeCompliance = avg(activeLinks.map((l) => l.scopeCompliance));

  // Dispute score: fewer disputes = higher score (inverse)
  const totalDisputes = activeLinks.reduce((sum, l) => sum + l.disputeCount, 0);
  const disputeScore = clamp(100 - totalDisputes * 10, 0, 100);

  // Relationship age: longer = better (up to 1 year)
  const maxAge = 365 * 24 * 3600;
  const relationshipAge = avg(
    activeLinks.map((l) => clamp((l.ageSeconds / maxAge) * 100, 0, 100))
  );

  // Revocation stability: % of links NOT revoked
  const allLinks = input.links;
  const revocationStability = allLinks.length > 0
    ? (activeLinks.length / allLinks.length) * 100
    : 100;

  // Link Trust = 0.30 × shared + 0.25 × scope + 0.20 × dispute + 0.15 × age + 0.10 × revocation
  const total =
    0.30 * sharedSuccess +
    0.25 * scopeCompliance +
    0.20 * disputeScore +
    0.15 * relationshipAge +
    0.10 * revocationStability;

  return {
    total: clamp(total, 0, 100),
    sharedSuccess,
    scopeCompliance,
    disputeScore,
    relationshipAge,
    revocationStability,
  };
}

// ── Step 5: Confidence Multiplier ────────────────────────────────

function computeConfidence(input: ScoringInput, validFeedbackCount: number): number {
  // Proof strength: ethos=100, ens=70, unverified=10
  const proofStrength =
    input.proofType === "ethos" ? 100 :
    input.proofType === "ens" ? 70 :
    10;

  // TUNED: Data depth scaling — each review contributes more (12 vs 8),
  // and each link contributes more (20 vs 15) for faster confidence growth
  const dataDepth = clamp(
    validFeedbackCount * 12 + input.links.filter((l) => !l.isRevoked).length * 20,
    0, 100
  );

  // Freshness: based on agent age (more recent activity = higher)
  const maxAge = 365 * 24 * 3600;
  const freshness = clamp((1 - input.agentAge / maxAge) * 100 + 30, 0, 100);

  // Confidence = 0.35 × Proof + 0.40 × Data Depth + 0.25 × Freshness
  const raw =
    0.35 * proofStrength +
    0.40 * dataDepth +
    0.25 * freshness;

  // TUNED: Floor at 0.25 for verified users (was effectively ~0.10)
  // Verified agents shouldn't bottom out entirely on confidence
  const baseFloor = input.proofType !== "unverified" ? 0.25 : 0.10;
  return clamp(Math.max(raw / 100, baseFloor), 0, 1);
}

// ── Step 6: Hard Safeguards ──────────────────────────────────────

function applySafeguards(
  score: LineageScoreBreakdown,
  input: ScoringInput,
  validFeedback: FeedbackEntry[]
): LineageScoreBreakdown {
  let agentTrustCap = 100;
  let finalScoreCap = 100;
  let confidencePenalty = 0;

  // If Feedback Confidence < 40 → cap Agent Trust at 65
  if (score.agentTrust.feedbackConfidence < 40) {
    agentTrustCap = 65;
  }

  // If Ethos Score < 800 → cap Final Score at 60
  if (input.ethosScore < 800) {
    finalScoreCap = 60;
  }

  // If no identity proof → reduce Confidence by 20%
  if (input.proofType === "unverified") {
    confidencePenalty = 0.20;
  }

  // If >30% feedback from low-credibility reviewers → penalty
  if (validFeedback.length > 0) {
    const lowCredCount = validFeedback.filter(
      (f) => normalizeEthos(f.reviewerEthosScore) < 30
    ).length;
    if (lowCredCount / validFeedback.length > 0.3) {
      agentTrustCap = Math.min(agentTrustCap, 70);
    }
  }

  // Apply caps
  const cappedAgentTrust = Math.min(score.agentTrust.total, agentTrustCap);
  const cappedConfidence = Math.max(score.confidence - confidencePenalty, 0.1);

  const cappedLineageScore =
    0.38 * cappedAgentTrust +
    0.37 * score.humanTrust.total +
    0.25 * score.linkTrust.total;

  const cappedFinal = Math.min(cappedLineageScore, finalScoreCap);
  const displayedScore = cappedFinal * cappedConfidence;

  return {
    ...score,
    agentTrust: { ...score.agentTrust, total: cappedAgentTrust },
    lineageScore: clamp(cappedFinal, 0, 100),
    confidence: cappedConfidence,
    displayedScore: clamp(displayedScore, 0, 100),
    ...scoreToGrade(displayedScore),
  };
}

// ── Score Spread (TUNED) ─────────────────────────────────────────

/**
 * Sigmoid-like curve that pushes mid-range scores apart.
 *
 * Without this, ENS-verified and mixed-review agents cluster in the
 * 42–48 range, making rankings hard to distinguish.
 *
 * The curve:
 *   - Amplifies differences in the 30–70 range
 *   - Keeps extremes (0–20, 80–100) mostly stable
 *   - Center point is 50 (neutral scores stay neutral)
 *
 * Formula: score + k × sin(π × score / 100)
 *   where k controls the spread strength
 */
function applySpread(score: number): number {
  const k = 8; // spread strength: how far mid-range scores push apart
  const adjusted = score + k * Math.sin((Math.PI * score) / 100);
  return clamp(adjusted, 0, 100);
}

// ── Grade Labels ─────────────────────────────────────────────────

function scoreToGrade(score: number): { grade: string; label: string; color: string } {
  if (score >= 90) return { grade: "A+", label: "Exceptional", color: "#22c55e" };
  if (score >= 80) return { grade: "A",  label: "Excellent",   color: "#22c55e" };
  if (score >= 70) return { grade: "B+", label: "Very Good",   color: "#86efac" };
  if (score >= 60) return { grade: "B",  label: "Good",        color: "#facc15" };
  if (score >= 50) return { grade: "C+", label: "Fair",        color: "#fbbf24" };
  if (score >= 40) return { grade: "C",  label: "Below Average",color: "#f97316" };
  if (score >= 25) return { grade: "D",  label: "Poor",        color: "#ef4444" };
  return               { grade: "F",  label: "Untrusted",   color: "#dc2626" };
}

// ── Main Computation ─────────────────────────────────────────────

/**
 * Compute the full Lineage Score breakdown from raw inputs.
 *
 * Final Score = (0.38 × Agent Trust + 0.37 × Human Trust + 0.25 × Link Trust) × Confidence
 */
export function computeLineageScore(input: ScoringInput): LineageScoreBreakdown {
  // 1. Filter feedback (anti-spam)
  const { valid: validFeedback, filteredCount } = filterValidFeedback(input.feedback);

  // 2. Compute components
  const humanTrust = computeHumanTrust(input);
  const agentTrust = computeAgentTrust(input, validFeedback);
  const linkTrust = computeLinkTrust(input);

  // 3. Composite score
  const rawLineageScore =
    0.38 * agentTrust.total +
    0.37 * humanTrust.total +
    0.25 * linkTrust.total;

  // TUNED: Sigmoid-like spread to push mid-range scores apart
  // Without this, ENS-verified (48.4) and mixed-review (42.7) agents cluster together.
  // The curve amplifies differences in the 30–70 range while keeping extremes stable.
  const lineageScore = applySpread(rawLineageScore);

  // 4. Confidence multiplier
  const confidence = computeConfidence(input, validFeedback.length);

  // 5. Displayed score
  const displayedScore = lineageScore * confidence;

  const baseResult: LineageScoreBreakdown = {
    lineageScore: clamp(lineageScore, 0, 100),
    confidence,
    displayedScore: clamp(displayedScore, 0, 100),
    humanTrust,
    agentTrust,
    linkTrust,
    feedbackFiltered: filteredCount,
    feedbackUsed: validFeedback.length,
    ...scoreToGrade(displayedScore),
  };

  // 6. Apply hard safeguards
  return applySafeguards(baseResult, input, validFeedback);
}

// ── Helper: Build ScoringInput from existing data ────────────────

/**
 * Build a ScoringInput from the data we already have in the system.
 * This bridges our existing contracts + Ethos API to the scoring engine.
 */
export function buildScoringInput(params: {
  ethosScore?: number;
  ethosProfileExists?: boolean;
  humanVerified?: boolean;
  proofType?: "ethos" | "ens" | "unverified";
  proofAge?: number;
  reviewCount?: number;
  averageScore?: number;         // 0–500 (our contract stores score × 100)
  linkCount?: number;
  linkAge?: number;
  agentAge?: number;
}): ScoringInput {
  const {
    ethosScore = 1200,
    ethosProfileExists = false,
    humanVerified = false,
    proofType = "unverified",
    proofAge = 0,
    reviewCount = 0,
    averageScore = 0,
    linkCount = 0,
    linkAge = 0,
    agentAge = 0,
  } = params;

  // Synthesize feedback entries from aggregate data
  // (When we don't have individual reviews, simulate from averages)
  const feedback: FeedbackEntry[] = [];
  if (reviewCount > 0) {
    const avgRating = clamp(averageScore / 100, 1, 5);
    for (let i = 0; i < Math.min(reviewCount, 50); i++) {
      feedback.push({
        score: avgRating,
        reviewerEthosScore: 1200, // assume neutral reviewers when data unavailable
        hasPaymentProof: false,
        interactionDepth: 50,
        ageSeconds: agentAge > 0 ? agentAge * (i / reviewCount) : 0,
        isRevoked: false,
      });
    }
  }

  // Synthesize links
  const links: LinkEntry[] = [];
  for (let i = 0; i < linkCount; i++) {
    links.push({
      role: i === 0 ? "creator" : "operator",
      ageSeconds: linkAge,
      sharedSuccessRate: 50,
      scopeCompliance: 50,
      disputeCount: 0,
      isRevoked: false,
    });
  }

  return {
    ethosScore,
    ethosProfileExists,
    humanVerified,
    proofType,
    proofAge,
    feedback,
    links,
    agentAge,
    totalInteractions: reviewCount,
    successfulInteractions: Math.round(reviewCount * (averageScore > 250 ? 0.8 : 0.5)),
  };
}
