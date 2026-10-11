import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Backpack, Check, Snowflake, Zap, Package, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MaxFigure, WearableArt } from "@/components/Wearables";
import {
  equipItem,
  equipWearables,
  getStore,
  TITLE_BADGES,
  THEME_ITEMS,
  type StoreState,
} from "@/lib/store.functions";
import { WEARABLES, slotsConflict } from "@/lib/wearables";
import { refreshWearables } from "@/lib/use-wearables";
import { toast } from "sonner";

export const Route = createFileRoute("/collection")({
  head: () => ({
    meta: [
      { title: "Collection — JobMaxxing" },
      { name: "description", content: "Everything you've unlocked: Max's wearables, titles, themes and boosts." },
      { property: "og:title", content: "Collection — JobMaxxing" },
      { property: "og:description", content: "Everything you've unlocked: Max's wearables, titles, themes and boosts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Collection,
});

const spring = { type: "spring", stiffness: 320, damping: 26 } as const;

function Collection() {
  const [state, setState] = useState<StoreState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStore().then((res) => {
      if (res.ok) setState(res);
      else setError(res.error);
    });
  }, []);

  if (error)
    return (
      <div className="mx-auto max-w-3xl panel p-8 text-center text-muted-foreground">{error}</div>
    );
  if (!state)
    return (
      <div className="mx-auto max-w-3xl panel p-8 text-center text-muted-foreground">
        Opening your collection…
      </div>
    );

  const ownedWearables = WEARABLES.filter((w) => state.ownedWearables.includes(w.id));
  const ownedTitles = Object.entries(TITLE_BADGES).filter(([id]) => state.owned.includes(id));
  const ownedThemes = Object.entries(THEME_ITEMS).filter(([id]) => state.owned.includes(id));
  const ownedPacks = state.items.filter(
    (i) => i.category === "content_pack" && state.owned.includes(i.id),
  );
  const empty =
    !ownedWearables.length && !ownedTitles.length && !ownedThemes.length && !ownedPacks.length &&
    !state.freezeCount && !state.boosterExpiresAt;

  const toggleWearable = (id: string) => {
    const on = state.activeWearables.includes(id);
    const next = on
      ? state.activeWearables.filter((w) => w !== id)
      : [
          ...state.activeWearables.filter((other) => {
            const a = WEARABLES.find((w) => w.id === other)!;
            const b = WEARABLES.find((w) => w.id === id)!;
            return !slotsConflict(a, b);
          }),
          id,
        ];
    setState({ ...state, activeWearables: next });
    equipWearables({ data: { ids: next } }).then((r) => {
      if (!r.ok) toast.error(r.error);
      else refreshWearables();
    });
  };

  const equip = (kind: "title" | "theme", value: string) => {
    equipItem({ data: { kind, value } }).then((r) => {
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setState((s) =>
        s
          ? {
              ...s,
              activeTitle: kind === "title" ? value || null : s.activeTitle,
              activeTheme: kind === "theme" ? value || "default" : s.activeTheme,
            }
          : s,
      );
      toast.success(kind === "title" ? "Title equipped." : "Theme applied.");
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-bold md:text-5xl">
            <Backpack className="h-9 w-9 text-primary" /> Collection
          </h1>
          <p className="text-muted-foreground">
            Everything you've unlocked. Equip Max, wear a title, or switch up the theme.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link to="/store">
            <Store className="h-4 w-4" /> Visit the Store
          </Link>
        </Button>
      </div>

      {empty && (
        <div className="panel p-10 text-center">
          <p className="text-lg font-semibold">Nothing here yet</p>
          <p className="mt-1 text-muted-foreground">
            Earn XP, then roll the capsule machine or grab something from the Store.
          </p>
          <Button asChild className="mt-4">
            <Link to="/store">Open the Store</Link>
          </Button>
        </div>
      )}

      {ownedWearables.length > 0 && (
        <section className="panel p-6">
          <h2 className="text-xl font-bold">Max's wardrobe</h2>
          <p className="text-sm text-muted-foreground">
            {ownedWearables.length} of {WEARABLES.length} wearables found. Tap to equip — one per spot.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-6">
            <motion.div
              key={state.activeWearables.join()}
              initial={{ y: -6 }}
              animate={{ y: 0 }}
              transition={spring}
              className="shrink-0"
            >
              <MaxFigure worn={state.activeWearables} width={190} />
            </motion.div>
            <div className="flex flex-wrap gap-3">
              {ownedWearables.map((w) => {
                const on = state.activeWearables.includes(w.id);
                return (
                  <button
                    key={w.id}
                    onClick={() => toggleWearable(w.id)}
                    className={`flex w-24 flex-col items-center gap-1 rounded-xl border-2 p-3 transition-colors ${
                      on
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/50"
                    }`}
                  >
                    <WearableArt item={w} width={64} />
                    <span className="text-xs font-medium">{w.name}</span>
                    {on && <Check className="h-3.5 w-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {(ownedTitles.length > 0 || ownedThemes.length > 0) && (
        <section className="panel p-6">
          <h2 className="text-xl font-bold">Titles & themes</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {ownedTitles.map(([id, label]) => {
              const on = state.activeTitle === label;
              return (
                <button
                  key={id}
                  onClick={() => equip("title", on ? "" : label)}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {label}
                  {on && <Check className="ml-1.5 inline h-3.5 w-3.5" />}
                </button>
              );
            })}
            {ownedThemes.map(([id, theme]) => {
              const on = state.activeTheme === theme;
              return (
                <button
                  key={id}
                  onClick={() => equip("theme", on ? "default" : theme)}
                  className={`rounded-full border-2 px-4 py-2 text-sm font-semibold capitalize transition-colors ${
                    on
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  {theme} theme
                  {on && <Check className="ml-1.5 inline h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {(state.freezeCount > 0 || state.boosterExpiresAt || ownedPacks.length > 0) && (
        <section className="panel p-6">
          <h2 className="text-xl font-bold">Boosts & packs</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {state.freezeCount > 0 && (
              <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                <Snowflake className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold">Streak freeze ×{state.freezeCount}</p>
                  <p className="text-xs text-muted-foreground">Used automatically if you miss a day.</p>
                </div>
              </div>
            )}
            {state.boosterExpiresAt && (
              <div className="flex items-center gap-3 rounded-xl border border-border p-4">
                <Zap className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold">1.5× XP booster active</p>
                  <p className="text-xs text-muted-foreground">
                    Until {new Date(state.boosterExpiresAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {ownedPacks.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border p-4">
                <Package className="h-6 w-6 text-primary" />
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
