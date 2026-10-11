import { useCallback, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Mic, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import soloArt from "@/assets/max/max-solo.png.asset.json";
import peerArt from "@/assets/max/max-duel.png.asset.json";
import { cn } from "@/lib/utils";

/**
 * Every "Interview" entry point opens this small popup instead of jumping straight
 * into the AI mock interview, so the player chooses who interviews them: the AI
 * recruiter (Solo) or a friend on a live call (Peer). Each mode carries its own Max
 * artwork — one briefcase reaching out for Solo, two standing together for Peer.
 */
type InterviewMode = {
  key: string;
  to: "/interview" | "/peers";
  label: string;
  tag: string;
  blurb: string;
  reward: string;
  art: string;
  artClass: string;
  icon: typeof Mic;
};

const MODES: InterviewMode[] = [
  {
    key: "solo",
    to: "/interview",
    label: "Solo",
    tag: "AI recruiter",
    blurb: "An AI interviewer asks out loud, listens to your answers and grades you the moment you finish.",
    reward: "Up to 400 XP",
    art: soloArt.url,
    artClass: "h-24",
    icon: Mic,
  },
  {
    key: "peer",
    to: "/peers",
    label: "Peer",
    tag: "With a friend",
    blurb: "You and a friend run the same interview over a live call — one asks, one answers, both get graded.",
    reward: "XP for both",
    art: peerArt.url,
    artClass: "h-16",
    icon: Users,
  },
];

export function useInterviewModePicker() {
  const [open, setOpen] = useState(false);
  const openInterviewMode = useCallback(() => setOpen(true), []);
  return {
    openInterviewMode,
    interviewModeDialog: <InterviewModeDialog open={open} onOpenChange={setOpen} />,
  };
}

function InterviewModeDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden rounded-lg p-0 sm:max-w-xl">
        <DialogHeader className="px-6 pb-1 pt-6 text-left">
          <DialogTitle className="text-xl">Who's interviewing you?</DialogTitle>
          <DialogDescription>Same questions, same grading — you pick who asks.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 p-5 pt-4 sm:grid-cols-2">
          {MODES.map((mode) => {
            const card = (
              <>
                <span className="grid h-28 place-items-center overflow-hidden rounded-sm border border-border bg-muted/50 px-3">
                  <img
                    src={mode.art}
                    alt=""
                    aria-hidden
                    draggable={false}
                    className={cn("object-contain transition-transform duration-300 group-hover:scale-[1.05]", mode.artClass)}
                  />
                </span>
                <span className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <mode.icon className="h-3.5 w-3.5" />
                  {mode.tag}
                </span>
                <span className="mt-1 text-lg font-bold">{mode.label}</span>
                <span className="mt-1 flex-1 text-sm text-muted-foreground">{mode.blurb}</span>
                <span className="mt-3 flex items-center justify-between text-sm font-semibold text-primary">
                  {mode.reward}
                  <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
                </span>
              </>
            );
            const cls =
              "hover-lift group flex flex-col overflow-hidden rounded-md border bg-card p-4 text-left transition-colors hover:border-primary/60";
            return mode.to === "/interview" ? (
              <Link key={mode.key} to="/interview" search={{ radar: undefined }} className={cls} onClick={() => onOpenChange(false)}>
                {card}
              </Link>
            ) : (
              <Link key={mode.key} to="/peers" className={cls} onClick={() => onOpenChange(false)}>
                {card}
              </Link>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function InterviewModeTrigger({
  openInterviewMode,
  className,
  children,
}: {
  openInterviewMode: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button type="button" onClick={openInterviewMode} className={className}>
      {children}
    </button>
  );
}
