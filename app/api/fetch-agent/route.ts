import { NextRequest, NextResponse } from "next/server";

const API_BASE = "https://8004scan.io/api/v1/public";

// All chains to search across
const ALL_CHAINS = [84532, 11155111, 8453, 1, 56, 42161, 42220, 2741, 43114, 10143, 10, 137, 324];

export async function GET(req: NextRequest) {
  const tokenId = req.nextUrl.searchParams.get("tokenId");
  const chainId = req.nextUrl.searchParams.get("chainId");

  if (!tokenId) {
    return NextResponse.json({ error: "Missing tokenId" }, { status: 400 });
  }

  // If a specific chain is requested, try just that one
  if (chainId) {
    try {
      const res = await fetch(`${API_BASE}/agents/${chainId}/${tokenId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) {
        const data = await res.json();
        const agent = data?.data ?? data;
        if (agent?.token_id) {
          return NextResponse.json({ data: [agent] });
        }
      }
    } catch { /* */ }
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // No chain specified — search ALL chains in parallel and return all matches
  const results = await Promise.allSettled(
    ALL_CHAINS.map(async (cid) => {
      const res = await fetch(`${API_BASE}/agents/${cid}/${tokenId}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const agent = data?.data ?? data;
      return agent?.token_id ? agent : null;
    })
  );

  const agents = results
    .filter((r): r is PromiseFulfilledResult<any> => r.status === "fulfilled" && r.value !== null)
    .map(r => r.value);

  if (agents.length === 0) {
    return NextResponse.json({ error: "Agent not found on any chain" }, { status: 404 });
  }

  return NextResponse.json({ data: agents });
}
