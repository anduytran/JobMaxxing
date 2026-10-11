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
  { to: "/interview" as const, title: "Interview", tag: "Main event", blurb: "Practice out loud with an AI recruiter or a friend, and get graded feedback.", icon: Mic, art: MAX_POSES.interview, tint: "bg-primary/15 text-primary", xp: "+150 XP" },
  { to: "/setup" as const, title: "Resume Lab", tag: "Polish", blurb: "Grade your resume, accept fixes and level it past 80.", icon: FileText, art: MAX_POSES.resume, tint: "bg-accent/20 text-accent-foreground", xp: "+15 XP / fix" },
  { to: "/market" as const, title: "Job Radar", tag: "Hunt", blurb: "Find roles matched to your resume and track where you applied.", icon: Radar, art: MAX_POSES.hunt, tint: "bg-success/15 text-success", xp: "+25 XP / save" },
];

/** The page of a mode: photo band up top, ruled paper below. */
function ModePage({ m }: { m: (typeof MODES)[number] }) {
  return (
    <>
      <div className={`relative grid h-52 shrink-0 place-items-center overflow-hidden border-b ${m.tint.split(" ")[0]}`}>
        <img src={m.art} alt="" className="mascot-float h-40 w-40 object-contain" draggable={false} />
      </div>
      <div className="paper-rules flex flex-1 flex-col p-6">
        <div className="flex items-center gap-2">
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-[3px] ${m.tint}`}><m.icon className="h-5 w-5" /></span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{m.tag}</span>
          <span className="ml-auto shrink-0 border border-dashed px-2 py-1 text-xs font-bold text-success">{m.xp}</span>
        </div>
        <h2 className="mt-4 text-2xl font-bold">{m.title}</h2>
        <p className="mt-2 flex-1 text-muted-foreground">{m.blurb}</p>
      </div>
    </>
  );
}

/** A pile of sheets: two pages fanned underneath, the live one on top. */
function ModeStack({ m, recommended }: { m: (typeof MODES)[number]; recommended?: boolean }) {
  return (
    <div className="paper-stack relative flex h-full flex-col pb-6">
      {recommended && (
        <span className="absolute -top-2 left-6 z-10 -rotate-1 bg-primary px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary-foreground">
          Recommended
        </span>
      )}
      <span aria-hidden className="paper-under paper-under-2" />
      <span aria-hidden className="paper-under paper-under-1" />
      <div className="paper-sheet flex h-full flex-col overflow-hidden">
        <ModePage m={m} />
      </div>
    </div>
  );
}

function LockIn() {
  // The Interview pile opens the solo / peer popup instead of going straight in.
  const { openInterviewMode, interviewModeDialog } = useInterviewModePicker();
  const { note, next } = useRandomMaxNote();
  return (

    <div className="mx-auto max-w-6xl">
      <h1 className="text-4xl font-bold md:text-5xl">Choose your mode</h1>
      <MaxNote note={note} onCycle={next} className="mt-4" />


      <div className="mt-10 grid gap-8 md:grid-cols-3">
        {MODES.map((m, i) => {
          const stack = <ModeStack m={m} recommended={i === 0} />;
          return m.to === "/interview" ? (
            <button key={m.to} type="button" onClick={openInterviewMode} className="text-left">{stack}</button>
          ) : (
            <Link key={m.to} to={m.to} search={{ radar: undefined } as never} className="text-left">{stack}</Link>
          );
        })}
      </div>
      {interviewModeDialog}
    </div>
  );
}
