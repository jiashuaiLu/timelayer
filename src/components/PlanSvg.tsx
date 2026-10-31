"use client";

import { fitProjection, polylinePath } from "@/lib/geo";
import type { Block } from "@/domain/types";

/** A quiet, unlabelled plan drawing — used as the entrance backdrop. */
export function PlanSvg({
  block,
  viewBox = 1000,
  className,
  ink = "rgba(38,34,28,0.55)",
  fill = "rgba(38,34,28,0.06)",
  showStreets = true,
}: {
  block: Block;
  viewBox?: number;
  className?: string;
  ink?: string;
  fill?: string;
  showStreets?: boolean;
}) {
  const pts = [...block.buildings.flatMap((b) => b.ring), ...block.streets.flatMap((s) => s.line)];
  const proj = fitProjection(pts, { x: 0, y: 0, w: viewBox, h: viewBox }, viewBox * 0.06);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${viewBox} ${viewBox}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {showStreets &&
        block.streets.map((s) => (
          <path
            key={s.id}
            d={polylinePath(s.line.map(proj))}
            fill="none"
            stroke={ink}
            strokeOpacity={s.kind === "avenue" ? 0.34 : 0.2}
            strokeWidth={Math.max(1, s.width * (viewBox / 900))}
            strokeLinecap="round"
          />
        ))}
      {block.buildings.map((b) => (
        <polygon
          key={b.id}
          points={b.ring.map((p) => {
            const q = proj(p);
            return `${q.x.toFixed(1)},${q.y.toFixed(1)}`;
          }).join(" ")}
          fill={fill}
          stroke={ink}
          strokeOpacity={b.role === "landmark" ? 0.6 : 0.34}
          strokeWidth={b.role === "landmark" ? 1.1 : 0.55}
        />
      ))}
    </svg>
  );
}
