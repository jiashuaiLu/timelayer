"use client";

import { create } from "zustand";
import type { Block } from "@/domain/types";
import { sliceAt, sliceYears } from "@/pipeline/slices";

export type PlaybackState = {
  block: Block | null;
  /** continuous year under the viewfinder — may sit between slices while dragging */
  year: number;
  /** the slice the map is actually showing */
  sliceYear: number;
  visited: number[];
  selectedId: string | null;
  /** milliseconds spent on each slice — decides the card's hero frame */
  dwell: Record<number, number>;
  enteredAt: number;
  init(block: Block, year?: number): void;
  setYear(year: number): void;
  settle(year: number): void;
  selectEvent(id: string | null): void;
};

export const usePlayer = create<PlaybackState>((set, get) => ({
  block: null,
  year: 2026,
  sliceYear: 2026,
  visited: [],
  selectedId: null,
  dwell: {},
  enteredAt: 0,

  init(block, year) {
    const years = sliceYears(block);
    const start = year ?? years[years.length - 1];
    set({
      block,
      year: start,
      sliceYear: start,
      visited: [start],
      selectedId: null,
      dwell: { [start]: 0 },
      enteredAt: Date.now(),
    });
  },

  setYear(year) {
    const { block, sliceYear, visited, dwell } = get();
    if (!block) return;
    const next = sliceAt(block, year).year;
    if (next === sliceYear) {
      set({ year });
      return;
    }
    const now = Date.now();
    set({
      year,
      sliceYear: next,
      visited: visited.includes(next) ? visited : [...visited, next],
      dwell: {
        ...dwell,
        [sliceYear]: (dwell[sliceYear] ?? 0) + (now - get().enteredAt),
        [next]: dwell[next] ?? 0,
      },
      enteredAt: now,
    });
  },

  settle(year) {
    const { block, sliceYear, visited, dwell } = get();
    if (!block) return;
    const next = sliceAt(block, year).year;
    const now = Date.now();
    set({
      year,
      sliceYear: next,
      visited: visited.includes(next) ? visited : [...visited, next],
      selectedId: null,
      dwell: {
        ...dwell,
        [sliceYear]: (dwell[sliceYear] ?? 0) + (now - get().enteredAt),
        [next]: dwell[next] ?? 0,
      },
      enteredAt: now,
    });
  },

  selectEvent(id) {
    set({ selectedId: id });
  },
}));
