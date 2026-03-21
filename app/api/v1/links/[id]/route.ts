/**
 * GET /api/v1/links/[id]
 *
 * Returns a link's details and associated trust score.
 */

import { NextResponse } from "next/server";
import { db, initializeDatabase } from "@/lib/db/index";
import { links } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

initializeDatabase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const linkId = parseInt(id, 10);

  if (isNaN(linkId)) {
    return NextResponse.json({ error: "Invalid link ID" }, { status: 400 });
  }

  const link = db.select().from(links)
    .where(eq(links.linkId, linkId))
    .get();

  if (!link) {
    return NextResponse.json({ error: "Link not found", linkId }, { status: 404 });
  }

  return NextResponse.json({
    linkId: link.linkId,
    agentTokenId: link.agentTokenId,
    chainId: link.chainId,
    humanWallet: link.humanWallet,
    agentWallet: link.agentWallet,
    ethosProfileId: link.ethosProfileId,
    role: link.role,
    level: link.level,
    status: link.status,
    expiresAt: link.expiresAt > 0 ? new Date(link.expiresAt * 1000).toISOString() : null,
    createdAt: new Date(link.createdAt * 1000).toISOString(),
    updatedAt: new Date(link.updatedAt * 1000).toISOString(),
  });
}
