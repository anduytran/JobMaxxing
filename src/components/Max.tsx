import { cn } from "@/lib/utils";
import wave from "@/assets/max/max-wave.svg";
import resume from "@/assets/max/max-resume.svg";
import interview from "@/assets/max/max-interview.svg";
import skills from "@/assets/max/max-skills.svg";
import hunt from "@/assets/max/max-hunt.svg";
import dap from "@/assets/max/max-dap.svg";

export const MAX_POSES = { wave, resume, interview, skills, hunt, branding, dap } as const;
export type MaxPose = keyof typeof MAX_POSES;

export function Max({ pose = "wave", className, alt = "" }: { pose?: MaxPose; className?: string | undefined; alt?: string }) {
  return <img src={MAX_POSES[pose]} alt={alt} width={640} height={640} draggable={false} className={cn("mascot-personality object-contain", className)} />;
}
