import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight, Clock, Code2, FileText, Mic, Radar, Sparkles, Users, Zap } from "lucide-react";
import { useGame } from "@/lib/game";
import { Button } from "@/components/ui/button";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import meadowDesktop from "@/assets/quest-scenes/meadow-desktop.png.asset.json";
import meadowMobile from "@/assets/quest-scenes/meadow-mobile.png.asset.json";
import officeDesktop from "@/assets/quest-scenes/office-desktop.png.asset.json";
import officeMobile from "@/assets/quest-scenes/office-mobile.png.asset.json";
import stageDesktop from "@/assets/quest-scenes/stage-desktop.png.asset.json";
import stageMobile from "@/assets/quest-scenes/stage-mobile.png.asset.json";
import { MAX_POSES, MAX_SCALE, type MaxPose } from "@/components/Max";
import { cn } from "@/lib/utils";
import gymDesktop from "@/assets/quest-scenes/gym-desktop.png.asset.json";
import gymMobile from "@/assets/quest-scenes/gym-mobile.png.asset.json";
import billboardDesktop from "@/assets/quest-scenes/billboard-desktop.png.asset.json";
import billboardMobile from "@/assets/quest-scenes/billboard-mobile.png.asset.json";
import openToWork from "@/assets/open-to-work.png.asset.json";

import { questTitleLines } from "@/lib/quest-titles";
import { ResetCountdown } from "@/components/ResetCountdown";
import { useInterviewModePicker } from "@/components/InterviewModePicker";
import { WEARABLE_ART } from "@/components/Wearables";
import { WEARABLES } from "@/lib/wearables";
import { useWornWearables } from "@/lib/use-wearables";

const MAX_ART: Record<string, MaxPose> = { setup: "resume", resume: "resume", interview: "interview", skills: "skills", hunt: "hunt", branding: "dap", social: "dap" };

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Featured Quests — JobMaxxing" },
      { name: "description", content: "Start a featured career quest or AI mock interview and see the XP you can earn." },
      { property: "og:title", content: "Featured Quests — JobMaxxing" },
      { property: "og:description", content: "Level up your job hunt with quests, XP and AI mock interviews." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:image", content: stageDesktop.url },
      { name: "twitter:image", content: stageDesktop.url },
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
    phrase: "Grow your Fellow Maxxers.",
    blurb: "Opportunities show up more when people know your name. Start one conversation today.",
  },
  social: {
    icon: Users, bg: "bg-primary/15", ring: "border-primary/30", chip: "text-primary",
    props: [["Coffee chat", "right-72 top-40 -rotate-6"], ["LinkedIn", "right-52 bottom-28 rotate-3"], ["Dap!", "right-80 bottom-44 -rotate-3"]],
    phrase: "Grow your Fellow Maxxers.",
    blurb: "Opportunities show up more when people know your name. Start one conversation today.",
  },
};
const DEFAULT_SCENE: Scene = {
  icon: Sparkles, bg: "bg-accent/20", ring: "border-accent/40", chip: "text-accent-foreground",
  props: [["Small win", "right-72 top-40 -rotate-6"], ["Momentum", "right-52 bottom-28 rotate-3"], ["+XP", "right-80 bottom-44 -rotate-3"]],
  phrase: "One step closer.",
  blurb: "Your dream role is closer than you think. Build your skills, sharpen your story, and make your next move.",
};

// Original uploaded scenes fill the entire featured screen; portrait art swaps on mobile.
function sceneSources(kind: string) {
  if (kind === "branding") return { desktop: billboardDesktop.url, mobile: billboardMobile.url };
  if (kind === "interview" || kind === "social") {
    return { desktop: stageDesktop.url, mobile: stageMobile.url };
  }
  if (kind === "skills") return { desktop: gymDesktop.url, mobile: gymMobile.url };
  // The resume quest reads as the office scene; the hunt quest keeps the open meadow.
  if (kind === "resume" || kind === "setup") return { desktop: officeDesktop.url, mobile: officeMobile.url };
  return { desktop: meadowDesktop.url, mobile: meadowMobile.url };
}
function SceneBackdrop({ kind }: { kind: string }) {
  const sources = sceneSources(kind);
  return (
    <picture className="absolute inset-0 block" data-quest-background>
      <source media="(max-width: 767px)" srcSet={sources.mobile} />
      <img src={sources.desktop} alt="" aria-hidden className="h-full w-full object-cover object-center" draggable={false} />
    </picture>
  );
}

function Dashboard() {
  const { quests } = useGame();
  // Clicking any Interview entry point opens the solo / peer popup first.
  const { openInterviewMode, interviewModeDialog } = useInterviewModePicker();
  const open = quests.filter((q) => !q.done);
  const [pick, setPick] = useState<number | null>(null);
  const [dir, setDir] = useState(1);
  // One slide per quest type — the carousel never shows two of the same kind.
  // One slide per quest type. The mock-interview slide already owns the interview
  // scene, so an interview-category quest doesn't get a second, identical card.
  const featuredOpen = open.filter(
    (q, i) => open.findIndex((o) => o.category === q.category) === i &&
      MAX_ART[(q.category ?? "").toLowerCase()] !== "interview",
  );
  // Slide 0 is always the mock interview — the core product; quest slides follow.
  const total = featuredOpen.length + 1;
  const featIdx = pick === null ? 0 : Math.min(pick, total - 1);
  const featured = featIdx === 0 ? null : featuredOpen[featIdx - 1];
  const shift = (d: number) => {
    setDir(d);
    setPick(((((pick ?? featIdx) + d) % total) + total) % total);
  };
  const jump = (i: number) => { setDir(i >= featIdx ? 1 : -1); setPick(i); };
  const featKey = featured?.category?.toLowerCase() ?? "interview";
  const featPose = MAX_ART[featKey] ?? "interview";
  const interviewQuest = open.find((q) => q.category.toLowerCase() === "interview");
  const reward = featured ? `+${featured.xp} XP` : interviewQuest ? `+${interviewQuest.xp} quest bonus · up to 400 XP by score` : "Up to 400 XP by score";
  const wornWearables = useWornWearables();
  const destination = featKey === "interview" ? "/interview" : featKey === "setup" || featKey === "resume" ? "/setup" : featKey === "hunt" ? "/market" : "/quests/add";
  const featArt = MAX_POSES[featPose];
  const featScale = MAX_SCALE[featPose];
  // Decode Max and the scene backdrop together so they appear at the same moment.
  const sources = sceneSources(featKey);
  const sceneSrcs = [featArt, sources.desktop, sources.mobile];
  const sceneKey = sceneSrcs.join("|");
  const [readyKey, setReadyKey] = useState("");
  useEffect(() => {
    let live = true;
    Promise.all(sceneSrcs.map((s) => { const i = new Image(); i.src = s; return i.decode().catch(() => {}); })).then(() => { if (live) setReadyKey(sceneKey); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneKey]);
  useEffect(() => { [gymDesktop.url, gymMobile.url, stageDesktop.url, stageMobile.url, meadowDesktop.url, meadowMobile.url, officeDesktop.url, officeMobile.url, billboardDesktop.url, billboardMobile.url, openToWork.url, ...Object.values(MAX_POSES)].forEach((s) => { const i = new Image(); i.src = s; }); }, []);
  const sceneReady = readyKey === sceneKey;
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

  // The Start button is stretched to exactly as wide as the longest line of the
  // quest title, so the headline and the button read as one block.
  const [titleW, setTitleW] = useState(0);
  useLayoutEffect(() => {
    const head = headRef.current;
    if (!head) return;
    const measure = () => {
      const range = document.createRange();
      let w = 0;
      head.querySelectorAll("span").forEach((line) => {
        range.selectNodeContents(line);
        w = Math.max(w, range.getBoundingClientRect().width);
      });
      const next = Math.round(w);
      setTitleW((prev) => (prev === next ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(head);
    document.fonts?.ready.then(measure).catch(() => {});
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featured?.id, featLines[0], featLines[1]]);

  return (
    <div>
      {/* Phase 1 — the featured quest fills the whole screen, edge to edge, under the top bar. */}
      <div className="relative">
        <section
          className={cn("featured-screen relative flex min-h-[calc(100svh_-_4rem)] items-stretch overflow-hidden border-b bg-hero px-6 pb-24 pt-8 md:px-20 md:pb-28 md:pt-14", (featKey === "interview" || featKey === "social") && "featured-stage")}
          aria-label="Featured quest"
        >
          <SceneBackdrop kind={featKey} />
          <div className="featured-scrim pointer-events-none absolute inset-0" />
          {/* The column stretches to the card so the pitch and the dots
              anchor the top and bottom of the screen. */}
          <div className="relative z-10 flex w-full max-w-2xl flex-col justify-start md:max-w-[calc(50%_-_13svh_-_1.5rem)] md:justify-between">
            <div className="flex flex-1 flex-col justify-center pb-8 pt-8 md:py-10">
              {featured ? (
                <h2 ref={headRef} title={featured.title} className="min-h-[2.2em] break-words text-foreground text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl"><span className="block">{featLines[0]}</span><span className="block">{featLines[1]}</span></h2>
              ) : (
                <h2 ref={headRef} className="min-h-[2.2em] break-words text-foreground text-3xl font-bold leading-[1.1] sm:text-4xl lg:text-5xl"><span className="block">Practice your</span><span className="block">mock interview</span></h2>
              )}
              <p ref={subRef} className="mt-5 max-w-md text-lg text-muted-foreground">{scene.blurb}</p>
              <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-foreground"><Zap className="h-4 w-4 text-primary" />{reward}</p>
              {destination === "/interview" ? (
                <Button style={titleW ? { width: titleW } : undefined} className={cn("mt-7 h-14 rounded-none px-3 text-lg font-bold uppercase tracking-[0.12em]", titleW ? "min-w-0" : "min-w-48")} onClick={openInterviewMode}>Start</Button>
              ) : (
                <Button asChild style={titleW ? { width: titleW } : undefined} className={cn("mt-7 h-14 rounded-none px-3 text-lg font-bold uppercase tracking-[0.12em]", titleW ? "min-w-0" : "min-w-48")}>
                  <Link to={destination} search={{}}>Start</Link>
                </Button>
              )}
            </div>
            {total > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                {Array.from({ length: Math.min(total, 10) }, (_, i) => (
                  <button key={i} type="button" onClick={() => jump(i)} aria-label={i === 0 ? "Show mock interview" : `Show quest: ${featuredOpen[i - 1]?.title}`} aria-current={i === featIdx} className={cn("h-2 rounded-full transition-all", i === featIdx ? "w-7 bg-primary" : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/60")} />
                ))}
                {total > 10 && <span className="text-xs text-muted-foreground">+{total - 10} more</span>}
              </div>
            )}
          </div>
          <motion.div key={featured?.id ?? "none"} initial={reducedMotion ? false : { opacity: 0, x: 28 * dir }} animate={sceneReady ? { opacity: 1, x: 0 } : { opacity: 0, x: reducedMotion ? 0 : 28 * dir }} transition={{ duration: 0.45 }} className="pointer-events-none absolute inset-x-0 bottom-14 flex h-[28svh] items-end justify-center md:inset-0 md:h-auto md:items-center">
            <div className="relative" style={{ height: `calc(clamp(140px,21svh,300px) * ${featScale})`, width: `calc(clamp(140px,21svh,300px) * ${featScale})` }}>
              {featKey === "branding" && (
                <img
                  src={openToWork.url}
                  alt=""
                  aria-hidden
                  draggable={false}
                   className="absolute left-1/2 top-1/2 h-[150%] w-[150%] max-w-none -translate-x-1/2 -translate-y-1/2 object-contain"
                />
              )}
              <div className="relative h-full w-full">
                <img key={featArt} src={featArt} alt={featured ? `Max ready for: ${featured.title}` : "Max with a microphone, ready to interview you"} width={816} height={816} decoding="sync" draggable={false} className="h-full w-full object-contain" />
                {WEARABLES.filter((w) => wornWearables.includes(w.id)).map((w) => (
                  <img key={w.id} src={WEARABLE_ART[w.id]} alt="" draggable={false} className="pointer-events-none absolute" style={{ left: `${w.left}%`, top: `${w.top}%`, width: `${w.width}%` }} />
                ))}
              </div>
            </div>
          </motion.div>
          <aside aria-label="Quick overview" className="absolute right-20 top-1/2 z-10 hidden w-1/2 -translate-y-1/2 justify-end">
            <div className="w-[min(32rem,calc(50vw_-_15svh_-_8rem))] max-w-full overflow-hidden rounded-md border border-border bg-card/95 text-card-foreground shadow-2xl ring-1 ring-foreground/10 backdrop-blur-xl">
              <p className="border-b border-border bg-muted/40 px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.25em]">Goals</p>
              <ul className="divide-y divide-border">
                {[...quests.filter((q) => q.period === "daily"), ...quests.filter((q) => q.period === "weekly")].sort((a, b) => Number(a.done) - Number(b.done)).slice(0, 5).map((q) => (
                  <li key={q.id}>
                    <Link to="/quests/add" title={q.title} className="group flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center border", q.done ? "border-success/50 bg-success/15 text-success" : "border-border bg-muted text-muted-foreground")}>{q.done ? <Check className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{q.title}</p>
                        <div className="mt-1.5 h-1 bg-border"><div className={cn("h-full bg-success transition-all", q.done ? "w-full" : "w-0")} /></div>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground/80">+{q.xp} XP</span>
                    </Link>
                  </li>
                ))}
                {quests.length === 0 && <li className="px-5 py-4 text-sm text-muted-foreground">No missions yet.</li>}
              </ul>
              <div className="flex items-center justify-center gap-2 border-t border-border px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-foreground/80">
                <Clock className="h-3.5 w-3.5" />
                <ResetCountdown period="daily" label="Daily expiration in" />
              </div>
              <p className="border-t border-border bg-muted/40 px-5 py-3 text-center text-xs font-bold uppercase tracking-[0.25em]">Improve</p>
              <div className="divide-y divide-border">
                <button type="button" onClick={openInterviewMode} className="group flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-muted/50">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-muted"><Mic className="h-5 w-5" /></span>
                  <span className="flex-1 text-sm font-bold uppercase tracking-wider">Interview</span>
                  <span className="text-xs text-muted-foreground">Solo or peer</span>
                </button>
                <Link to="/setup" className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/50">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-border bg-muted"><FileText className="h-5 w-5" /></span>
                  <span className="flex-1 text-sm font-bold uppercase tracking-wider">Resume Lab</span>
                  <span className="text-xs text-muted-foreground">Grade & polish</span>
                </Link>
              </div>
            </div>
          </aside>
          {total > 1 && (
            <span className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2 rounded-full border bg-card/90 px-3 py-1 text-xs font-medium tabular-nums text-card-foreground shadow-sm">{featIdx + 1} / {total}</span>
          )}
        </section>
        {total > 1 && (<>
          <Button variant="outline" size="icon" className="absolute left-3 top-[70%] md:top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full bg-card md:left-6" onClick={() => shift(-1)} aria-label="Previous quest" title="Previous quest"><ChevronLeft className="h-5 w-5" /></Button>
          <Button variant="outline" size="icon" className="absolute right-3 top-[70%] md:top-1/2 z-20 h-11 w-11 -translate-y-1/2 rounded-full bg-card md:right-6" onClick={() => shift(1)} aria-label="Next quest" title="Next quest"><ChevronRight className="h-5 w-5" /></Button>
        </>)}
      </div>


      {interviewModeDialog}
    </div>
  );
}
