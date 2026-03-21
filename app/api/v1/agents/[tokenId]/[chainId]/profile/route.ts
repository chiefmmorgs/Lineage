/**
 * GET /api/v1/agents/[tokenId]/[chainId]/profile
 *
 * Unified agent profile — one call to get everything:
 *   - Agent data (from 8004scan, live)
 *   - Lineage Score (from DB or on-demand)
 *   - Links (from DB)
 *   - Proofs (from DB)
 *   - Task summary (from DB)
 *   - Dispute summary (from DB)
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { links, scoreSnapshots, proofs, tasks, disputes, feedback } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { recomputeAgentScore } from "@/lib/engine/recompute";

initializeDatabase();

const SCAN_API = "https://8004scan.io/api/v1/public";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string; chainId: string }> }
) {
  const { tokenId: tid, chainId: cid } = await params;
  const tokenId = parseInt(tid, 10);
  const chainId = parseInt(cid, 10);

  if (isNaN(tokenId) || isNaN(chainId)) {
    return NextResponse.json({ error: "Invalid tokenId or chainId" }, { status: 400 });
  }

  const entityId = `${tokenId}:${chainId}`;

  // 1. Fetch agent data from 8004scan (external, live)
  let agentData: any = null;
  try {
    const res = await fetch(`${SCAN_API}/agents/${chainId}/${tokenId}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const json = await res.json();
      agentData = json?.data ?? json;
    }
  } catch { /* agent not found externally */ }

  // 2. Get or compute Lineage Score
  let snapshot = db.select().from(scoreSnapshots)
    .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1)
    .get();

  if (!snapshot) {
    await recomputeAgentScore(tokenId, chainId, "profile_view");
    snapshot = db.select().from(scoreSnapshots)
      .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
      .orderBy(desc(scoreSnapshots.createdAt))
      .limit(1)
      .get();
  }

  // 3. Get links (Lineage-owned)
  const agentLinks = db.select().from(links)
    .where(eq(links.agentTokenId, tokenId))
    .all();

  // 4. Get proofs (Lineage-owned)
  const agentProofs = db.select().from(proofs)
    .where(eq(proofs.agentTokenId, tokenId))
    .all();

  // 5. Get task summary (Lineage-owned)
  const agentTasks = db.select().from(tasks)
    .where(eq(tasks.agentTokenId, tokenId))
    .all();
  const taskSummary = {
    total: agentTasks.length,
    success: agentTasks.filter(t => t.outcome === "success").length,
    failure: agentTasks.filter(t => t.outcome === "failure").length,
    partial: agentTasks.filter(t => t.outcome === "partial").length,
    successRate: agentTasks.length > 0
      ? Math.round((agentTasks.filter(t => t.outcome === "success").length / agentTasks.length) * 100)
      : 0,
  };

  // 6. Get dispute summary (Lineage-owned)
  const agentDisputes = db.select().from(disputes)
    .where(eq(disputes.agentTokenId, tokenId))
    .all();
  const disputeSummary = {
    total: agentDisputes.length,
    open: agentDisputes.filter(d => d.status === "open").length,
    resolved: agentDisputes.filter(d => d.status === "resolved").length,
    dismissed: agentDisputes.filter(d => d.status === "dismissed").length,
  };

  // 7. Get platform feedback count
  const platformFeedback = db.select().from(feedback)
    .where(eq(feedback.agentTokenId, tokenId))
    .all();

  return NextResponse.json({
    // Identity (from external)
    tokenId,
    chainId,
    name: agentData?.name || `Agent #${tokenId}`,
    description: agentData?.description || "",
    image: agentData?.image_url || "",
    owner: agentData?.owner_address || "",
    isVerified: agentData?.is_verified || false,
    registeredAt: agentData?.created_at || null,

    // Score (computed)
    score: snapshot ? {
      displayedScore: snapshot.displayedScore,
      lineageScore: snapshot.lineageScore,
      confidence: snapshot.confidence,
      grade: snapshot.grade,
      label: snapshot.label,
      humanTrust: snapshot.humanTrust,
      agentTrust: snapshot.agentTrust,
      linkTrust: snapshot.linkTrust,
      lastUpdated: new Date(snapshot.createdAt * 1000).toISOString(),
    } : null,

    // Links (Lineage-owned)
    links: {
      total: agentLinks.length,
      active: agentLinks.filter(l => l.status === "active").length,
      items: agentLinks.map(l => ({
        linkId: l.linkId,
        humanWallet: l.humanWallet,
        role: l.role,
        level: l.level,
        status: l.status,
        createdAt: new Date(l.createdAt * 1000).toISOString(),
      })),
    },

    // Proofs (Lineage-owned)
    proofs: agentProofs.map(p => ({
      type: p.proofType,
      value: p.value,
      verified: p.verified,
    })),

    // Tasks (Lineage-owned)
    tasks: taskSummary,

    // Disputes (Lineage-owned)
    disputes: disputeSummary,

    // Platform feedback
    platformFeedback: {
      total: platformFeedback.length,
      avgScore: platformFeedback.length > 0
        ? Math.round((platformFeedback.reduce((s, f) => s + f.score, 0) / platformFeedback.length) * 100) / 100
        : 0,
    },
  });
}
