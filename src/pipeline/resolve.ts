import { z } from "zod";
import type { Block, ResolvedBlock } from "@/domain/types";
import { allBlocks, getBlockById } from "@/data/blocks";
import { distanceM } from "@/lib/geo";

/**
 * M1 — address -> neighbourhood.
 *
 * The resolver is deliberately a gazetteer, not a full geocoder: with two blocks
 * in the MVP, a hand-checked gazetteer is more reliable than a cold Nominatim call,
 * and it lets us guarantee the privacy contract in tests. A `Geocoder` adapter is
 * exposed below for the swap to Nominatim/Mapbox without touching call sites —
 * whatever it returns, `anonymize()` runs before anything else sees it.
 */

export interface GeocodeHit {
  blockId: string;
  /** higher is better */
  score: number;
  matchedOn: "alias" | "coordinate" | "fallback";
}

export interface Geocoder {
  lookup(input: string): Promise<GeocodeHit | null>;
}

/** Contract test target: this schema may not grow a house-number field. */
export const resolvedBlockSchema = z.object({
  blockId: z.string().min(1),
  slug: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().min(1),
  city: z.enum(["nyc", "ldn"]),
  cityName: z.string().min(1),
  borough: z.string().min(1),
  centroid: z.object({ lng: z.number(), lat: z.number() }),
  radiusM: z.number().min(500),
  precision: z.literal("neighborhood"),
  notice: z.string().min(1),
  matchedOn: z.enum(["alias", "coordinate", "fallback"]),
});

const HOUSE_NUMBER = /^\s*\d+[a-zA-Z]?(?:[-–]\d+[a-zA-Z]?)?\s+/;

export function normalizeAddress(input: string): string {
  return input
    .toLowerCase()
    .replace(/[，、。．]/g, " ")
    .replace(/[,./#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Distance in characters, capped — enough to forgive a typo, not enough to merge streets. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const prev = new Array(b.length + 1).fill(0).map((_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diag = tmp;
    }
  }
  return prev[b.length];
}

function coordinateHit(input: string): GeocodeHit | null {
  const m = input.match(/(-?\d{1,3}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  // accept "lat,lng" and "lng,lat" — try both, keep the closer
  const candidates = [
    { lat: a, lng: b },
    { lat: b, lng: a },
  ].filter((c) => Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180);
  let best: { block: Block; d: number } | null = null;
  for (const c of candidates) {
    for (const block of allBlocks()) {
      const d = distanceM(block.centroid, c);
      if (!best || d < best.d) best = { block, d };
    }
  }
  if (best && best.d < 4000) {
    return { blockId: best.block.id, score: 100 - best.d / 100, matchedOn: "coordinate" };
  }
  return null;
}

export function lookupBlock(input: string): GeocodeHit {
  const raw = input.trim();
  const norm = normalizeAddress(raw);

  const coord = coordinateHit(norm);
  if (coord) return coord;

  const stripped = norm.replace(HOUSE_NUMBER, "");
  const tokens = stripped.split(/[^a-z0-9]+/).filter((t) => t.length > 2);

  let best: GeocodeHit | null = null;
  for (const block of allBlocks()) {
    let score = 0;
    for (const alias of block.aliases) {
      const a = alias.toLowerCase();
      if (stripped.includes(a)) {
        score += a.length * 1.6;
        continue;
      }
      // multi-word aliases are matched word by word, one typo forgiven per word
      const aliasTokens = a.split(/[^a-z0-9]+/).filter(Boolean);
      if (!aliasTokens.length) continue;
      const hit = aliasTokens.every((at) => tokens.some((t) => t === at || editDistance(t, at) <= 1));
      if (hit) score += a.length * (aliasTokens.length > 1 ? 1 : 0.7);
    }
    if (!best || score > best.score) {
      best = { blockId: block.id, score, matchedOn: "alias" };
    }
  }

  if (best && best.score >= 8) return best;
  return fallbackHit();
}

export function fallbackHit(today = new Date()): GeocodeHit {
  const blocks = allBlocks();
  const seed = Number(
    `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
      today.getDate(),
    ).padStart(2, "0")}`,
  );
  const block = blocks[seed % blocks.length];
  return { blockId: block.id, score: 0, matchedOn: "fallback" };
}

/**
 * The only way a block leaves this module. Note what it cannot carry: the input
 * string, a house number, a postcode, or a point more precise than the centroid.
 */
export function anonymize(hit: GeocodeHit): ResolvedBlock {
  const block = getBlockById(hit.blockId) ?? allBlocks()[0];
  const radiusM = Math.max(500, Math.round(block.radiusM));
  return {
    blockId: block.id,
    slug: block.slug,
    name: block.name,
    nameEn: block.nameEn,
    city: block.city,
    cityName: block.cityName,
    borough: block.borough,
    centroid: block.centroid,
    radiusM,
    precision: "neighborhood",
    notice:
      hit.matchedOn === "fallback"
        ? "没找到这个地址，先看今天的街区。已定位到街区尺度，不会显示你的门牌。"
        : "已定位到街区尺度，不会显示你的门牌。",
    matchedOn: hit.matchedOn,
  };
}

export function resolveAddress(input: string, today = new Date()): ResolvedBlock {
  const trimmed = input.trim();
  if (!trimmed) return anonymize(fallbackHit(today));
  return anonymize(lookupBlock(trimmed));
}

/** Async path kept for the eventual real geocoder; same anonymisation gate. */
export async function resolveAddressWith(
  input: string,
  geocoder: Geocoder,
  today = new Date(),
): Promise<ResolvedBlock> {
  const hit = await geocoder.lookup(input);
  return anonymize(hit ?? fallbackHit(today));
}

/** Daily challenge: three bookmarks, deterministic per day, narrative-first. */
export function dailyBookmarks(today = new Date(), count = 3) {
  const blocks = allBlocks();
  const daySeed = Math.floor(
    Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86_400_000,
  );
  const items: { slug: string; name: string; borough: string; hook: string; eventId: string; year: number }[] = [];
  for (const block of blocks) {
    const ranked = block.events
      .slice()
      .sort((a, b) => weight(b.kind) - weight(a.kind) || a.year - b.year);
    ranked.forEach((event) => {
      items.push({
        slug: block.slug,
        name: block.name,
        borough: block.borough,
        hook: event.hook,
        eventId: event.id,
        year: event.year,
      });
    });
  }
  const rotated = items
    .map((item, i) => ({ item, k: (daySeed * 31 + i * 17) % 997 }))
    .sort((a, b) => a.k - b.k)
    .map((x) => x.item);
  const picked: typeof items = [];
  const seen = new Set<string>();
  for (const item of rotated) {
    if (seen.has(item.slug) && picked.length < blocks.length) continue;
    picked.push(item);
    seen.add(item.slug);
    if (picked.length >= count) break;
  }
  return picked;
}

function weight(kind: string): number {
  switch (kind) {
    case "vanished":
      return 4;
    case "severed":
      return 3;
    case "reused":
      return 2;
    default:
      return 1;
  }
}
