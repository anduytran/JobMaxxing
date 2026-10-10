import { cn } from "@/lib/utils";
import waveAsset from "@/assets/max/sized-wave.png.asset.json";
import resumeAsset from "@/assets/max/sized-resume.png.asset.json";
import interviewAsset from "@/assets/max/sized-interview-clean.png.asset.json";
import skillsAsset from "@/assets/max/sized-skills.png.asset.json";
import hunt from "@/assets/max/max-hunt.svg";
import dapAsset from "@/assets/max/sized-dap-clean.png.asset.json";

export const MAX_POSES = { wave: waveAsset.url, resume: resumeAsset.url, interview: interviewAsset.url, skills: skillsAsset.url, hunt, dap: dapAsset.url } as const;
export type MaxPose = keyof typeof MAX_POSES;

// Every pose PNG carries a different amount of transparent padding around Max, so
// one shared box renders him at different sizes. These factors are measured from the
// artwork — the height of Max's briefcase body as a fraction of its own canvas — and
// normalise each pose to the branding pose, which is the reference.
export const MAX_SCALE: Record<MaxPose, number> = {
  dap: 1,
  interview: 1.04,
  resume: 1.1,
  skills: 1.32,
  wave: 1.21,
  hunt: 1.23,
};


export function Max({ pose = "wave", className, alt = "" }: { pose?: MaxPose; className?: string | undefined; alt?: string }) {
  return <img src={MAX_POSES[pose]} alt={alt} width={640} height={640} draggable={false} className={cn("mascot-personality object-contain", className)} />;
}
