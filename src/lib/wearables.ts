// Wearable catalog shared by client and server. Artwork lives in
// src/assets/wearables (CDN pointers) and is imported by components/Wearables.tsx;
// this module stays asset-free so server functions can validate ids.

export type WearableSlot = "eyes" | "handle" | "head" | "head+handle" | "body";

export type WearableDef = {
  id: string; // store item id, e.g. wearable_bow
  name: string;
  slots: WearableSlot[];
  // Placement on Max's square pose canvas (the wave pose, 1174x1174), in percent.
  left: number;
  top: number;
  width: number;
};

export const ROLL_COST = 250;

export const WEARABLES: WearableDef[] = [
  { id: "wearable_googly", name: "Googly eyes", slots: ["eyes"], left: 22, top: 38, width: 56 },
  { id: "wearable_groucho", name: "Groucho glasses", slots: ["eyes"], left: 24, top: 40, width: 52 },
  { id: "wearable_bow", name: "Orange bow", slots: ["handle"], left: 52, top: 3, width: 18 },
  { id: "wearable_ears", name: "Cat ears", slots: ["head"], left: 16, top: 5, width: 68 },
  { id: "wearable_horns", name: "Devil horns", slots: ["head"], left: 24, top: 7, width: 52 },
  { id: "wearable_mcap", name: "M cap", slots: ["head", "handle"], left: 28, top: 0, width: 44 },
  { id: "wearable_afro", name: "Green afro", slots: ["head", "handle"], left: 6, top: -3, width: 88 },
  { id: "wearable_gem", name: "Green gem", slots: ["body"], left: 44, top: 68, width: 12 },
];

export const WEARABLE_IDS = WEARABLES.map((w) => w.id);

/** True when two wearables fight over the same slot (only one can be worn). */
export function slotsConflict(a: WearableDef, b: WearableDef) {
  return a.slots.some((s) => b.slots.includes(s));
}
