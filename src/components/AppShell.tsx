import { Link, useLocation } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { LayoutDashboard, Swords, Video, BarChart3, FileUp, Settings, Zap, Menu } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useGame, XP_PER_LEVEL, levelTitle } from "@/lib/game";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/quests", label: "Quests", icon: Swords },
  { to: "/interview", label: "Interview Simulator", icon: Video },
  { to: "/market", label: "Market Insights", icon: BarChart3 },
  { to: "/setup", label: "Resume Setup", icon: FileUp },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { level, levelXp, lastGain, name } = useGame();
  const loc = useLocation();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 border-r bg-sidebar p-5 transition-transform md:translate-x-0",
        open ? "translate-x-0" : "-translate-x-full",
      )}>
        <div className="mb-10 flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-md bg-primary text-primary-foreground glow clip-corner">
            <Zap className="h-5 w-5" />
          </div>
          <span className="font-display text-2xl font-bold tracking-wider">DEV<span className="text-primary">UP</span></span>
        </div>
        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = loc.pathname === to;
            return (
              <Link key={to} to={to} onClick={() => setOpen(false)}
                className={cn("relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors",
                  active ? "text-primary" : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground")}>
                {active && <motion.span layoutId="nav" className="absolute inset-0 rounded-md border border-primary/40 bg-primary/10" />}
                <Icon className="relative h-4 w-4" />
                <span className="relative">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-5 left-5 right-5 rounded-lg border bg-sidebar-accent p-3 font-mono text-xs text-muted-foreground">
          <div className="text-foreground">{name}</div>
          LVL {level} · {levelTitle(level)}
        </div>
      </aside>

      <div className="flex-1 md:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-4 border-b bg-background/80 px-4 py-3 backdrop-blur md:px-8">
          <button className="md:hidden" onClick={() => setOpen(!open)} aria-label="Menu"><Menu /></button>
          <div className="ml-auto flex items-center gap-3">
            <span className="font-display text-sm font-bold text-primary">LVL {level}</span>
            <div className="relative h-2.5 w-40 overflow-hidden rounded-full bg-muted sm:w-64">
              <motion.div className="h-full rounded-full xp-fill" animate={{ width: `${(levelXp / XP_PER_LEVEL) * 100}%` }} transition={{ type: "spring", stiffness: 60 }} />
            </div>
            <span className="relative font-mono text-xs text-muted-foreground">
              {levelXp}/{XP_PER_LEVEL} XP
              <AnimatePresence>
                {lastGain && (
                  <motion.span key={lastGain.key} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} transition={{ duration: 1.6 }}
                    className="absolute -top-1 right-0 font-bold text-success">+{lastGain.amount}</motion.span>
                )}
              </AnimatePresence>
            </span>
          </div>
        </header>
        <motion.main key={loc.pathname} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="p-4 md:p-8">
          {children}
        </motion.main>
      </div>
    </div>
  );
}
