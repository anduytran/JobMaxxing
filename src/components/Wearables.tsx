import { MAX_POSES } from "@/components/Max";
import { WEARABLES, type WearableDef } from "@/lib/wearables";
import bowAsset from "@/assets/wearables/bow.png.asset.json";
import earsAsset from "@/assets/wearables/ears.png.asset.json";
import hornsAsset from "@/assets/wearables/horns.png.asset.json";
import grouchoAsset from "@/assets/wearables/groucho.png.asset.json";
import googlyAsset from "@/assets/wearables/googly.png.asset.json";
import mcapAsset from "@/assets/wearables/mcap.png.asset.json";
import afroAsset from "@/assets/wearables/afro.png.asset.json";
import machineAsset from "@/assets/wearables/machine.png.asset.json";
import capsuleAsset from "@/assets/wearables/capsule.png.asset.json";

export const WEARABLE_ART: Record<string, string> = {
  wearable_bow: bowAsset.url,
  wearable_ears: earsAsset.url,
  wearable_horns: hornsAsset.url,
  wearable_groucho: grouchoAsset.url,
  wearable_googly: googlyAsset.url,
  wearable_mcap: mcapAsset.url,
  wearable_afro: afroAsset.url,
};

export const MACHINE_ART = machineAsset.url;
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

/** Max (wave pose) wearing the given wearable ids, scaled fluidly to `width`. */
export function MaxFigure({ worn = [], width = 200, className }: { worn?: string[]; width?: number; className?: string }) {
  return (
    <span className={`relative inline-block select-none ${className ?? ""}`} style={{ width, aspectRatio: "1 / 1" }}>
      <img src={MAX_POSES.wave} alt="Max" draggable={false} className="absolute inset-0 h-full w-full object-contain" />
      {WEARABLES.filter((w) => worn.includes(w.id)).map((w) => (
        <img
          key={w.id}
          src={WEARABLE_ART[w.id]}
          alt=""
          draggable={false}
          className="absolute"
          style={{ left: `${w.left}%`, top: `${w.top}%`, width: `${w.width}%` }}
        />
      ))}
    </span>
  );
}
