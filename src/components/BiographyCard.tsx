"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { Block } from "@/domain/types";
import { CARD_H, CARD_W, drawCard, type CardOptions } from "@/lib/cardRenderer";

export function BiographyCard({
  block,
  options,
  onClose,
}: {
  block: Block;
  options: CardOptions;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"drawing" | "ready" | "saving">("drawing");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const draw = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      try {
        await Promise.all([
          document.fonts.load('600 46px "Noto Serif SC"'),
          document.fonts.load('400 35px "Noto Serif SC"'),
          document.fonts.load('400 17px "IBM Plex Mono"'),
          document.fonts.load('500 22px "Cormorant Garamond"'),
        ]);
      } catch {
        // fonts are allowed to fail; the system serif still holds the layout
      }
      await document.fonts.ready;
      if (cancelled) return;
      drawCard(canvas, block, options);
      setStatus("ready");
    };
    void draw();
    return () => {
      cancelled = true;
    };
  }, [block, options]);

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setStatus("saving");
    canvas.toBlob((blob) => {
      if (!blob) {
        setStatus("ready");
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `timelayer-${block.slug}-${options.oldYear}-${options.newYear}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      setStatus("ready");
      // the card has been put down on the table
      frameRef.current?.animate(
        [
          { transform: "translateY(0) rotate(0deg)" },
          { transform: "translateY(2px) rotate(-0.5deg)" },
          { transform: "translateY(0) rotate(0deg)" },
        ],
        { duration: 280, easing: "ease-out" },
      );
      navigator.vibrate?.(12);
    }, "image/png");
  };

  const copyLink = async () => {
    const url = `${window.location.origin}/b/${block.slug}?card=1`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      window.prompt("复制这个链接", url);
    }
  };

  return (
    <motion.div
      className="card-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="card-overlay-veil" onClick={onClose} />
      <motion.div
        className="card-stage"
        initial={{ y: 64, opacity: 0, rotate: 0.6 }}
        animate={{ y: 0, opacity: 1, rotate: -1.5 }}
        exit={{ y: 40, opacity: 0, rotate: 0.4 }}
        transition={{ type: "spring", stiffness: 120, damping: 18, mass: 0.9 }}
      >
        <div className="card-frame" ref={frameRef}>
          <canvas
            ref={canvasRef}
            width={CARD_W}
            height={CARD_H}
            style={{ width: "100%", height: "auto", display: "block" }}
            aria-label={`${block.name} 街区传记卡片`}
          />
          <span className="card-shadow" />
        </div>
        <div className="card-actions">
          <button className="btn btn--solid" onClick={download} disabled={status === "drawing"}>
            {status === "saving" ? "正在导出…" : "下载长图 1080×1440"}
          </button>
          <button className="btn" onClick={copyLink}>
            {copied ? "链接已复制" : "复制分享链接"}
          </button>
          <button className="btn btn--quiet" onClick={onClose}>
            收起
          </button>
        </div>
        <p className="card-caption">卡片只显示街区名，不含门牌号。</p>
      </motion.div>
    </motion.div>
  );
}
