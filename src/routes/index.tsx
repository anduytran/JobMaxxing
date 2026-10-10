import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Code2, FileText, Flame, Mic, Radar, Sparkles, Users, Zap } from "lucide-react";
import { useGame } from "@/lib/game";
import { Mascot } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useEffect, useRef, useState } from "react";
import { getLatestResumeReview } from "@/lib/resume.functions";
import meadowScene from "@/assets/max/meadow.svg";
import type { StoredReview } from "@/lib/resume";
import { MAX_POSES } from "@/components/Max";
import { cn } from "@/lib/utils";
import gymScene from "@/assets/max/gym-scene.svg";
import billboardScene from "@/assets/max/billboard.svg";
import { questTitleLines } from "@/lib/quest-titles";
import { ResumeScoreCard } from "@/components/ResumeScoreCard";
import { XpCareerCard } from "@/components/DashboardProgressCards";

const MAX_ART: Record<string, string> = { setup: MAX_POSES.resume, resume: MAX_POSES.resume, interview: MAX_POSES.interview, skills: MAX_POSES.skills, hunt: MAX_POSES.hunt, branding: MAX_POSES.dap, social: MAX_POSES.dap };
const QUEST_LINK: Record<string, "/setup" | "/interview" | "/quests" | "/skills" | "/market"> = { setup: "/setup", resume: "/setup", interview: "/interview", skills: "/skills", hunt: "/market" };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobMaxxing" },
      { name: "description", content: "Build career momentum with resume improvements, daily and weekly quests, XP milestones, and your next career rank." },
      { property: "og:title", content: "JobMaxxing — Your career, levelled up" },
      { property: "og:description", content: "Level up your job hunt with quests, XP and AI mock interviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const CAT_ICON: Record<string, typeof FileText> = { resume: FileText, interview: Mic, social: Users };

// Per-type featured-quest scenes: tinted backdrop, floating icon and prop chips.
type Scene = { icon: typeof FileText; bg: string; ring: string; chip: string; props: [string, string][]; phrase: string; blurb: string };
const SCENES: Record<string, Scene> = {
  skills: {
    icon: Code2, bg: "bg-success/15", ring: "border-success/30", chip: "text-success",
    props: [["</>", "right-72 top-40 -rotate-6"], ["{ algo }", "right-52 bottom-28 rotate-3"], ["O(n)", "right-80 bottom-44 -rotate-3"]],
    phrase: "Sharpen the blade.",
    blurb: "One problem at a time — that's how sharp gets built. Solve a few today and the next one feels easier.",
  },
  interview: {
    icon: Mic, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Q&A", "right-72 top-40 -rotate-6"], ["STAR method", "right-52 bottom-28 rotate-3"], ["Tell me about…", "right-80 bottom-44 -rotate-3"]],
    phrase: "Talk it out.",
    blurb: "Say it out loud once and it stops being scary. Practice the answer before the real one asks.",
  },
  resume: {
    icon: FileText, bg: "bg-accent/20", ring: "border-accent/40", chip: "text-accent-foreground",
    props: [["ATS-friendly", "right-72 top-40 -rotate-6"], ["Impact verbs", "right-52 bottom-28 rotate-3"], ["+1 metric", "right-80 bottom-44 -rotate-3"]],
    phrase: "Polish your story.",
    blurb: "Your experience is good — let's make sure it reads that way. One edit at a time.",
  },
  hunt: {
    icon: Radar, bg: "bg-success/15", ring: "border-success/30", chip: "text-success",
    props: [["Remote", "right-72 top-40 -rotate-6"], ["92% match", "right-52 bottom-28 rotate-3"], ["New role", "right-80 bottom-44 -rotate-3"]],
    phrase: "Scan the horizon.",
    blurb: "The right role is out there. Look a little wider today and it gets a little closer.",
  },
  branding: {
    icon: Users, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Coffee chat", "right-72 top-40 -rotate-6"], ["LinkedIn", "right-52 bottom-28 rotate-3"], ["Dap!", "right-80 bottom-44 -rotate-3"]],
    phrase: "Grow your crew.",
    blurb: "Opportunities show up more when people know your name. Start one conversation today.",
  },
  social: {
    icon: Users, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Coffee chat", "right-72 top-40 -rotate-6"], ["LinkedIn", "right-52 bottom-28 rotate-3"], ["Dap!", "right-80 bottom-44 -rotate-3"]],
    phrase: "Grow your crew.",
    blurb: "Opportunities show up more when people know your name. Start one conversation today.",
  },
};
const DEFAULT_SCENE: Scene = {
  icon: Sparkles, bg: "bg-accent/20", ring: "border-accent/40", chip: "text-accent-foreground",
  props: [["Small win", "right-72 top-40 -rotate-6"], ["Momentum", "right-52 bottom-28 rotate-3"], ["+XP", "right-80 bottom-44 -rotate-3"]],
  phrase: "One step closer.",
  blurb: "Your dream role is closer than you think. Build your skills, sharpen your story, and make your next move.",
};

// Illustrated backdrop behind Max for the featured quest; one scene per quest type.
// The featured card now fills the viewport, so every scene scales with its height.
function SceneBackdrop({ kind }: { kind: string }) {
  if (kind === "branding" || kind === "social") {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <img src={billboardScene} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain object-center" draggable={false} />
      </div>
    );
  }
  if (kind === "skills") {
    return (
      <div className="absolute inset-0 overflow-hidden bg-gym-wall [container-type:inline-size]">
        <div className="absolute inset-x-0 bottom-0 h-[min(25cqw,25%)] bg-gym-floor" />
        <img src={gymScene} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain object-bottom" draggable={false} />
      </div>
    );
  }
  if (kind === "hunt") {
    return (
      <div className="absolute inset-0 overflow-hidden">
        <img src={meadowScene} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover object-bottom" draggable={false} />
      </div>
    );
  }
  if (kind === "interview") {
    return (
      <div className="absolute inset-0 flex justify-center">
        <div className="h-full w-[70%] bg-gradient-to-b from-primary/25 to-transparent [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
        <div className="absolute bottom-10 h-6 w-[55%] rounded-[50%] bg-primary/15" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {[-8, 4, -2].map((r, i) => (
        <div key={i} className="absolute h-72 w-56 rounded-xl border border-foreground/10 bg-card/70" style={{ transform: `rotate(${r}deg) translate(${i * 12}px, ${i * 8}px)` }}>
          <div className="mt-7 space-y-2.5 px-6">{[80, 60, 70, 50].map((w) => <div key={w} className="h-1.5 rounded bg-foreground/10" style={{ width: `${w}%` }} />)}</div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { name, title, level, levelXp, xp, quests, details, lastGain } = useGame();
  const first = name.split(" ")[0] || "there";
  const open = quests.filter((q) => !q.done);
  const done = quests.filter((q) => q.done).length;
  const [review, setReview] = useState<StoredReview | null>(null);
  const [reviewLoading, setReviewLoading] = useState(true);
  useEffect(() => { getLatestResumeReview().then((r) => { if (r.ok) setReview(r.review); }).catch(() => {}).finally(() => setReviewLoading(false)); }, []);
  const resumeScore = review?.score ?? (details.resume as { score?: number } | undefined)?.score;
  const [pick, setPick] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  const openCount = open.length;
  // Slide 0 is always the mock interview — the core product; quest slides follow.
  const total = openCount + 1;
  const featIdx = pick === null ? 0 : Math.min(pick, total - 1);
  const featured = featIdx === 0 ? null : open[featIdx - 1];
  const shift = (d: number) => {
    setDir(d);
    setPick(((((pick ?? featIdx) + d) % total) + total) % total);
  };
  const jump = (i: number) => { setDir(i >= featIdx ? 1 : -1); setPick(i); };
  const featKey = featured?.category?.toLowerCase() ?? "interview";
  const featArt = MAX_ART[featKey] ?? MAX_POSES.interview;
  // Decode Max and the scene backdrop together so they appear at the same moment.
  const sceneSrcs = [featArt, featKey === "skills" ? gymScene : featKey === "hunt" ? meadowScene : featKey === "branding" || featKey === "social" ? billboardScene : null].filter(Boolean) as string[];
  const sceneKey = sceneSrcs.join("|");
  const [readyKey, setReadyKey] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all(sceneSrcs.map((s) => { const i = new Image(); i.src = s; return i.decode().catch(() => {}); })).then(() => { if (live) setReadyKey(sceneKey); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);
  useEffect(() => { [gymScene, billboardScene, meadowScene, ...Object.values(MAX_POSES)].forEach((s) => { const i = new Image(); i.src = s; }); }, []);
  const sceneReady = readyKey === sceneKey;
  const featLink = QUEST_LINK[featKey] ?? "/quests";
  const scene = SCENES[featKey] ?? (featKey === "setup" ? SCENES["resume"] : undefined) ?? DEFAULT_SCENE;
  const featLines = featured ? questTitleLines(featured.title) : ["", ""];
  const reducedMotion = useReducedMotion();
  const headRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  // Slide the headline and its line in with the Web Animations API. The nodes stay
  // mounted, so switching quests replaces the text instead of stacking a new headline.
  useEffect(() => {
    if (reducedMotion || !featured) return;
    headRef.current?.animate(
      [{ opacity: 0, transform: `translateX(${-16 * dir}px)` }, { opacity: 1, transform: "none" }],
      { duration: 300, easing: "ease-out" },
    );
    subRef.current?.animate(
      [{ opacity: 0, transform: `translateX(${-10 * dir}px)` }, { opacity: 1, transform: "none" }],
      { duration: 300, delay: 50, easing: "ease-out" },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.id, dir, reducedMotion]);
  const [tip, setTip] = useState(0);
  const tips = [
    "You don't have to have it all figured out. You just have to take the next step.",
    "A good interview is a conversation, not a performance. Take a breath. You've got this.",
    "That thing you think is 'just part of the job'? It might be your best resume story.",
    "Some days, one small step is plenty. Progress still counts.",
  ];

  return (
    <div>
      {/* Phase 1 — the featured quest fills the whole screen, edge to edge, under the top bar. */}
      <div className="relative">
        <section
          className="relative flex min-h-[calc(100svh_-_4rem)] items-center overflow-hidden border-b bg-hero px-6 pb-28 pt-12 md:px-16 md:pb-32 md:pt-16"
          aria-label="Featured quest"
        >
          <div className="relative z-10 w-full max-w-2xl md:max-w-[46%]">
            <p className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70"><span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />{featured ? `Today's featured quest · ${featured.category}` : "Your main event · Mock interview"}</p>
            {featured ? (
              <h2 ref={headRef} title={featured.title} className="mt-6 min-h-[2.2em] break-words text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl"><span className="block">{featLines[0]}</span><span className="block">{featLines[1]}</span></h2>
            ) : (
              <h2 className="mt-6 min-h-[2.2em] break-words text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl"><span className="block">Practice your</span><span className="block">mock interview</span></h2>
            )}
            <p ref={subRef} className="mt-5 max-w-lg text-lg text-muted-foreground">{scene.blurb}</p>
            {featured ? (
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button asChild className="h-auto rounded-xl px-8 py-4 text-base"><Link to={featLink}>
                  Start this quest <ArrowRight className="h-5 w-5" />
                </Link></Button>
              </div>
            ) : (
              <Button asChild className="mt-8 h-auto rounded-xl px-8 py-4 text-base"><Link to="/interview" search={{ radar: undefined }}>
                Start a mock interview <ArrowRight className="h-5 w-5" />
              </Link></Button>
            )}
            <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{featured ? `+${featured.xp} XP waiting for you` : "15 minutes to a more confident you"}</p>
            {total > 1 && (
              <div className="mt-8 flex flex-wrap items-center gap-2">
                {Array.from({ length: Math.min(total, 10) }, (_, i) => (
                  <button key={i} type="button" onClick={() => jump(i)} aria-label={i === 0 ? "Show mock interview" : `Show quest: ${open[i - 1]?.title}`} aria-current={i === featIdx} className={cn("h-2 rounded-full transition-all", i === featIdx ? "w-7 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60")} />
                ))}
                {total > 10 && <span className="text-xs text-muted-foreground">+{total - 10} more</span>}
              </div>
            )}
          </div>
          <motion.div key={featured?.id ?? "none"} initial={reducedMotion ? false : { opacity: 0, x: 28 * dir }} animate={sceneReady ? { opacity: 1, x: 0 } : { opacity: 0, x: reducedMotion ? 0 : 28 * dir }} transition={{ duration: 0.45 }} className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
            <div className="absolute inset-0"><SceneBackdrop kind={featKey} /></div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="relative h-[clamp(260px,34svh,420px)] w-[clamp(260px,34svh,420px)]">
                <div className="mascot-float relative h-full w-full"><img key={featArt} src={featArt} alt={featured ? `Max ready for: ${featured.title}` : "Max with a microphone, ready to interview you"} width={816} height={816} decoding="sync" draggable={false} className="h-full w-full object-contain" /></div>
              </div>
            </div>
            <div className="absolute left-10 top-12 flex -rotate-6 items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-md"><Zap className="h-4 w-4" />+{featured?.xp ?? 150} XP</div>
            <div className={`absolute right-8 top-14 rotate-6 rounded-2xl bg-card p-3 shadow-md ${scene.chip}`}><scene.icon className="h-6 w-6" /></div>
            {scene.props.slice(0, 2).map(([label], i) => (
              <div key={label} className={cn("absolute rounded-xl bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm", i === 0 ? "right-6 top-36 -rotate-3" : "right-6 top-1/2 rotate-3")}>{label}</div>
            ))}
            <div className="absolute bottom-12 right-8 flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-md"><Check className="h-4 w-4 text-success" />{scene.phrase}</div>
          </motion.div>
          {total > 1 && (
            <span className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border bg-card/90 px-3 py-1 text-xs font-medium tabular-nums text-muted-foreground shadow-sm">{featIdx + 1} / {total}</span>
          )}
        </section>
        {total > 1 && (<>
          <Button variant="outline" size="icon" className="absolute left-3 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full bg-card md:left-7" onClick={() => shift(-1)} aria-label="Previous quest" title="Previous quest"><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="outline" size="icon" className="absolute right-3 top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full bg-card md:right-7" onClick={() => shift(1)} aria-label="Next quest" title="Next quest"><ChevronRight className="h-5 w-5" /></Button>
        </>)}
      </div>

      {/* Phase 2 — the routes and progress cards live below the fold. */}
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 md:px-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Let's make your next move count</p>
            <h1 className="mt-2 text-4xl font-bold md:text-5xl">Looking good, {first} <span className="text-accent">✦</span></h1>
            <p className="mt-2 text-lg text-muted-foreground">{done > 0 ? `${done} quests behind you. Take a moment to appreciate that.` : "Glad you're here. Let's start with one small win."}</p>
          </div>
          <div className="panel flex items-center gap-3 px-5 py-3 text-sm transition-shadow hover:shadow-md">
            <Flame className="animate-flame h-5 w-5 text-primary" /><b>{done} quests done</b><span className="border-l pl-3 text-muted-foreground">Keep it going!</span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link to="/interview" search={{ radar: undefined }} className="hover-lift flex items-center gap-4 rounded-2xl border bg-card p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/15 text-primary"><Mic className="h-6 w-6" /></span>
            <span className="flex-1"><span className="block font-semibold">Interviews</span><span className="text-sm text-muted-foreground">Jump into a mock interview</span></span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
          <Link to="/setup" className="hover-lift flex items-center gap-4 rounded-2xl border bg-card p-5">
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-accent/20 text-accent-foreground"><FileText className="h-6 w-6" /></span>
            <span className="flex-1"><span className="block font-semibold">Resume Lab</span><span className="text-sm text-muted-foreground">Grade and polish your resume</span></span>
            <ArrowRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </div>

        <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2">
          <ResumeScoreCard review={review} score={resumeScore} loading={reviewLoading} />
          <XpCareerCard xp={xp} level={level} levelXp={levelXp} lastGain={lastGain} title={title} />
        </div>

        <div className="flex items-center gap-5 rounded-2xl border bg-hero/60 p-6">
          <Button variant="ghost" aria-label="Another thought from Max" title="Another thought from Max" className="h-20 w-20 shrink-0 p-0 hover:bg-transparent" onClick={() => setTip((t) => (t + 1) % tips.length)}><Mascot className="h-20 w-20" /></Button>
          <div className="min-w-0"><div className="font-semibold">Max says</div><motion.p key={tip} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-12 text-muted-foreground" aria-live="polite">{tips[tip]}</motion.p></div>
        </div>
      </div>
    </div>
  );
}
