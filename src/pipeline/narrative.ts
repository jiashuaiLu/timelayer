import { z } from "zod";
import type { Block, ChangeEvent, ChangeKind, Narrative, NarrativeProvenance } from "@/domain/types";
import { buildSlices } from "./slices";

/**
 * M4 — narrative layer.
 *
 * The rule engine owns the facts. The LLM (when a key is present) may only rewrite
 * the sentence; every number it emits is checked against the structured facts before
 * it is allowed onto the screen. No source -> forced "虚构推演".
 */

const KINDS = ["vanished", "appeared", "reused", "severed"] as const;
const PROVENANCE = ["archive", "demo", "inferred"] as const;

export const narrativeSchema = z
  .object({
    eventId: z.string().min(1),
    text: z.string().min(40, "叙述太短").max(220, "叙述太长"),
    source: z.string(),
    provenance: z.enum(PROVENANCE),
    polished: z.boolean(),
    kind: z.enum(KINDS),
    year: z.number().int(),
    buildingId: z.string().optional(),
    anchor: z.object({ x: z.number(), y: z.number() }),
  })
  .superRefine((value, ctx) => {
    if (!value.source.trim() && value.provenance !== "inferred") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "无来源的叙述必须标记为虚构推演",
        path: ["provenance"],
      });
    }
    if (value.provenance === "inferred" && !/虚构|推演/.test(value.text)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "虚构叙述必须在文本中显式声明",
        path: ["text"],
      });
    }
  });

type Building = Block["buildings"][number];

function buildingOf(block: Block, event: ChangeEvent): Building | undefined {
  return block.buildings.find((b) => b.id === event.buildingId);
}

function ageOf(block: Block, event: ChangeEvent): number | null {
  const b = buildingOf(block, event);
  if (!b) return null;
  return Math.max(0, event.year - b.tStart);
}

function coverageNote(block: Block, event: ChangeEvent): string {
  const gaps = buildSlices(block).gaps.filter((g) => g.from >= event.year);
  if (!gaps.length) return "";
  const gap = gaps[0];
  return `此后的记录断在 ${gap.from}–${gap.to} 之间，${gap.years} 年没有新图。`;
}

/** The last year we can actually look at — quoted so the reader knows where "now" stops. */
function lastSliceYear(block: Block): number {
  return block.slices.reduce((m, s) => Math.max(m, s.year), 0);
}

/** Template selection is rule-based and inspectable — that is the point. */
export function draftNarrative(block: Block, event: ChangeEvent): string {
  const f = event.facts;
  const building = buildingOf(block, event);
  const age = ageOf(block, event);
  const place = f.street ?? "这条街";
  const gap = coverageNote(block, event);
  const last = lastSliceYear(block);

  switch (event.kind) {
    case "vanished": {
      const years = age ? `它作为${f.from ?? "房子"}存在了 ${age} 年，` : "";
      return `${event.year} 年，${f.subject}从${place}上消失。${years}${event.year} 年之后此地改为${f.to ?? "新的用途"}。${gap}此后到 ${last} 年的切片里，原址只剩一圈虚线——这是我们在图上还能指认的全部。`;
    }
    case "appeared": {
      return `${event.year} 年，${f.subject}在这块地上落成，此前它是${f.from ?? "空地"}。它不是从旧墙里改出来的，地基重新打过。${gap}到 ${last} 年的切片，它仍在原地，是这一段街面上最晚出现的一栋。`;
    }
    case "reused": {
      const years = age ? `距它建成已经 ${age} 年。` : "";
      return `${event.year} 年，同一圈外墙被重新使用：${f.from ?? "旧用途"}改成了${f.to ?? "新用途"}。${years}立面没有拆，只换了门头、招牌和进出的那批人。${gap}到 ${last} 年的切片，轮廓仍与 ${building?.tStart ?? event.year} 年对得上。`;
    }
    case "severed": {
      const street = f.street ?? "这条街";
      const by = block.streets.find((s) => s.name === street)?.severedBy ?? "道路工程";
      return `${event.year} 年，${street} 被${by}切断。路基还在，但路口不再对齐，剩下的那一段成了断头巷。${gap}到 ${last} 年的切片上，这个缺口一直保留着，像地图被折过一道。`;
    }
    default:
      return event.fact;
  }
}

export function buildNarrative(
  block: Block,
  event: ChangeEvent,
  options: { text?: string; polished?: boolean } = {},
): Narrative {
  const text = (options.text ?? draftNarrative(block, event)).trim();
  let provenance: NarrativeProvenance =
    event.provenance === "archive" ? "archive" : event.provenance === "demo" ? "demo" : "inferred";
  let source = event.source.trim();
  if (!source) {
    provenance = "inferred";
    source = "无来源";
  }
  const candidate: Narrative = {
    eventId: event.id,
    text: provenance === "inferred" && !/虚构|推演/.test(text) ? `${text}（虚构推演，无档案支撑）` : text,
    source,
    provenance,
    polished: options.polished ?? false,
    kind: event.kind,
    year: event.year,
    buildingId: event.buildingId,
    anchor: event.anchor,
  };
  return narrativeSchema.parse(candidate);
}

export function narrativesFor(block: Block): Narrative[] {
  return block.events
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((e) => buildNarrative(block, e));
}

export function narrativeFor(block: Block, eventId: string): Narrative | null {
  const event = block.events.find((e) => e.id === eventId);
  return event ? buildNarrative(block, event) : null;
}

/** Years are the one thing an LLM loves to invent. We check every one of them. */
export function extractYears(text: string): number[] {
  return Array.from(text.matchAll(/\b(1[6-9]\d{2}|20\d{2})\b/g)).map((m) => Number(m[1]));
}

export function groundingIssues(block: Block, event: ChangeEvent, text: string): string[] {
  const allowed = new Set<number>([
    event.year,
    ...block.slices.map((s) => s.year),
    ...(buildingOf(block, event) ? [buildingOf(block, event)!.tStart] : []),
    ...(buildingOf(block, event)?.tEnd ? [buildingOf(block, event)!.tEnd!] : []),
  ]);
  const issues: string[] = [];
  for (const year of extractYears(text)) {
    if (!allowed.has(year)) issues.push(`未在事实清单中的年份：${year}`);
  }
  return issues;
}

export const POLISH_RULES = `你在为一份街区档案润色叙述。
硬性要求：
1. 只允许改写措辞，不得引入任何新的事实、因果或评价。
2. 保留原文中所有年份、人名、建筑名与用途词。
3. 长度 90–150 个汉字，陈述句，不用感叹号，不用"见证了""承载着"这类套话。
4. 不要以"这条街"开头超过一次。
只输出润色后的正文，不要解释。`;

export function buildPolishPrompt(block: Block, event: ChangeEvent, text: string): string {
  return `${POLISH_RULES}

街区：${block.name}（${block.cityName}·${block.borough}）
变化类型：${event.kind}
事实清单：${event.fact}
年份：${event.year}

原文：
${text}`;
}

/* ---------------------------------------------------------------- verdicts */

function weight(kind: ChangeKind): number {
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

export function pickStoryEvent(block: Block, from: number, to: number): ChangeEvent {
  const inRange = block.events.filter((e) => e.year >= from && e.year <= to);
  const pool = inRange.length ? inRange : block.events;
  return pool
    .slice()
    .sort((a, b) => (b.story ?? weight(b.kind)) - (a.story ?? weight(a.kind)) || a.year - b.year)[0];
}

/**
 * The one line printed on the card. Chosen by rules, not by the model — a card that
 * says something untrue is worse than a card that says nothing.
 */
export function buildVerdict(block: Block, from: number, to: number): string {
  const event = pickStoryEvent(block, from, to);
  const f = event.facts;
  const span = Math.max(0, to - event.year);
  switch (event.kind) {
    case "vanished":
      return `${event.year} 年，${f.subject}在这条街上消失；${span} 年后，${f.to ?? "空地"}替它站在这块地上。`;
    case "reused":
      return `同一圈立面，${f.from ?? "旧用途"}在 ${event.year} 年换成了${f.to ?? "新用途"}。`;
    case "severed":
      return `${event.year} 年，${f.street ?? "这条街"}被切断；${span} 年过去，它仍是一条断头巷。`;
    default:
      return `${event.year} 年，${f.subject}从一块${f.from ?? "空地"}上长出来。`;
  }
}

/** Used by the share page and the OG image. */
export function storyHeadline(block: Block): { year: number; hook: string } {
  const event = block.events
    .slice()
    .sort((a, b) => (b.story ?? weight(b.kind)) - (a.story ?? weight(a.kind)))[0];
  return { year: event.year, hook: event.hook };
}
