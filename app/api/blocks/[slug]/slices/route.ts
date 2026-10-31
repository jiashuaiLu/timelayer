import { NextResponse } from "next/server";
import { getBlock } from "@/data/blocks";
import { buildSlices } from "@/pipeline/slices";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const block = getBlock(slug);
  if (!block) return NextResponse.json({ error: "unknown block" }, { status: 404 });
  return NextResponse.json(buildSlices(block), {
    headers: { "cache-control": "public, max-age=300" },
  });
}
