import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Code2, Mic, FileText, Briefcase, Users, Target, Plus, Trash2, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGame } from "@/lib/game";
import type { QuestPeriod } from "@/lib/devup.functions";

export const Route = createFileRoute("/quests/add")({
  head: () => ({
    meta: [
      { title: "Add Quests — JobMaxxing" },
      { name: "description", content: "Choose which kinds of quests go into your JobMaxxing quest pool, or write your own." },
      { property: "og:title", content: "Add Quests — JobMaxxing" },
      { property: "og:description", content: "Build your quest pool: LeetCode, interviews, role-specific goals and custom quests." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AddQuests,
});

type Template = { id: string; title: string; xp: number; category: string; period: QuestPeriod };
type Pack = { key: string; name: string; blurb: string; icon: typeof Code2; quests: Template[] };

const CUSTOM_XP = 50;

const BASE_PACKS: Pack[] = [
  {
    key: "leetcode", name: "LeetCode Problems", blurb: "Keep your problem-solving sharp.", icon: Code2,
    quests: [
      { id: "lc-easy", title: "Solve 2 LeetCode Easy problems", xp: 150, category: "Skills", period: "daily" },
      { id: "lc-medium", title: "Solve 1 LeetCode Medium problem", xp: 250, category: "Skills", period: "daily" },
      { id: "lc-hard", title: "Attempt 1 LeetCode Hard problem", xp: 400, category: "Skills", period: "weekly" },
      { id: "lc-review", title: "Re-solve a problem you missed last week", xp: 200, category: "Skills", period: "weekly" },
    ],
  },
  {
    key: "interview", name: "Interview Practice", blurb: "Reps that make the real thing feel easy.", icon: Mic,
    quests: [
      { id: "iv-behavioral", title: "Run a behavioral mock interview", xp: 250, category: "Interview", period: "weekly" },
      { id: "iv-star", title: "Write 1 STAR story from your experience", xp: 150, category: "Interview", period: "daily" },
      { id: "iv-questions", title: "Prepare 3 questions to ask an interviewer", xp: 100, category: "Interview", period: "once" },
    ],
  },
  {
    key: "resume", name: "Resume & Branding", blurb: "Look as good on paper as you are.", icon: FileText,
    quests: [
      { id: "rb-bullet", title: "Rewrite one resume bullet with a metric", xp: 150, category: "Setup", period: "weekly" },
      { id: "rb-linkedin", title: "Update your LinkedIn About section", xp: 150, category: "Branding", period: "once" },
      { id: "rb-portfolio", title: "Add a project to your portfolio", xp: 300, category: "Branding", period: "once" },
    ],
  },
  {
    key: "hunt", name: "Job Hunt", blurb: "Steady applications, steady momentum.", icon: Briefcase,
    quests: [
      { id: "jh-apply3", title: "Apply to 3 roles", xp: 250, category: "Hunt", period: "weekly" },
      { id: "jh-research", title: "Research one target company", xp: 100, category: "Hunt", period: "daily" },
      { id: "jh-followup", title: "Follow up on an application", xp: 100, category: "Hunt", period: "weekly" },
    ],
  },
  {
    key: "network", name: "Networking", blurb: "Your next job is probably a person.", icon: Users,
    quests: [
      { id: "nw-message", title: "Message someone in your target field", xp: 150, category: "Social", period: "weekly" },
      { id: "nw-coffee", title: "Book a coffee chat", xp: 250, category: "Social", period: "once" },
    ],
  },
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 20);

function rolePack(roles: string | undefined): Pack | null {
  const role = roles?.split(/[,;\n]/)[0]?.trim();
  if (!role) return null;
  const r = slug(role) || "role";
  return {
    key: "role", name: `For ${role}`, blurb: "Quests tuned to the role you're aiming for.", icon: Target,
    quests: [
      { id: `role-${r}-skill`, title: `Study one core skill for ${role}`, xp: 200, category: "Skills", period: "daily" },
      { id: `role-${r}-posting`, title: `Read 3 ${role} job postings and note common asks`, xp: 150, category: "Hunt", period: "weekly" },
      { id: `role-${r}-project`, title: `Build a small project a ${role} would ship`, xp: 400, category: "Skills", period: "once" },
      { id: `role-${r}-mock`, title: `Do a mock interview for a ${role} role`, xp: 250, category: "Interview", period: "weekly" },
    ],
  };
}

const PERIOD_LABEL: Record<QuestPeriod, string> = { once: "One-time", daily: "Daily", weekly: "Weekly" };

function AddQuests() {
  const { quests, addQuest, removeQuest, details } = useGame();
  const owned = useMemo(() => new Set(quests.map((q) => q.id)), [quests]);
  const packs = useMemo(() => {
    const rp = rolePack(details.jobPrefs.roles);
    return rp ? [rp, ...BASE_PACKS] : BASE_PACKS;
  }, [details.jobPrefs.roles]);

  const [title, setTitle] = useState("");
  const [period, setPeriod] = useState<QuestPeriod>("daily");
  const customs = quests.filter((q) => q.id.startsWith("custom-"));

  const togglePack = (p: Pack) => {
    const all = p.quests.every((q) => owned.has(q.id));
    p.quests.forEach((q) => (all ? owned.has(q.id) && removeQuest(q.id) : !owned.has(q.id) && addQuest(q)));
  };

  const addCustom = () => {
    const t = title.trim();
    if (!t) return;
    addQuest({ id: `custom-${Date.now().toString(36)}`, title: t.slice(0, 120), xp: CUSTOM_XP, category: "Custom", period });
    setTitle("");
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div>
        <Link to="/" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </Link>
        <h1 className="text-4xl font-bold md:text-5xl">Your quest organizer</h1>
        <p className="text-muted-foreground">Pin the slips you want in your pool. Tap again to unpin.</p>
        {!details.jobPrefs.roles && (
          <p className="mt-2 text-sm text-muted-foreground">
            Tip: add a desired role in <Link to="/settings" className="text-primary underline">Settings</Link> to unlock role-specific quests.
          </p>
        )}
      </div>

      <div className="grid gap-x-5 gap-y-10 pt-4 md:grid-cols-2 xl:grid-cols-4">
        {drawers(packs).map((d) => {
          const count = d.quests.filter((q) => owned.has(q.id)).length;
          const all = count === d.quests.length;
          return (
            <section key={d.key} className="relative flex flex-col">
              {/* folder tab */}
              <div className="absolute -top-7 left-5 flex h-8 items-center gap-2 rounded-t-lg border border-b-0 bg-secondary px-4 text-xs font-semibold uppercase tracking-wide text-secondary-foreground">
                <d.icon className="h-3.5 w-3.5" /> {d.name}
              </div>
              <div className="flex flex-1 flex-col rounded-2xl rounded-tl-none border bg-secondary/60 p-4 pt-5">
                <div className="mb-3 flex items-center justify-between gap-3 px-1">
                  <p className="text-xs text-muted-foreground">{d.blurb} · {count}/{d.quests.length} pinned</p>
                  <button onClick={() => togglePack({ ...d, quests: d.quests })} className="text-xs font-semibold text-primary hover:underline">
                    {all ? "Unpin all" : "Pin all"}
                  </button>
                </div>
                <ul className="space-y-2">
                  {d.quests.map((q, i) => {
                    const on = owned.has(q.id);
                    return (
                      <li key={q.id} style={{ transform: `rotate(${((i % 3) - 1) * 0.4}deg)` }}>
                        <button onClick={() => (on ? removeQuest(q.id) : addQuest(q))} aria-pressed={on}
                          className={`flex w-full items-center gap-3 border-l-4 bg-card px-3 py-2.5 text-left shadow-sm transition hover:-translate-y-0.5 ${on ? "border-l-primary" : "border-l-border opacity-80 hover:opacity-100"}`}>
                          <span className="flex-1 text-sm">{q.title}</span>
                          <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
                            {PERIOD_LABEL[q.period]}<br /><b className="text-foreground">+{q.xp}</b>
                          </span>
                          {on ? <Check className="h-4 w-4 shrink-0 text-primary" /> : <Plus className="h-4 w-4 shrink-0 text-muted-foreground" />}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </section>
          );
        })}
      </div>

      <section className="panel p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-secondary-foreground"><PenLine className="h-5 w-5" /></div>
          <div>
            <h2 className="text-lg font-semibold">Custom quests</h2>
            <p className="text-sm text-muted-foreground">Write your own. Custom quests earn a smaller +{CUSTOM_XP} XP.</p>
          </div>
        </div>
        <form className="flex max-w-3xl flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); addCustom(); }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Read one system design chapter" maxLength={120} className="flex-1" aria-label="Custom quest title" />
          <select value={period} onChange={(e) => setPeriod(e.target.value as QuestPeriod)} className="h-10 rounded-md border border-input bg-background px-3 text-sm" aria-label="How often it resets">
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="once">One-time</option>
          </select>
          <Button type="submit" disabled={!title.trim()}><Plus className="h-4 w-4" /> Add quest</Button>
        </form>
        {customs.length > 0 && (
          <ul className="mt-4 max-w-3xl space-y-2">
            {customs.map((q) => (
              <li key={q.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                <span className="flex-1 text-sm">{q.title} <span className="text-xs text-muted-foreground">· {PERIOD_LABEL[q.period]} · +{q.xp} XP</span></span>
                <Button size="icon" variant="ghost" aria-label={`Remove ${q.title}`} onClick={() => removeQuest(q.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Re-files the quest packs into the organizer's four drawers. */
function drawers(packs: Pack[]): Pack[] {
  const all = packs.flatMap((p) => p.quests);
  const seen = new Set<string>();
  const take = (f: (q: Template) => boolean) => all.filter((q) => !seen.has(q.id) && f(q)).map((q) => (seen.add(q.id), q));
  const today = take((q) => q.period === "daily");
  const resume = take((q) => q.category === "Setup" || q.category === "Branding");
  const radar = take((q) => q.category === "Hunt" || q.category === "Social");
  const interviews = take(() => true);
  return [
    { key: "today", name: "Today", blurb: "Small daily wins", icon: Target, quests: today },
    { key: "resume", name: "Resume", blurb: "Look good on paper", icon: FileText, quests: resume },
    { key: "interviews", name: "Interviews", blurb: "Reps and problem-solving", icon: Mic, quests: interviews },
    { key: "radar", name: "Job Radar", blurb: "Applications and people", icon: Briefcase, quests: radar },
  ].filter((d) => d.quests.length);
}
