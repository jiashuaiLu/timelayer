"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import type { Block } from "@/domain/types";
import { MapStage } from "@/components/MapStage";
import { TimeRuler } from "@/components/TimeRuler";
import { ArchiveNote } from "@/components/ArchiveNote";
import { BiographyCard } from "@/components/BiographyCard";
import { EvidencePhoto } from "@/components/EvidencePhoto";
import type { Evidence } from "@/imagery/types";
import { countChanges } from "@/lib/mapPlan";
import { buildSlices, type GapSpan } from "@/pipeline/slices";
import { buildVerdict, narrativeFor } from "@/pipeline/narrative";
import { usePlayer } from "@/store/player";
import { rememberVisit } from "@/lib/persist";

export function BlockView({ block }: { block: Block }) {
  const init = usePlayer((s) => s.init);
  const visited = usePlayer((s) => s.visited);
  const selectedId = usePlayer((s) => s.selectedId);
  const sliceYear = usePlayer((s) => s.sliceYear);
  const dwell = usePlayer((s) => s.dwell);
  const selectEvent = usePlayer((s) => s.selectEvent);

  const [gap, setGap] = useState<GapSpan | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [polished, setPolished] = useState<Record<string, string>>({});
  const [evidence, setEvidence] = useState<Evidence[]>([]);

  useEffect(() => {
    init(block);
    void rememberVisit({ slug: block.slug, name: block.name, at: Date.now() });
  }, [block, init]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/imagery/${block.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { items?: Evidence[] } | null) => {
        if (!cancelled && data?.items) setEvidence(data.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [block.slug]);

  // the model is allowed to improve the sentence, never to change the facts
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch("/api/narrative", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: block.slug, eventId: selectedId }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((n: { eventId?: string; text?: string; polished?: boolean } | null) => {
        if (cancelled || !n?.polished || !n.text || !n.eventId) return;
        setPolished((prev) => ({ ...prev, [n.eventId as string]: n.text as string }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selectedId, block.slug]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("card") === "1") setCardOpen(true);
  }, []);

  const years = useMemo(() => block.slices.map((s) => s.year).sort((a, b) => a - b), [block]);
  const prevSliceYear = useMemo(() => {
    const idx = years.indexOf(sliceYear);
    return idx > 0 ? years[idx - 1] : years[0];
  }, [years, sliceYear]);

  const changes = useMemo(
    () => countChanges(block, sliceYear, prevSliceYear),
    [block, sliceYear, prevSliceYear],
  );

  const baseNarrative = selectedId ? narrativeFor(block, selectedId) : null;
  const narrative = baseNarrative
    ? { ...baseNarrative, text: polished[baseNarrative.eventId] ?? baseNarrative.text, polished: Boolean(polished[baseNarrative.eventId]) }
    : null;

  const visitedFrom = Math.min(...(visited.length ? visited : [sliceYear]));
  const visitedTo = Math.max(...(visited.length ? visited : [sliceYear]));

  const lastYear = years[years.length - 1];

  /** the frame the user lingered on; if that is "now", fall back to the street's own story */
  const oldYear = useMemo(() => {
    const pool = visited.length ? visited : [sliceYear];
    const hero = pool.reduce((best, y) => ((dwell[y] ?? 0) > (dwell[best] ?? 0) ? y : best), pool[0]);
    if (hero !== lastYear) return hero;
    if (visitedFrom !== lastYear) return visitedFrom;
    const story = block.events
      .slice()
      .sort((a, b) => (b.story ?? 0) - (a.story ?? 0))[0];
    return [...years].reverse().find((y) => y <= story.year) ?? years[0];
  }, [visited, dwell, sliceYear, years, lastYear, visitedFrom, block.events]);

  const from = Math.min(visitedFrom, oldYear);
  const to = Math.max(visitedTo, lastYear);

  const options = useMemo(
    () => ({
      oldYear,
      newYear: lastYear,
      from,
      to,
      verdict: buildVerdict(block, from, to),
    }),
    [block, oldYear, lastYear, from, to],
  );

  const unlocked = visited.length >= 2;
  const gapInfo = buildSlices(block).gaps[0];

  return (
    <main className="stage">
      <MapStage block={block} onGap={setGap} />

      <div className="vignette" />
      <div className="grain" />
      <div className="sheet" />
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />

      <EvidencePhoto items={evidence} year={sliceYear} blockName={block.name} />

      <header className="stage-head">
        <div>
          <div className="t-eyebrow">
            {block.cityNameEn} · {block.borough} · 街区尺度
          </div>
          <h1 className="stage-title">{block.name}</h1>
          <div className="stage-sub">
            半径 {block.radiusM}m · 不显示门牌号 · 数据为演示样本
          </div>
        </div>
        <div className="stage-actions">
          <Link href="/" className="btn btn--quiet">
            ← 换一条街
          </Link>
          <button
            className="btn btn--solid"
            disabled={!unlocked}
            onClick={() => setCardOpen(true)}
            title={unlocked ? "生成街区传记卡片" : "滑过至少两个切片后可生成"}
          >
            生成卡片
          </button>
        </div>
      </header>

      <div className="legend">
        <span className="legend-item">
          <i className="legend-swatch legend-swatch--gone" />
          已消失
        </span>
        <span className="legend-item">
          <i className="legend-swatch legend-swatch--new" />
          新增
        </span>
        <span className="legend-item">
          <i className="legend-swatch legend-swatch--reuse" />
          用途变更
        </span>
      </div>

      <AnimatePresence>
        {gap && (
          <motion.div
            className="gap-caption"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
          >
            <div className="gap-caption-years">
              {gap.from} — {gap.to}
            </div>
            <div className="gap-caption-text">这 {gap.years} 年没有留下可用的街区记录</div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="change-meter">
        <span className="change-year">{sliceYear}</span>
        <span className="change-sep">·</span>
        <span>消失 {changes.gone}</span>
        <span className="change-sep">·</span>
        <span>新增 {changes.fresh}</span>
      </div>

      <AnimatePresence>
        {!unlocked && (
          <motion.div
            className="hint"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.4 }}
          >
            拖动卷尺 · 每一格都是真实存在过的年份
          </motion.div>
        )}
      </AnimatePresence>

      <TimeRuler block={block} />

      <ArchiveNote
        narrative={narrative}
        onClose={() => selectEvent(null)}
      />

      <AnimatePresence>
        {cardOpen && (
          <BiographyCard block={block} options={options} onClose={() => setCardOpen(false)} />
        )}
      </AnimatePresence>

      {gapInfo && (
        <div className="stage-foot">
          {block.nameEn.toUpperCase()} · {years[0]}–{years[years.length - 1]} ·{" "}
          {block.slices.length} 个切片 · {gapInfo.years} 年缺口已如实标出
        </div>
      )}
    </main>
  );
}
