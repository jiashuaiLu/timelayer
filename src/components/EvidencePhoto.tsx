"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Evidence } from "@/imagery/types";
import { evidenceCaption, evidenceForYear } from "@/imagery/types";

type Props = {
  items: Evidence[];
  year: number;
  blockName: string;
};

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * 单帧证据。
 *
 * 一次只摆在台面上的一张：截至当前年份、我们能找到的最新一张影像。
 * 年份永远是照片自己的年份，不是当前切片的年份——差 40 年就写 40 年。
 */
export function EvidencePhoto({ items, year, blockName }: Props) {
  const [open, setOpen] = useState(false);
  const picked = evidenceForYear(items, year);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!picked) return null;
  const { item, ageGap } = picked;

  return (
    <>
      <aside className="evidence" aria-label="街区影像证据">
        <AnimatePresence mode="wait" initial={false}>
          <motion.figure
            key={item.id}
            className="evidence-print"
            initial={{ opacity: 0, y: 10, rotate: -2.4 }}
            animate={{ opacity: 1, y: 0, rotate: -1.3 }}
            exit={{ opacity: 0, y: -6, rotate: -0.6 }}
            transition={{ duration: 0.36, ease: EASE }}
            role="button"
            tabIndex={0}
            onClick={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOpen(true);
              }
            }}
          >
            <span className="evidence-tape" aria-hidden />
            <span className="evidence-img">
              {/* Commons 缩略图，900px 宽 */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.title} loading="lazy" decoding="async" />
            </span>
            <figcaption className="evidence-cap">
              <span className="evidence-year">{item.year}</span>
              <span className="evidence-title">{item.title}</span>
              <span className="evidence-meta">
                {item.kind === "plate" ? "图版" : "照片"} · {item.license}
                {ageGap >= 8 ? ` · 距此 ${ageGap} 年` : ""}
              </span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </aside>

      <AnimatePresence>
        {open && (
          <motion.div
            className="evidence-veil"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label={item.title}
          >
            <motion.figure
              className="evidence-sheet"
              initial={{ opacity: 0, y: 14, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.99 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={(event) => event.stopPropagation()}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.url} alt={item.title} />
              <figcaption>
                <div className="evidence-sheet-head">
                  <span className="evidence-year">{item.year ?? "年代不详"}</span>
                  <span className="evidence-sheet-title">{item.title}</span>
                </div>
                <div className="evidence-sheet-meta">
                  <span>{item.credit}</span>
                  <span>{item.license}</span>
                  <span>{evidenceCaption(item, blockName)}</span>
                </div>
                <div className="evidence-sheet-foot">
                  <a href={item.pageUrl} target="_blank" rel="noreferrer noopener">
                    在 Wikimedia Commons 查看原始条目 →
                  </a>
                  <button type="button" className="btn btn--ghost" onClick={close}>
                    收起
                  </button>
                </div>
              </figcaption>
            </motion.figure>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
