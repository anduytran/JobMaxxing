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
        <span className="sticky-tag absolute -top-6 left-1/2 z-20 -translate-x-1/2 px-3 py-1.5 text-[13px] font-bold italic tracking-tight">
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
      {/* The desk: surface fills most of the screen, then the table edge, then the ground. */}
      <div className="desk-scene">
        <div className="desk-surface">
          {/* scattered loose papers */}
          <DeskPaper className="left-[1.5%] top-[10%] h-40 w-32 -rotate-6" seed={1} />
          <DeskPaper className="left-[3%] top-[48%] h-32 w-28 rotate-3" seed={2} />
          <DeskPaper className="right-[1.5%] top-[8%] h-44 w-36 rotate-6" seed={3} />
          <DeskPaper className="right-[3%] top-[52%] h-32 w-28 -rotate-3" seed={4} />

          {/* Heading on the left, Max's note pinned to the desk on the right. */}
          <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-wrap items-start justify-between gap-6 px-4 pt-10 md:px-8">
            <h1 className="text-4xl font-bold md:text-5xl">Choose your mode</h1>
            <MaxNote note={note} onCycle={next} className="-rotate-2" />
          </div>

          <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 content-end items-end gap-10 px-4 pb-14 md:grid-cols-3 md:px-8">
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

/** Loose paper with handwriting-like scribbles; lives only in the desk's side gutters so it never sits under UI. */
function DeskPaper({ className, seed }: { className: string; seed: number }) {
  let x = seed * 9301 + 49297;
  const rnd = () => ((x = (x * 9301 + 49297) % 233280) / 233280);
  const lines = Array.from({ length: 7 }, (_, i) => {
    const y = 14 + i * 11;
    const end = 60 + rnd() * 30;
    let d = `M8 ${y}`;
    for (let px = 8; px < end; px += 4) d += ` q2 ${(rnd() * 6 - 3).toFixed(1)} 4 0`;
    return <path key={i} d={d} />;
  });
  return (
    <span aria-hidden className={`desk-paper hidden 2xl:block ${className}`}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" style={{ color: "oklch(0.35 0.03 260 / 0.55)" }}>
        {lines}
      </svg>
    </span>
  );
}
