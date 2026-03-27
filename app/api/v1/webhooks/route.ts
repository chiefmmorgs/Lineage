import { NextResponse } from "next/server";
import { db, initializeDatabase, now } from "@/lib/db/index";
import { webhooks } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifySignature } from "@/lib/auth";

initializeDatabase();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { agentTokenId, chainId, url, events, secret, signature, timestamp, signerWallet } = body;

    // 1. Basic Validation
    if (!agentTokenId || !url || !events || !Array.isArray(events) || !signature || !timestamp || !signerWallet) {
      return NextResponse.json(
        { error: "Missing required: agentTokenId, url, events, signature, timestamp, signerWallet" },
        { status: 400 }
      );
    }

    // 2. Signature Verification (Security)
    const isValid = await verifySignature({
      address: signerWallet,
      signature,
      primaryType: "Webhook",
      message: {
        agentTokenId: BigInt(agentTokenId),
        url,
        events,
        timestamp: BigInt(timestamp),
      },
    });

    if (!isValid) {
      return NextResponse.json({ error: "Invalid EIP-712 signature" }, { status: 401 });
    }

    // 3. Save to DB (Persistent)
    const webhook = {
      agentTokenId: Number(agentTokenId),
      chainId: Number(chainId || 84532),
      url,
      events: JSON.stringify(events),
      secret: secret || "",
      isActive: true,
      createdAt: now(),
    };

    const result = db.insert(webhooks).values(webhook).run();

    return NextResponse.json({
      success: true,
      webhookId: result.lastInsertRowid,
      message: "Webhook registered successfully",
      events,
    }, { status: 201 });
  } catch (error) {
    console.error("[API] Webhook registration error:", error);
    return NextResponse.json({ error: "Invalid request or internal error" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agentTokenId = url.searchParams.get("agentTokenId");

  try {
    let query = db.select().from(webhooks);
    
    if (agentTokenId) {
      const results = query.where(eq(webhooks.agentTokenId, Number(agentTokenId))).all();
      return NextResponse.json({
         total: results.length,
         webhooks: results.map(w => ({
           id: w.id,
           agentTokenId: w.agentTokenId,
           chainId: w.chainId,
           url: w.url,
           events: JSON.parse(w.events),
           active: w.isActive,
           createdAt: new Date(w.createdAt * 1000).toISOString(),
         }))
      });
    }

    const all = query.all();
    return NextResponse.json({
      total: all.length,
      webhooks: all.map(w => ({
        id: w.id,
        agentTokenId: w.agentTokenId,
        chainId: w.chainId,
        url: w.url,
        events: JSON.parse(w.events),
        active: w.isActive,
        createdAt: new Date(w.createdAt * 1000).toISOString(),
      }))
    });
  } catch (error) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
