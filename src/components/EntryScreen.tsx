"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { Block, ResolvedBlock } from "@/domain/types";
import { PlanSvg } from "@/components/PlanSvg";
import { lastVisit, type Visit } from "@/lib/persist";

const linger = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function EntryScreen({
  bookmarks,
  backdrop,
  fallbackSlug,
}: {
  bookmarks: { slug: string; name: string; borough: string; hook: string; year: number }[];
  backdrop: Block;
  fallbackSlug: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [recent, setRecent] = useState<Visit | null>(null);
  const [phase, setPhase] = useState<"idle" | "resolving">("idle");
  const [resolved, setResolved] = useState<ResolvedBlock | null>(null);

  useEffect(() => {
    void lastVisit().then((v) => setRecent(v));
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (phase === "resolving") return;
    setPhase("resolving");
    const started = performance.now();

    let result: ResolvedBlock | null = null;
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address: value }),
      });
      if (res.ok) result = (await res.json()) as ResolvedBlock;
    } catch {
      result = null;
    }

    const remaining = Math.max(0, 620 - (performance.now() - started));
    await linger(remaining);
    setResolved(result);
    await linger(240);
    router.push(`/b/${result?.slug ?? fallbackSlug}`);
  };

  return (
    <main className="entry">
      <motion.div
        className="entry-plan drift"
        animate={
          phase === "resolving"
            ? { opacity: 0.34, scale: 1.22, filter: "blur(1.4px)" }
            : { opacity: 0.5, scale: 1.04, filter: "blur(0px)" }
        }
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <PlanSvg block={backdrop} className="entry-plan-svg" />
      </motion.div>

      <div className="vignette" />
      <div className="grain" />
      <div className="sheet" />
      <span className="crop tl" />
      <span className="crop tr" />
      <span className="crop bl" />
      <span className="crop br" />

      <motion.div
        className="entry-content"
        animate={phase === "resolving" ? { y: -14 } : { y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="entry-mark">
          <span className="t-eyebrow">TIMELAYER · EST. 2026</span>
          <h1 className="entry-title">时间街道</h1>
          <p className="entry-lede">
            输入一个地址。看看这条街，过去一百年发生了什么。
          </p>
        </div>

        <form className="entry-form" onSubmit={submit}>
          <div className={`entry-field${phase === "resolving" ? " is-resolving" : ""}`}>
            <AnimatePresence mode="wait">
              {phase === "idle" ? (
                <motion.input
                  key="input"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder="例如 45-10 23rd Street, Queens"
                  className="entry-input"
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="输入一个纽约地址"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, y: 10, filter: "blur(3px)" }}
                  transition={{ duration: 0.3 }}
                />
              ) : (
                <motion.div
                  key="resolved"
                  className="entry-resolved"
                  initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                >
                  <span className="entry-resolved-label">
                    {resolved ? resolved.name : "已定位到街区尺度"}
                  </span>
                  <span className="entry-resolved-sub">
                    {resolved?.notice ?? "不会显示你的门牌。"}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
            <button className="entry-submit" type="submit" aria-label="解析地址">
              {phase === "resolving" ? "定位中" : "读取街区"}
            </button>
          </div>
          <div className="entry-helper">
            <span>地址只用于匹配街区质心，不保存、不显示门牌。</span>
            <button
              type="button"
              className="entry-skip"
              onClick={() => router.push(`/b/${fallbackSlug}`)}
            >
              直接看今日街区 →
            </button>
          </div>
          {recent && (
            <div className="entry-recent">
              <span className="t-eyebrow">上次看的</span>
              <button
                type="button"
                className="entry-recent-link"
                onClick={() => router.push(`/b/${recent.slug}`)}
              >
                {recent.name} →
              </button>
            </div>
          )}
        </form>

        <div className="bookmarks">
          <div className="bookmarks-head">
            <span className="t-eyebrow">今日街区 · 三枚书签</span>
            <span className="bookmarks-rule" />
          </div>
          <div className="bookmarks-row">
            {bookmarks.map((b, i) => (
              <motion.div
                key={`${b.slug}-${b.hook}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                style={{ flex: 1 }}
              >
                <Link href={`/b/${b.slug}`} className="bookmark">
                  <span className="bookmark-year">{b.year}</span>
                  <span className="bookmark-hook">{b.hook}</span>
                  <span className="bookmark-name">
                    {b.name} · {b.borough}
                  </span>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="entry-foot">
          <span>两个街区样板 · 14 个时间切片 · 0 个账号</span>
          <span className="entry-foot-sep">·</span>
          <span>历史内容为演示数据，用于验证产品结构</span>
        </div>
      </motion.div>
    </main>
  );
}
