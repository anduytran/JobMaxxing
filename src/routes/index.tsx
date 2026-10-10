import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Check, ChevronRight, Clock, FileText, Flame, Mic, Users, Zap } from "lucide-react";
import { levelTitle, useGame, XP_PER_LEVEL } from "@/lib/game";
import { Mascot } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { getLatestResumeReview } from "@/lib/resume.functions";
import type { StoredReview } from "@/lib/resume";
import maxResume from "@/assets/max-resume.png";
import maxInterview from "@/assets/max-interview.png";
import maxSkills from "@/assets/max-skills.png";
import maxHunt from "@/assets/max-hunt.png";
import maxBranding from "@/assets/max-branding.png";

const MAX_ART: Record<string, string> = { setup: maxResume, resume: maxResume, interview: maxInterview, skills: maxSkills, hunt: maxHunt, branding: maxBranding, social: maxBranding };
const QUEST_LINK: Record<string, "/setup" | "/interview" | "/quests" | "/radar"> = { setup: "/setup", resume: "/setup", interview: "/interview" };

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
  useEffect(() => { setSeed(Math.random()); }, []);
  const featured = useMemo(() => (open.length ? open[Math.floor(seed * open.length) % open.length] : null), [open, seed]);
  const featKey = featured?.category?.toLowerCase() ?? "interview";
  const featArt = MAX_ART[featKey] ?? maxInterview;
  const featLink = QUEST_LINK[featKey] ?? "/quests";
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
            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Today's featured quest · {featured.category}</p>
            <p className="mt-1 text-2xl font-semibold">{featured.title}</p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button asChild className="h-auto rounded-xl px-7 py-4 text-base"><Link to={featLink}>
                Start this quest <ArrowRight className="h-5 w-5" />
              </Link></Button>
              <Button variant="outline" className="h-auto rounded-xl px-5 py-4" onClick={() => setSeed(Math.random())}>Pick another</Button>
            </div>
          </>) : (
            <Button asChild className="mt-8 h-auto rounded-xl px-7 py-4 text-base"><Link to="/interview">
              Start a mock interview <ArrowRight className="h-5 w-5" />
            </Link></Button>
          )}
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" />{featured ? `+${featured.xp} XP waiting for you` : "15 minutes to a more confident you"}</p>
        </div>
        <div className="pointer-events-none absolute -right-10 top-6 hidden h-[420px] w-[420px] rounded-full border border-success/30 md:block" />
        <div className="absolute bottom-0 right-16 hidden items-end gap-0 md:flex">
          {[90, 160, 260].map((h, i) => <div key={i} className="w-28 rounded-t-md bg-success/40" style={{ height: h }} />)}
        </div>
        <div className="mascot-float absolute right-16 top-0 hidden md:block">{featured ? <img key={featArt} src={featArt} alt={`Max ready for: ${featured.title}`} width={816} height={816} className="h-48 w-48 object-contain" /> : <Mascot className="h-40 w-40" />}</div>
        <div className="absolute right-64 top-16 hidden -rotate-6 items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-md md:flex"><Zap className="h-4 w-4" />+{featured?.xp ?? 150} XP</div>
        <div className="absolute bottom-12 right-10 hidden items-center gap-2 rounded-xl bg-card px-4 py-3 text-sm shadow-md md:flex"><Check className="h-4 w-4 text-success" />One step closer.</div>
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
                <img src={maxResume} alt="" loading="lazy" width={816} height={816} className="h-14 w-14 shrink-0 rounded-xl bg-sidebar-accent object-contain p-1 transition-transform group-hover:scale-110" />
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
