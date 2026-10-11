// Where each wearable sits on each Max pose. Wearable defaults are calibrated to
// the wave pose; every pose gets measured anchors (face centre, handle top-centre)
// and a size factor, so a wearable follows Max's head when he tilts, crouches or
// shrinks. Users can then drag a wearable to their own spot per pose, saved as
// `spots[pose][wearableId] = { left, top }` (percent of the square pose canvas).
import type { WearableDef } from "@/lib/wearables";

export type PoseKey = "wave" | "resume" | "interview" | "skills" | "hunt" | "dap" | "dizzy" | "empty";
export type Spot = { left: number; top: number };
export type WearableSpots = Partial<Record<PoseKey, Record<string, Spot>>>;

type Anchors = { face: [number, number]; handle: [number, number]; s: number };

// Measured from the pose artwork, in percent of each square canvas.
export const POSE_ANCHORS: Record<PoseKey, Anchors> = {
  wave: { face: [47, 53], handle: [47, 8], s: 1 },
  interview: { face: [46, 48], handle: [63, 2], s: 0.9 },
  resume: { face: [50, 50], handle: [53, 8], s: 0.9 },
  skills: { face: [58, 59], handle: [61, 20], s: 0.85 },
  hunt: { face: [49, 53], handle: [52, 11], s: 1 },
  dap: { face: [63, 48], handle: [57, 1], s: 1 },
  dizzy: { face: [50, 52], handle: [50, 25], s: 0.66 },
  empty: { face: [50, 64], handle: [50, 8], s: 0.85 },
};

export const POSE_LABELS: Record<PoseKey, string> = {
  wave: "Wave", interview: "Interview", resume: "Resume", skills: "Skills",
  hunt: "Job Radar", dap: "Thumbs up", dizzy: "Dizzy", empty: "Empty box",
};

export const POSE_KEYS = Object.keys(POSE_ANCHORS) as PoseKey[];

function anchorFor(def: WearableDef): "face" | "handle" {
  return def.slots.some((s) => s === "head" || s === "handle" || s === "head+handle") ? "handle" : "face";
}

/** Final left/top/width (percent) of a wearable on a pose, honouring a saved spot. */
export function placeWearable(def: WearableDef, pose: string, spots?: WearableSpots | null) {
  const key = (pose in POSE_ANCHORS ? pose : "wave") as PoseKey;
  const p = POSE_ANCHORS[key];
  const w = POSE_ANCHORS.wave;
  const a = anchorFor(def);
  const width = def.width * p.s;
  const custom = spots?.[key]?.[def.id];
  if (custom) return { left: custom.left, top: custom.top, width };
  return {
    left: p[a][0] + (def.left - w[a][0]) * p.s,
    top: p[a][1] + (def.top - w[a][1]) * p.s,
    width,
  };
}

/** Validate untrusted spot data (from the client or the database). */
export function cleanSpots(raw: unknown, ids: string[]): WearableSpots {
  const out: WearableSpots = {};
  if (!raw || typeof raw !== "object") return out;
  for (const pose of POSE_KEYS) {
    const per = (raw as any)[pose];
    if (!per || typeof per !== "object") continue;
    const m: Record<string, Spot> = {};
    for (const id of ids) {
      const s = per[id];
      if (s && Number.isFinite(s.left) && Number.isFinite(s.top))
        m[id] = { left: Math.max(-30, Math.min(100, Math.round(s.left * 10) / 10)), top: Math.max(-30, Math.min(100, Math.round(s.top * 10) / 10)) };
    }
    if (Object.keys(m).length) out[pose] = m;
  }
  return out;
}
