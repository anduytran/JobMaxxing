import { useSyncExternalStore } from "react";
import { getActiveWearables } from "@/lib/store.functions";
import type { WearableSpots } from "@/lib/wearable-fit";

// Module-level cache of the signed-in user's equipped wearables (and their custom
// per-pose spots) so every Max on screen dresses the same way without each
// component fetching. `refreshWearables` / `setWearableSpots` update it instantly.
type Outfit = { ids: string[]; spots: WearableSpots };
let cached: Outfit | null = null;
let inflight: Promise<void> | null = null;
let gen = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function load() {
  if (cached !== null || inflight) return;
  const mine = ++gen;
  inflight = getActiveWearables()
    .then((r) => {
      if (mine !== gen) return;
      cached = r.ok ? { ids: r.ids, spots: r.spots } : EMPTY;
    })
    .catch(() => {
      if (mine === gen) cached = EMPTY;
    })
    .finally(() => {
      if (mine === gen) inflight = null;
      emit();
    });
}

/**
 * Update the equipped-wearables cache. When the caller already knows the new
 * ids (e.g. right after equipping), pass them so every Max updates instantly.
 */
export function refreshWearables(ids?: string[]) {
  gen++;
  inflight = null;
  if (ids) {
    cached = { ids, spots: cached?.spots ?? {} };
    emit();
    return;
  }
  cached = null;
  load();
}

/** Apply new custom spots to every Max on screen immediately. */
export function setWearableSpots(spots: WearableSpots) {
  gen++;
  inflight = null;
  cached = { ids: cached?.ids ?? [], spots };
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  load();
  return () => listeners.delete(cb);
}

export function useOutfit(): Outfit {
  return useSyncExternalStore(subscribe, () => cached ?? EMPTY, () => EMPTY);
}

export function useWornWearables(): string[] {
  return useOutfit().ids;
}

const EMPTY: Outfit = { ids: [], spots: {} };
