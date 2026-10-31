import { NextResponse } from "next/server";
import { resolveAddress } from "@/pipeline/resolve";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let address = "";
  try {
    const body = (await request.json()) as { address?: unknown };
    if (typeof body.address === "string") address = body.address;
  } catch {
    address = "";
  }

  const resolved = resolveAddress(address);

  // the raw input is never logged, stored, or echoed back
  return NextResponse.json(resolved, {
    headers: { "cache-control": "no-store" },
  });
}
