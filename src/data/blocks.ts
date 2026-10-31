import type {
  Block,
  Building,
  ChangeEvent,
  Point,
  Ring,
  Slice,
  Street,
  UseKind,
} from "@/domain/types";
import { pointInPolygon, rotate, ringCentroid } from "@/lib/geo";
import { Rng } from "@/lib/rng";
import type { BlockPlan, LandmarkPlan, StreetPlan } from "./plans";
import { PLANS } from "./plans";

/** A gap wider than this is drawn as a gap, never smoothed over. */
export const GAP_YEARS = 25;

function segmentDistance(p: Point, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const wx = p.x - a.x;
  const wy = p.y - a.y;
  const len2 = vx * vx + vy * vy || 1;
  const t = Math.max(0, Math.min(1, (wx * vx + wy * vy) / len2));
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

function rectRing(center: Point, w: number, h: number, rng: Rng, notch: boolean): Ring {
  const x0 = center.x - w / 2;
  const x1 = center.x + w / 2;
  const y0 = center.y - h / 2;
  const y1 = center.y + h / 2;
  const ring: Ring = [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
  if (notch) {
    const k = rng.int(0, 3);
    const step = rng.range(1.6, 3.4);
    const p = ring[k];
    const ax = (k + 3) % 4;
    const bx = (k + 1) % 4;
    const inA = ring[ax];
    const inB = ring[bx];
    // pull one corner along both edges -> a slight step, so the block isn't all boxes
    const nx = { x: p.x + Math.sign(inA.x - p.x) * step, y: p.y + Math.sign(inB.y - p.y) * step };
    ring.splice(k + 1, 0, { x: nx.x, y: p.y }, { x: nx.x, y: nx.y });
  }
  return ring;
}

interface Lot {
  ring: Ring;
  tStart: number;
  tEnd: number | null;
  use: UseKind;
}

function pickUse(plan: BlockPlan, rng: Rng): UseKind {
  if (plan.slug.startsWith("crosby")) {
    const r = rng.float();
    if (r < 0.34) return "loft";
    if (r < 0.58) return "tenement";
    if (r < 0.78) return "factory";
    if (r < 0.92) return "store";
    return "rowhouse";
  }
  const r = rng.float();
  if (r < 0.62) return "rowhouse";
  if (r < 0.82) return "store";
  if (r < 0.93) return "tenement";
  return "garage";
}

function buildFabric(
  plan: BlockPlan,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
  inset: { left: number; right: number; bottom: number; top: number },
  cellIndex: number,
  rng: Rng,
): { buildings: Building[]; lots: Lot[] } {
  const buildings: Building[] = [];
  const lots: Lot[] = [];

  const ax0 = x0 + inset.left + 3;
  const ax1 = x1 - inset.right - 3;
  const ay0 = y0 + inset.bottom + 3;
  const ay1 = y1 - inset.top - 3;
  if (ax1 - ax0 < 18 || ay1 - ay0 < 18) return { buildings, lots };

  const pushRow = (a: Point, b: Point, normal: Point, row: number) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 12) return;
    const dir = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
    let t = 0;
    let k = 0;
    while (t < len - 7) {
      const w = rng.range(7, 13.5);
      if (t + w > len - 2) break;
      const gap = rng.range(0, 1.6);
      const depth = rng.range(15, 21.5);
      const s = t;
      // 8% of lots are simply never built on
      if (rng.chance(0.08)) {
        t += w + gap;
        k += 1;
        continue;
      }
      const p0 = { x: a.x + dir.x * s, y: a.y + dir.y * s };
      const p1 = { x: a.x + dir.x * (s + w), y: a.y + dir.y * (s + w) };
      const d0 = { x: p0.x + normal.x * depth, y: p0.y + normal.y * depth };
      const d1 = { x: p1.x + normal.x * depth, y: p1.y + normal.y * depth };
      const ring: Ring = [p0, p1, d1, d0];

      let tStart = rng.int(plan.era.from, plan.era.to);
      if (rng.chance(0.12)) tStart = rng.int(1948, 2009);
      let tEnd: number | null = null;
      if (tStart < 1945 && rng.chance(0.07)) {
        const candidate = rng.int(1946, 2012);
        if (candidate > tStart + 25) tEnd = candidate;
      }
      const use = pickUse(plan, rng);
      lots.push({ ring, tStart, tEnd, use });
      buildings.push({
        id: `f-${cellIndex}-${row}-${k}`,
        ring,
        tStart,
        tEnd,
        use,
        role: "fabric",
      });
      t += w + gap;
      k += 1;
    }
  };

  // south + north frontages
  pushRow({ x: ax0 + 4, y: ay0 }, { x: ax1 - 4, y: ay0 }, { x: 0, y: 1 }, 0);
  pushRow({ x: ax1 - 4, y: ay1 }, { x: ax0 + 4, y: ay1 }, { x: 0, y: -1 }, 1);
  // west + east frontages
  pushRow({ x: ax0, y: ay1 - 6 }, { x: ax0, y: ay0 + 6 }, { x: 1, y: 0 }, 2);
  pushRow({ x: ax1, y: ay0 + 6 }, { x: ax1, y: ay1 - 6 }, { x: -1, y: 0 }, 3);

  return { buildings, lots };
}

function landmarkBuilding(lm: LandmarkPlan, rng: Rng): Building {
  return {
    id: lm.id,
    ring: rectRing(lm.center, lm.size.w, lm.size.h, rng, false),
    tStart: lm.built,
    tEnd: lm.demolished ?? null,
    use: lm.use,
    role: "landmark",
    name: lm.name,
    reuse: lm.reuse,
    eventId: lm.demolished ? undefined : undefined,
  };
}

function compileStreet(s: StreetPlan): Street {
  return {
    id: s.id,
    name: s.name,
    nameZh: s.nameZh,
    line: s.line,
    width: s.width,
    kind: s.kind,
    lifespan: s.lifespan,
    severedBy: s.severedBy,
  };
}

function compileSlices(raw: BlockPlan["slices"]): Slice[] {
  const sorted = raw.slice().sort((a, b) => a.year - b.year);
  return sorted.map((s, i) => {
    const prev = sorted[i - 1];
    const years = prev ? s.year - prev.year : 0;
    return {
      year: s.year,
      type: s.type,
      label: s.label,
      source: s.source,
      fullCoverage: s.fullCoverage ?? true,
      gapBefore: prev && years > GAP_YEARS ? { from: prev.year, to: s.year, years } : null,
    };
  });
}

export function compileBlock(plan: BlockPlan): Block {
  const rng = new Rng(plan.slug);
  const gridV = plan.streets
    .filter((s) => s.kind !== "lane" && s.line[0].x === s.line[1].x)
    .sort((a, b) => a.line[0].x - b.line[0].x);
  const gridH = plan.streets
    .filter((s) => s.kind !== "lane" && s.line[0].y === s.line[1].y)
    .sort((a, b) => a.line[0].y - b.line[0].y);

  const buildings: Building[] = [];
  let cellIndex = 0;
  for (let i = 0; i < gridV.length - 1; i += 1) {
    for (let j = 0; j < gridH.length - 1; j += 1) {
      const left = gridV[i];
      const right = gridV[i + 1];
      const bottom = gridH[j];
      const top = gridH[j + 1];
      const { buildings: cellBuildings } = buildFabric(
        plan,
        left.line[0].x,
        right.line[0].x,
        bottom.line[0].y,
        top.line[0].y,
        {
          left: left.width / 2,
          right: right.width / 2,
          bottom: bottom.width / 2,
          top: top.width / 2,
        },
        cellIndex,
        rng,
      );
      buildings.push(...cellBuildings);
      cellIndex += 1;
    }
  }

  // landmarks punch a hole in the fabric and then occupy it
  const landmarkRings = new Map<string, Ring>();
  for (const lm of plan.landmarks) {
    const ring = rectRing(lm.center, lm.size.w + 6, lm.size.h + 6, rng, false);
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      if (pointInPolygon(ringCentroid(buildings[i].ring), ring)) buildings.splice(i, 1);
    }
  }
  for (const lm of plan.landmarks) {
    const b = landmarkBuilding(lm, rng);
    landmarkRings.set(lm.id, b.ring);
    buildings.push(b);
  }

  const streets = plan.streets.map(compileStreet);

  // a severed street also severs whatever was standing in its corridor
  for (const s of streets) {
    if (!s.lifespan) continue;
    const [a, b] = s.line;
    const corridor = s.width / 2 + 5;
    for (let i = buildings.length - 1; i >= 0; i -= 1) {
      const building = buildings[i];
      if (building.role === "landmark") continue;
      const c = ringCentroid(building.ring);
      if (segmentDistance(c, a, b) < corridor) buildings.splice(i, 1);
    }
  }

  const events: ChangeEvent[] = plan.events.map((e) => {
    const lm = plan.landmarks.find((l) => l.id === e.landmarkId);
    const anchor = e.anchor ?? (lm ? lm.center : { x: 0, y: 0 });
    const buildingId = e.landmarkId ?? streets.find((s) => s.name === e.facts.street)?.id;
    return {
      id: e.id,
      kind: e.kind,
      year: e.year,
      buildingId,
      anchor,
      label: e.label,
      fact: e.fact,
      hook: e.hook,
      story: e.story,
      source: e.source,
      provenance: e.provenance,
      facts: e.facts,
    };
  });

  // one rotation, applied to everything at the end
  const rot = (p: Point) => rotate(p, plan.rotation);
  const rotRing = (r: Ring) => r.map(rot);

  const finalStreets = streets.map((s) => ({ ...s, line: s.line.map(rot) }));
  const finalBuildings = buildings.map((b) => ({ ...b, ring: rotRing(b.ring) }));
  const finalEvents = events.map((e) => ({ ...e, anchor: rot(e.anchor) }));

  const xs: number[] = [];
  const ys: number[] = [];
  for (const b of finalBuildings) {
    for (const p of b.ring) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  for (const s of finalStreets) {
    for (const p of s.line) {
      xs.push(p.x);
      ys.push(p.y);
    }
  }
  const extent = Math.max(
    Math.max(...xs.map(Math.abs)),
    Math.max(...ys.map(Math.abs)),
  );

  return {
    id: plan.id,
    slug: plan.slug,
    name: plan.name,
    nameEn: plan.nameEn,
    city: plan.city,
    cityName: plan.cityName,
    cityNameEn: plan.cityNameEn,
    borough: plan.borough,
    centroid: { lng: plan.centroid.lng, lat: plan.centroid.lat },
    radiusM: plan.radiusM,
    aliases: plan.aliases,
    slices: compileSlices(plan.slices),
    events: finalEvents,
    hookLine: plan.hookLine,
    paper: plan.paper,
    commonsCategory: plan.commonsCategory,
    streets: finalStreets,
    buildings: finalBuildings,
    extent: Math.ceil(extent / 20) * 20 + 20,
  };
}

let cache: Block[] | null = null;

export function allBlocks(): Block[] {
  if (!cache) cache = PLANS.map(compileBlock);
  return cache;
}

export function getBlock(slug: string): Block | undefined {
  return allBlocks().find((b) => b.slug === slug);
}

export function getBlockById(id: string): Block | undefined {
  return allBlocks().find((b) => b.id === id);
}
