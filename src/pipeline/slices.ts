import type { Block, Slice } from "@/domain/types";
import { GAP_YEARS } from "@/data/blocks";

/**
 * M2 — slice discovery.
 *
 * A slice list is only allowed to contain years we actually have material for.
 * `gapBefore` is the machine-readable form of "we don't know this stretch"; the
 * ruler renders it as a dashed void and the playback never interpolates across it.
 */

export interface GapSpan {
  from: number;
  to: number;
  years: number;
  note: string;
}

export interface SliceSet {
  blockId: string;
  year: number;
  slices: Slice[];
  gaps: GapSpan[];
  /** how many of the five canonical eras are covered */
  coverage: number;
  warnings: string[];
}

const CANONICAL = [1920, 1950, 1980, 2000, 2026];

/** "now" is whatever the newest map slice claims to be — not the wall clock. */
export function currentYear(block: Block): number {
  return block.slices.reduce((max, s) => Math.max(max, s.year), 0);
}

export function buildSlices(block: Block): SliceSet {
  const slices = block.slices
    .slice()
    .sort((a, b) => a.year - b.year)
    .filter((s, i, arr) => i === 0 || s.year !== arr[i - 1].year);

  const warnings: string[] = [];
  if (slices.length < 3) warnings.push(`only ${slices.length} slices for ${block.slug}`);

  const gaps: GapSpan[] = [];
  for (let i = 1; i < slices.length; i += 1) {
    const years = slices[i].year - slices[i - 1].year;
    if (years > GAP_YEARS) {
      gaps.push({
        from: slices[i - 1].year,
        to: slices[i].year,
        years,
        note: `这 ${years} 年没有留下可用的街区记录`,
      });
    }
  }

  const coverage = CANONICAL.filter((era) =>
    slices.some((s) => Math.abs(s.year - era) <= 30),
  ).length;

  return { blockId: block.id, year: currentYear(block), slices, gaps, coverage, warnings };
}

export function sliceYears(block: Block): number[] {
  return block.slices.map((s) => s.year).sort((a, b) => a - b);
}

/** largest slice year <= year (the honest "what we know at this moment") */
export function sliceAt(block: Block, year: number): Slice {
  const sorted = block.slices.slice().sort((a, b) => a.year - b.year);
  let found = sorted[0];
  for (const s of sorted) {
    if (s.year <= year) found = s;
  }
  return found;
}

export function nearestYear(block: Block, year: number): number {
  const years = sliceYears(block);
  let best = years[0];
  for (const y of years) {
    if (Math.abs(y - year) < Math.abs(best - year)) best = y;
  }
  return best;
}

export function nextYear(block: Block, year: number): number | null {
  const years = sliceYears(block);
  return years.find((y) => y > year) ?? null;
}

export function prevYear(block: Block, year: number): number | null {
  const years = sliceYears(block).slice().reverse();
  return years.find((y) => y < year) ?? null;
}

export function isGapYear(block: Block, year: number): boolean {
  return buildSlices(block).gaps.some((g) => year > g.from && year < g.to);
}

/** The gap crossed when moving between two adjacent slice years, if any. */
export function gapBetween(block: Block, from: number, to: number): GapSpan | null {
  const gaps = buildSlices(block).gaps;
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  return gaps.find((g) => g.from >= lo && g.to <= hi) ?? null;
}
