/**
 * GET /api/v1/badges/[tokenId]/[chainId]
 *
 * Returns an SVG score badge for an agent.
 * Can be embedded in websites, READMEs, A2A protocol responses.
 *
 * Query: ?style=flat (optional, default "flat")
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { scoreSnapshots } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { recomputeAgentScore } from "@/lib/engine/recompute";

initializeDatabase();

function gradeColor(grade: string): string {
  if (grade.startsWith("A")) return "#22c55e";
  if (grade === "B+") return "#60a5fa";
  if (grade === "B") return "#818cf8";
  if (grade.startsWith("C")) return "#f59e0b";
  if (grade === "D") return "#ef4444";
  return "#6b7280";
}

function generateBadgeSVG(score: number, grade: string, label: string): string {
  const color = gradeColor(grade);
  const scoreText = `${Math.round(score)}`;
  const labelWidth = 80;
  const scoreWidth = 55;
  const totalWidth = labelWidth + scoreWidth;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="Lineage: ${scoreText} ${grade}">
  <title>Lineage Score: ${scoreText} (${grade} — ${label})</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${labelWidth}" height="20" fill="#555"/>
    <rect x="${labelWidth}" width="${scoreWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="Verdana,Geneva,DejaVu Sans,sans-serif" text-rendering="geometricPrecision" font-size="11">
    <text aria-hidden="true" x="${labelWidth / 2}" y="15" fill="#010101" fill-opacity=".3">Lineage</text>
    <text x="${labelWidth / 2}" y="14">Lineage</text>
    <text aria-hidden="true" x="${labelWidth + scoreWidth / 2}" y="15" fill="#010101" fill-opacity=".3">${scoreText} ${grade}</text>
    <text x="${labelWidth + scoreWidth / 2}" y="14">${scoreText} ${grade}</text>
  </g>
</svg>`;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string; chainId: string }> }
) {
  const { tokenId: tid, chainId: cid } = await params;
  const tokenId = parseInt(tid, 10);
  const chainId = parseInt(cid, 10);

  if (isNaN(tokenId) || isNaN(chainId)) {
    // Return a "unknown" badge
    return new NextResponse(generateBadgeSVG(0, "?", "Unknown"), {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "max-age=300" },
    });
  }

  const entityId = `${tokenId}:${chainId}`;

  let snapshot = db.select().from(scoreSnapshots)
    .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
    .orderBy(desc(scoreSnapshots.createdAt))
    .limit(1)
    .get();

  if (!snapshot) {
    await recomputeAgentScore(tokenId, chainId, "badge_view");
    snapshot = db.select().from(scoreSnapshots)
      .where(and(eq(scoreSnapshots.entityType, "agent"), eq(scoreSnapshots.entityId, entityId)))
      .orderBy(desc(scoreSnapshots.createdAt))
      .limit(1)
      .get();
  }

  const score = snapshot?.displayedScore ?? 0;
  const grade = snapshot?.grade ?? "?";
  const label = snapshot?.label ?? "New";

  const svg = generateBadgeSVG(score, grade, label);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=300, s-maxage=600",
    },
  });
}
