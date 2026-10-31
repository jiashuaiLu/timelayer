import { allBlocks } from "@/data/blocks";
import { dailyBookmarks } from "@/pipeline/resolve";
import { EntryScreen } from "@/components/EntryScreen";

export const dynamic = "force-dynamic";

export default function Home() {
  const bookmarks = dailyBookmarks(new Date());
  const blocks = allBlocks();
  const backdrop = blocks.find((b) => b.slug === bookmarks[0]?.slug) ?? blocks[0];

  return (
    <EntryScreen
      bookmarks={bookmarks}
      backdrop={backdrop}
      fallbackSlug={bookmarks[0]?.slug ?? blocks[0].slug}
    />
  );
}
