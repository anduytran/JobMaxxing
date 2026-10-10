import { Link, useLocation, useRouter, useRouterState } from "@tanstack/react-router";
import { signOut } from "@/lib/auth.functions";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import {
  LayoutGrid, FileText, Mic, Users, Radar, LineChart, Network, UsersRound, Swords, Settings, Menu, LogOut, Zap, ArrowRight, Flame, CircleHelp,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { useGame, levelTitle } from "@/lib/game";
import { Max, type MaxPose } from "@/components/Max";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Item = { to: string; label: string; icon: typeof LayoutGrid; badge?: string };
const GROUPS: { label: string; items: Item[] }[] = [
  { label: "Your career, levelled up", items: [
    { to: "/", label: "Dashboard", icon: LayoutGrid },
    { to: "/setup", label: "Resume Lab", icon: FileText },
    { to: "/interview", label: "AI Mock Interview", icon: Mic },
    { to: "/peers", label: "Peer Interviews", icon: Users },
  ] },
  { label: "Opportunities", items: [
    { to: "/market", label: "Job Radar", icon: Radar, badge: "New" },
    { to: "/progress", label: "Career Progress", icon: LineChart },
  ] },
  { label: "Growth", items: [
    { to: "/quests", label: "Quests", icon: Swords },
    { to: "/skills", label: "Skill Tree", icon: Network },
  ] },
  { label: "Your crew", items: [{ to: "/crew", label: "Job Maxxers", icon: UsersRound, badge: "3" }] },
];
const ALL = GROUPS.flatMap((g) => g.items).concat({ to: "/settings", label: "Settings", icon: Settings });

export function Mascot({ className }: { className?: string }) {
  return <Max className={className} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { level, lastGain, name } = useGame();
  const loc = useLocation();
  const router = useRouter();
  const navigating = useRouterState({ select: (s) => s.status === "pending" });
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const current = ALL.find((i) => i.to === loc.pathname)?.label ?? "Workspace";
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  return (
    <MotionConfig reducedMotion="user"><div className="flex min-h-screen">
      {navigating && <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-primary" />}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 flex w-72 flex-col overflow-y-auto border-r bg-sidebar px-4 py-7 transition-transform md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <Link to="/" className="mb-8 flex items-center gap-2 px-2">
          <Mascot className="h-10 w-10" />
          <span className="font-display text-2xl font-bold">JobMaxxing<span className="text-primary">.</span></span>
        </Link>
        <nav className="flex-1 space-y-6">
          {GROUPS.map((g, gi) => (
            <div key={g.label} className={cn(gi > 0 && "border-t pt-5")}>
              <div className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{g.label}</div>
              {g.items.map(({ to, label, icon: Icon, badge }) => {
                const active = loc.pathname === to;
                return (
                  <Link key={to} to={to} onClick={() => setOpen(false)}
                    className={cn("group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-all hover-slide",
                      active ? "font-medium text-primary" : "text-foreground/80 hover:bg-muted")}>
                    {active && <motion.span layoutId="nav" className="absolute inset-0 rounded-xl border border-primary/20 bg-sidebar-accent" />}
                    <Icon className="icon-wiggle relative h-[18px] w-[18px]" />
                    <span className="relative flex-1">{label}</span>
                    {badge && <span className="relative rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{badge}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="mt-6 rounded-2xl bg-muted/60 p-4 transition-shadow hover:shadow-md">
          <Zap className="h-5 w-5 text-primary" />
          <p className="mt-2 text-sm font-semibold">A little boost. A big leap.</p>
          <p className="mt-1 text-xs text-muted-foreground">Unlock your full career potential.</p>
          <Link to="/settings" onClick={() => setOpen(false)} className="mt-3 flex items-center justify-between rounded-xl border bg-card px-4 py-2.5 text-sm font-medium hover:bg-muted">Explore Pro <ArrowRight className="h-4 w-4" /></Link>
        </div>
        <Link to="/settings" onClick={() => setOpen(false)} className="mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] text-foreground/80 hover:bg-muted">
          <Settings className="h-[18px] w-[18px]" /> Settings
        </Link>
        <div className="mt-4 rounded-2xl border bg-background p-3 text-sm">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold text-primary">{initials}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{name}</div>
              <div className="text-xs text-muted-foreground">Level {level} · {levelTitle(level)}</div>
            </div>
          </div>
          <div className="mt-3 flex gap-2 text-xs">
            <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted"><Settings className="h-3.5 w-3.5" />Settings</Link>
            <Button variant="ghost" size="sm" className="ml-auto flex h-auto items-center gap-1 rounded-lg px-2 py-1 text-primary hover:bg-muted disabled:opacity-60" disabled={signingOut}
              onClick={async () => { setSigningOut(true); try { await signOut(); await router.invalidate(); } finally { setSigningOut(false); } }}>
              <LogOut className="h-3.5 w-3.5" />{signingOut ? "Signing out…" : "Sign out"}</Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:pl-72">
        <header className="sticky top-0 z-30 flex h-20 items-center gap-4 border-b bg-card/90 px-4 backdrop-blur md:px-10">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu"><Menu /></Button>
          <div className="hidden items-center gap-3 text-[15px] sm:flex">
            <span className="text-muted-foreground">Workspace</span><span className="text-muted-foreground">›</span><span>{current}</span>
          </div>
          <div className="ml-auto flex items-center gap-4">
            <div className="relative flex items-center gap-3 rounded-2xl border bg-card px-4 py-2.5 text-sm transition-shadow hover:shadow-md">
              <Flame className="animate-flame h-5 w-5 text-primary" />
              <span className="font-semibold">5 day streak</span>
              <span className="hidden border-l pl-3 text-muted-foreground sm:inline">Keep it going!</span>
              <AnimatePresence>
                {lastGain && (
                  <motion.span key={lastGain.key} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} transition={{ duration: 1.6 }}
                    className="absolute -top-2 right-0 font-bold text-success">+{lastGain.amount}</motion.span>
                )}
              </AnimatePresence>
            </div>
            <div className="grid h-10 w-10 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold">{initials}</div>
          </div>
        </header>
        <motion.main key={loc.pathname} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="page-arrival p-4 md:px-10 md:py-10">
          {children}
          <footer className="mx-auto mt-16 flex max-w-6xl justify-between border-t pt-6 text-xs text-muted-foreground">
            <span>Made for your next chapter.</span><span>Privacy · Terms · AI-powered. Human-centered.</span>
          </footer>
        </motion.main>
      </div>
      <Button variant="outline" size="icon" aria-label="Help" title="Help" className="hover-pop fixed bottom-6 right-6 z-40 grid h-11 w-11 place-items-center rounded-full border bg-card shadow-md hover:bg-muted">
        <CircleHelp className="h-5 w-5" />
      </Button>
      <AnimatePresence>
        {lastGain && <motion.div key={lastGain.key} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: [0, 1, 1, 0], y: reducedMotion ? 0 : [20, 0, 0, -8] }} transition={{ duration: 3.5, times: [0, 0.1, 0.8, 1] }} className="pointer-events-none fixed bottom-6 left-4 right-20 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border bg-card p-4 shadow-md md:left-72">
          <div className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-success/20 text-foreground">
            <CheckReward />
            <div aria-hidden="true" className="absolute inset-0 flex justify-between">{["bg-primary", "bg-success", "bg-accent", "bg-primary"].map((color, i) => <span key={i} className={cn("reward-particle h-2 w-1 rounded-sm", color)} />)}</div>
          </div>
          <div><p className="text-sm font-semibold">A little closer. Nice work!</p><p className="text-xs text-muted-foreground">+{lastGain.amount} XP · Keep that momentum.</p></div>
        </motion.div>}
      </AnimatePresence>
    </div></MotionConfig>
  );
}

function CheckReward() { return <Zap className="h-5 w-5 text-primary" />; }

export function PanelHead({ title, level }: { title: string; level: number }) {
  return (
    <div className="flex items-center justify-between gap-4 px-8 pt-7 md:px-12">
      <h2 className="text-xl font-bold">{title}</h2>
      <span className="rounded-lg bg-sidebar-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">Level {level}</span>
    </div>
  );
}

export function PageHeader({ eyebrow, title, sub, pose }: { eyebrow: string; title: string; sub: string; pose?: MaxPose }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6">
      <div>
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold md:text-5xl">{title}</h1>
      <p className="mt-2 text-lg text-muted-foreground">{sub}</p>
      </div>
      {pose && <Max pose={pose} className="hidden h-24 w-24 shrink-0 sm:block" />}
    </div>
  );
}
