import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") || 100), 200);
  const page = Number(searchParams.get("page") || 1);

  try {
    const res = await fetch(
      `https://www.8004scan.io/api/v1/public/agents?page=${page}&limit=${limit}`,
      { signal: AbortSignal.timeout(10000), cache: "no-store" }
    );

    if (!res.ok) throw new Error(`8004scan: ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    console.error("Proxy agents error:", e);
    return NextResponse.json({ data: [], meta: { pagination: { total: 0 } } }, { status: 502 });
  }
}
