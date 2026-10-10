import { cn } from "@/lib/utils";
import waveAsset from "@/assets/max/original-wave.png.asset.json";
import resumeAsset from "@/assets/max/original-resume.png.asset.json";
import interviewAsset from "@/assets/max/original-interview.png.asset.json";
import skillsAsset from "@/assets/max/original-skills.png.asset.json";
import hunt from "@/assets/max/max-hunt.svg";
import dapAsset from "@/assets/max/original-dap.png.asset.json";

export const MAX_POSES = { wave: waveAsset.url, resume: resumeAsset.url, interview: interviewAsset.url, skills: skillsAsset.url, hunt, dap: dapAsset.url } as const;
export type MaxPose = keyof typeof MAX_POSES;

export function Max({ pose = "wave", className, alt = "" }: { pose?: MaxPose; className?: string | undefined; alt?: string }) {
  return <img src={MAX_POSES[pose]} alt={alt} width={640} height={640} draggable={false} className={cn("mascot-personality object-contain", className)} />;
}
