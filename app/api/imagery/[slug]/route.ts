import { NextResponse } from "next/server";
import { getBlock } from "@/data/blocks";
import { loadImagery } from "@/imagery/commons";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const block = getBlock(slug);
  if (!block) return NextResponse.json({ error: "unknown block" }, { status: 404 });

  const imagery = await loadImagery(block);
  return NextResponse.json(imagery, {
    headers: { "cache-control": "public, max-age=600, s-maxage=21600" },
  });
}
