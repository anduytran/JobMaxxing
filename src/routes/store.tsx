import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Coins, Snowflake, Wrench, Zap, BadgeCheck, Palette, Package, Check, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/lib/game";
import { CAPSULE_ART, MACHINE_ART, MaxFigure, WearableArt } from "@/components/Wearables";
import { refreshWearables } from "@/lib/use-wearables";
import { ROLL_COST, WEARABLES, slotsConflict, type WearableDef } from "@/lib/wearables";
import {
  buyItem,
  equipItem,
  equipWearables,
  getStore,
  rollCapsule,
  TITLE_BADGES,
  THEME_ITEMS,
  type StoreItem,
  type StoreState,
} from "@/lib/store.functions";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Store — JobMaxxing" },
      { name: "description", content: "Spend the points you earn on boosters, streak protection, titles, themes and question packs." },
      { property: "og:title", content: "Store — JobMaxxing" },
      { property: "og:description", content: "Spend the points you earn on boosters, streak protection, titles, themes and question packs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePage,
});

const CATEGORY_LABEL: Record<StoreItem["category"], string> = {
  consumable: "Utilities",
  customization: "Themes & Badges",
  content_pack: "Question Packs",
  wearable: "Wearables",
};

const CATEGORY_ICON: Record<StoreItem["category"], typeof Zap> = {
  consumable: Zap,
  customization: Palette,
  content_pack: Package,
  wearable: Sparkles,
};

const SHOP_CATEGORIES = ["consumable", "customization", "content_pack"] as const;

function itemIcon(item: StoreItem) {
  if (item.id === "streak_freeze") return Snowflake;
  if (item.id === "streak_repair") return Wrench;
  if (item.id === "xp_booster") return Zap;
  if (item.id.startsWith("title_")) return BadgeCheck;
  if (item.id.startsWith("theme_")) return Palette;
  return Package;
}

const spring = { type: "spring" as const, stiffness: 380, damping: 28 };
type RollPhase = "ready" | "rolling" | "capsule" | "reveal";

function CapsuleMachine({
  state,
  onRolled,
}: {
  state: StoreState;
  onRolled: (balance: number) => void;
}) {
  const [phase, setPhase] = useState<RollPhase>("ready");
  const [won, setWon] = useState<WearableDef | null>(null);
  const [busy, setBusy] = useState(false);

  const remaining = WEARABLES.filter((w) => !state.ownedWearables.includes(w.id));
  const soldOut = remaining.length === 0;
  const affordable = state.balance >= ROLL_COST;

  const roll = async () => {
    if (soldOut || !affordable || busy) return;
    setBusy(true);
    setPhase("rolling");
    const res = await rollCapsule();
    setBusy(false);
    if (!res.ok) {
      setPhase("ready");
      toast.error(res.error);
      return;
    }
    const def = WEARABLES.find((w) => w.id === res.won)!;
    setWon(def);
    onRolled(res.balance);
    window.setTimeout(() => setPhase("capsule"), 1100);
  };

  const openCapsule = () => {
    if (!won) return;
    setPhase("reveal");
  };

  const finish = (equip: boolean) => {
    if (equip && won) {
      const def = won;
      const next = [
        ...state.activeWearables.filter((id) => {
          const other = WEARABLES.find((w) => w.id === id);
          return other && !slotsConflict(def, other);
        }),
        def.id,
      ];
      equipWearables({ data: { ids: next } }).then((r) => {
        if (!r.ok) toast.error(r.error);
        else refreshWearables();
      });
      toast.success(`Max is wearing the ${def.name.toLowerCase()}.`);
    }
    setPhase("ready");
    setWon(null);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 className="font-display text-lg font-semibold">Mimic chest</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Every roll wins Max a wearable you don't own yet — no duplicates. Rolls can't be undone.
        </p>
      </div>

      <div className="relative grid min-h-64 place-items-center overflow-hidden rounded-xl bg-secondary/60 py-4">
        <AnimatePresence mode="wait">
          {phase === "reveal" && won ? (
            <motion.div
              key="reveal"
              className="flex flex-col items-center gap-2 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.span
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ ...spring, delay: 0.3 }}
                className="inline-flex items-center gap-1.5 rounded-full bg-accent/40 px-3 py-1 text-xs font-semibold text-accent-foreground"
              >
                <Sparkles className="size-3.5" /> New for Max: {won.name}
              </motion.span>
              <motion.span
                initial={{ scale: 0.2, y: 70, opacity: 0, rotate: -12 }}
                animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
                transition={{ ...spring, delay: 0.15 }}
              >
                <WearableArt item={won} width={150} />
              </motion.span>
            </motion.div>
          ) : (
            <motion.div key="machine" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative">
              <motion.img
                src={MACHINE_ART}
                alt="Mimic chest"
                width={210}
                height={210}
                draggable={false}
                animate={phase === "rolling" ? { rotate: [0, -1.5, 1.5, -1, 0] } : { rotate: 0 }}
                transition={{ duration: 0.5, repeat: phase === "rolling" ? 1 : 0 }}
              />
              <AnimatePresence>
                {phase === "capsule" && (
                  <motion.button
                    key="cap"
                    aria-label="Open the capsule"
                    className="absolute left-1/2 top-[62%] -translate-x-1/2 cursor-pointer"
                    initial={{ y: -36, opacity: 0, scale: 0.6 }}
                    animate={{ y: [-36, 0, -8, 0], opacity: 1, scale: 1 }}
                    exit={{ scale: 1.4, opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    whileHover={{ scale: 1.12 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={openCapsule}
                  >
                    <img src={CAPSULE_ART} alt="" width={56} height={56} draggable={false} />
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {phase === "reveal" && won ? (
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => finish(true)}>Equip now</Button>
          <Button size="sm" variant="outline" className="flex-1" disabled={soldOut || state.balance < ROLL_COST} onClick={() => { setPhase("ready"); setWon(null); }}>
            Keep it
          </Button>
        </div>
      ) : soldOut ? (
        <Button variant="secondary" size="sm" disabled>Collection complete</Button>
      ) : phase === "rolling" ? (
        <Button variant="secondary" size="sm" disabled>Rolling…</Button>
      ) : phase === "capsule" ? (
        <Button size="sm" onClick={openCapsule}>Tap the capsule to open it</Button>
      ) : (
        <Button size="sm" disabled={!affordable || busy} onClick={roll}>
          {affordable ? `Roll for ${ROLL_COST} points` : `Need ${ROLL_COST - state.balance} more points`}
        </Button>
      )}
      <p className="text-center text-xs text-muted-foreground">
        {soldOut ? "Every wearable collected. Nice fit, Max." : `${remaining.length} of ${WEARABLES.length} wearables still in the chest`}
      </p>
    </div>
  );
}

function Wardrobe({ state, onChanged }: { state: StoreState; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const owned = WEARABLES.filter((w) => state.ownedWearables.includes(w.id));

  const toggle = async (item: WearableDef) => {
    const on = state.activeWearables.includes(item.id);
    const next = on
      ? state.activeWearables.filter((id) => id !== item.id)
      : [
          ...state.activeWearables.filter((id) => {
            const other = WEARABLES.find((w) => w.id === id);
            return other && !slotsConflict(item, other);
          }),
          item.id,
        ];
    setBusy(true);
    const res = await equipWearables({ data: { ids: next } });
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    refreshWearables();
    onChanged();
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm lg:col-span-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">Max's wardrobe</h3>
        <span className="text-xs text-muted-foreground">{owned.length} of {WEARABLES.length} found</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-[auto_1fr]">
        <div className="grid place-items-center rounded-xl bg-secondary/60 p-4">
          <motion.div key={state.activeWearables.join()} initial={{ y: -6 }} animate={{ y: 0 }} transition={spring}>
            <MaxFigure worn={state.activeWearables} width={190} />
          </motion.div>
        </div>
        {owned.length === 0 ? (
          <p className="self-center text-sm text-muted-foreground">
            Nothing here yet — roll the mimic chest to win Max's first wearable.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {owned.map((w) => {
              const on = state.activeWearables.includes(w.id);
              return (
                <motion.div
                  layout
                  key={w.id}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-colors ${
                    on ? "border-primary/50 bg-accent/30" : "border-border bg-background"
                  }`}
                >
                  <WearableArt item={w} width={64} />
                  <span className="text-xs font-medium">{w.name}</span>
                  <Button size="sm" variant={on ? "secondary" : "outline"} className="w-full" disabled={busy} onClick={() => toggle(w)}>
                    {on ? "Unequip" : "Equip"}
                  </Button>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StorePage() {
  const { setActiveTheme, setActiveTitle } = useGame();
  const [state, setState] = useState<StoreState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = () => {
    getStore().then((res) => {
      if (res.ok) {
        setState(res);
        setActiveTheme(res.activeTheme);
        setActiveTitle(res.activeTitle);
      } else setError(res.error);
    });
  };
  useEffect(refresh, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buy = async (item: StoreItem) => {
    setBusy(item.id);
    const res = await buyItem({ data: { itemId: item.id } });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(`${item.name} is yours`, { description: `-${item.cost} points` });
    refresh();
  };

  const equip = async (kind: "title" | "theme", value: string) => {
    setBusy(`${kind}:${value}`);
    const res = await equipItem({ data: { kind, value } });
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    if (kind === "theme") setActiveTheme(value || "default");
    else setActiveTitle(value || null);
    refresh();
  };

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow="Store" title="Store" sub={error} pose="dap" />
      </div>
    );
  }
  if (!state) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader eyebrow="Store" title="Store" sub="Loading the shelves…" pose="dap" />
      </div>
    );
  }

  const boosterActive = state.boosterExpiresAt && new Date(state.boosterExpiresAt) > new Date();

  const renderCard = (item: StoreItem) => {
    const owned = state.owned.includes(item.id);
    const affordable = state.balance >= item.cost;
    const Icon = itemIcon(item);
    const isTitle = item.id in TITLE_BADGES;
    const isTheme = item.id in THEME_ITEMS;
    const equipped =
      (isTitle && state.activeTitle === TITLE_BADGES[item.id]) ||
      (isTheme && state.activeTheme === THEME_ITEMS[item.id]);

    return (
      <div
        key={item.id}
        className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-secondary-foreground">
            <Icon className="size-5" />
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-accent/40 px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            <Coins className="size-3.5" /> {item.cost}
          </span>
        </div>
        <div>
          <p className="font-display font-semibold leading-tight">{item.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
        </div>
        <div className="mt-auto pt-1">
          {owned ? (
            isTitle || isTheme ? (
              equipped ? (
                <Button variant="secondary" size="sm" className="w-full" disabled={busy !== null}
                  onClick={() => equip(isTitle ? "title" : "theme", "")}>
                  <Check className="size-4" /> Equipped — unequip
                </Button>
              ) : (
                <Button variant="outline" size="sm" className="w-full" disabled={busy !== null}
                  onClick={() => equip(isTitle ? "title" : "theme", (isTitle ? TITLE_BADGES[item.id] : THEME_ITEMS[item.id]) ?? "")}>
                  Equip
                </Button>
              )
            ) : (
              <Button variant="secondary" size="sm" className="w-full" disabled>
                <Check className="size-4" /> Owned
              </Button>
            )
          ) : (
            <Button
              size="sm"
              className="w-full"
              disabled={!affordable || busy !== null}
              onClick={() => buy(item)}
            >
              {busy === item.id ? "Buying…" : affordable ? "Buy" : "Not enough points"}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        eyebrow="Spend your points"
        title="Store"
        sub="Every XP you earn is also a point. Roll the mimic chest for Max, or trade points for boosters, titles, themes and question packs."
        pose="dap"
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold">
          <Coins className="size-4 text-primary" /> {state.balance.toLocaleString()} points
        </span>
        {state.freezeCount > 0 && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
            <Snowflake className="size-4 text-primary" /> {state.freezeCount} streak freeze{state.freezeCount === 1 ? "" : "s"} ready
          </span>
        )}
        {boosterActive && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
            <Zap className="size-4 text-primary" /> 1.5x XP until {new Date(state.boosterExpiresAt!).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
          </span>
        )}
        {state.activeTitle && (
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm">
            <BadgeCheck className="size-4 text-primary" /> {state.activeTitle}
          </span>
        )}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        <CapsuleMachine state={state} onRolled={(balance) => setState((s) => (s ? { ...s, balance } : s))} />
        <Wardrobe state={state} onChanged={refresh} />
      </div>

      <Tabs defaultValue="consumable">
        <TabsList>
          {SHOP_CATEGORIES.map((cat) => {
            const Icon = CATEGORY_ICON[cat];
            return (
              <TabsTrigger key={cat} value={cat} className="gap-1.5">
                <Icon className="size-4" /> {CATEGORY_LABEL[cat]}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {SHOP_CATEGORIES.map((cat) => (
          <TabsContent key={cat} value={cat}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {state.items.filter((i) => i.category === cat).map(renderCard)}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
