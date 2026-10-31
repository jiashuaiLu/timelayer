"use client";

import { openDB, type IDBPDatabase } from "idb";

/**
 * No accounts, but the second visit should feel like the second visit.
 * Only the block slug is stored — never the address that led to it.
 */

const DB = "timelayer";
const STORE = "visits";

let dbPromise: Promise<IDBPDatabase> | null = null;

function db() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB, 1, {
      upgrade(database) {
        if (!database.objectStoreNames.contains(STORE)) {
          database.createObjectStore(STORE, { keyPath: "slug" });
        }
      },
    });
  }
  return dbPromise;
}

export type Visit = { slug: string; name: string; at: number };

export async function rememberVisit(visit: Visit): Promise<void> {
  try {
    const database = await db();
    if (!database) return;
    await database.put(STORE, visit);
  } catch {
    // private mode, quota, or no IndexedDB — the product works without it
  }
}

export async function lastVisit(): Promise<Visit | null> {
  try {
    const database = await db();
    if (!database) return null;
    const all = (await database.getAll(STORE)) as Visit[];
    if (!all.length) return null;
    return all.sort((a, b) => b.at - a.at)[0];
  } catch {
    return null;
  }
}
