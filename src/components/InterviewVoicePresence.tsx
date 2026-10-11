import { AudioLines, Brain, Loader2, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export type InterviewVoiceState = "ready" | "listening" | "thinking" | "preparing" | "speaking" | "grading";

const STATES = {
  ready: { label: "Your turn", icon: Mic },
  listening: { label: "Listening to you", icon: Mic },
  thinking: { label: "Thinking", icon: Brain },
  preparing: { label: "Preparing voice", icon: Loader2 },
  speaking: { label: "Interviewer speaking", icon: AudioLines },
  grading: { label: "Reviewing your interview", icon: Brain },
};

export function InterviewVoicePresence({ state, caption }: { state: InterviewVoiceState; caption?: string }) {
  const { label, icon: Icon } = STATES[state];
  return (
    <div className="flex w-full flex-col items-center gap-7 px-4 py-10 text-center sm:px-8" data-voice-state={state}>
      <div className={cn("interview-voice-circle", `interview-voice-${state}`)} aria-hidden="true">
        <div className="interview-voice-ring" />
        <div className="interview-voice-core"><Icon className="h-10 w-10" /></div>
      </div>
      <div role="status" aria-live="polite" className="text-sm font-semibold">{label}</div>
      <div className="flex min-h-20 w-full max-w-2xl items-start justify-center">
        {caption && <p className="text-lg leading-relaxed text-foreground sm:text-xl">{caption}</p>}
      </div>
    </div>
  );
}