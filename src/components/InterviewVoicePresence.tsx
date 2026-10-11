import { cn } from "@/lib/utils";

export type InterviewVoiceState = "ready" | "listening" | "thinking" | "preparing" | "speaking" | "grading";

/**
 * The interview orb. Pulses while the interviewer speaks, slowly draws
 * inward while the candidate answers, spins its ring while thinking.
 */
export function InterviewVoicePresence({ state, className }: { state: InterviewVoiceState; className?: string }) {
  return (
    <div className={cn("interview-voice-circle", `interview-voice-${state}`, className)} aria-hidden="true" data-voice-state={state}>
      <div className="interview-voice-ring" />
      <div className="interview-voice-core" />
    </div>
  );
}
