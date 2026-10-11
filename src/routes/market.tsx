import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Bookmark, Check, ExternalLink, Loader2, Mic, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGame } from "@/lib/game";
import {
  getRadar, markRadarViewed, setRadarStatus, removeRadarMatch, awardRadarPracticeXp,
  type RadarJob, type RadarStatus,
} from "@/lib/radar.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Job Radar — JobMaxxing" },
      { name: "description", content: "Real roles matched to your resume, with statuses, practice interviews and XP." },
      { property: "og:title", content: "Job Radar — Job Radar — JobMaxxing" },
      { property: "og:description", content: "Roles matched to your profile, refreshed as you grow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Market,
});

const STATUS_LABEL: Record<RadarStatus, string> = {
  new: "New", saved: "Saved", applied: "Applied", interviewing: "Interviewing", dismissed: "Dismissed",
};
const STATUS_STYLE: Record<RadarStatus, string> = {
  new: "bg-muted text-muted-foreground",
  saved: "bg-primary/15 text-primary",
  applied: "bg-accent/15 text-accent",
  interviewing: "bg-success/15 text-success",
  dismissed: "bg-muted text-muted-foreground line-through",
};

const fmtSalary = (j: RadarJob) => {
  const n = (v: number) => `$${Math.round(v / 1000)}k`;
  if (j.salaryMin && j.salaryMax) return `${n(j.salaryMin)}–${n(j.salaryMax)}`;
  if (j.salaryMax) return `Up to ${n(j.salaryMax)}`;
  if (j.salaryMin) return `From ${n(j.salaryMin)}`;
  return null;
};
const fmtPosted = (iso: string) => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  const days = Math.floor((Date.now() - t) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days}d ago`;
};

function Market() {
  const nav = useNavigate();
  const { details, saveDetails, setXp } = useGame();
  const [jobs, setJobs] = useState<RadarJob[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [appliedPrompt, setAppliedPrompt] = useState<RadarJob | null>(null);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefs, setPrefs] = useState({
    roles: details.jobPrefs.roles ?? "",
    locations: details.jobPrefs.locations ?? "",
    workMode: details.jobPrefs.workMode ?? "",
    salary: details.jobPrefs.salary ?? "",
  });
  const busyId = useRef<string | null>(null);

  const load = async (refresh: boolean) => {
    setLoading(true);
    try {
      const res = await getRadar({ data: { refresh } });
      if (!res.ok) { toast.error(res.error); return; }
      if (res.error) toast.info(res.error);
      setJobs(res.jobs);
      if (!refresh && res.jobs.length === 0 && !res.error) await load(true); // first visit: fetch live listings
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(false); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyStatus = (jobId: string, status: RadarStatus) => {
    setJobs((js) => js?.map((j) => (j.id === jobId ? { ...j, status } : j)) ?? null);
    busyId.current = jobId;
    setRadarStatus({ data: { jobId, status } }).then((res) => {
      busyId.current = null;
      if (res && !res.ok) { toast.error(res.error); void load(false); return; }
      if (res?.ok && res.awarded) {
        if (typeof res.xp === "number") setXp(res.xp);
        toast.success("Role saved", { description: `+${res.awarded} XP for saving a matched role.` });
      }
    }).catch(() => { busyId.current = null; });
  };

  const removeMatch = (jobId: string) => {
    setJobs((js) => js?.filter((j) => j.id !== jobId) ?? null);
    busyId.current = jobId;
    removeRadarMatch({ data: { jobId } }).then((res) => {
      busyId.current = null;
      if (res && !res.ok) { toast.error(res.error); void load(false); return; }
      toast.success("Removed from your radar");
    }).catch(() => { busyId.current = null; });
  };

  const viewRole = (job: RadarJob) => {
    markRadarViewed({ data: { jobId: job.id } }).then((res) => {
      if (res?.ok && res.awarded) {
        if (typeof res.xp === "number") setXp(res.xp);
        toast.success("Role reviewed", { description: `+${res.awarded} XP — every 5 roles you review pays out.` });
      }
    }).catch(() => {});
    setJobs((js) => js?.map((j) => (j.id === job.id ? { ...j, viewed: true } : j)) ?? null);
    if (job.status === "new" || job.status === "saved") setAppliedPrompt(job);
  };

  const practice = (job: RadarJob) => {
    try {
      sessionStorage.setItem("jobmaxxing:radar-jd", `${job.title}\n${job.company}\n${job.location}\n\n${job.description}`);
      if (job.url) sessionStorage.setItem("jobmaxxing:radar-url", job.url);
    } catch { /* storage unavailable — the interview still opens on the paste step */ }
    applyStatus(job.id, "interviewing");
    nav({ to: "/interview", search: { radar: job.id } });
  };

  const savePrefs = async () => {
    setSavingPrefs(true);
    const ok = await saveDetails({ jobPrefs: prefs });
    setSavingPrefs(false);
    if (ok) { toast.success("Preferences saved"); void load(true); }
  };

  const open = jobs?.filter((j) => j.status !== "dismissed") ?? [];
  const dismissed = jobs?.filter((j) => j.status === "dismissed") ?? [];

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <PageHeader eyebrow="Build your next chapter" title="Job Radar" sub="Roles matched to your resume and what you want next." pose="hunt" />

      {/* Preferences */}
      <section className="panel p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">What you're looking for</h2>
            <p className="text-sm text-muted-foreground">These shape which roles the radar finds and how it ranks them.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={savePrefs} disabled={savingPrefs}>
              {savingPrefs && <Loader2 className="animate-spin" />} Save preferences
            </Button>
            <Button onClick={() => load(true)} disabled={loading}>
              {loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh matches
            </Button>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Input value={prefs.roles} onChange={(e) => setPrefs({ ...prefs, roles: e.target.value })} placeholder="Desired role — e.g. Product Designer" aria-label="Desired role" />
          <Input value={prefs.locations} onChange={(e) => setPrefs({ ...prefs, locations: e.target.value })} placeholder="Location — e.g. New York or Remote" aria-label="Preferred location" />
          <Input value={prefs.workMode} onChange={(e) => setPrefs({ ...prefs, workMode: e.target.value })} placeholder="Work mode — e.g. Remote, Hybrid, On-site" aria-label="Work mode" />
          <Input value={prefs.salary} onChange={(e) => setPrefs({ ...prefs, salary: e.target.value })} placeholder="Salary goal — e.g. $120k" aria-label="Salary goal" />
        </div>
        <p className="mt-3 font-mono text-[10px] text-muted-foreground">
          EARN AS YOU GO — +10 XP FOR EVERY 5 ROLES YOU REVIEW · +25 XP FOR SAVING A MATCHED ROLE · +50 XP FOR A TAILORED PRACTICE INTERVIEW
        </p>
      </section>

      {/* Matches */}
      <section className="panel">
        <div className="flex items-center justify-between gap-4 px-8 pt-7 md:px-12">
          <h2 className="text-xl font-bold">Your matches</h2>
          {jobs && <span className="rounded-lg bg-sidebar-accent px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">{open.length} open roles</span>}
        </div>
        <div className="px-8 pb-10 pt-4 md:px-12">
          {jobs === null && loading && (
            <div className="space-y-3 py-6">
              {[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-muted/50" />)}
            </div>
          )}
          {jobs !== null && open.length === 0 && (
            <div className="py-10 text-center">
              <p className="text-lg font-semibold">No matches yet.</p>
              <p className="mt-2 text-sm text-muted-foreground">Save your preferences above, then refresh — the radar pulls fresh roles and ranks them against your resume.</p>
              <Button className="mt-6" onClick={() => load(true)} disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh matches
              </Button>
            </div>
          )}
          <div className="divide-y">
            {open.map((j) => (
              <div key={j.id} className="flex flex-col gap-4 py-6 md:flex-row md:items-center">
                <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl border bg-background">
                  <span className={cn("font-display text-lg font-bold", j.match >= 75 ? "text-success" : j.match >= 55 ? "text-primary" : "text-muted-foreground")}>{j.match}%</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-medium">{j.title}</span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS_STYLE[j.status])}>{STATUS_LABEL[j.status]}</span>
                    {fmtPosted(j.postedAt) && <span className="font-mono text-[10px] text-muted-foreground">{fmtPosted(j.postedAt)}</span>}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {j.company} · {j.location || "Location not listed"}{fmtSalary(j) ? ` · ${fmtSalary(j)}` : ""}
                  </div>
                  {j.matchWhy.length > 0 && <div className="mt-1 font-mono text-[10px] uppercase tracking-wider text-primary">{j.matchWhy.join(" · ")}</div>}
                  {j.skills.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {j.skills.map((s) => (
                        <span key={s} className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary">{s}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <a href={j.url || "#"} target="_blank" rel="noreferrer" onClick={() => viewRole(j)}>
                      <ExternalLink className="h-4 w-4" /> View role
                    </a>
                  </Button>
                  <Button size="sm" onClick={() => practice(j)}>
                    <Mic className="h-4 w-4" /> Practice interview
                  </Button>
                  <StatusMenu status={j.status} busy={busyId.current === j.id} onPick={(s) => applyStatus(j.id, s)} />
                </div>
              </div>
            ))}
          </div>
          {dismissed.length > 0 && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer font-mono text-xs text-muted-foreground">{dismissed.length} DISMISSED</summary>
              <div className="mt-3 space-y-2">
                {dismissed.map((j) => (
                  <div key={j.id} className="flex items-center gap-3 rounded-xl border p-3 opacity-70">
                    <span className="flex-1">{j.title} · {j.company}</span>
                    <Button size="sm" variant="ghost" onClick={() => applyStatus(j.id, "new")}><Undo2 className="h-4 w-4" /> Undo</Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </section>

      {/* Applied prompt — shown after opening a listing */}
      {appliedPrompt && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4" role="dialog" aria-modal="true" aria-label="Did you apply?">
          <div className="panel w-full max-w-sm p-6 text-center">
            <h3 className="font-display text-xl">Did you apply?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {appliedPrompt.title} · {appliedPrompt.company}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <Button
                onClick={() => {
                  applyStatus(appliedPrompt.id, "applied");
                  setAppliedPrompt(null);
                  toast.success("Marked as applied", { description: "Nice — keep the momentum going." });
                }}
              >
                <Check className="h-4 w-4" /> Yes, I applied
              </Button>
              <Button variant="outline" onClick={() => setAppliedPrompt(null)}>
                Just looking
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusMenu({ status, busy, onPick }: { status: RadarStatus; busy: boolean; onPick: (s: RadarStatus) => void }) {
  const [open, setOpen] = useState(false);
  const options: RadarStatus[] = ["saved", "applied", "interviewing", "dismissed"];
  return (
    <div className="relative">
      <Button variant="ghost" size="sm" onClick={() => setOpen(!open)} disabled={busy} aria-expanded={open}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : status === "new" ? <Bookmark className="h-4 w-4" /> : <Check className="h-4 w-4" />}
        {status === "new" ? "Track" : STATUS_LABEL[status]}
      </Button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-40 rounded-xl border bg-background p-1 shadow-lg">
          {options.filter((s) => s !== status).map((s) => (
            <button key={s} className="block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => { setOpen(false); onPick(s); }}>
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
