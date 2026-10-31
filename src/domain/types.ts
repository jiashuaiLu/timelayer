/**
 * TimeLayer — domain vocabulary.
 *
 * Two rules encoded here, not just documented:
 *  1. There is no `houseNumber` / `streetAddress` field anywhere a client can read.
 *     Address resolution only ever produces a `ResolvedBlock` (neighbourhood scale).
 *  2. Geometry is authored in a local metric frame (metres east / north of the block
 *     centroid). Nothing leaves the pipeline in that frame; renders project it.
 */

export type LngLat = { lng: number; lat: number };
export type Point = { x: number; y: number };
export type Ring = Point[];

export type CityId = "nyc" | "ldn";

export type UseKind =
  | "rowhouse"
  | "tenement"
  | "loft"
  | "factory"
  | "theatre"
  | "rink"
  | "garage"
  | "store"
  | "tower"
  | "civic";

export type ChangeKind = "vanished" | "appeared" | "reused" | "severed";

/** How much we actually know. Drives the visual language of honesty. */
export type Provenance = "archive" | "inferred" | "demo";

export type SliceType = "map" | "aerial" | "photo" | "street";

export interface Slice {
  year: number;
  type: SliceType;
  /** Chinese label for the viewfinder, e.g. "保险地图" */
  label: string;
  source: string;
  /** false when the layer only covers part of the block */
  fullCoverage: boolean;
  /** years between the previous slice and this one, when that gap is too wide to interpolate */
  gapBefore: { from: number; to: number; years: number } | null;
}

export interface Street {
  id: string;
  name: string;
  nameZh?: string;
  /** centreline in local metres */
  line: Point[];
  width: number;
  kind: "avenue" | "street" | "lane";
  /** a street that was cut: it exists only inside [from, to] */
  lifespan?: { from: number; to: number };
  /** why it was cut — surfaces as a trace, never as a modal */
  severedBy?: string;
}

export interface Building {
  id: string;
  ring: Ring;
  tStart: number;
  tEnd: number | null;
  use: UseKind;
  role: "fabric" | "landmark";
  name?: string;
  /** landmark whose disappearance / arrival is narratable */
  eventId?: string;
  reuse?: { year: number; use: UseKind; label: string };
}

export interface ChangeEvent {
  id: string;
  kind: ChangeKind;
  year: number;
  buildingId?: string;
  /** local metres — where the archive slip points */
  anchor: Point;
  /** short, factual, no interpretation */
  label: string;
  /** the structured fact the rule engine is allowed to use */
  fact: string;
  /** 8 characters or fewer — used on the daily bookmark */
  hook: string;
  /** editorial weight, chosen by a human: which story deserves the card */
  story?: number;
  source: string;
  provenance: Provenance;
  /** extra structured facts for templates */
  facts: {
    subject: string;
    from?: string;
    to?: string;
    yearsLater?: number;
    street?: string;
  };
}

export interface BlockGeometry {
  streets: Street[];
  buildings: Building[];
  /** local metres, half-extent of the drawn plan */
  extent: number;
}

export interface Block extends BlockGeometry {
  id: string;
  slug: string;
  name: string;
  nameEn: string;
  city: CityId;
  cityName: string;
  cityNameEn: string;
  borough: string;
  centroid: LngLat;
  /** privacy radius, always > 500m (see risk table) */
  radiusM: number;
  aliases: string[];
  slices: Slice[];
  events: ChangeEvent[];
  /** one-line promise shown on the bookmark */
  hookLine: string;
  /** paper colour token */
  paper: "warm" | "cool";
}

/** What M1 is allowed to return. Note the absence of any door-level field. */
export interface ResolvedBlock {
  blockId: string;
  slug: string;
  name: string;
  nameEn: string;
  city: CityId;
  cityName: string;
  borough: string;
  centroid: LngLat;
  radiusM: number;
  precision: "neighborhood";
  /** human-readable note for the 600ms "location breath" */
  notice: string;
  /** how the match was made — useful in tests, harmless in the UI */
  matchedOn: "alias" | "coordinate" | "fallback";
}

export type NarrativeProvenance = "archive" | "demo" | "inferred";

export interface Narrative {
  eventId: string;
  text: string;
  source: string;
  provenance: NarrativeProvenance;
  polished: boolean;
  kind: ChangeKind;
  year: number;
  buildingId?: string;
  anchor: Point;
}

export interface CardScene {
  block: Block;
  oldYear: number;
  newYear: number;
  /** normalised 0..1 coordinates in card space, y down */
  streets: { d: string; width: number }[];
  oldBuildings: string[];
  newBuildings: string[];
  crack: string;
  /** building rings that vanished between old and new — drawn as ghosts */
  ghosts: string[];
  verdict: string;
  visited: { from: number; to: number };
  scenes: number;
}
