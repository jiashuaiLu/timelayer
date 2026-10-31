import type { LngLat, Point, Ring } from "@/domain/types";

const M_PER_DEG_LAT = 111_320;

export function metersPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180);
}

/** Local metric offset -> geographic coordinate. */
export function toLngLat(origin: LngLat, p: Point): [number, number] {
  const dLng = p.x / metersPerDegLng(origin.lat);
  const dLat = p.y / M_PER_DEG_LAT;
  return [origin.lng + dLng, origin.lat + dLat];
}

export function toLocal(origin: LngLat, lng: number, lat: number): Point {
  return {
    x: (lng - origin.lng) * metersPerDegLng(origin.lat),
    y: (lat - origin.lat) * M_PER_DEG_LAT,
  };
}

export function rotate(p: Point, deg: number): Point {
  const r = (deg * Math.PI) / 180;
  const c = Math.cos(r);
  const s = Math.sin(r);
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c };
}

export function ringCentroid(ring: Ring): Point {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p.x;
    y += p.y;
  }
  return { x: x / ring.length, y: y / ring.length };
}

export function bbox(points: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}

/**
 * Metres -> card pixels. `height` is the drawing box; aspect is preserved by fitting
 * the shorter axis, which keeps the block from stretching.
 */
export function fitProjection(
  points: Point[],
  box: { x: number; y: number; w: number; h: number },
  pad = 0,
): (p: Point) => Point {
  const b = bbox(points);
  const w = Math.max(1, b.maxX - b.minX);
  const h = Math.max(1, b.maxY - b.minY);
  const scale = Math.min((box.w - pad * 2) / w, (box.h - pad * 2) / h);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return (p: Point) => ({
    x: box.x + box.w / 2 + (p.x - cx) * scale,
    y: box.y + box.h / 2 - (p.y - cy) * scale,
  });
}

export function polylinePath(points: Point[]): string {
  if (!points.length) return "";
  return points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(" ");
}

/** Chaikin smoothing — used for streets so plans read as drawn, not drafted. */
export function smooth(points: Point[], iterations = 2): Point[] {
  let pts = points;
  for (let k = 0; k < iterations; k += 1) {
    if (pts.length < 3) return pts;
    const next: Point[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i += 1) {
      const a = pts[i];
      const b = pts[i + 1];
      next.push({ x: a.x * 0.75 + b.x * 0.25, y: a.y * 0.75 + b.y * 0.25 });
      next.push({ x: a.x * 0.25 + b.x * 0.75, y: a.y * 0.25 + b.y * 0.75 });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export function pointInPolygon(p: Point, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const a = ring[i];
    const b = ring[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) {
      inside = !inside;
    }
  }
  return inside;
}

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function distanceM(a: LngLat, b: LngLat): number {
  const dx = (a.lng - b.lng) * metersPerDegLng((a.lat + b.lat) / 2);
  const dy = (a.lat - b.lat) * M_PER_DEG_LAT;
  return Math.hypot(dx, dy);
}
