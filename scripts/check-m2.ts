/* M2 acceptance: >=3 slices per block, every slice sourced, gaps marked not interpolated. */
import { allBlocks } from "../src/data/blocks";
import { buildSlices, isGapYear, nearestYear, sliceAt } from "../src/pipeline/slices";

let failures = 0;
for (const block of allBlocks()) {
  const set = buildSlices(block);
  const years = set.slices.map((s) => s.year);
  const sorted = years.every((y, i) => i === 0 || y > years[i - 1]);

  console.log(`\n${block.slug}`);
  console.log(`  slices: ${set.slices.map((s) => `${s.year}:${s.type}`).join("  ")}`);
  console.log(`  gaps:   ${set.gaps.map((g) => `${g.from}→${g.to} (${g.years}y)`).join("  ") || "none"}`);
  console.log(`  coverage: ${set.coverage}/5 eras`);

  if (set.slices.length < 3) (failures += 1), console.error("  ✗ fewer than 3 slices");
  if (!sorted) (failures += 1), console.error("  ✗ slices not strictly sorted");
  if (set.slices.some((s) => !s.source || !s.label)) (failures += 1), console.error("  ✗ slice missing source/label");
  if (set.slices.some((s) => s.gapBefore && s.gapBefore.years <= 25)) (failures += 1), console.error("  ✗ gap flagged too eagerly");

  for (const gap of set.gaps) {
    const mid = Math.round((gap.from + gap.to) / 2);
    if (!isGapYear(block, mid)) (failures += 1), console.error(`  ✗ gap midpoint ${mid} not recognised`);
    const snapped = nearestYear(block, mid);
    if (snapped === mid) (failures += 1), console.error(`  ✗ snapped to interpolated year ${mid}`);
    const at = sliceAt(block, mid);
    if (at.year > mid) (failures += 1), console.error(`  ✗ sliceAt returned a future slice`);
  }
}

if (failures) {
  console.error(`\nM2 FAILED (${failures})`);
  process.exit(1);
}
console.log("\nM2 OK — no fabricated intermediate frames");
