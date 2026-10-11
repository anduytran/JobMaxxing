import { MAX_POSES, type MaxPose } from "@/components/Max";
import { WEARABLES, type WearableDef } from "@/lib/wearables";
import { useOutfit } from "@/lib/use-wearables";
import { placeWearable } from "@/lib/wearable-fit";
import bowAsset from "@/assets/wearables/bow.png.asset.json";
import earsAsset from "@/assets/wearables/ears.png.asset.json";
import hornsAsset from "@/assets/wearables/horns.png.asset.json";
import grouchoAsset from "@/assets/wearables/groucho.png.asset.json";
import googlyAsset from "@/assets/wearables/googly.png.asset.json";
import mcapAsset from "@/assets/wearables/mcap.png.asset.json";
import afroAsset from "@/assets/wearables/afro.png.asset.json";
import gemAsset from "@/assets/wearables/gem.png.asset.json";
import mimicAsset from "@/assets/wearables/mimic-chest.png.asset.json";
import capsuleAsset from "@/assets/wearables/capsule.png.asset.json";

export const WEARABLE_ART: Record<string, string> = {
  wearable_bow: bowAsset.url,
  wearable_ears: earsAsset.url,
  wearable_horns: hornsAsset.url,
  wearable_groucho: grouchoAsset.url,
  wearable_googly: googlyAsset.url,
  wearable_mcap: mcapAsset.url,
  wearable_afro: afroAsset.url,
  wearable_gem: gemAsset.url,
};

export const MACHINE_ART = mimicAsset.url;
export const CAPSULE_ART = capsuleAsset.url;

/** A single wearable, rendered at its natural aspect ratio. */
export function WearableArt({ item, width, className }: { item: WearableDef; width: number; className?: string }) {
  return (
    <img
      src={WEARABLE_ART[item.id]}
      alt=""
      draggable={false}
      loading="lazy"
      style={{ width }}
      className={className}
    />
  );
}

/** Max (any pose, default wave) wearing the given wearable ids, scaled fluidly to `width`. */
export function MaxFigure({ worn = [], width = 200, className, pose = "wave" }: { worn?: string[]; width?: number; className?: string; pose?: MaxPose }) {
  const { spots } = useOutfit();
  return (
    <span className={`relative inline-block select-none ${className ?? ""}`} style={{ width, aspectRatio: "1 / 1" }}>
      <img src={MAX_POSES[pose]} alt="Max" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
      {WEARABLES.filter((w) => worn.includes(w.id)).map((w) => (
        <img
          key={w.id}
          src={WEARABLE_ART[w.id]}
          alt=""
          draggable={false}
          className="absolute"
          style={pct(placeWearable(w, pose, spots))}
        />
      ))}
    </span>
  );
}

/**
 * Max in any pose, dressed with the signed-in user's equipped wearables.
 * Placement follows each pose's measured head/face anchors plus any spot the
 * user dragged the wearable to for that pose.
 */
export function WornMax({ pose = "wave", className, alt = "" }: { pose?: MaxPose | undefined; className?: string | undefined; alt?: string | undefined }) {
  const { ids: worn, spots } = useOutfit();
  return (
    <span className={`relative inline-block select-none ${className ?? ""}`}>
      <img src={MAX_POSES[pose]} alt={alt} width={640} height={640} draggable={false} className="mascot-personality block h-full w-full object-contain" />
      {WEARABLES.filter((w) => worn.includes(w.id)).map((w) => (
        <img
          key={w.id}
          src={WEARABLE_ART[w.id]}
          alt=""
          draggable={false}
          className="pointer-events-none absolute"
          style={pct(placeWearable(w, pose, spots))}
        />
      ))}
    </span>
  );
}

export function pct(p: { left: number; top: number; width: number }) {
  return { left: `${p.left}%`, top: `${p.top}%`, width: `${p.width}%` };
}
