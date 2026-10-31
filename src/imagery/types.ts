/**
 * 证据层：街区范围内公开的影像资料。
 *
 * 只做一件事——把「这一带在某个年代长什么样」变成可以指着看的东西。
 * 来源必须是可核查、可署名的公开档案；拿不到就明说拿不到，不生成图。
 */

export type EvidenceKind = "photo" | "plate";

export type Evidence = {
  id: string;
  title: string;
  kind: EvidenceKind;
  /** 拍摄/出版年份；解析不出就是 null，绝不猜 */
  year: number | null;
  caption: string;
  /** 约 900px 宽的缩略图 */
  url: string;
  pageUrl: string;
  license: string;
  credit: string;
  /** 与街区质心的距离（米）；来自地理检索，类别检索没有 */
  distanceM: number | null;
  /** street：确实落在这条街/这个街区；archive：街区档案里的一张 */
  relevance: "street" | "archive";
  source: "wikimedia";
};

export type ImageryResponse = {
  slug: string;
  items: Evidence[];
  notice: string;
};

const PHOTO_WINDOW_YEARS = 60;

/**
 * 选出「截至这一年，我们手上最新的一张」。
 * 不往前借未来的照片——1978 年的切片不能显示 2004 年的街景。
 */
function evidencePick(items: Evidence[], year: number): {
  item: Evidence;
  ageGap: number;
} | null {
  const dated = items.filter((i) => i.year !== null) as (Evidence & { year: number })[];
  if (!dated.length) return null;

  const earlier = dated.filter((i) => i.year <= year + 1);
  const pool = earlier.length ? earlier : dated;
  const best = pool.reduce((a, b) =>
    Math.abs(b.year - year) < Math.abs(a.year - year) ? b : a,
  );
  // 还没发生的照片不能提前出现
  if (!earlier.length && best.year > year + 2) return null;
  const ageGap = year - best.year;
  if (ageGap > PHOTO_WINDOW_YEARS) return null;
  return { item: best, ageGap: Math.max(0, ageGap) };
}

export function evidenceCaption(item: Evidence, blockName: string): string {
  if (item.distanceM !== null && item.distanceM < 900) {
    return `距街区中心 ${Math.round(item.distanceM)} 米`;
  }
  return item.relevance === "street" ? blockName : "街区档案";
}

export function evidenceForYear(items: Evidence[], year: number) {
  return evidencePick(items, year);
}
