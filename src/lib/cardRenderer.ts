import type { Block } from "@/domain/types";
import { fitProjection } from "@/lib/geo";
import { Rng } from "@/lib/rng";

export interface CardOptions {
  oldYear: number;
  newYear: number;
  from: number;
  to: number;
  verdict: string;
}

export const CARD_W = 1080;
export const CARD_H = 1440;

const PAPER = "#E6DFD3";
const PAPER_LIGHT = "#EFE9DE";
const INK = "#26221C";
const SOFT = "#6E6253";

const SERIF = '"Noto Serif SC", "Songti SC", Georgia, serif';
const MONO = '"IBM Plex Mono", "SFMono-Regular", monospace';
const DISPLAY = '"Cormorant Garamond", "Noto Serif SC", Georgia, serif';

/** letterspacing is the whole archival voice — canvas needs it drawn by hand */
function tracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  align: "left" | "right" | "center" = "left",
) {
  const chars = Array.from(text);
  const width =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) + spacing * Math.max(0, chars.length - 1);
  let cursor = align === "right" ? x - width : align === "center" ? x - width / 2 : x;
  for (const c of chars) {
    ctx.fillText(c, cursor, y);
    cursor += ctx.measureText(c).width + spacing;
  }
  return width;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const ch of Array.from(text)) {
    if (ch === "\n") {
      lines.push(line);
      line = "";
      continue;
    }
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = ch;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function crackPoints(x0: number, x1: number, yTop: number, yBottom: number): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const mid = (x0 + x1) / 2;
  const amp = (x1 - x0) * 0.035;
  const steps = 26;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = yTop + (yBottom - yTop) * t;
    const x = mid + Math.sin(t * Math.PI * 2.6 + 0.7) * amp + Math.sin(t * 9.4) * amp * 0.25;
    pts.push({ x, y });
  }
  return pts;
}

function clipSide(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  side: "left" | "right",
  x0: number,
  x1: number,
) {
  ctx.beginPath();
  if (side === "left") {
    ctx.moveTo(x0, pts[0].y);
    for (const p of pts) ctx.lineTo(p.x, p.y);
    ctx.lineTo(x0, pts[pts.length - 1].y);
  } else {
    ctx.moveTo(x1, pts[0].y);
    for (let i = pts.length - 1; i >= 0; i -= 1) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.lineTo(x1, pts[pts.length - 1].y);
  }
  ctx.closePath();
  ctx.clip();
}

function drawPlan(
  ctx: CanvasRenderingContext2D,
  block: Block,
  year: number,
  palette: { ink: string; fill: string; street: string },
  proj: (p: { x: number; y: number }) => { x: number; y: number },
  scale: number,
) {
  // streets
  for (const street of block.streets) {
    if (street.lifespan && (year < street.lifespan.from || year > street.lifespan.to)) continue;
    ctx.beginPath();
    street.line.forEach((p, i) => {
      const q = proj(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.strokeStyle = palette.street;
    ctx.lineWidth = Math.max(1, street.width * scale * 0.5);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // buildings
  for (const b of block.buildings) {
    if (b.tStart > year) continue;
    if (b.tEnd !== null && b.tEnd <= year) continue;
    ctx.beginPath();
    b.ring.forEach((p, i) => {
      const q = proj(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fillStyle = b.role === "landmark" ? palette.fill : palette.fill;
    ctx.globalAlpha = b.role === "landmark" ? 0.16 : 0.09;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = palette.ink;
    ctx.lineWidth = b.role === "landmark" ? 1.2 : 0.7;
    ctx.stroke();
  }
}

function drawGhosts(
  ctx: CanvasRenderingContext2D,
  block: Block,
  oldYear: number,
  newYear: number,
  proj: (p: { x: number; y: number }) => { x: number; y: number },
) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = "rgba(181,73,58,0.65)";
  ctx.lineWidth = 1.2;
  for (const b of block.buildings) {
    const existed = b.tStart <= oldYear && (b.tEnd === null || b.tEnd > oldYear);
    const existsNow = b.tStart <= newYear && (b.tEnd === null || b.tEnd > newYear);
    if (!existed || existsNow) continue;
    ctx.beginPath();
    b.ring.forEach((p, i) => {
      const q = proj(p);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
}

function noise(ctx: CanvasRenderingContext2D, w: number, h: number, seed: string, count: number, alpha: number) {
  const rng = new Rng(seed);
  ctx.save();
  for (let i = 0; i < count; i += 1) {
    const x = rng.range(0, w);
    const y = rng.range(0, h);
    const r = rng.range(0.4, 1.5);
    ctx.beginPath();
    ctx.fillStyle = `rgba(38,34,28,${(rng.range(0.4, 1) * alpha).toFixed(3)})`;
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawCard(canvas: HTMLCanvasElement, block: Block, opts: CardOptions) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = CARD_W;
  const H = CARD_H;
  canvas.width = W;
  canvas.height = H;
  ctx.clearRect(0, 0, W, H);

  // paper
  const g = ctx.createLinearGradient(0, 0, W * 0.4, H);
  g.addColorStop(0, "#EDE7DB");
  g.addColorStop(0.45, PAPER);
  g.addColorStop(1, "#DED5C5");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  noise(ctx, W, H, `${block.slug}-paper`, 5200, 0.09);

  // sheet margin
  ctx.strokeStyle = "rgba(38,34,28,0.16)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(46, 46, W - 92, H - 92);

  // header
  ctx.fillStyle = INK;
  ctx.font = `600 46px ${SERIF}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText(block.name, 78, 150);

  ctx.fillStyle = SOFT;
  ctx.font = `400 17px ${MONO}`;
  tracked(ctx, `${block.nameEn.toUpperCase()}`, 80, 190, 3.4);
  tracked(ctx, `${block.cityNameEn.toUpperCase()} · ${block.borough} · 街区尺度`, 1000, 190, 3.4, "right");

  // hairline
  ctx.strokeStyle = "rgba(38,34,28,0.22)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(78, 216);
  ctx.lineTo(W - 78, 216);
  ctx.stroke();

  // ---------------------------------------------------------------- image
  const box = { x: 78, y: 246, w: W - 156, h: 690 };
  ctx.fillStyle = PAPER_LIGHT;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  const pts = [
    ...block.buildings.flatMap((b) => b.ring),
    ...block.streets.flatMap((s) => s.line),
  ];
  const proj = fitProjection(pts, box, 34);
  const span = Math.max(
    Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
    Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
  );
  const scale = Math.min(box.w, box.h) / Math.max(1, span);

  const cuts = crackPoints(box.x, box.x + box.w, box.y, box.y + box.h);

  // left: the archive year
  ctx.save();
  clipSide(ctx, cuts, "left", box.x, box.x + box.w);
  ctx.fillStyle = "#E9E0CE";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  drawPlan(
    ctx,
    block,
    opts.oldYear,
    { ink: "rgba(38,34,28,0.62)", fill: INK, street: "rgba(38,34,28,0.16)" },
    proj,
    scale,
  );
  drawGhosts(ctx, block, opts.oldYear, opts.newYear, proj);
  ctx.restore();

  // right: now
  ctx.save();
  clipSide(ctx, cuts, "right", box.x, box.x + box.w);
  ctx.fillStyle = "#E7E6DE";
  ctx.fillRect(box.x, box.y, box.w, box.h);
  drawPlan(
    ctx,
    block,
    opts.newYear,
    { ink: "rgba(38,34,28,0.5)", fill: "#3A3A32", street: "rgba(38,34,28,0.13)" },
    proj,
    scale,
  );
  // the crack itself
  ctx.restore();

  ctx.beginPath();
  cuts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = "rgba(38,34,28,0.3)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = "rgba(38,34,28,0.2)";
  ctx.strokeRect(box.x, box.y, box.w, box.h);

  // year marks (paper pill behind, so the ink never fights the type)
  ctx.fillStyle = "rgba(240,234,224,0.82)";
  ctx.fillRect(box.x + 8, box.y + 12, 104, 58);
  ctx.fillRect(box.x + box.w - 112, box.y + 12, 104, 58);
  ctx.font = `400 24px ${MONO}`;
  ctx.fillStyle = "rgba(38,34,28,0.62)";
  tracked(ctx, String(opts.oldYear), box.x + 20, box.y + 38, 2);
  ctx.fillStyle = "rgba(38,34,28,0.55)";
  tracked(ctx, String(opts.newYear), box.x + box.w - 20, box.y + 38, 2, "right");

  ctx.font = `400 14px ${SERIF}`;
  ctx.fillStyle = "rgba(110,98,83,0.9)";
  tracked(ctx, "档案切片", box.x + 20, box.y + 62, 4);
  tracked(ctx, "当代", box.x + box.w - 20, box.y + 62, 4, "right");

  // ------------------------------------------------------------- timeline
  const tlY = 1012;
  const tlX = 96;
  const tlW = W - 192;
  const years = block.slices.map((s) => s.year).sort((a, b) => a - b);
  const minY = years[0];
  const maxY = years[years.length - 1];
  const tx = (y: number) => tlX + ((y - minY) / Math.max(1, maxY - minY)) * tlW;

  ctx.strokeStyle = "rgba(38,34,28,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(tlX, tlY);
  ctx.lineTo(tlX + tlW, tlY);
  ctx.stroke();

  // visited span
  const fromX = tx(opts.from);
  const toX = tx(opts.to);
  ctx.strokeStyle = "rgba(181,73,58,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(fromX, tlY + 18);
  ctx.lineTo(toX, tlY + 18);
  ctx.stroke();

  for (const y of years) {
    const x = tx(y);
    const visited = y >= opts.from && y <= opts.to;
    ctx.beginPath();
    ctx.arc(x, tlY, visited ? 6 : 4.5, 0, Math.PI * 2);
    ctx.fillStyle = visited ? INK : PAPER;
    ctx.fill();
    ctx.strokeStyle = "rgba(38,34,28,0.55)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.font = `400 17px ${MONO}`;
    ctx.fillStyle = visited ? INK : "rgba(110,98,83,0.72)";
    tracked(ctx, String(y), x, tlY + 46, 1, "center");
  }

  // a gap, stated plainly
  for (const gap of block.slices) {
    if (!gap.gapBefore) continue;
    const x0 = tx(gap.gapBefore.from);
    const x1 = tx(gap.gapBefore.to);
    ctx.save();
    ctx.setLineDash([3, 5]);
    ctx.strokeStyle = "rgba(110,98,83,0.45)";
    ctx.beginPath();
    ctx.moveTo(x0 + 10, tlY - 22);
    ctx.lineTo(x1 - 10, tlY - 22);
    ctx.stroke();
    ctx.restore();
    ctx.font = `400 13px ${SERIF}`;
    ctx.fillStyle = "rgba(110,98,83,0.7)";
    tracked(ctx, `${gap.gapBefore.years} 年无记录`, (x0 + x1) / 2, tlY - 30, 2, "center");
  }

  // --------------------------------------------------------------- verdict
  ctx.fillStyle = INK;
  ctx.font = `400 33px ${SERIF}`;
  const lines = wrap(ctx, opts.verdict, W - 200);
  let y = 1118;
  for (const line of lines) {
    ctx.fillText(line, 96, y);
    y += 58;
  }

  // ------------------------------------------------------------------ foot
  ctx.strokeStyle = "rgba(38,34,28,0.18)";
  ctx.beginPath();
  ctx.moveTo(78, 1300);
  ctx.lineTo(W - 78, 1300);
  ctx.stroke();

  ctx.font = `400 14px ${MONO}`;
  ctx.fillStyle = "rgba(110,98,83,0.85)";
  tracked(ctx, "OSM · MAPILLARY · CITY ARCHIVE", 78, 1340, 2.2);
  ctx.font = `400 13px ${SERIF}`;
  ctx.fillStyle = "rgba(110,98,83,0.75)";
  tracked(ctx, "数据为演示样本，用于验证产品结构", 78, 1366, 1.6);

  ctx.font = `500 22px ${DISPLAY}`;
  ctx.fillStyle = INK;
  tracked(ctx, "TIMELAYER", W - 78, 1340, 6, "right");
  ctx.font = `400 13px ${SERIF}`;
  ctx.fillStyle = "rgba(110,98,83,0.8)";
  tracked(ctx, "看看你的街区", W - 78, 1366, 2, "right");

  // stamp — sits on the image, the way a real archive stamp does
  ctx.save();
  ctx.translate(box.x + box.w - 118, box.y + box.h - 46);
  ctx.rotate(-0.06);
  ctx.strokeStyle = "rgba(181,73,58,0.5)";
  ctx.lineWidth = 2;
  ctx.strokeRect(-78, -25, 156, 50);
  ctx.fillStyle = "rgba(181,73,58,0.62)";
  ctx.font = `500 19px ${SERIF}`;
  tracked(ctx, "演示数据", 0, 6, 6, "center");
  ctx.restore();

}
