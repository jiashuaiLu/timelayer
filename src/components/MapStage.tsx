"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import type { Block } from "@/domain/types";
import { gapBetween, type GapSpan } from "@/pipeline/slices";
import { usePlayer } from "@/store/player";
import { baseStyle, addPlanLayers, type PlanHandles, type Slot } from "@/lib/mapPlan";
import { toLngLat } from "@/lib/geo";

function wait(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

function tween(duration: number, onUpdate: (t: number) => void) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.max(0, Math.min(1, (now - start) / duration));
      onUpdate(t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** easeOutQuint — close enough to cubic-bezier(0.16, 1, 0.3, 1) for a 450ms beat */
const ease = (t: number) => 1 - Math.pow(1 - t, 5);

export function MapStage({
  block,
  onGap,
}: {
  block: Block;
  onGap: (gap: GapSpan | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const handlesRef = useRef<PlanHandles | null>(null);
  const labelsRef = useRef<Record<string, HTMLDivElement | null>>({});
  const hoverRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  const sliceYear = usePlayer((s) => s.sliceYear);
  const year = usePlayer((s) => s.year);
  const selectEvent = usePlayer((s) => s.selectEvent);

  const activeRef = useRef<Slot>("a");
  const currentYearRef = useRef(sliceYear);
  const opacityRef = useRef<{ a: number; b: number }>({ a: 1, b: 0 });
  const tokenRef = useRef(0);
  const traceYearRef = useRef(-1);
  const startYearRef = useRef(sliceYear);

  /* ------------------------------------------------------------- map init */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: baseStyle(),
      center: [block.centroid.lng, block.centroid.lat],
      zoom: 16.6,
      maxZoom: 19.5,
      minZoom: 14.5,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      attributionControl: false,
      fadeDuration: 0,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    if (process.env.NODE_ENV !== "production") {
      (window as unknown as Record<string, unknown>).__tl = { map, block };
    }

    const pad = block.extent * 1.06;
    const sw = toLngLat(block.centroid, { x: -pad, y: -pad });
    const ne = toLngLat(block.centroid, { x: pad, y: pad });
    map.setMaxBounds([
      [sw[0] - 0.004, sw[1] - 0.004],
      [ne[0] + 0.004, ne[1] + 0.004],
    ]);

    map.on("load", () => {
      const handles = addPlanLayers(map, block, startYearRef.current);
      handlesRef.current = handles;
      handles.fillSlot("a", startYearRef.current);
      map.fitBounds(
        [
          [sw[0], sw[1]],
          [ne[0], ne[1]],
        ],
        {
          padding: { top: 76, bottom: 150, left: 72, right: 72 },
          duration: 0,
        },
      );
      setReady(true);
      updateLabels();
    });

    map.on("resize", () => updateLabels());

    let raf = 0;
    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        updateLabels();
      });
    };
    map.on("move", schedule);
    map.on("zoom", schedule);

    function updateLabels() {
      const m = mapRef.current;
      if (!m) return;
      for (const street of block.streets) {
        const el = labelsRef.current[street.id];
        if (!el) continue;
        const a = street.line[0];
        const b = street.line[street.line.length - 1];
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const [lng, lat] = toLngLat(block.centroid, mid);
        const p = m.project([lng, lat]);
        let angle = (Math.atan2(-(b.y - a.y), b.x - a.x) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        if (angle < -90) angle += 180;
        el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) rotate(${angle}deg)`;
        el.style.opacity = street.kind === "lane" ? "0.75" : "1";
      }
    }

    let hoverFrame = 0;
    const onMove = (e: maplibregl.MapMouseEvent) => {
      if (hoverFrame) return;
      hoverFrame = requestAnimationFrame(() => {
        hoverFrame = 0;
        const handles = handlesRef.current;
        const caption = hoverRef.current;
        if (!handles || !caption) return;
        const building = handles.buildingAt(e.point);
        const street = building ? null : handles.streetAt(e.point);
        const ev = building?.ev || street?.ev;
        const event = ev ? block.events.find((x) => x.id === ev) : null;
        if (event) {
          caption.textContent = `${event.year} · ${event.hook}`;
          caption.style.transform = `translate3d(${e.point.x + 14}px, ${e.point.y - 8}px, 0)`;
          caption.style.opacity = "1";
          if (containerRef.current) containerRef.current.style.cursor = "pointer";
        } else {
          caption.style.opacity = "0";
          if (containerRef.current) containerRef.current.style.cursor = "grab";
        }
      });
    };
    map.on("mousemove", onMove);

    map.on("click", (e) => {
      const handles = handlesRef.current;
      if (!handles) return;
      const building = handles.buildingAt(e.point);
      const street = building ? null : handles.streetAt(e.point);
      const ev = building?.ev || street?.ev;
      selectEvent(ev || null);
    });

    return () => {
      map.remove();
      mapRef.current = null;
      handlesRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.slug]);

  /* --------------------------------------------------------- sheet turning */
  useEffect(() => {
    if (!ready) return;
    const handles = handlesRef.current;
    if (!handles) return;
    if (sliceYear === currentYearRef.current) return;

    const prev = currentYearRef.current;
    const next = sliceYear;
    const token = ++tokenRef.current;
    const active = activeRef.current;
    const incoming: Slot = active === "a" ? "b" : "a";
    const gap = gapBetween(block, prev, next);

    const setOpacity = (slot: Slot, v: number) => {
      const clamped = Math.max(0, Math.min(1, v));
      opacityRef.current[slot] = clamped;
      handles.setSlotOpacity(slot, clamped);
    };

    handles.fillSlot(incoming, next);
    setOpacity(incoming, 0);
    onGap(gap);

    const run = async () => {
      if (gap) {
        // the blank breath: both sheets go to paper for 200ms.
        await tween(220, (t) => {
          if (token !== tokenRef.current) return;
          setOpacity(active, 1 - ease(t));
        });
        if (token !== tokenRef.current) return;
        await wait(180);
        if (token !== tokenRef.current) return;
        await tween(450, (t) => {
          if (token !== tokenRef.current) return;
          setOpacity(incoming, ease(t));
        });
      } else {
        await tween(450, (t) => {
          if (token !== tokenRef.current) return;
          setOpacity(active, 1 - ease(t));
          setOpacity(incoming, ease(t));
        });
      }
      if (token !== tokenRef.current) return;
      setOpacity(active, 0);
      activeRef.current = incoming;
      currentYearRef.current = next;
      onGap(null);
      handles.setTraceYear(next, prev);
      traceYearRef.current = next;
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sliceYear, ready]);

  /* ----------------------------------------------------------- change stains */
  useEffect(() => {
    if (!ready) return;
    const handles = handlesRef.current;
    if (!handles) return;
    const y = Math.round(year);
    if (y === traceYearRef.current) return;
    traceYearRef.current = y;
    handles.setTraceYear(y, currentYearRef.current);
  }, [year, ready]);

  return (
    <div className="map-shell">
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {block.streets.map((s) => (
          <div
            key={s.id}
            ref={(el) => {
              labelsRef.current[s.id] = el;
            }}
            className={`street-label${s.kind === "lane" ? " street-label--zh" : ""}`}
            style={{
              left: 0,
              top: 0,
              color: s.lifespan ? "rgba(181,73,58,0.45)" : undefined,
            }}
          >
            {s.name}
          </div>
        ))}
      </div>
      <div
        ref={hoverRef}
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          opacity: 0,
          transition: "opacity 140ms linear",
          pointerEvents: "none",
          fontFamily: "var(--mono)",
          fontSize: 9.5,
          letterSpacing: "0.12em",
          color: "var(--ink)",
          background: "rgba(239,233,222,0.92)",
          border: "1px solid rgba(38,34,28,0.22)",
          padding: "3px 7px",
          whiteSpace: "nowrap",
        }}
      >
        {""}
      </div>
    </div>
  );
}
