import type { Block } from "@/domain/types";
import type { Evidence, EvidenceKind, ImageryResponse } from "./types";

/**
 * Wikimedia Commons 适配器。
 *
 * 用两条检索交叉：地理检索（有坐标的现代街景照片）+ 类别检索（档案馆扫描件、
 * 税照、图版，通常没有坐标）。两条都拿不到就返回空列表——宁可空着，
 * 也不拿一张别处的照片来凑数。
 */

const ENDPOINT = "https://commons.wikimedia.org/w/api.php";
const UA = "TimeLayer/0.1 (neighborhood biography demo; Wikimedia API)";
const TTL_MS = 6 * 60 * 60 * 1000;

type CommonsPage = {
  title: string;
  imageinfo?: {
    thumburl?: string;
    url?: string;
    descriptionurl?: string;
    width?: number;
    height?: number;
    extmetadata?: Record<string, { value?: string }>;
  }[];
  dist?: number;
};

const cache = new Map<string, { at: number; value: ImageryResponse }>();

function stripHtml(input: string): string {
  return input
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function yearFrom(input: string): number | null {
  const match = input.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
  return match ? Number(match[1]) : null;
}

/** 文件名不是标题：去掉图库编号、把全大写压回正常大小写 */
function prettyTitle(raw: string): string {
  let out = raw
    .replace(/^\([^)]*\)\s*/, "")
    .replace(/\bpg\s*\d+\b/gi, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const letters = out.replace(/[^A-Za-z]/g, "");
  if (letters.length > 8 && letters.replace(/[^A-Z]/g, "").length / letters.length > 0.7) {
    out = out
      .toLowerCase()
      .replace(/(^|[\s(])([a-z])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase());
    const small = new Set(["On", "Of", "The", "At", "In", "For", "To", "And", "A", "An"]);
    out = out
      .split(" ")
      .map((word, index) => (index > 0 && small.has(word) ? word.toLowerCase() : word))
      .join(" ");
  }

  return out.length > 62 ? `${out.slice(0, 60).trimEnd()}…` : out;
}

const RANGE = /\b(1[5-9]\d{2}|20\d{2})\s*[–—-]\s*(1[5-9]\d{2}|20\d{2})\b/;

/** "1880 – 1990" 这种区间不算数：宁可去标题里找，找不到就承认不知道 */
function resolveYear(date: string, title: string): number | null {
  if (RANGE.test(date)) return yearFrom(title);
  return yearFrom(date) ?? yearFrom(title);
}

function classify(title: string, caption: string): EvidenceKind {
  const text = `${title} ${caption}`.toLowerCase();
  return /map|atlas|plate|plan of|survey|engraving|lithograph|bird'?s[- ]eye|panorama/.test(text)
    ? "plate"
    : "photo";
}

async function query(params: Record<string, string>): Promise<CommonsPage[]> {
  const url = `${ENDPOINT}?${new URLSearchParams({
    ...params,
    format: "json",
    formatversion: "2",
  })}`;
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(7000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`commons ${response.status}`);
  const payload = (await response.json()) as { query?: { pages?: CommonsPage[] } };
  return payload.query?.pages ?? [];
}

const JUNK = /^(wikt|wstm|img[_-]|dsc[_-]?\d|dscn|p\d{6,}|cimg|picture\d|photo\d)/i;

/** 这条街自己的词：街名、街区名、语言变体 */
function streetTokens(block: Block): string[] {
  const tokens = new Set<string>();
  const push = (value: string) => {
    const clean = value.toLowerCase().trim();
    if (clean.length < 4) return;
    tokens.add(clean);
    const head = clean.split(/[\s,·—-]+/)[0];
    if (head.length >= 5) tokens.add(head);
  };
  block.streets.forEach((street) => {
    push(street.name);
    if (street.nameZh) push(street.nameZh);
  });
  block.nameEn.split(/[\s,]+/).forEach(push);
  return Array.from(tokens);
}

function relevanceOf(block: Block, title: string, caption: string): number {
  const text = `${title} ${caption}`.toLowerCase();
  let score = 0;
  if (streetTokens(block).some((token) => text.includes(token))) score += 4;
  if (caption.length > 30) score += 1;
  if (JUNK.test(title)) score -= 6;
  if (!caption) score -= 2;
  return score;
}

function toEvidence(page: CommonsPage, block: Block): Evidence | null {
  const info = page.imageinfo?.[0];
  if (!info?.thumburl) return null;
  if ((info.width ?? 0) < 600) return null;
  if (!/\.(jpe?g|png)$/i.test(page.title)) return null;

  const meta = info.extmetadata ?? {};
  const caption = stripHtml(meta.ImageDescription?.value ?? "");
  const date = stripHtml(meta.DateTimeOriginal?.value ?? "");
  const title = prettyTitle(
    page.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "").replace(/_/g, " "),
  );
  const year = resolveYear(date, title);

  return {
    id: String(page.title),
    title,
    kind: classify(title, caption),
    year,
    caption: caption.slice(0, 160),
    url: info.thumburl,
    pageUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    license: stripHtml(meta.LicenseShortName?.value ?? "见来源页"),
    credit: stripHtml(meta.Artist?.value ?? "Wikimedia Commons").slice(0, 80),
    distanceM: typeof page.dist === "number" ? Math.round(page.dist) : null,
    relevance: "archive",
    source: "wikimedia",
  };
}

function dedupe(items: Evidence[]): Evidence[] {
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const item of items) {
    const key = item.title.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

/**
 * Mapillary 只在配了 token 时才参与；它的覆盖是 2014 年之后，
 * 所以永远只会进入「现在」这一端，不会冒充历史照片。
 * 请求失败（离线、被墙、额度）就静默跳过。
 */
async function mapillary(block: Block): Promise<Evidence[]> {
  const token = process.env.MAPILLARY_TOKEN;
  if (!token) return [];

  const d = block.radiusM / 111320;
  const bbox = [
    block.centroid.lng - d,
    block.centroid.lat - d,
    block.centroid.lng + d,
    block.centroid.lat + d,
  ].join(",");

  try {
    const url = `https://graph.mapillary.com/images?access_token=${encodeURIComponent(token)}&fields=id,captured_at,thumb_1024_url,computed_geometry&bbox=${bbox}&limit=12`;
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!response.ok) return [];
    const payload = (await response.json()) as {
      data?: { id: string; captured_at?: number; thumb_1024_url?: string }[];
    };
    return (payload.data ?? [])
      .filter((image) => image.thumb_1024_url && image.captured_at)
      .map((image) => ({
        id: `mapillary-${image.id}`,
        title: "街景影像",
        kind: "photo" as const,
        year: new Date(image.captured_at as number).getUTCFullYear(),
        caption: "Mapillary 用户上传的街面影像",
        url: image.thumb_1024_url as string,
        pageUrl: `https://www.mapillary.com/app/?pKey=${image.id}`,
        license: "CC BY-SA 4.0",
        credit: "Mapillary 贡献者",
        distanceM: null,
        relevance: "street" as const,
        source: "wikimedia" as const,
      }));
  } catch {
    return [];
  }
}

async function collect(block: Block): Promise<Evidence[]> {
  const [geo, category] = await Promise.allSettled([
    query({
      action: "query",
      generator: "geosearch",
      ggscoord: `${block.centroid.lat}|${block.centroid.lng}`,
      ggsradius: String(Math.round(block.radiusM)),
      ggslimit: "50",
      ggsnamespace: "6",
      prop: "imageinfo",
      iiprop: "url|extmetadata|size",
      iiurlwidth: "900",
    }),
    block.commonsCategory
      ? query({
          action: "query",
          generator: "categorymembers",
          gcmtitle: `Category:${block.commonsCategory}`,
          gcmtype: "file",
          gcmlimit: "100",
          prop: "imageinfo",
          iiprop: "url|extmetadata|size",
          iiurlwidth: "900",
        })
      : Promise.resolve([] as CommonsPage[]),
  ]);

  const pages = [
    ...(geo.status === "fulfilled" ? geo.value : []),
    ...(category.status === "fulfilled" ? category.value : []),
  ];

  return dedupe(
    pages
      .map((page) => toEvidence(page, block))
      .filter((item): item is Evidence => item !== null),
  );
}

const ERA_EDGES = [1900, 1950, 1990, 2010, 2100];

/** 每个时代留几张：宁可少，也要让 19 世纪和 1940 年代都有人说话 */
const PER_ERA = 3;

function slugKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "")
    .replace(/crop|edit|copy|small|large|\d{2,}/g, "")
    .slice(0, 18);
}

export async function loadImagery(block: Block): Promise<ImageryResponse> {
  const hit = cache.get(block.slug);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  const [commons, mapi] = await Promise.all([collect(block).catch(() => []), mapillary(block)]);

  const scored = [...commons, ...mapi]
    .filter((item) => item.year !== null)
    .map((item) => {
      const score = relevanceOf(block, item.title, item.caption) + (item.distanceM !== null ? 3 : 0);
      return {
        item: { ...item, relevance: (score >= 4 ? "street" : "archive") as Evidence["relevance"] },
        score,
      };
    })
    // 负分的是扫描件噪声、纯上传编号，不要占用时代名额
    .filter((entry) => entry.score >= 0);

  // 同一景别的连拍只留一张：按标题前 20 字归一，保留分数最高的
  const byKey = new Map<string, { item: Evidence; score: number }>();
  for (const entry of scored) {
    const key = slugKey(entry.item.title);
    const prev = byKey.get(key);
    if (!prev || entry.score > prev.score) byKey.set(key, entry);
  }

  // 分时代取样，保证 1893 年的版画和 2022 年的照片都在
  const buckets: { item: Evidence; score: number }[][] = ERA_EDGES.map(() => []);
  for (const entry of byKey.values()) {
    const index = ERA_EDGES.findIndex((edge) => (entry.item.year ?? 2100) < edge);
    buckets[Math.max(0, index)].push(entry);
  }

  const items = buckets
    .flatMap((bucket) => bucket.sort((a, b) => b.score - a.score).slice(0, PER_ERA))
    .map((entry) => entry.item)
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));

  const value: ImageryResponse = {
    slug: block.slug,
    items,
    notice: items.length
      ? "影像来自 Wikimedia Commons 等公开档案，按拍摄/出版年份标注；不是该建筑本体的照片。"
      : "这一带暂时没有可核查的公开影像，地图之外不补充臆造的图。",
  };

  cache.set(block.slug, { at: Date.now(), value });
  return value;
}
