import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  addQuest as addQuestFn,
  completeQuest as completeQuestFn,
  gainXp as gainXpFn,
  saveProfile as saveProfileFn,
  saveRoast as saveRoastFn,
  saveReducedMotion as saveReducedMotionFn,
  saveDetails as saveDetailsFn,
  type JobPrefs,
  type ResumeInfo,
  type StudentInfo,
  type GameState,
  type Quest,
  type SaveResult,
} from "./devup.functions";

export const XP_PER_LEVEL = 1000;
const TITLES = ["Rookie", "Apprentice", "Contender", "Challenger", "Specialist", "Veteran", "Elite", "Legend"];
export const levelTitle = (lvl: number) => TITLES[Math.min(lvl - 1, TITLES.length - 1)];

export type { Quest, JobPrefs, ResumeInfo, StudentInfo };
export type Details = { skills: string[]; student: StudentInfo; jobPrefs: JobPrefs; resume: ResumeInfo };

/** Used only when Neon can't be reached, so the UI still has something to show. */
const FALLBACK_QUESTS: Quest[] = [
  { id: "resume", title: "Upload Resume", xp: 500, done: false, category: "Setup", period: "once" },
  { id: "mock1", title: "Complete 1 Mock Interview", xp: 200, done: false, category: "Interview", period: "daily" },
  { id: "linkedin", title: "Polish LinkedIn headline", xp: 150, done: false, category: "Branding", period: "once" },
  { id: "leet", title: "Solve 3 algorithm problems", xp: 300, done: false, category: "Skills", period: "daily" },
  { id: "apply", title: "Apply to 5 target roles", xp: 400, done: true, category: "Hunt", period: "weekly" },
];

export const ACHIEVEMENTS = [
  { id: "first", name: "First Blood", desc: "Completed first quest" },
  { id: "streak", name: "7-Day Streak", desc: "Logged in 7 days" },
  { id: "roast", name: "Survived the Roast", desc: "Finished a Roast interview" },
  { id: "net", name: "Networker", desc: "10 connections" },
];

type Game = {
  name: string; title: string; xp: number; level: number; levelXp: number;
  quests: Quest[]; roast: boolean; reducedMotion: boolean; lastGain: { amount: number; key: number } | null;
  setProfile: (n: string, t: string) => Promise<boolean>;
  completeQuest: (id: string) => void;
  addQuest: (q: Omit<Quest, "done">) => void;
  gainXp: (n: number, reason?: string) => void;
  setRoast: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setXp: (n: number) => void;
  email: string;
  details: Details;
  saveDetails: (d: Partial<Details>) => Promise<boolean>;
};

// Keep one context instance across hot reloads; a re-created context makes
// already-mounted consumers throw "useGame outside provider".
const g = globalThis as { __devupGameCtx?: React.Context<Game | null> };
const Ctx = (g.__devupGameCtx ??= createContext<Game | null>(null));

export function GameProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: GameState | { ok: false; error: string } | null;
}) {
  const loaded = initial && initial.ok ? initial : null;
  const [name, setName] = useState(loaded?.name ?? "Alex Rivera");
  const [title, setTitle] = useState(loaded?.title ?? "Junior Full-Stack Developer");
  const [xp, setXpState] = useState(loaded?.xp ?? 2350);
  const [quests, setQuests] = useState<Quest[]>(loaded?.quests ?? FALLBACK_QUESTS);
  const [roast, setRoastState] = useState(loaded?.roast ?? false);
  const [reducedMotion, setReducedMotionState] = useState(loaded?.reducedMotion ?? false);
  const [details, setDetails] = useState<Details>({
    skills: loaded?.skills ?? [], student: loaded?.student ?? {}, jobPrefs: loaded?.jobPrefs ?? {}, resume: loaded?.resume ?? null,
  });
  const [lastGain, setLastGain] = useState<Game["lastGain"]>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("roast", roast);
  }, [roast]);

  // The in-app "reduce motion" switch; OS-level prefers-reduced-motion is
  // handled separately by the stylesheet.
  useEffect(() => {
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  // Writes go to Neon optimistically; a rejected write rolls the screen back.
  const rejected = (res: SaveResult | undefined, rollback: () => void) => {
    if (res && !res.ok) {
      rollback();
      toast.error(res.error);
      return true;
    }
    return false;
  };

  const gainXp = (n: number, reason = "bonus") => {
    const prev = xp;
    setXpState((x) => x + n);
    setLastGain({ amount: n, key: Date.now() });
    gainXpFn({ data: { amount: n, reason } }).then((res) => {
      if (rejected(res, () => { setXpState(prev); setLastGain(null); })) return;
      if (res.ok && typeof res.xp === "number") setXpState(res.xp);
    });
  };

  const value: Game = {
    name, title, xp, quests, roast, reducedMotion, lastGain,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    levelXp: xp % XP_PER_LEVEL,
    setProfile: async (n, t) => {
      const prevName = name, prevTitle = title;
      setName(n); setTitle(t);
      const res = await saveProfileFn({ data: { name: n, title: t } });
      return !rejected(res, () => { setName(prevName); setTitle(prevTitle); });
    },
    completeQuest: (id) => {
      const q = quests.find((q) => q.id === id);
      if (!q || q.done) return;
      const prevXp = xp;
      setQuests((qs) => qs.map((x) => (x.id === id ? { ...x, done: true } : x)));
      setXpState((x) => x + q.xp);
      setLastGain({ amount: q.xp, key: Date.now() });
      completeQuestFn({ data: { id } }).then((res) => {
        if (
          rejected(res, () => {
            setQuests((qs) => qs.map((x) => (x.id === id ? { ...x, done: false } : x)));
            setXpState(prevXp);
            setLastGain(null);
          })
        )
          return;
        if (res.ok && typeof res.xp === "number") setXpState(res.xp);
        toast.success(`Quest complete: ${q.title}`, { description: `+${q.xp} XP saved` });
      });
    },
    addQuest: (q) => {
      if (quests.some((x) => x.id === q.id)) return;
      setQuests((qs) => [{ ...q, done: false }, ...qs]);
      addQuestFn({ data: q }).then((res) => {
        rejected(res, () => setQuests((qs) => qs.filter((x) => x.id !== q.id)));
      });
    },
    gainXp,
    setRoast: (v) => {
      const prev = roast;
      setRoastState(v);
      saveRoastFn({ data: { roast: v } }).then((res) => {
        rejected(res, () => setRoastState(prev));
      });
    },
    setReducedMotion: (v) => {
      const prev = reducedMotion;
      setReducedMotionState(v);
      saveReducedMotionFn({ data: { reducedMotion: v } }).then((res) => {
        rejected(res, () => setReducedMotionState(prev));
      });
    },
    setXp: (n) => setXpState(n),
    email: loaded?.email ?? "",
    details,
    saveDetails: async (d) => {
      const prev = details;
      setDetails({ ...details, ...d });
      const res = await saveDetailsFn({ data: d });
      return !rejected(res, () => setDetails(prev));
    },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}
