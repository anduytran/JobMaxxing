import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export const XP_PER_LEVEL = 1000;
const TITLES = ["Rookie", "Apprentice", "Contender", "Challenger", "Specialist", "Veteran", "Elite", "Legend"];
export const levelTitle = (lvl: number) => TITLES[Math.min(lvl - 1, TITLES.length - 1)];

export type Quest = { id: string; title: string; xp: number; done: boolean; category: string };

const INITIAL_QUESTS: Quest[] = [
  { id: "resume", title: "Upload Resume", xp: 500, done: false, category: "Setup" },
  { id: "mock1", title: "Complete 1 Mock Interview", xp: 200, done: false, category: "Interview" },
  { id: "linkedin", title: "Polish LinkedIn headline", xp: 150, done: false, category: "Branding" },
  { id: "leet", title: "Solve 3 algorithm problems", xp: 300, done: false, category: "Skills" },
  { id: "apply", title: "Apply to 5 target roles", xp: 400, done: true, category: "Hunt" },
];

export const ACHIEVEMENTS = [
  { id: "first", name: "First Blood", desc: "Completed first quest" },
  { id: "streak", name: "7-Day Streak", desc: "Logged in 7 days" },
  { id: "roast", name: "Survived the Roast", desc: "Finished a Roast interview" },
  { id: "net", name: "Networker", desc: "10 connections" },
];

type Game = {
  name: string; title: string; xp: number; level: number; levelXp: number;
  quests: Quest[]; roast: boolean; lastGain: { amount: number; key: number } | null;
  setProfile: (n: string, t: string) => void;
  completeQuest: (id: string) => void;
  addQuest: (q: Omit<Quest, "done">) => void;
  gainXp: (n: number) => void;
  setRoast: (v: boolean) => void;
  setXp: (n: number) => void;
};

const Ctx = createContext<Game | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [name, setName] = useState("Alex Rivera");
  const [title, setTitle] = useState("Junior Full-Stack Developer");
  const [xp, setXpState] = useState(2350);
  const [quests, setQuests] = useState(INITIAL_QUESTS);
  const [roast, setRoast] = useState(false);
  const [lastGain, setLastGain] = useState<Game["lastGain"]>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("roast", roast);
  }, [roast]);

  const gainXp = (n: number) => {
    setXpState((x) => x + n);
    setLastGain({ amount: n, key: Date.now() });
  };

  const value: Game = {
    name, title, xp, quests, roast, lastGain,
    level: Math.floor(xp / XP_PER_LEVEL) + 1,
    levelXp: xp % XP_PER_LEVEL,
    setProfile: (n, t) => { setName(n); setTitle(t); },
    completeQuest: (id) => {
      const q = quests.find((q) => q.id === id);
      if (!q || q.done) return;
      setQuests((qs) => qs.map((x) => (x.id === id ? { ...x, done: true } : x)));
      gainXp(q.xp);
    },
    addQuest: (q) => setQuests((qs) => (qs.some((x) => x.id === q.id) ? qs : [{ ...q, done: false }, ...qs])),
    gainXp,
    setRoast,
    setXp: (n) => setXpState(n),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGame() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}
