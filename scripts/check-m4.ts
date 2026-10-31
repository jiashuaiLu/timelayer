/* M4 acceptance: >=50 narratives, all schema-valid, all years grounded. */
import { allBlocks } from "../src/data/blocks";
import type { Block, ChangeEvent } from "../src/domain/types";
import {
  buildNarrative,
  buildVerdict,
  draftNarrative,
  extractYears,
  groundingIssues,
  narrativeSchema,
} from "../src/pipeline/narrative";

const blocks = allBlocks();
const narratives = blocks.flatMap((block) =>
  block.events.map((event) => ({ block, event, narrative: buildNarrative(block, event) })),
);

let failures = 0;
for (const { block, event, narrative } of narratives) {
  const parsed = narrativeSchema.safeParse(narrative);
  if (!parsed.success) {
    failures += 1;
    console.error(`✗ ${block.slug}/${event.id}: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }
  if (!narrative.source) {
    failures += 1;
    console.error(`✗ ${block.slug}/${event.id}: empty source`);
  }
  const issues = groundingIssues(block, event, narrative.text);
  if (issues.length) {
    failures += 1;
    console.error(`✗ ${block.slug}/${event.id}: ${issues.join("; ")}`);
  }
  if (narrative.text.length < 60 || narrative.text.length > 200) {
    console.warn(`· ${event.id}: length ${narrative.text.length}`);
  }
}

// volume test: synthetic events through the same rule engine
function synthetic(block: Block, i: number): ChangeEvent {
  const years = block.slices.map((s) => s.year);
  const kind = (["vanished", "appeared", "reused", "severed"] as const)[i % 4];
  return {
    id: `syn-${block.slug}-${i}`,
    kind,
    year: years[i % years.length],
    anchor: { x: 0, y: 0 },
    label: `合成样本 ${i}`,
    fact: "合成样本，用于验证模板与校验",
    hook: "合成样本",
    source: "合成测试",
    provenance: "demo",
    facts: { subject: `样本建筑 ${i}`, from: "仓库", to: "住宅", yearsLater: 20, street: "样本街" },
  };
}

const syntheticNarratives = blocks.flatMap((block) =>
  Array.from({ length: 22 }, (_, i) => {
    const event = synthetic(block, i);
    return { block, event, narrative: buildNarrative(block, event) };
  }),
);

for (const { block, event, narrative } of syntheticNarratives) {
  const parsed = narrativeSchema.safeParse(narrative);
  if (!parsed.success) {
    failures += 1;
    console.error(`✗ synthetic ${event.id}: schema`);
  }
  const issues = groundingIssues(block, event, narrative.text);
  if (issues.length) {
    failures += 1;
    console.error(`✗ synthetic ${event.id}: ${issues.join("; ")}`);
  }
}

const all = [...narratives, ...syntheticNarratives];
console.log(`narratives validated: ${all.length}`);
console.log(`  with archive/demo source: ${all.filter((n) => n.narrative.source).length}`);
console.log(`  inferred (no source): ${all.filter((n) => n.narrative.provenance === "inferred").length}`);

// an unsourced event must be forced into 虚构推演
const orphan: ChangeEvent = {
  ...synthetic(blocks[0], 1),
  id: "orphan",
  source: "",
  provenance: "inferred",
};
const orphanNarrative = buildNarrative(blocks[0], orphan);
if (orphanNarrative.provenance !== "inferred" || !/虚构|推演/.test(orphanNarrative.text)) {
  failures += 1;
  console.error("✗ unsourced narrative not marked 虚构推演");
}

for (const block of blocks) {
  const verdict = buildVerdict(block, block.slices[0].year, block.slices[block.slices.length - 1].year);
  const years = extractYears(verdict);
  if (!verdict || years.some((y) => y < 1700 || y > 2100)) {
    failures += 1;
    console.error(`✗ verdict for ${block.slug}: ${verdict}`);
  }
  console.log(`  verdict ${block.slug}: ${verdict}`);
}

if (failures || all.length < 50) {
  console.error(`\nM4 FAILED (${failures})`);
  process.exit(1);
}
console.log("\nM4 OK — every claim carries a source or an explicit 虚构推演 tag");
