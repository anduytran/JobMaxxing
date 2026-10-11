import { cn } from "@/lib/utils";
import waveAsset from "@/assets/max/sized-wave.png.asset.json";
import resumeAsset from "@/assets/max/max-resume.png.asset.json";
import interviewAsset from "@/assets/max/sized-interview-clean.png.asset.json";
import skillsAsset from "@/assets/max/sized-skills.png.asset.json";
import hunt from "@/assets/max/max-hunt.svg";
import dapAsset from "@/assets/max/sized-dap-clean.png.asset.json";
import dizzyAsset from "@/assets/max/sized-dizzy.png.asset.json";
import emptyAsset from "@/assets/max/sized-empty.png.asset.json";

export const MAX_POSES = { wave: waveAsset.url, resume: resumeAsset.url, interview: interviewAsset.url, skills: skillsAsset.url, hunt, dap: dapAsset.url, dizzy: dizzyAsset.url, empty: emptyAsset.url } as const;
export type MaxPose = keyof typeof MAX_POSES;

// Every pose PNG carries a different amount of transparent padding around Max, so
// one shared box renders him at different sizes. These factors are measured from the
// artwork (the height Max's figure reaches inside its own canvas) and normalise each
// pose to the branding pose. The skills pose crouches under a raised dumbbell and the
// hunt pose is squat, so both get a little more than their padding alone asks for.
export const MAX_SCALE: Record<MaxPose, number> = {
  dap: 1,
  interview: 1.04,
  dizzy: 1.1,
  // The resume composite is a wide square with Max small inside it (figure height
  // 0.568 of canvas vs 0.996 for the branding pose), so his box grows to compensate.
  resume: 1.75,
  skills: 1.16,
  wave: 1.16,
  hunt: 1.23,
  // The empty pose was cropped to wave's framing (body height 0.824 vs 0.826, same
  // foot line), so it needs exactly wave's factor to render at the same visible size.
  empty: 1.16,
};


export function Max({ pose = "wave", className, alt = "" }: { pose?: MaxPose; className?: string | undefined; alt?: string }) {
  return <img src={MAX_POSES[pose]} alt={alt} width={640} height={640} draggable={false} className={cn("mascot-personality object-contain", className)} />;
}
