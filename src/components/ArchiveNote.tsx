"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { Narrative } from "@/domain/types";

const PROVENANCE: Record<Narrative["provenance"], { label: string; color: string }> = {
  archive: { label: "档案", color: "var(--ink-soft)" },
  demo: { label: "演示数据", color: "var(--ink-soft)" },
  inferred: { label: "虚构推演", color: "var(--carmine)" },
};

export function ArchiveNote({
  narrative,
  onClose,
}: {
  narrative: Narrative | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {narrative && (
        <motion.aside
          key={narrative.eventId}
          className="note"
          initial={{ opacity: 0, y: 18, rotate: 0.4 }}
          animate={{ opacity: 1, y: 0, rotate: -0.35 }}
          exit={{ opacity: 0, y: 12, rotate: 0.2 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="note-head">
            <span className="t-eyebrow">档案纸条 · {narrative.year}</span>
            <button className="note-close" onClick={onClose} aria-label="收起档案纸条">
              ×
            </button>
          </div>
          <div className="note-body">
            <p>{narrative.text}</p>
          </div>
          <div className="note-foot">
            <span>来源 · {narrative.source}</span>
            <span className="note-tag" style={{ color: PROVENANCE[narrative.provenance].color }}>
              {PROVENANCE[narrative.provenance].label}
            </span>
          </div>
          <span className="note-notch" aria-hidden="true" />
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
