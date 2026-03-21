import { NextRequest, NextResponse } from "next/server";
import { fetchAgentsByWallet } from "@/lib/scan";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Invalid address" }, { status: 400 });
  }

  try {
    const agents = await fetchAgentsByWallet(address);
    return NextResponse.json({ data: agents });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch agents" }, { status: 500 });
  }
}
