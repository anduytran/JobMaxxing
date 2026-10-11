import { useRef, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_POSES } from "@/components/Max";
import { WEARABLE_ART, pct } from "@/components/Wearables";
import { WEARABLES } from "@/lib/wearables";
import { POSE_KEYS, POSE_LABELS, placeWearable, type PoseKey, type WearableSpots } from "@/lib/wearable-fit";
import { setWearableSpots, useOutfit } from "@/lib/use-wearables";
import { saveWearableSpots } from "@/lib/store.functions";
import { cn } from "@/lib/utils";

/** Drag equipped wearables to custom spots, separately for every Max pose. */
export function WearableFitEditor({ worn }: { worn: string[] }) {
  const { spots: saved } = useOutfit();
  const [pose, setPose] = useState<PoseKey>("wave");
  const [draft, setDraft] = useState<WearableSpots | null>(null);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const spots = draft ?? saved;
  const items = WEARABLES.filter((w) => worn.includes(w.id));

  function move(id: string, left: number, top: number) {
    setDraft((d) => {
      const base = d ?? saved;
      return { ...base, [pose]: { ...(base[pose] ?? {}), [id]: { left, top } } };
    });
  }

  function pointer(e: React.PointerEvent) {
    const d = drag.current; const r = box.current?.getBoundingClientRect();
    if (!d || !r) return;
    const left = ((e.clientX - r.left) / r.width) * 100 - d.dx;
    const top = ((e.clientY - r.top) / r.height) * 100 - d.dy;
    move(d.id, Math.max(-30, Math.min(100, left)), Math.max(-30, Math.min(100, top)));
  }

  function nudge(id: string, key: string) {
    const step = ({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] } as Record<string, [number, number]>)[key];
    if (!step) return false;
    const p = placeWearable(WEARABLES.find((w) => w.id === id)!, pose, spots);
    move(id, p.left + step[0], p.top + step[1]);
    return true;
  }

  function resetPose() {
    const base = { ...spots };
    delete base[pose];
    setDraft(base);
  }

  async function save() {
    if (!draft) return;
    setSaving(true);
    const r = await saveWearableSpots({ data: { spots: draft } });
    setSaving(false);
    if (!r.ok) { toast.error(r.error); return; }
    setWearableSpots(draft);
    setDraft(null);
    toast.success("Fit saved — every Max is wearing it that way now");
  }

  return (
    <div className="mt-6 border-t border-border pt-5">
      <h3 className="font-semibold">Adjust the fit</h3>
      <p className="text-sm text-muted-foreground">Pick a pose, then drag a wearable (or use arrow keys) to where it looks best. Each pose remembers its own spot.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {POSE_KEYS.map((k) => (
          <button key={k} type="button" onClick={() => setPose(k)} aria-pressed={pose === k}
            className={cn("rounded-full border px-3 py-1 text-xs font-medium transition-colors", pose === k ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50")}>
            {POSE_LABELS[k]}{spots[k] ? " •" : ""}
          </button>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div ref={box} className="relative aspect-square w-[min(320px,80vw)] touch-none select-none rounded-xl bg-muted/40"
          onPointerMove={pointer} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
          <img src={MAX_POSES[pose]} alt={`Max, ${POSE_LABELS[pose]} pose`} draggable={false} className="absolute inset-0 h-full w-full object-contain" />
          {items.map((w) => {
            const p = placeWearable(w, pose, spots);
            return (
              <img key={w.id} src={WEARABLE_ART[w.id]} alt={`${w.name} — drag to move`} draggable={false} tabIndex={0}
                className="absolute cursor-grab rounded outline-none focus-visible:ring-2 focus-visible:ring-primary active:cursor-grabbing"
                style={pct(p)}
                onKeyDown={(e) => { if (nudge(w.id, e.key)) e.preventDefault(); }}
                onPointerDown={(e) => {
                  const r = box.current!.getBoundingClientRect();
                  drag.current = { id: w.id, dx: ((e.clientX - r.left) / r.width) * 100 - p.left, dy: ((e.clientY - r.top) / r.height) * 100 - p.top };
                  (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
                }} />
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={resetPose} disabled={!spots[pose]}><RotateCcw /> Reset this pose</Button>
          <Button onClick={save} disabled={!draft || saving}>{saving && <Loader2 className="animate-spin" />}Save fit</Button>
        </div>
      </div>
    </div>
  );
}
