import { Link, useLocation, useRouter, useRouterState } from "@tanstack/react-router";
import { signOut } from "@/lib/auth.functions";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "framer-motion";
import {
  LayoutGrid, FileText, Mic, Radar, LineChart, Network, UsersRound, Swords, Settings, Menu, LogOut, Zap, Flame, CircleHelp, X, Store, ArrowRight,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getStreak } from "@/lib/career.functions";
import { useGame, levelTitle } from "@/lib/game";
import { type MaxPose } from "@/components/Max";
import { WornMax } from "@/components/Wearables";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { QuestMenu } from "@/components/QuestMenu";
import { InviteListener } from "@/components/InviteListener";

type Item = { to: string; label: string; icon: typeof LayoutGrid; badge?: string };
// Flat nav, no sections — Interview leads because it's the core product.
// Lock In sits at the far left, right after the brand, as the one loud button.
const LEFT: Item[] = [
  { to: "/", label: "Home", icon: LayoutGrid },
  { to: "/collection", label: "Collection", icon: Swords },
];
const LOCKIN: Item = { to: "/lock-in", label: "Lock In", icon: ArrowRight };
const RIGHT: Item[] = [
  { to: "/progress", label: "Career", icon: LineChart },
  { to: "/store", label: "Store", icon: Store },
];
const ITEMS: Item[] = [LOCKIN, ...LEFT, ...RIGHT];

export function Mascot({ className }: { className?: string }) {
  return <WornMax className={className} />;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { level, lastGain, name, avatarUrl, setAvatar } = useGame();
  const loc = useLocation();
  const router = useRouter();
  const navigating = useRouterState({ select: (s) => s.status === "pending" });
  const [signingOut, setSigningOut] = useState(false);
  const [open, setOpen] = useState(false);
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    let live = true;
    getStreak().then((s) => { if (live) setStreak(s.current); }).catch(() => {});
    return () => { live = false; };
  }, []);
  const reducedMotion = useReducedMotion();
  const initials = name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase() || "ME";

  const doSignOut = async () => {
    setSigningOut(true);
    try { await signOut(); await router.invalidate(); } finally { setSigningOut(false); }
  };

  // Profile photo: read the picked file, downscale to a 256px square on a
  // canvas, and hand the small data URL to the server (no file storage).
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingAvatar, setSavingAvatar] = useState(false);
  const pickAvatar = async (file: File | undefined) => {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) { toast.error("Choose a PNG, JPG, or WebP image."); return; }
    setSavingAvatar(true);
    try {
      const bitmap = await createImageBitmap(file);
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 256;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, 256, 256);
      bitmap.close();
      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      if (!(await setAvatar(dataUrl))) return;
      toast.success("Profile picture updated.");
    } catch {
      toast.error("Couldn't read that image. Try another one.");
    } finally {
      setSavingAvatar(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <MotionConfig reducedMotion="user"><div className="flex min-h-screen flex-col">
      <InviteListener />
      {navigating && <div role="progressbar" aria-label="Loading page" className="fixed inset-x-0 top-0 z-50 h-0.5 animate-pulse bg-primary" />}

      {/* Valorant-style top nav: brand left, centered tabs with active underline, player cluster right */}
      <header className="sticky top-0 z-40 border-b bg-card/90 backdrop-blur">
        <div className="flex h-16 items-center gap-4 px-4 md:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <Mascot className="h-9 w-9" />
            <span className="font-display text-xl font-bold">JobMaxxing<span className="text-primary">.</span></span>
          </Link>

          <nav className="hidden flex-1 items-stretch justify-center gap-1 self-stretch lg:flex" aria-label="Main">
            {/* Lock In is the one loud button: the leftmost option, straight left of Home, full nav height. */}
            <Link to={LOCKIN.to}
              className={cn("group relative flex shrink-0 items-center gap-3 bg-primary px-7 text-[18px] font-bold uppercase tracking-[0.14em] text-primary-foreground transition-colors hover:bg-primary/90",
                loc.pathname === LOCKIN.to && "ring-1 ring-inset ring-primary-foreground/40")}>
              {LOCKIN.label}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
            </Link>
            {LEFT.map((it) => <TopTab key={it.to} item={it} active={loc.pathname === it.to} />)}
            {RIGHT.map((it) => <TopTab key={it.to} item={it} active={loc.pathname === it.to} />)}
          </nav>

          <div className="ml-auto flex items-center gap-3 lg:ml-0">
            <QuestMenu />
            <div className="relative hidden items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm transition-shadow hover:shadow-md md:flex">
              <Flame className="animate-flame h-4 w-4 text-primary" />
              <span className="font-semibold">{streak > 0 ? `${streak} day streak` : "No streak yet"}</span>
              <AnimatePresence>
                {lastGain && (
                  <motion.span key={lastGain.key} initial={{ opacity: 1, y: 0 }} animate={{ opacity: 0, y: -28 }} transition={{ duration: 1.6 }}
                    className="absolute -top-2 right-0 font-bold text-success">+{lastGain.amount}</motion.span>
                )}
              </AnimatePresence>
            </div>
            {/* Profile menu: avatar button holding level, settings, photo, sign out. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="hidden items-center gap-2 rounded-full border bg-card px-3 py-1.5 text-sm transition-shadow hover:shadow-md md:flex" aria-label="Profile menu">
                  <AvatarFace url={avatarUrl} initials={initials} className="h-7 w-7 text-xs" />
                  <span className="font-semibold">Lv {level}</span>
                  <span className="hidden text-xs text-muted-foreground xl:inline">{levelTitle(level)}</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="flex items-center gap-3">
                  <AvatarFace url={avatarUrl} initials={initials} className="h-9 w-9 text-sm" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{name}</span>
                    <span className="block text-xs font-normal text-muted-foreground">Level {level} · {levelTitle(level)}</span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => fileRef.current?.click()} disabled={savingAvatar}>
                  <ImagePlus className="h-4 w-4" />{savingAvatar ? "Saving photo…" : avatarUrl ? "Change photo" : "Add profile photo"}
                </DropdownMenuItem>
                {avatarUrl && (
                  <DropdownMenuItem onSelect={() => void setAvatar(null)}>
                    <ImageOff className="h-4 w-4" />Remove photo
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => void router.navigate({ to: "/settings" })}>
                  <Settings className="h-4 w-4" />Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => void doSignOut()} disabled={signingOut} className="text-primary focus:text-primary">
                  <LogOut className="h-4 w-4" />{signingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" aria-hidden="true"
              onChange={(e) => void pickAvatar(e.target.files?.[0])} />
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu" aria-expanded={open}>
              {open ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {open && (
            <motion.nav initial={reducedMotion ? false : { height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}
              className="overflow-hidden border-t lg:hidden" aria-label="Main mobile">
              <div className="space-y-1 px-4 py-4">
                {ITEMS.map(({ to, label, icon: Icon, badge }) => {
                  const active = loc.pathname === to;
                  return (
                    <Link key={to} to={to} onClick={() => setOpen(false)}
                      className={cn("flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] transition-colors",
                        active ? "bg-sidebar-accent font-medium text-primary" : "text-foreground/80 hover:bg-muted")}>
                      <Icon className="h-[18px] w-[18px]" />
                      <span className="flex-1">{label}</span>
                      {badge && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">{badge}</span>}
                    </Link>
                  );
                })}
                <div className="mt-3 flex items-center gap-3 rounded-xl border bg-background p-3 text-sm">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-sidebar-accent text-xs font-semibold text-primary">{initials}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{name}</div>
                    <div className="text-xs text-muted-foreground">Level {level} · {levelTitle(level)}</div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1 text-xs">
                  <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-muted-foreground hover:bg-muted"><Settings className="h-3.5 w-3.5" />Settings</Link>
                  <Button variant="ghost" size="sm" className="ml-auto flex h-auto items-center gap-1 rounded-lg px-2 py-1 text-primary hover:bg-muted disabled:opacity-60" disabled={signingOut} onClick={doSignOut}>
                    <LogOut className="h-3.5 w-3.5" />{signingOut ? "Signing out…" : "Sign out"}</Button>
                </div>
              </div>
            </motion.nav>
          )}
        </AnimatePresence>
      </header>

      {/* Home lands on a full-screen featured card, so its page carries its own padding. */}
      <motion.main key={loc.pathname} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className={cn("page-arrival flex-1", (loc.pathname === "/" || loc.pathname === "/interview") ? "" : "p-4 md:px-10 md:py-10")}>
        {children}
        {loc.pathname !== "/interview" && <footer className={cn("mx-auto mt-16 flex max-w-6xl justify-between border-t pt-6 text-xs text-muted-foreground", loc.pathname === "/" && "px-4 md:px-10")}>
          <span>Made for your next chapter.</span><span>Privacy · Terms · AI-powered. Human-centered.</span>
        </footer>}
      </motion.main>

      {loc.pathname !== "/interview" && <Button variant="outline" size="icon" aria-label="Help" title="Help" className="hover-pop fixed bottom-6 right-6 z-40 grid h-11 w-11 place-items-center rounded-full border bg-card shadow-md hover:bg-muted">
        <CircleHelp className="h-5 w-5" />
      </Button>}
      <AnimatePresence>
        {lastGain && <motion.div key={lastGain.key} initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: [0, 1, 1, 0], y: reducedMotion ? 0 : [20, 0, 0, -8] }} transition={{ duration: 3.5, times: [0, 0.1, 0.8, 1] }} className="pointer-events-none fixed bottom-6 left-4 right-20 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-xl border bg-card p-4 shadow-md">
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

function TopTab({ item: { to, label }, active }: { item: Item; active: boolean }) {
  return (
    <Link to={to}
      className={cn("relative flex items-center px-5 text-[13px] font-semibold uppercase tracking-[0.14em] transition-colors",
        active ? "text-primary" : "text-foreground/70 hover:text-foreground")}>
      {label}
      {active && <motion.span layoutId="topnav" className="absolute inset-x-3 -bottom-px h-[3px] rounded-t-sm bg-primary" />}
    </Link>
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
      {pose && <WornMax pose={pose} className="hidden h-24 w-24 shrink-0 sm:block" />}
    </div>
  );
}
