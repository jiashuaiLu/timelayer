import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlock } from "@/data/blocks";
import { BlockView } from "@/components/BlockView";
import { storyHeadline } from "@/pipeline/narrative";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const block = getBlock(slug);
  if (!block) return { title: "街区未找到 · 时间街道" };
  const { year, hook } = storyHeadline(block);
  const title = `${block.name} · 时间街道`;
  const description = `${year} 年，${hook}。拖动卷尺，看这条街一百年留下的痕迹。`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BlockPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const block = getBlock(slug);
  if (!block) notFound();
  return <BlockView block={block} />;
}
