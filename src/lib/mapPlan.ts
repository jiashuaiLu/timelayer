import type { Map as MapLibreMap, FilterSpecification, ExpressionSpecification } from "maplibre-gl";
import type { Block, Building } from "@/domain/types";
import { toLngLat } from "@/lib/geo";
import { Rng } from "@/lib/rng";

export const PAPER = "#E6DFD3";
export const INK = "#26221C";
export const CARMINE = "#B5493A";
export const COPPER = "#7A8B6F";

export const END_OF_TIME = 9999;

export type Slot = "a" | "b";

export interface PlanHandles {
  /** geometry of a given year into a slot */
  fillSlot(slot: Slot, year: number): void;
  /** opacity of a slot's ink, 0..1 */
  setSlotOpacity(slot: Slot, value: number): void;
  /** traces follow the continuous year under the viewfinder */
  setTraceYear(year: number, prevYear: number): void;
  buildingAt(point: { x: number; y: number }): { id: string; ev: string } | null;
  streetAt(point: { x: number; y: number }): { id: string; ev: string } | null;
  destroy(): void;
}

function jitter(ring: { x: number; y: number }[], seed: string, amount = 0.45) {
  const rng = new Rng(seed);
  return ring.map((p) => ({
    x: p.x + rng.range(-amount, amount),
    y: p.y + rng.range(-amount, amount),
  }));
}

function closedRing(ring: { x: number; y: number }[], origin: Block["centroid"]) {
  const coords = ring.map((p) => toLngLat(origin, p));
  coords.push(coords[0]);
  return coords;
}

export function buildingsGeoJSON(block: Block) {
  const features = block.buildings.map((b) => ({
    type: "Feature" as const,
    id: hashId(b.id),
    properties: {
      id: b.id,
      use: b.use,
      role: b.role,
      name: b.name ?? "",
      t_start: b.tStart,
      t_end: b.tEnd ?? END_OF_TIME,
      reuse_year: b.reuse?.year ?? 0,
      ev: eventOfBuilding(block, b),
    },
    geometry: {
      type: "Polygon" as const,
      coordinates: [closedRing(jitter(b.ring, b.id), block.centroid)],
    },
  }));
  return { type: "FeatureCollection" as const, features };
}

function eventOfBuilding(block: Block, b: Building): string {
  if (b.role !== "landmark") return "";
  const ev = block.events.find((e) => e.buildingId === b.id);
  return ev?.id ?? "";
}

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Streets get a faint hand-drawn wobble so the plan reads as inked, not extruded. */
function streetPath(block: Block, line: { x: number; y: number }[], seed: string) {
  const rng = new Rng(seed);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < line.length - 1; i += 1) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    for (let s = 0; s < 3; s += 1) {
      const t = s / 3;
      const off = rng.range(-0.9, 0.9);
      pts.push({ x: a.x + dx * t + nx * off, y: a.y + dy * t + ny * off });
    }
  }
  pts.push(line[line.length - 1]);
  return pts.map((p) => toLngLat(block.centroid, p));
}

export function streetsGeoJSON(block: Block) {
  const features = block.streets.map((s) => ({
    type: "Feature" as const,
    id: hashId(s.id),
    properties: {
      id: s.id,
      name: s.name,
      name_zh: s.nameZh ?? "",
      kind: s.kind,
      width: s.width,
      from: s.lifespan?.from ?? 0,
      to: s.lifespan?.to ?? END_OF_TIME,
      severed_by: s.severedBy ?? "",
      ev: block.events.find((e) => e.buildingId === s.id)?.id ?? "",
    },
    geometry: {
      type: "LineString" as const,
      coordinates: streetPath(block, s.line, s.id),
    },
  }));
  return { type: "FeatureCollection" as const, features };
}

export function baseStyle() {
  return {
    version: 8 as const,
    sources: {},
    layers: [
      {
        id: "paper",
        type: "background" as const,
        paint: { "background-color": PAPER },
      },
    ],
  };
}

function makePattern(kind: "hatch" | "dots"): ImageData {
  const size = 12;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  if (kind === "hatch") {
    ctx.strokeStyle = "rgba(38,34,28,0.55)";
    ctx.lineWidth = 1;
    for (let i = -size; i < size * 2; i += 5) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + size, size);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(122,139,111,0.85)";
    for (let x = 2; x < size; x += 5) {
      for (let y = 2; y < size; y += 5) {
        ctx.beginPath();
        ctx.arc(x, y, 0.9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  return ctx.getImageData(0, 0, size, size);
}

const fillFilter = (year: number): FilterSpecification =>
  [
    "all",
    ["<=", ["get", "t_start"], year],
    ["any", ["==", ["get", "t_end"], END_OF_TIME], [">", ["get", "t_end"], year]],
  ] as unknown as FilterSpecification;

export function addPlanLayers(
  map: MapLibreMap,
  block: Block,
  initialYear: number,
): PlanHandles {
  const buildings = buildingsGeoJSON(block);
  const streets = streetsGeoJSON(block);

  if (!map.getSource("plan-buildings")) {
    map.addSource("plan-buildings", { type: "geojson", data: buildings as never });
  }
  if (!map.getSource("plan-streets")) {
    map.addSource("plan-streets", { type: "geojson", data: streets as never });
  }

  if (!map.hasImage("hatch")) map.addImage("hatch", makePattern("hatch"));
  if (!map.hasImage("hatch-copper")) map.addImage("hatch-copper", makePattern("dots"));

  // street bed first, then ink
  map.addLayer({
    id: "street-bed",
    type: "line",
    source: "plan-streets",
    layout: { "line-cap": "round", "line-join": "round" },
    paint: {
      "line-color": "#E2DAC9",
      "line-width": [
        "interpolate",
        ["linear"],
        ["zoom"],
        14,
        ["*", ["get", "width"], 0.55],
        19,
        ["*", ["get", "width"], 1.5],
      ],
    },
  });

  const streetInk: ExpressionSpecification = [
    "interpolate",
    ["linear"],
    ["zoom"],
    14,
    ["*", ["get", "width"], 0.12],
    19,
    ["*", ["get", "width"], 0.34],
  ] as unknown as ExpressionSpecification;

  map.addLayer({
    id: "street-ink",
    type: "line",
    source: "plan-streets",
    layout: { "line-cap": "round", "line-join": "round" },
    filter: ["any", ["==", ["get", "to"], END_OF_TIME], [">", ["get", "to"], initialYear]] as never,
    paint: {
      "line-color": "rgba(38,34,28,0.34)",
      "line-width": streetInk,
    },
  });

  // the cut itself stays on the sheet as a dashed scar
  map.addLayer({
    id: "street-severed",
    type: "line",
    source: "plan-streets",
    layout: { "line-cap": "butt" },
    filter: ["<=", ["get", "to"], initialYear] as never,
    paint: {
      "line-color": "rgba(181,73,58,0.42)",
      "line-width": 1.1,
      "line-dasharray": [2, 3],
    },
  });

  for (const slot of ["a", "b"] as Slot[]) {
    map.addLayer({
      id: `bld-fill-${slot}`,
      type: "fill",
      source: "plan-buildings",
      filter: fillFilter(initialYear),
      paint: {
        "fill-color": "#26221C",
        "fill-opacity": [
          "case",
          ["==", ["get", "role"], "landmark"],
          0.1,
          ["case", ["==", ["get", "use"], "civic"], 0.04, 0.055],
        ] as never,
      },
    });
    map.addLayer({
      id: `bld-line-${slot}`,
      type: "line",
      source: "plan-buildings",
      filter: fillFilter(initialYear),
      paint: {
        "line-color": "rgba(38,34,28,0.5)",
        "line-width": ["case", ["==", ["get", "role"], "landmark"], 1.15, 0.75] as never,
      },
    });
  }

  map.setPaintProperty("bld-fill-b", "fill-opacity", 0);
  map.setPaintProperty("bld-line-b", "line-opacity", 0);

  map.addLayer({
    id: "gone",
    type: "fill",
    source: "plan-buildings",
    filter: ["all", [">", ["get", "t_end"], 0], ["<", ["get", "t_end"], initialYear], ["<", ["get", "t_end"], END_OF_TIME]] as never,
    paint: {
      "fill-pattern": "hatch",
      "fill-opacity": 0.22,
    },
  });
  map.addLayer({
    id: "gone-line",
    type: "line",
    source: "plan-buildings",
    filter: ["all", [">", ["get", "t_end"], 0], ["<", ["get", "t_end"], initialYear], ["<", ["get", "t_end"], END_OF_TIME]] as never,
    paint: {
      "line-color": "rgba(181,73,58,0.55)",
      "line-width": 1,
      "line-dasharray": [2.4, 2.4],
    },
  });

  map.addLayer({
    id: "new-line",
    type: "line",
    source: "plan-buildings",
    filter: ["all", [">", ["get", "t_start"], initialYear], ["<=", ["get", "t_start"], initialYear]] as never,
    paint: {
      "line-color": "rgba(122,139,111,0.9)",
      "line-width": 1.4,
      "line-opacity": 0,
      "line-dasharray": [3, 2],
    },
  });

  map.addLayer({
    id: "reuse",
    type: "fill",
    source: "plan-buildings",
    filter: ["all", [">", ["get", "reuse_year"], 0], ["<=", ["get", "reuse_year"], initialYear]] as never,
    paint: { "fill-pattern": "hatch-copper", "fill-opacity": 0.3 },
  });

  const state = { slot: "a" as Slot, activeYear: initialYear };

  const handlers: PlanHandles = {
    fillSlot(slot, year) {
      map.setFilter(`bld-fill-${slot}`, fillFilter(year));
      map.setFilter(`bld-line-${slot}`, fillFilter(year));
      state.activeYear = year;
      state.slot = slot;
    },
    setSlotOpacity(slot, value) {
      map.setPaintProperty(`bld-fill-${slot}`, "fill-opacity", [
        "case",
        ["==", ["get", "role"], "landmark"],
        0.1 * value,
        ["case", ["==", ["get", "use"], "civic"], 0.04 * value, 0.055 * value],
      ] as never);
      map.setPaintProperty(`bld-line-${slot}`, "line-opacity", value);
    },
    setTraceYear(year, prevYear) {
      const y = Math.round(year);
      const decay: ExpressionSpecification = [
        "max",
        0,
        [
          "min",
          0.5,
          ["-", 0.5, ["*", 0.5, ["/", ["-", y, ["get", "t_end"]], 55]]],
        ],
      ] as unknown as ExpressionSpecification;
      map.setFilter("gone", [
        "all",
        [">", ["get", "t_end"], 0],
        ["<=", ["get", "t_end"], y],
        ["<", ["get", "t_end"], END_OF_TIME],
      ] as never);
      map.setFilter("gone-line", [
        "all",
        [">", ["get", "t_end"], 0],
        ["<=", ["get", "t_end"], y],
        ["<", ["get", "t_end"], END_OF_TIME],
      ] as never);
      map.setPaintProperty("gone", "fill-opacity", decay);
      map.setPaintProperty("gone-line", "line-opacity", decay);
      map.setFilter("new-line", [
        "all",
        [">", ["get", "t_start"], prevYear],
        ["<=", ["get", "t_start"], y],
      ] as never);
      map.setFilter("reuse", [
        "all",
        [">", ["get", "reuse_year"], 0],
        ["<=", ["get", "reuse_year"], y],
      ] as never);
      map.setFilter("street-ink", [
        "any",
        ["==", ["get", "to"], END_OF_TIME],
        [">", ["get", "to"], y],
      ] as never);
      map.setFilter("street-severed", ["<=", ["get", "to"], y] as never);
    },
    buildingAt(point) {
      // ghosts count: an empty lot that used to be a theatre is still the story
      const features = map.queryRenderedFeatures([point.x, point.y], {
        layers: ["bld-fill-a", "bld-fill-b", "gone", "reuse"],
      });
      const f = features.find((x) => x.properties?.ev);
      if (!f) return null;
      return { id: String(f.properties?.id ?? ""), ev: String(f.properties?.ev ?? "") };
    },
    streetAt(point) {
      const features = map.queryRenderedFeatures([point.x, point.y], {
        layers: ["street-ink", "street-severed"],
      });
      const f = features.find((x) => x.properties?.ev);
      if (!f) return null;
      return { id: String(f.properties?.id ?? ""), ev: String(f.properties?.ev ?? "") };
    },
    destroy() {
      // the map is owned by the component; nothing to dispose here
    },
  };

  handlers.setTraceYear(initialYear, initialYear);
  return handlers;
}

export function countChanges(block: Block, year: number, prevYear: number) {
  let gone = 0;
  let fresh = 0;
  for (const b of block.buildings) {
    if (b.tEnd !== null && b.tEnd > prevYear && b.tEnd <= year) gone += 1;
    if (b.tStart > prevYear && b.tStart <= year) fresh += 1;
  }
  return { gone, fresh };
}
