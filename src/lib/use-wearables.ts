import { useSyncExternalStore } from "react";
import { getActiveWearables } from "@/lib/store.functions";

// Module-level cache of the signed-in user's equipped wearables so every Max on
// screen dresses the same way without each component fetching. `refreshWearables`
// is called after equipping/unequipping to bust the cache.
let cached: string[] | null = null;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load() {
  if (cached !== null || inflight) return;
  inflight = getActiveWearables()
    .then((r) => {
      cached = r.ok ? r.ids : [];
    })
    .catch(() => {
      cached = [];
    })
    .finally(() => {
      inflight = null;
      emit();
    });
}

/**
 * Update the equipped-wearables cache. When the caller already knows the new
 * ids (e.g. right after equipping), pass them so every Max updates instantly
 * and no stale in-flight fetch can overwrite the fresh value.
 */
export function refreshWearables(ids?: string[]) {
  if (ids) {
    cached = ids;
    inflight = null;
    emit();
    return;
  }
  cached = null;
  inflight = null;
  load();
}

export function useWornWearables(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      load();
      return () => listeners.delete(cb);
    },
    () => cached ?? EMPTY,
  );
}

const EMPTY: string[] = [];
