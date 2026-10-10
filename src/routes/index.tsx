import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronLeft, ChevronRight, Clock, Code2, FileText, Flame, Mic, Radar, Sparkles, Users, Zap } from "lucide-react";
import { levelTitle, useGame, XP_PER_LEVEL } from "@/lib/game";
import { Mascot } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { getLatestResumeReview } from "@/lib/resume.functions";
import type { StoredReview } from "@/lib/resume";
import { MAX_POSES } from "@/components/Max";
import { cn } from "@/lib/utils";

const MAX_ART: Record<string, string> = { setup: MAX_POSES.resume, resume: MAX_POSES.resume, interview: MAX_POSES.interview, skills: MAX_POSES.skills, hunt: MAX_POSES.hunt, branding: MAX_POSES.dap, social: MAX_POSES.dap };
const QUEST_LINK: Record<string, "/setup" | "/interview" | "/quests" | "/skills" | "/market"> = { setup: "/setup", resume: "/setup", interview: "/interview", skills: "/skills", hunt: "/market" };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Dashboard — JobMaxxing" },
      { name: "description", content: "Your career hub: level, XP, daily quests and your next power move." },
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
type Scene = { icon: typeof FileText; bg: string; ring: string; chip: string; props: [string, string][]; phrase: string };
const SCENES: Record<string, Scene> = {
  skills: {
    icon: Code2, bg: "bg-success/15", ring: "border-success/30", chip: "text-success",
    props: [["</>", "right-72 top-40 -rotate-6"], ["{ algo }", "right-52 bottom-28 rotate-3"], ["O(n)", "right-80 bottom-44 -rotate-3"]],
    phrase: "Sharpen the blade.",
  },
  interview: {
    icon: Mic, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Q&A", "right-72 top-40 -rotate-6"], ["STAR method", "right-52 bottom-28 rotate-3"], ["Tell me about…", "right-80 bottom-44 -rotate-3"]],
    phrase: "Talk it out.",
  },
  resume: {
    icon: FileText, bg: "bg-accent/20", ring: "border-accent/40", chip: "text-accent-foreground",
    props: [["ATS-friendly", "right-72 top-40 -rotate-6"], ["Impact verbs", "right-52 bottom-28 rotate-3"], ["+1 metric", "right-80 bottom-44 -rotate-3"]],
    phrase: "Polish your story.",
  },
  hunt: {
    icon: Radar, bg: "bg-success/15", ring: "border-success/30", chip: "text-success",
    props: [["Remote", "right-72 top-40 -rotate-6"], ["92% match", "right-52 bottom-28 rotate-3"], ["New role", "right-80 bottom-44 -rotate-3"]],
    phrase: "Scan the horizon.",
  },
  branding: {
    icon: Users, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Coffee chat", "right-72 top-40 -rotate-6"], ["LinkedIn", "right-52 bottom-28 rotate-3"], ["Dap!", "right-80 bottom-44 -rotate-3"]],
    phrase: "Grow your crew.",
  },
  social: {
    icon: Users, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Coffee chat", "right-72 top-40 -rotate-6"], ["LinkedIn", "right-52 bottom-28 rotate-3"], ["Dap!", "right-80 bottom-44 -rotate-3"]],
    phrase: "Grow your crew.",
  },
};
const DEFAULT_SCENE: Scene = {
  icon: Sparkles, bg: "bg-accent/20", ring: "border-accent/40", chip: "text-accent-foreground",
  props: [["Small win", "right-72 top-40 -rotate-6"], ["Momentum", "right-52 bottom-28 rotate-3"], ["+XP", "right-80 bottom-44 -rotate-3"]],
  phrase: "One step closer.",
};

// Illustrated backdrop behind Max for the featured quest; one scene per quest type.
function SceneBackdrop({ kind }: { kind: string }) {
  if (kind === "branding" || kind === "social") {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="absolute bottom-0 left-1/2 flex w-72 -translate-x-1/2 justify-between px-12">
          <div className="h-40 w-3 rounded-t bg-foreground/15" /><div className="h-40 w-3 rounded-t bg-foreground/15" />
        </div>
        <div className="relative -mt-6 flex h-56 w-80 flex-col justify-between rounded-2xl border-4 border-foreground/15 bg-card/80 p-4">
          <div className="flex gap-1.5">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-accent/70" />)}</div>
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.4em] text-primary/60">JobMaxxing · Now hiring you</p>
        </div>
      </div>
    );
  }
  if (kind === "skills") {
    const plates = ["h-16 w-4", "h-12 w-3", "h-9 w-3"];
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative h-64 w-[22rem]">
          <div className="absolute inset-y-0 left-4 w-2.5 rounded bg-foreground/15" />
          <div className="absolute inset-y-0 right-4 w-2.5 rounded bg-foreground/15" />
          {[16, 40, 64].map((top) => (
            <div key={top} className="absolute inset-x-0 flex items-center justify-between px-1" style={{ top: `${top}%` }}>
              <div className="absolute inset-x-2 h-1.5 rounded bg-foreground/20" />
              {[0, 1].map((side) => (
                <div key={side} className={cn("relative flex items-center gap-0.5", side && "flex-row-reverse")}>
                  {plates.map((p) => <span key={p} className={`${p} rounded-sm bg-foreground/25`} />)}
                </div>
              ))}
            </div>
          ))}
          <div className="absolute -bottom-2 inset-x-0 h-2 rounded bg-foreground/15" />
        </div>
      </div>
    );
  }
  if (kind === "hunt") {
    const blades = Array.from({ length: 34 }, (_, i) => ({ h: 28 + ((i * 37) % 46), r: ((i * 53) % 30) - 15 }));
    return (
      <div className="absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-around px-2">
          {blades.map((b, i) => (
            <span key={i} className={cn("w-2 origin-bottom rounded-t-full", i % 3 ? "bg-success/45" : "bg-success/70")} style={{ height: `${b.h * 1.6}px`, transform: `rotate(${b.r}deg)` }} />
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-0 h-6 bg-success/30" />
      </div>
    );
  }
  if (kind === "interview") {
    return (
      <div className="absolute inset-0 flex justify-center">
        <div className="h-full w-80 bg-gradient-to-b from-primary/25 to-transparent [clip-path:polygon(40%_0,60%_0,100%_100%,0_100%)]" />
        <div className="absolute bottom-8 h-6 w-72 rounded-[50%] bg-primary/15" />
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      {[-8, 4, -2].map((r, i) => (
        <div key={i} className="absolute h-60 w-48 rounded-xl border border-foreground/10 bg-card/70" style={{ transform: `rotate(${r}deg) translate(${i * 10}px, ${i * 6}px)` }}>
          <div className="mt-6 space-y-2 px-5">{[80, 60, 70, 50].map((w) => <div key={w} className="h-1.5 rounded bg-foreground/10" style={{ width: `${w}%` }} />)}</div>
        </div>
      ))}
    </div>
  );
}

function Dashboard() {
  const { name, level, levelXp, xp, quests, completeQuest, details } = useGame();
  const first = name.split(" ")[0] || "there";
  const open = quests.filter((q) => !q.done);
  const done = quests.filter((q) => q.done).length;
  const pct = (levelXp / XP_PER_LEVEL) * 100;
  const [review, setReview] = useState<StoredReview | null>(null);
  useEffect(() => { getLatestResumeReview().then((r) => { if (r.ok) setReview(r.review); }).catch(() => {}); }, []);
  const resumeScore = review?.score ?? (details.resume as { score?: number } | undefined)?.score;
  const resumeQuests = (review?.suggestions ?? []).filter((s) => !s.applied);
  const [seed, setSeed] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  useEffect(() => { setSeed(Math.random()); }, []);
  const openCount = open.length;
  const startIdx = useMemo(() => (openCount ? Math.floor(seed * openCount) % openCount : 0), [seed, openCount]);
  const featIdx = pick === null ? Math.min(startIdx, Math.max(openCount - 1, 0)) : Math.min(pick, Math.max(openCount - 1, 0));
  const featured = openCount ? open[featIdx] : null;
  const shift = (d: number) => {
    if (!openCount) return;
    setDir(d);
    setPick(((((pick ?? featIdx) + d) % openCount) + openCount) % openCount);
  };
  const jump = (i: number) => { setDir(i >= featIdx ? 1 : -1); setPick(i); };
  const surprise = () => { setDir(1); setPick(null); setSeed(Math.random()); };
  const featKey = featured?.category?.toLowerCase() ?? "interview";
  const featArt = MAX_ART[featKey] ?? MAX_POSES.interview;
  const featLink = QUEST_LINK[featKey] ?? "/quests";
  const scene = SCENES[featKey] ?? DEFAULT_SCENE;
  const reducedMotion = useReducedMotion();
  const [tip, setTip] = useState(0);
  const tips = [
    "You don't have to have it all figured out. You just have to take the next step.",
    "A good interview is a conversation, not a performance. Take a breath. You've got this.",
    "That thing you think is 'just part of the job'? It might be your best resume story.",
    "Some days, one small step is plenty. Progress still counts.",
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
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

      <section className="relative overflow-hidden rounded-3xl border bg-hero p-8 md:p-12">
        <div className="relative z-10 max-w-xl">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70"><span className="h-1.5 w-1.5 rounded-full bg-foreground/60" />Your next chapter starts here</p>
          <h2 className="mt-5 text-4xl font-bold leading-tight md:text-5xl">You've got potential.<br />Let's put it to work.</h2>
          <p className="mt-4 text-muted-foreground">Your dream role is closer than you think. Build your skills, sharpen your story, and make your next move.</p>
          {featured ? (<>
            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Today's featured quest · {featured.category}</p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={() => shift(-1)} aria-label="Previous quest" title="Previous quest"><ChevronLeft className="h-4 w-4" /></Button>
                <span className="min-w-12 text-center text-xs tabular-nums text-muted-foreground">{featIdx + 1} / {openCount}</span>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 rounded-xl" onClick={() => shift(1)} aria-label="Next quest" title="Next quest"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
            <motion.p key={featured.id} initial={reducedMotion ? false : { opacity: 0, x: -16 * dir }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3 }} className="mt-1 text-2xl font-semibold">{featured.title}</motion.p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="h-auto rounded-xl px-7 py-4 text-base"><Link to={featLink}>
                Start this quest <ArrowRight className="h-5 w-5" />
              </Link></Button>
              <Button variant="ghost" className="h-auto rounded-xl px-4 py-4 text-muted-foreground" onClick={surprise}>Pick another</Button>
            </div>
            {openCount > 1 && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {open.slice(0, 9).map((q, i) => (
                  <button key={q.id} type="button" onClick={() => jump(i)} aria-label={`Show quest: ${q.title}`} aria-current={i === featIdx} className={cn("h-2 rounded-full transition-all", i === featIdx ? "w-7 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60")} />
                ))}
                {openCount > 9 && <span className="text-xs text-muted-foreground">+{openCount - 9} more</span>}
              </div>
            )}
          </>) : (
            <Button asChild className="mt-8 h-auto rounded-xl px-7 py-4 text-base"><Link to="/interview">
              Start a mock interview <ArrowRight className="h-5 w-5" />
            </Link></Button>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{featured ? `+${featured.xp} XP waiting for you` : "15 minutes to a more confident you"}</p>
        </div>
        <motion.div key={featured?.id ?? "none"} initial={reducedMotion ? false : { opacity: 0, x: 28 * dir }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }} className="pointer-events-none absolute inset-y-0 right-0 hidden w-1/2 md:block">
          <SceneBackdrop kind={featKey} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="mascot-float">{featured ? <img key={featArt} src={featArt} alt={`Max ready for: ${featured.title}`} width={816} height={816} className="h-56 w-56 object-contain" /> : <Mascot className="h-44 w-44" />}</div>
          </div>
          <div className="absolute left-6 top-6 flex -rotate-6 items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-md"><Zap className="h-4 w-4" />+{featured?.xp ?? 150} XP</div>
          <div className={`absolute right-8 top-8 rotate-6 rounded-2xl bg-card p-3 shadow-md ${scene.chip}`}><scene.icon className="h-6 w-6" /></div>
          {scene.props.slice(0, 2).map(([label], i) => (
            <div key={label} className={cn("absolute rounded-xl bg-card/90 px-3 py-1.5 text-xs font-medium shadow-sm", i === 0 ? "left-8 top-1/2 -rotate-3" : "right-8 top-1/2 rotate-3")}>{label}</div>
          ))}
          <div className="absolute bottom-6 right-8 flex items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-md"><Check className="h-4 w-4 text-success" />{scene.phrase}</div>
        </motion.div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr_1fr_1.4fr]">
        <Stat icon={FileText} label="Resume score">
          <div className="text-4xl font-bold">{review && <span className="mr-2 rounded-md bg-success/20 px-2 text-2xl">{review.grade}</span>}{resumeScore ?? "—"}<span className="text-xl font-normal text-muted-foreground"> / 100</span></div>
          <Bar pct={resumeScore ?? 0} cls="bg-success" />
          <Link to="/setup" className="mt-3 block text-sm text-muted-foreground hover:text-primary">{review ? (resumeQuests.length ? `${resumeQuests.length} resume quests to level it up →` : "All resume quests done. Nice!") : resumeScore ? "Getting stronger with every edit" : "Upload your resume →"}</Link>
        </Stat>
        <Stat icon={Mic} label="Quests open">
          <div className="text-4xl font-bold">{String(open.length).padStart(2, "0")}</div>
          <p className="mt-6 text-sm text-muted-foreground">Practice makes progress</p>
        </Stat>
        <Stat icon={Zap} label="Total XP earned">
          <div className="flex items-center justify-between"><span className="text-2xl text-muted-foreground">{xp.toLocaleString()}</span><span className="rounded-md bg-accent/20 px-2 py-0.5 text-xs font-medium text-accent-foreground">LEVEL {level}</span></div>
          <Bar pct={pct} cls="bg-primary" />
          <p className="mt-3 text-sm text-muted-foreground">{XP_PER_LEVEL - levelXp} XP to your next level</p>
        </Stat>
        <div className="panel row-span-2 p-7 text-center">
          <h3 className="text-left text-2xl font-semibold">Your career, in motion</h3>
          <div className="relative mx-auto my-6 h-48 w-48">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
              <circle cx="50" cy="50" r="44" fill="none" stroke="var(--muted)" strokeWidth="5" />
              <motion.circle cx="50" cy="50" r="44" fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round"
                strokeDasharray={276.5} initial={reducedMotion ? false : { strokeDashoffset: 276.5 }} animate={{ strokeDashoffset: 276.5 * (1 - pct / 100) }} transition={{ duration: 1 }} />
            </svg>
            <div className="absolute inset-0 grid place-content-center">
              <div className="text-xs tracking-[0.3em] text-muted-foreground">LEVEL</div>
              <div className="font-display text-6xl font-bold">{level}</div>
              <div className="text-sm text-muted-foreground">{levelTitle(level)}</div>
            </div>
          </div>
          <p className="text-muted-foreground">{levelXp} / {XP_PER_LEVEL.toLocaleString()} XP</p>
          <p className="mt-2 text-sm text-muted-foreground">You're building something great.</p>
          <div className="mt-5 flex justify-between border-t pt-4 text-xs text-muted-foreground"><span>Next up: <b className="text-foreground">{levelTitle(level + 1)}</b></span><span>LVL {level + 1}</span></div>
        </div>

        <section className="lg:col-span-3">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-3 text-2xl font-semibold">Your quests <span className="rounded-md bg-muted px-2 text-sm font-normal">{open.length + resumeQuests.length}</span></h2>
            <Link to="/quests" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-primary">View all quests <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <p className="mb-5 text-muted-foreground">A little progress, a little XP. A lot of possibility.</p>
          <div className="panel divide-y overflow-hidden">
            {open.slice(0, 3).map((q) => {
              const art = MAX_ART[q.category?.toLowerCase()];
              return (
                <div key={q.id} className="group flex items-center gap-5 p-5 transition-colors hover:bg-muted/60">
                  {art ? <img src={art} alt="" loading="lazy" width={816} height={816} className="h-14 w-14 shrink-0 rounded-xl bg-sidebar-accent object-contain p-1 transition-transform group-hover:scale-110" /> : <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-sidebar-accent text-primary"><Zap className="h-6 w-6" /></div>}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{q.title}</div>
                    <div className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">{q.category}</div>
                  </div>
                  <span className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm"><Zap className="h-4 w-4" />+{q.xp} XP</span>
                  <Button variant="ghost" size="icon" onClick={() => completeQuest(q.id)} aria-label={`Complete ${q.title}`} title={`Complete ${q.title}`} className="shrink-0 rounded-lg text-muted-foreground hover:bg-muted hover:text-success"><Check className="h-5 w-5" /></Button>
                </div>
              );
            })}
            {resumeQuests.slice(0, 2).map((s) => (
              <Link key={s.id} to="/setup" className="group flex items-center gap-5 p-5 transition-colors hover:bg-muted/60">
                <img src={MAX_POSES.resume} alt="" loading="lazy" width={816} height={816} className="h-14 w-14 shrink-0 rounded-xl bg-sidebar-accent object-contain p-1 transition-transform group-hover:scale-110" />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{s.title}</div>
                  <div className="mt-1 line-clamp-1 text-xs text-muted-foreground"><span className="uppercase tracking-widest">Resume quest</span> · {s.detail}</div>
                </div>
                <span className="flex items-center gap-1 rounded-lg border border-accent/40 bg-accent/10 px-3 py-1.5 text-sm"><Zap className="h-4 w-4" />+{s.xp} XP</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {open.length === 0 && resumeQuests.length === 0 && <div className="p-6 text-muted-foreground">All quests cleared. Legendary.</div>}
          </div>
        </section>
      </div>

      <section>
        <div className="mb-5 flex items-center justify-between"><h2 className="text-2xl font-semibold">Your next power move</h2><span className="text-xs tracking-[0.2em] text-muted-foreground">BUILT AROUND YOU</span></div>
        <div className="grid gap-6 md:grid-cols-2">
          <Power to="/setup" icon={FileText} tag="POWERED BY RAIA" title="A resume that opens doors." body="Get AI-powered feedback and turn your experience into your strongest story." cta="Enter Resume Lab" cls="bg-hero/60" />
          <Power to="/peers" icon={Users} tag="BETTER, TOGETHER" title="Practice with a real person." body="Find your career buddy and build confidence, one conversation at a time." cta="Find an interview partner" cls="bg-lavender" />
        </div>
      </section>

      <div className="flex items-center gap-5 rounded-2xl border bg-hero/60 p-6">
        <Button variant="ghost" aria-label="Another thought from Max" title="Another thought from Max" className="h-20 w-20 shrink-0 p-0 hover:bg-transparent" onClick={() => setTip((t) => (t + 1) % tips.length)}><Mascot className="h-20 w-20" /></Button>
        <div className="min-w-0"><div className="font-semibold">Max says</div><motion.p key={tip} initial={reducedMotion ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="min-h-12 text-muted-foreground" aria-live="polite">{tips[tip]}</motion.p></div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, children }: { icon: typeof Zap; label: string; children: React.ReactNode }) {
  return <div className="panel hover-lift p-6"><div className="mb-5 flex items-center gap-2 text-muted-foreground"><Icon className="h-5 w-5" />{label}</div>{children}</div>;
}
function Bar({ pct, cls }: { pct: number; cls: string }) {
  return <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-muted"><motion.div className={`h-full rounded-full ${cls}`} initial={{ width: 0 }} animate={{ width: `${pct}%` }} /></div>;
}
function Power({ to, icon: Icon, tag, title, body, cta, cls }: { to: "/setup" | "/peers"; icon: typeof Zap; tag: string; title: string; body: string; cta: string; cls: string }) {
  return (
    <Link to={to} className={`power-move group rounded-2xl border p-8 ${cls}`}>
      <div className="flex justify-between"><Icon className="h-8 w-8 text-muted-foreground" /><span className="text-[10px] tracking-[0.2em] text-muted-foreground">{tag}</span></div>
      <h3 className="mt-8 text-2xl font-semibold">{title}</h3>
      <p className="mt-3 text-muted-foreground">{body}</p>
      <div className="mt-8 flex items-center justify-between text-muted-foreground group-hover:text-primary">{cta}<ChevronRight className="h-5 w-5" /></div>
    </Link>
  );
}
