"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Block } from "@/domain/types";
import { buildSlices, nearestYear, prevYear, nextYear, sliceAt } from "@/pipeline/slices";
import { usePlayer } from "@/store/player";
import { clamp } from "@/lib/geo";

const PAD = 54;

export function TimeRuler({ block }: { block: Block }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const vfRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState(false);
  const rafRef = useRef(0);
  const velRef = useRef(0);
  const lastRef = useRef<{ t: number; year: number } | null>(null);

  const year = usePlayer((s) => s.year);
  const sliceYear = usePlayer((s) => s.sliceYear);
  const visited = usePlayer((s) => s.visited);
  const setYear = usePlayer((s) => s.setYear);
  const settle = usePlayer((s) => s.settle);

  const years = useMemo(() => block.slices.map((s) => s.year).sort((a, b) => a - b), [block]);
  const gaps = useMemo(() => buildSlices(block).gaps, [block]);
  const domain = useMemo(() => {
    const min = Math.floor((years[0] - 8) / 5) * 5;
    const max = Math.ceil((years[years.length - 1] + 4) / 5) * 5;
    return { min, max };
  }, [years]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const yearToX = useCallback(
    (y: number) => {
      const usable = Math.max(1, width - PAD * 2);
      return PAD + ((y - domain.min) / (domain.max - domain.min)) * usable;
    },
    [width, domain],
  );

  const xToYear = useCallback(
    (x: number) => {
      const usable = Math.max(1, width - PAD * 2);
      return domain.min + ((x - PAD) / usable) * (domain.max - domain.min);
    },
    [width, domain],
  );

  const animateTo = useCallback(
    (target: number, duration = 200) => {
      cancelAnimationFrame(rafRef.current);
      const from = usePlayer.getState().year;
      const delta = target - from;
      if (Math.abs(delta) < 0.4) {
        settle(target);
        pulse();
        return;
      }
      const start = performance.now();
      const back = (t: number) => {
        const c1 = 1.4;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
      };
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        const v = from + delta * back(t);
        setYear(v);
        if (t < 1) rafRef.current = requestAnimationFrame(step);
        else {
          settle(target);
          pulse();
        }
      };
      rafRef.current = requestAnimationFrame(step);
    },
    [setYear, settle],
  );

  function pulse() {
    const el = vfRef.current;
    if (!el) return;
    el.animate(
      [
        { transform: "scale(1)" },
        { transform: "scale(1.035)" },
        { transform: "scale(1)" },
      ],
      { duration: 210, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
    );
  }

  const onPointerDown = (e: React.PointerEvent) => {
    const el = trackRef.current;
    if (!el) return;
    cancelAnimationFrame(rafRef.current);
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, PAD, width - PAD);
    setDragging(true);
    lastRef.current = { t: performance.now(), year: xToYear(x) };
    setYear(xToYear(x));
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    const el = trackRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clamp(e.clientX - rect.left, PAD, width - PAD);
    const y = xToYear(x);
    const now = performance.now();
    const last = lastRef.current;
    if (last && now - last.t > 8) {
      velRef.current = (y - last.year) / (now - last.t);
      lastRef.current = { t: now, year: y };
    }
    setYear(y);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragging(false);
    const state = usePlayer.getState();
    const projected = state.year + velRef.current * 90;
    velRef.current = 0;
    lastRef.current = null;
    const target = nearestYear(block, projected);
    animateTo(target, 260);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const next = e.key === "ArrowRight" ? nextYear(block, sliceYear) : prevYear(block, sliceYear);
      if (next !== null) animateTo(next, 220);
    }
    if (e.key === "Home") animateTo(years[0], 260);
    if (e.key === "End") animateTo(years[years.length - 1], 260);
  };

  const inGap = gaps.some((g) => year > g.from && year < g.to);
  const active = sliceAt(block, year);
  const displayLabel = inGap ? "无记录" : active.label;

  const visitedFrom = Math.min(...(visited.length ? visited : [sliceYear]));
  const visitedTo = Math.max(...(visited.length ? visited : [sliceYear]));

  const pxPerYear = width > 0 ? (width - PAD * 2) / (domain.max - domain.min) : 1;
  let lastLabelYear = -Infinity;

  return (
    <div
      className="ruler"
      ref={trackRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      tabIndex={0}
      role="slider"
      aria-label="时间卷尺"
      aria-valuemin={domain.min}
      aria-valuemax={domain.max}
      aria-valuenow={Math.round(year)}
      style={{ touchAction: "none" }}
    >
      {width > 0 && (
        <>
          <div className="ruler-baseline" style={{ left: PAD, width: width - PAD * 2 }} />

          {gaps.map((g) => {
            const x0 = yearToX(g.from);
            const x1 = yearToX(g.to);
            return (
              <div key={`${g.from}-${g.to}`} className="ruler-gap" style={{ left: x0, width: x1 - x0 }}>
                <div className="ruler-gap-line" />
                <div className="ruler-gap-label">{g.years} 年无记录</div>
              </div>
            );
          })}

          <div
            className="ruler-visited"
            style={{
              left: yearToX(visitedFrom),
              width: Math.max(0, yearToX(visitedTo) - yearToX(visitedFrom)),
            }}
          />

          {years.map((y) => {
            const slice = block.slices.find((s) => s.year === y)!;
            const activeTick = Math.round(year) === y;
            // labels thin out before they collide — the viewfinder keeps the exact year
            const showLabel = (y - lastLabelYear) * pxPerYear >= 54;
            const showType = showLabel && pxPerYear >= 7;
            if (showLabel) lastLabelYear = y;
            return (
              <button
                key={y}
                className={`ruler-tick${activeTick ? " is-active" : ""}`}
                style={{ left: yearToX(y) }}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelAnimationFrame(rafRef.current);
                  animateTo(y, 240);
                }}
                tabIndex={-1}
                aria-label={`${y} ${slice.label}`}
              >
                <span className="ruler-tick-mark" />
                {showLabel && <span className="ruler-tick-year">{y}</span>}
                {showType && <span className="ruler-tick-type">{slice.label}</span>}
              </button>
            );
          })}

          <div
            className={`ruler-vf${dragging ? " is-dragging" : ""}${inGap ? " is-gap" : ""}`}
            style={{ left: yearToX(year) }}
          >
            <div className="ruler-vf-inner" ref={vfRef}>
              <span className="ruler-vf-year">{Math.round(year)}</span>
              <span className="ruler-vf-type">{displayLabel}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
