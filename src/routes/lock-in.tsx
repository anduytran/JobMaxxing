import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Mic, Radar } from "lucide-react";
import { MAX_POSES } from "@/components/Max";
import { useInterviewModePicker } from "@/components/InterviewModePicker";
import { MaxNote, useRandomMaxNote } from "@/components/MaxNote";

export const Route = createFileRoute("/lock-in")({
  head: () => ({
    meta: [
      { title: "Lock In — JobMaxxing" },
      { name: "description", content: "Pick your mode: mock interview, Resume Lab or Job Radar." },
      { property: "og:title", content: "Lock In — JobMaxxing" },
      { property: "og:description", content: "Pick your mode: mock interview, Resume Lab or Job Radar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LockIn,
});

const MODES = [
  { to: "/interview" as const, title: "Interview", tag: "Main event", blurb: "Practice out loud with an AI recruiter or a friend, and get graded feedback.", icon: Mic, art: MAX_POSES.interview, folder: "folder-primary", xp: "+150 XP" },
  { to: "/setup" as const, title: "Resume Lab", tag: "Polish", blurb: "Grade your resume, accept fixes and level it past 80.", icon: FileText, art: MAX_POSES.resume, folder: "folder-accent", xp: "+15 XP / fix" },
  { to: "/market" as const, title: "Job Radar", tag: "Hunt", blurb: "Find roles matched to your resume and track where you applied.", icon: Radar, art: MAX_POSES.hunt, folder: "folder-success", xp: "+25 XP / save" },
];

/** A colored folder standing on the desk, Max peeking out of the top. */
function ModeFolder({ m, recommended }: { m: (typeof MODES)[number]; recommended?: boolean }) {
  return (
    <div className={`folder ${m.folder} relative flex h-full flex-col`}>
      {recommended && (
        <span className="absolute -top-3 left-1/2 z-20 -translate-x-1/2 -rotate-2 bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
          Recommended
        </span>
      )}
      {/* back panel + tab */}
      <span aria-hidden className="folder-back" />
      <span aria-hidden className="folder-tab" />
      {/* Max rising out of the folder */}
      <div className="folder-peek relative z-10 mx-auto -mb-6 mt-2 grid h-36 w-36 place-items-end overflow-visible">
        <img src={m.art} alt="" className="mascot-float h-36 w-36 object-contain drop-shadow-md" draggable={false} />
      </div>
      {/* front panel */}
      <div className="folder-front relative z-20 flex flex-1 flex-col p-5 pt-8">
        <div className="flex items-center gap-2">
          <span className="folder-icon grid h-9 w-9 shrink-0 place-items-center rounded-[3px]"><m.icon className="h-5 w-5" /></span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] opacity-70">{m.tag}</span>
          <span className="ml-auto shrink-0 border border-dashed border-current px-2 py-1 text-xs font-bold opacity-80">{m.xp}</span>
        </div>
        <h2 className="mt-3 text-2xl font-bold">{m.title}</h2>
        <p className="mt-2 flex-1 text-sm opacity-80">{m.blurb}</p>
      </div>
    </div>
  );
}

function LockIn() {
  // The Interview folder opens the solo / peer popup instead of going straight in.
  const { openInterviewMode, interviewModeDialog } = useInterviewModePicker();
  const { note, next } = useRandomMaxNote();
  return (
    <div className="-mx-4 -mb-8 md:-mx-8">
      <div className="mx-auto max-w-6xl px-4 md:px-8">
        <h1 className="text-4xl font-bold md:text-5xl">Choose your mode</h1>
        <MaxNote note={note} onCycle={next} className="mt-4" />
      </div>

      {/* The desk: surface fills most of the screen, then the table edge, then the ground. */}
      <div className="desk-scene mt-8">
        <div className="desk-surface">
          <div className="mx-auto grid h-full max-w-6xl content-end gap-10 px-4 pb-10 md:grid-cols-3 md:px-8">
            {MODES.map((m, i) => {
              const folder = <ModeFolder m={m} recommended={i === 0} />;
              return m.to === "/interview" ? (
                <button key={m.to} type="button" onClick={openInterviewMode} className="text-left">{folder}</button>
              ) : (
                <Link key={m.to} to={m.to} search={{ radar: undefined } as never} className="text-left">{folder}</Link>
              );
            })}
          </div>
        </div>
        <div aria-hidden className="desk-edge" />
        <div aria-hidden className="desk-ground" />
      </div>
      {interviewModeDialog}
    </div>
  );
}
