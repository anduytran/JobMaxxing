import { useRouter } from "@tanstack/react-router";
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { ArrowRight, Bolt, Check, FileSearch, Loader2, Mic, Radar, Trophy, Users, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, signUp } from "@/lib/auth.functions";
import { MAX_POSES } from "@/components/Max";
import interviewShot from "@/assets/landing/interview-review.asset.json";

const spring = { type: "spring" as const, stiffness: 380, damping: 30 };
const rise = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
};

function XpBadge({ amount }: { amount: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
      <Bolt className="size-3" /> {amount}
    </span>
  );
}

function QuestTag({ type = "Main quest" }: { type?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground">
      <Trophy className="size-3" /> {type}
    </span>
  );
}

/* ---------- Draggable Max with a "papers burst" easter egg ---------- */
type Paper = { id: number; x: number; vx: number; vy: number; r: number; vr: number };

function DraggableMax({ bounds }: { bounds: React.RefObject<HTMLElement | null> }) {
  const reduce = useReducedMotion();
  const [papers, setPapers] = useState<Paper[]>([]);
  const [dizzy, setDizzy] = useState(false);
  const flips = useRef<number[]>([]);
  const lastDir = useRef(0);
  const lastBurst = useRef(0);
  const vx = useMotionValue(0);
  const rotate = useSpring(useTransform(vx, [-1500, 1500], [-18, 18], { clamp: true }), { stiffness: 300, damping: 18 });

  const burst = () => {
    const now = performance.now();
    if (now - lastBurst.current < 2400) return;
    lastBurst.current = now;
    if (reduce) return;
    const count = 18 + Math.floor(Math.random() * 8);
    setPapers(
      Array.from({ length: count }, (_, i) => ({
        id: now + i,
        x: 0,
        vx: (Math.random() < 0.5 ? -1 : 1) * (120 + Math.random() * 500),
        vy: -(500 + Math.random() * 700),
        r: Math.random() * 60 - 30,
        vr: Math.random() * 540 - 270,
      })),
    );
    window.setTimeout(() => setPapers([]), 2600);
  };

  return (
    <div className="relative">
      <motion.button
        type="button"
        aria-label="Max the mascot. Drag and shake him for a surprise."
        className="cursor-grab active:cursor-grabbing"
        drag
        dragConstraints={bounds}
        dragSnapToOrigin
        dragElastic={0.08}
        dragTransition={{ bounceStiffness: 260, bounceDamping: 16 }}
        style={{ rotate }}
        onDragStart={() => {
          setDizzy(true);
          flips.current = [];
        }}
        onDrag={(_, info) => {
          vx.set(info.velocity.x);
          const dir = Math.abs(info.velocity.x) > 250 ? Math.sign(info.velocity.x) : 0;
          if (dir && dir !== lastDir.current) {
            if (lastDir.current) {
              const t = performance.now();
              flips.current = [...flips.current.filter((f) => t - f < 1000), t];
              if (flips.current.length >= 4) {
                flips.current = [];
                burst();
              }
            }
            lastDir.current = dir;
          }
        }}
        onDragEnd={() => {
          setDizzy(false);
          vx.set(0);
          lastDir.current = 0;
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            animate(vx, [0, -1300, 1100, -600, 0], { duration: 0.5 });
            burst();
          }
        }}
      >
        <motion.img
          src={dizzy ? MAX_POSES.dap : MAX_POSES.wave}
          alt={dizzy ? "Max, the JobMaxxing briefcase, being dragged around" : "Max, the JobMaxxing briefcase, waving"}
          draggable={false}
          className="mascot-personality w-56 md:w-72"
          animate={dizzy && !reduce ? { rotate: [0, -4, 4, 0] } : {}}
          transition={{ duration: 0.5 }}
        />
      </motion.button>
      {/* Burst papers: plain styled sheets, animated outward */}
      <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
        {papers.map((p) => (
          <motion.span
            key={p.id}
            className="absolute left-1/2 top-1/3 block h-7 w-5 rounded-[3px] border border-border bg-card shadow-sm"
            style={{
              backgroundImage: "repeating-linear-gradient(transparent 0 4px, var(--color-border) 4px 5px)",
              backgroundSize: "70% 100%",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: p.r }}
            animate={{ x: p.vx, y: [0, p.vy * 0.4, 600], opacity: [1, 1, 0], rotate: p.r + p.vr }}
            transition={{ duration: 2.2, ease: [0.15, 0.6, 0.45, 1] }}
          />
        ))}
      </div>
    </div>
  );
}

const QUESTS = [
  {
    tag: "Main quest",
    xp: "+50 XP",
    icon: Mic,
    title: "AI mock interviews",
    text: "An interviewer that talks back. Answer out loud, then get graded on what you said and how clearly you said it.",
    chips: ["Answer quality", "Conciseness", "Your questions"],
  },
  {
    tag: "Main quest",
    xp: "+15 XP per fix",
    icon: FileSearch,
    title: "Resume grader",
    text: "Upload your resume. Max grades it against strong resumes in your field and flags the bullets holding you back.",
    chips: ["ATS check", "Action verbs", "Metrics"],
  },
  {
    tag: "Co-op quest",
    xp: "+40 XP each",
    icon: Users,
    title: "Peer interviews",
    text: "Pair up with a friend over a live call. One of you runs the AI-written script, the other answers — then you swap.",
    chips: ["Live audio", "Shared transcript", "Two-sided grades"],
  },
  {
    tag: "Scouting quest",
    xp: "+25 XP",
    icon: Radar,
    title: "Job radar",
    text: "Roles matched to your resume and your dealbreakers. Save the good ones, or practice for one in a click.",
    chips: ["Real listings", "Match scores", "One-click practice"],
  },
];

const STEPS: [string, string, string][] = [
  ["Upload your resume", "Max grades it and turns the weak spots into your first quests.", "+20 XP"],
  ["Clear daily quests", "Short tasks, like fixing two bullets or answering one interview question.", "+25 XP each"],
  ["Rank up", "XP raises your level. New levels earn titles you can show off.", "New title"],
  ["Walk in ready", "Run full mock interviews for real Job Radar listings before the real thing.", "+50 XP"],
];

const RANKS = [
  { name: "Applicant", level: 1, state: "earned" },
  { name: "Rookie", level: 3, state: "earned" },
  { name: "Contender", level: 4, state: "current" },
  { name: "Grinder", level: 5, state: "locked" },
  { name: "Closer", level: 10, state: "locked" },
  { name: "Maxxed out", level: 20, state: "locked" },
] as const;

/** Signed-out landing page: what JobMaxxing does, plus sign in / sign up. */
export function AuthScreen() {
  const router = useRouter();
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const hero = useRef<HTMLElement>(null);

  const openAuth = (m: "in" | "up") => {
    setMode(m);
    setAuthOpen(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const fn = mode === "in" ? signIn : signUp;
      const res = await fn({ data: { email, password, name } });
      if (!res.ok) return void toast.error(res.error);
      if (mode === "up") {
        await router.navigate({ to: "/setup", search: { welcome: "1" } });
      }
      await router.invalidate();
      toast.success(mode === "in" ? "Signed in" : "Account created");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3.5">
          <button className="flex items-center gap-2" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} aria-label="JobMaxxing home">
            <img src={MAX_POSES.wave} alt="" className="h-9 w-9 object-contain" />
            <span className="font-display text-xl font-bold tracking-tight">JobMaxxing<span className="text-primary">.</span></span>
          </button>
          <nav className="hidden items-center gap-6 text-sm font-medium text-muted-foreground md:flex">
            <button className="transition-colors hover:text-foreground" onClick={() => scrollTo("quests")}>Quest board</button>
            <button className="transition-colors hover:text-foreground" onClick={() => scrollTo("how")}>How it works</button>
            <button className="transition-colors hover:text-foreground" onClick={() => scrollTo("ranks")}>Ranks</button>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => openAuth("in")}>Sign in</Button>
            <Button size="sm" onClick={() => openAuth("up")}>Start your first quest</Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section ref={hero} className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-20 pt-14 lg:grid-cols-[1.1fr_1fr]">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}>
          <div className="flex items-center gap-2">
            <XpBadge amount="+20 XP" />
            <span className="text-xs font-medium text-muted-foreground">for your first resume scan</span>
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight md:text-6xl">
            Job hunting is a grind. Might as well earn XP.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted-foreground">
            Get your resume graded, practice interviews out loud with an AI interviewer, and run mock rounds with friends. Every rep counts toward your next rank.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={() => openAuth("up")}>Upload your resume <ArrowRight className="size-4" /></Button>
            <Button size="lg" variant="outline" onClick={() => openAuth("up")}>Try a mock interview</Button>
          </div>
        </motion.div>
        <div className="relative grid place-items-center">
          <div className="absolute inset-x-8 bottom-4 top-8 rounded-[2.5rem] bg-secondary/70" aria-hidden="true" />
          <DraggableMax bounds={hero} />
          <motion.div
            className="absolute right-2 top-2 w-44 rounded-2xl border border-border bg-card p-3 shadow-sm"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <QuestTag type="Daily quest" />
            <p className="mt-2 text-sm font-semibold">Fix 2 weak bullet points</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <motion.span className="block h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: "50%" }} transition={{ delay: 0.8, duration: 0.8 }} />
              </span>
              <span className="text-xs text-muted-foreground">1/2</span>
            </div>
            <div className="mt-2"><XpBadge amount="+25 XP" /></div>
          </motion.div>
        </div>
      </section>

      {/* Feature spotlight: AI interviewing */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-10 md:grid-cols-2">
          <motion.div {...rise} className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <QuestTag type="Main quest" />
              <XpBadge amount="+50 XP" />
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">An interviewer that actually interviews you.</h2>
            <p className="text-lg text-muted-foreground">
              Paste a real job posting and Max pulls out the role, the skills, and what they really care about — then runs a live voice interview built around it.
            </p>
            <ul className="flex flex-col gap-2.5 text-sm">
              {[
                "Answer out loud — your words are transcribed as you speak",
                "Follow-up questions react to what you actually said",
                "Graded on quality, conciseness, and the questions you ask back",
              ].map((line) => (
                <li key={line} className="flex items-start gap-2.5">
                  <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                    <Check className="size-3" />
                  </span>
                  <span className="text-muted-foreground">{line}</span>
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.figure
            {...rise}
            transition={{ ...rise.transition, delay: 0.1 }}
            className="group overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-hover)] transition-transform hover:-translate-y-1"
          >
            <div className="flex items-center gap-1.5 border-b border-border/60 bg-muted/50 px-4 py-2.5">
              <span className="size-2.5 rounded-full bg-primary/70" />
              <span className="size-2.5 rounded-full bg-accent/70" />
              <span className="size-2.5 rounded-full bg-secondary" />
              <span className="ml-3 text-xs text-muted-foreground">jobmaxxing.work/interview</span>
            </div>
            <img
              src={interviewShot.url}
              alt="The JobMaxxing interview setup screen after analyzing a real job posting, showing the detected role, skills, and qualifications"
              className="w-full transition-transform duration-500 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </motion.figure>
        </div>
      </section>

      {/* Quest board */}
      <section id="quests" className="border-y border-border/60 bg-card/60 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <motion.div {...rise} className="max-w-2xl">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Pick a quest. Get better at getting hired.</h2>
            <p className="mt-3 text-lg text-muted-foreground">Each tool is a quest with a clear reward, so you always know what to do next and what it earned you.</p>
          </motion.div>
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {QUESTS.map((q, i) => (
              <motion.article
                key={q.title}
                {...rise}
                transition={{ ...rise.transition, delay: i * 0.07 }}
                className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-hover)]"
              >
                <div className="flex items-center justify-between">
                  <QuestTag type={q.tag} />
                  <XpBadge amount={q.xp} />
                </div>
                <span className="grid size-11 place-items-center rounded-xl bg-secondary text-secondary-foreground transition-transform group-hover:scale-110">
                  <q.icon className="size-5" />
                </span>
                <h3 className="font-display text-xl font-semibold">{q.title}</h3>
                <p className="text-sm text-muted-foreground">{q.text}</p>
                <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                  {q.chips.map((c) => (
                    <span key={c} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{c}</span>
                  ))}
                </div>
              </motion.article>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 py-20">
        <motion.div {...rise} className="max-w-2xl">
          <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">From first scan to first offer.</h2>
          <p className="mt-3 text-lg text-muted-foreground">Quests pay XP. XP raises your level. Levels unlock new titles and tougher practice.</p>
        </motion.div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d, x], i) => (
            <motion.div key={t} {...rise} transition={{ ...rise.transition, delay: i * 0.08 }} className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-5 shadow-sm">
              <span className={`grid size-8 place-items-center rounded-full text-sm font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{i + 1}</span>
              <h3 className="font-display font-semibold">{t}</h3>
              <p className="text-sm text-muted-foreground">{d}</p>
              <div className="mt-auto pt-2"><XpBadge amount={x} /></div>
            </motion.div>
          ))}
        </div>

        {/* Ranks */}
        <motion.div {...rise} id="ranks" className="mt-14 grid items-center gap-8 rounded-3xl border border-border bg-card p-8 shadow-sm md:grid-cols-[auto_1px_1fr]">
          <div className="flex items-center gap-6">
            <div className="relative grid size-32 place-items-center rounded-full border-8 border-secondary">
              <motion.span
                className="absolute inset-0 rounded-full border-8 border-primary"
                style={{ clipPath: "inset(0 50% 0 0)" }}
                initial={{ rotate: -90, opacity: 0 }}
                whileInView={{ rotate: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1 }}
              />
              <div className="text-center">
                <span className="block text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Level</span>
                <b className="font-display text-3xl">4</b>
              </div>
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">Contender</h3>
              <p className="text-sm text-muted-foreground">690 / 800 XP to level 5</p>
            </div>
          </div>
          <span className="hidden h-full w-px bg-border md:block" />
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {RANKS.map((r) => (
              <div key={r.name} className={`flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center ${r.state === "current" ? "border-primary/50 bg-accent/30" : "border-border"} ${r.state === "locked" ? "opacity-50" : ""}`}>
                <span className={`grid size-9 place-items-center rounded-full text-xs font-bold ${r.state === "current" ? "bg-primary text-primary-foreground" : r.state === "earned" ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {r.state === "earned" ? <Check className="size-4" /> : r.level}
                </span>
                <span className="text-xs font-medium leading-tight">{r.name}</span>
                <span className="text-[10px] text-muted-foreground">Lvl {r.level}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <motion.div {...rise} className="relative overflow-hidden rounded-3xl border border-border bg-secondary/70 p-10 md:p-14">
          <img src={MAX_POSES.dap} alt="" className="absolute -right-6 bottom-0 w-40 opacity-90 md:w-52" />
          <div className="relative max-w-lg">
            <h2 className="font-display text-3xl font-bold tracking-tight md:text-4xl">Max is ready when you are.</h2>
            <p className="mt-3 text-lg text-muted-foreground">Upload your resume to get your first grade, your first quests, and your first 20 XP.</p>
            <Button size="lg" className="mt-6" onClick={() => openAuth("up")}>Upload your resume <ArrowRight className="size-4" /></Button>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-4 px-6 text-sm text-muted-foreground md:flex-row md:items-center">
          <span className="flex items-center gap-2">
            <img src={MAX_POSES.wave} alt="" className="h-7 w-7 object-contain" />
            <span className="font-display font-bold text-foreground">JobMaxxing<span className="text-primary">.</span></span>
          </span>
          <span>Career practice that rewards the reps.</span>
          <span>© 2026 JobMaxxing · AI feedback is guidance, not a guarantee of hiring outcomes.</span>
        </div>
      </footer>

      {/* Auth modal */}
      <AnimatePresence>
        {authOpen && (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAuthOpen(false)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-label={mode === "in" ? "Sign in" : "Create your account"}
              className="w-full max-w-md rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-hover)]"
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={spring}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your next step</span>
                  <h2 className="mt-1 font-display text-xl font-bold">{mode === "in" ? "Good to see you again." : "Your next chapter starts here."}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {mode === "in" ? "Pick up where you left off." : "Sign-ups are invite-only for now. You can add your resume right after."}
                  </p>
                </div>
                <button aria-label="Close dialog" className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" onClick={() => setAuthOpen(false)}>
                  <X className="size-4" />
                </button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                {mode === "up" && (
                  <div className="space-y-2"><Label htmlFor="name">Name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} /></div>
                )}
                <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
                <div className="space-y-2"><Label htmlFor="pw">Password</Label><Input id="pw" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
                <Button type="submit" className="w-full" disabled={busy}>{busy && <Loader2 className="animate-spin" />}{mode === "in" ? "Sign in" : "Sign up"}</Button>
                <Button variant="ghost" type="button" className="w-full text-sm text-muted-foreground hover:text-foreground" onClick={() => setMode(mode === "in" ? "up" : "in")}>
                  {mode === "in" ? "New here? Create an account" : "Have an account? Sign in"}
                </Button>
              </form>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
