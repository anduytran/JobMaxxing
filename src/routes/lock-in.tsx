import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, FileText, Mic, Radar } from "lucide-react";
import { MAX_POSES } from "@/components/Max";

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
  { to: "/interview" as const, title: "Interview", tag: "Main event", blurb: "Practice out loud with an AI recruiter and get graded feedback.", icon: Mic, art: MAX_POSES.interview, tint: "bg-primary/15 text-primary", xp: "+150 XP" },
  { to: "/setup" as const, title: "Resume Lab", tag: "Polish", blurb: "Grade your resume, accept fixes and level it past 80.", icon: FileText, art: MAX_POSES.resume, tint: "bg-accent/20 text-accent-foreground", xp: "+15 XP / fix" },
  { to: "/market" as const, title: "Job Radar", tag: "Hunt", blurb: "Find roles matched to your resume and track where you applied.", icon: Radar, art: MAX_POSES.hunt, tint: "bg-success/15 text-success", xp: "+25 XP / save" },
];

function LockIn() {
  return (
    <div className="mx-auto max-w-6xl">
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-muted-foreground">Phase 2 · Lock in</p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">Choose your mode</h1>
      <p className="mt-2 text-lg text-muted-foreground">Pick where you want to put in work today.</p>
      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {MODES.map((m, i) => (
          <Link key={m.to} to={m.to} search={{ radar: undefined } as never}
            className="hover-lift group flex flex-col overflow-hidden rounded-3xl border bg-card">
            <div className={`relative grid h-56 place-items-center ${m.tint.split(" ")[0]}`}>
              {i === 0 && <span className="absolute left-4 top-4 rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">Recommended</span>}
              <img src={m.art} alt="" className="mascot-float h-44 w-44 object-contain" draggable={false} />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center gap-2">
                <span className={`grid h-9 w-9 place-items-center rounded-lg ${m.tint}`}><m.icon className="h-5 w-5" /></span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{m.tag}</span>
                <span className="ml-auto text-sm font-semibold text-success">{m.xp}</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold">{m.title}</h2>
              <p className="mt-2 flex-1 text-muted-foreground">{m.blurb}</p>
              <span className="mt-6 flex items-center gap-2 font-semibold text-primary">Lock in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
