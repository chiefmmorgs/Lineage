/**
 * GET /api/v1/agents/[tokenId]/[chainId]/links
 *
 * Returns all links for an agent.
 * Query: ?status=active (optional filter)
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { links } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ tokenId: string; chainId: string }> }
) {
  const { tokenId: tid } = await params;
  const tokenId = parseInt(tid, 10);
  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status");

  if (isNaN(tokenId)) {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 });
  }

  let agentLinks = db.select().from(links)
    .where(eq(links.agentTokenId, tokenId))
    .all();

  if (statusFilter) {
    agentLinks = agentLinks.filter(l => l.status === statusFilter);
  }

  return NextResponse.json({
    tokenId,
    total: agentLinks.length,
    active: agentLinks.filter(l => l.status === "active").length,
    revoked: agentLinks.filter(l => l.status === "revoked").length,
    links: agentLinks.map(l => ({
      linkId: l.linkId,
      humanWallet: l.humanWallet,
      agentWallet: l.agentWallet,
      ethosProfileId: l.ethosProfileId,
      role: l.role,
      level: l.level,
      status: l.status,
      expiresAt: l.expiresAt > 0 ? new Date(l.expiresAt * 1000).toISOString() : null,
      createdAt: new Date(l.createdAt * 1000).toISOString(),
    })),
  });
}
