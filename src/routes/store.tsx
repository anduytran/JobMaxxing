import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Coins, Snowflake, Wrench, Zap, BadgeCheck, Palette, Package, Check } from "lucide-react";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/lib/game";
import {
  buyItem,
  equipItem,
  getStore,
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
};

const CATEGORY_ICON: Record<StoreItem["category"], typeof Zap> = {
  consumable: Zap,
  customization: Palette,
  content_pack: Package,
};

function itemIcon(item: StoreItem) {
  if (item.id === "streak_freeze") return Snowflake;
  if (item.id === "streak_repair") return Wrench;
  if (item.id === "xp_booster") return Zap;
  if (item.id.startsWith("title_")) return BadgeCheck;
  if (item.id.startsWith("theme_")) return Palette;
  return Package;
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
                  onClick={() => equip(isTitle ? "title" : "theme", isTitle ? TITLE_BADGES[item.id] : THEME_ITEMS[item.id])}>
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
        sub="Every XP you earn is also a point. Trade points for boosters, streak protection, titles, themes and question packs."
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

      <Tabs defaultValue="consumable">
        <TabsList>
          {(Object.keys(CATEGORY_LABEL) as StoreItem["category"][]).map((cat) => {
            const Icon = CATEGORY_ICON[cat];
            return (
              <TabsTrigger key={cat} value={cat} className="gap-1.5">
                <Icon className="size-4" /> {CATEGORY_LABEL[cat]}
              </TabsTrigger>
            );
          })}
        </TabsList>
        {(Object.keys(CATEGORY_LABEL) as StoreItem["category"][]).map((cat) => (
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
