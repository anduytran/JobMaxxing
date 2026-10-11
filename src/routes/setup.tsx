import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowRight, Check, FileUp, History, Loader2, RotateCcw, Save, ScanLine, Sparkle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { levelTitle, useGame } from "@/lib/game";
import {
  getResumeState,
  getResumeVersion,
  moreResumeSuggestions,
  saveResumeVersion,
  scanResume,
} from "@/lib/resume.functions";
import loadingVideo from "@/assets/max/max-loading.mp4.asset.json";
import {
  CATEGORY_LABEL, GRADE_META, SUGGESTION_BATCH, XP_RULES,
  type ResumeSection, type ResumeSuggestion, type ResumeVersion, type StoredReview,
} from "@/lib/resume";
import { cn } from "@/lib/utils";
import { extractPdfText } from "@/lib/pdf-text";

export const Route = createFileRoute("/setup")({
  validateSearch: (s: Record<string, unknown>): { welcome?: string } => (s["welcome"] ? { welcome: String(s["welcome"]) } : {}),
  head: () => ({
    meta: [
      { title: "Resume Lab — JobMaxxing" },
      { name: "description", content: "Get your resume graded, see ATS risks, accept AI bullet rewrites, and earn XP for every fix." },
      { property: "og:title", content: "Resume Lab — JobMaxxing" },
      { property: "og:description", content: "Get your resume graded, see ATS risks, accept AI bullet rewrites, and earn XP for every fix." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Setup,
});

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

const toBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const replaceLine = (sections: ResumeSection[], lineId: string, text: string) =>
  sections.map((s) => ({ ...s, lines: s.lines.map((l) => (l.id === lineId ? { ...l, text } : l)) }));

const findLine = (sections: ResumeSection[], lineId?: string | null) =>
  lineId ? sections.flatMap((s) => s.lines).find((l) => l.id === lineId) : undefined;

function Setup() {
  const { completeQuest, quests, xp, level, setXp, addQuest } = useGame();
  const { welcome } = Route.useSearch();
  const navigate = useNavigate();
  const [review, setReview] = useState<StoredReview | null>(null);
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [saved, setSaved] = useState<string>("[]");
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "scan" | "save">(null);
  const [seconds, setSeconds] = useState(0);
  const [applying, setApplying] = useState<string | null>(null);
  const [moreBusy, setMoreBusy] = useState(false);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    const res = await getResumeState();
    setLoading(false);
    if (!res.ok) return void toast.error(res.error);
    setReview(res.review);
    setSections(res.sections);
    setSaved(JSON.stringify(res.sections));
    setVersions(res.versions);
  };

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const dirty = JSON.stringify(sections) !== saved;

  const runScan = async (payload: Parameters<typeof scanResume>[0]["data"]) => {
    setBusy("scan");
    try {
      const isResumeQuest = (q: (typeof quests)[number]) =>
        q.id === "resume" || q.id.startsWith("resume") || /resume/i.test(q.category) || /resume/i.test(q.title);
      const openQuests = quests.filter((q) => !q.done && isResumeQuest(q)).map((q) => ({ id: q.id, title: q.title }));
      const res = await scanResume({ data: { ...payload, openQuests } });
      if (!res.ok) return void toast.error(res.error);
      setXp(res.xp);
      const extra = [
        res.awarded.firstScan && `+${res.awarded.firstScan} XP first scan`,
        res.awarded.levelUp && `+${res.awarded.levelUp} XP Level Up — score above ${XP_RULES.levelUpScore}!`,
        res.awarded.integrated > 0 && `${res.awarded.integrated} fix${res.awarded.integrated === 1 ? "" : "es"} confirmed · +${res.awarded.fixes} XP`,
      ].filter(Boolean).join(" · ");
      toast.success(`Resume graded ${res.review.grade} · ${res.review.score}/100`, { description: extra || `${res.review.suggestions.length} fixes ready below.` });
      // Only quests the resume grader confirmed (same grader conversation) complete.
      for (const id of res.questsDone) completeQuest(id);
      if (openQuests.length && !res.questsDone.length) toast.message("No resume quests confirmed yet", { description: "The grader didn't see those quest goals met in this version." });
      setPaste(false);
      setText("");
      await refresh();
    } catch (err) {
      console.error(err);
      toast.error("The resume scan didn't finish. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const pick = async (f?: File) => {
    if (!f) return;
    if (!ACCEPT.split(",").includes(f.type)) return void toast("Upload a PDF or an image (PNG, JPG, WEBP), or paste the text.");
    if (f.size > 8 * 1024 * 1024) return void toast.error("That file is over 8 MB.");
    const [fileBase64, pdfText] = await Promise.all([toBase64(f), f.type === "application/pdf" ? extractPdfText(f) : Promise.resolve("")]);
    await runScan({ fileName: f.name, contentType: f.type, fileBase64, text: pdfText });
    if (input.current) input.current.value = "";
  };

  const saveVersion = async () => {
    setBusy("save");
    const res = await saveResumeVersion({ data: { sections } });
    setBusy(null);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`Saved as version ${res.version}`);
    await refresh();
  };

  const apply = async (s: ResumeSuggestion) => {
    if (!review) return;
    let next = sections;
    if (s.type === "rewrite" && s.after && s.lineId) next = replaceLine(sections, s.lineId, s.after);
    if (s.type === "metric" && s.lineId) {
      const line = findLine(sections, s.lineId);
      if (line && s.before && line.text.trim() === s.before.trim()) {
        setFocusLine(s.lineId);
        return void toast("Add the number to that line first, then claim the fix.");
      }
    }
    // Fixes are confirmed only by the grader reading an uploaded or re-scanned resume.
    setSections(next);
    toast("Save or upload your updated resume and rescan — the grader confirms this fix and pays its XP.");
  };

  /** Asks for the next batch — the server refuses while any of the current fixes is still open. */
  const generateMore = async () => {
    if (!review) return;
    setMoreBusy(true);
    const res = await moreResumeSuggestions({ data: { reviewId: review.id, sections } });
    setMoreBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(`${res.added} more fixes unlocked`, { description: `Each is worth +${XP_RULES.perFix} XP once integrated.` });
    await refresh();
  };

  const restore = async (v: ResumeVersion) => {
    const res = await getResumeVersion({ data: { id: v.id } });
    if (!res.ok) return void toast.error(res.error);
    setSections(res.sections);
    toast(`Loaded version ${v.version} into the editor — save or re-scan to keep it.`);
  };

  const hasResume = sections.length > 0 || !!review;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {welcome && (
        <div className="panel flex flex-wrap items-center justify-between gap-3 border-primary/40 bg-primary/5 p-4">
          <div>
            <p className="font-semibold">Welcome to JobMaxxing! Want to start with your resume?</p>
            <p className="text-sm text-muted-foreground">Your first scan earns +{XP_RULES.firstScan} XP and fills in your profile. You can do this later.</p>
          </div>
          <Button variant="outline" onClick={() => void navigate({ to: "/", search: {} })}>Skip for now</Button>
        </div>
      )}

      <div>
        <h1 className="text-4xl font-bold md:text-5xl">Resume Lab</h1>
        <p className="text-muted-foreground">
          Upload a PDF or a photo of your resume. An AI recruiter grades it, checks it for applicant tracking systems, and hands you the {SUGGESTION_BATCH} fixes worth the most XP — integrate them and the next {SUGGESTION_BATCH} unlock.
        </p>
      </div>

      {loading ? (
        <div className="panel grid h-40 place-items-center"><Loader2 className="animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div
            onClick={() => !busy && input.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); void pick(e.dataTransfer.files[0]); }}
            className={cn("panel grid cursor-pointer place-items-center border-2 border-dashed text-center transition hover:border-primary", hasResume ? "p-6" : "p-16")}
          >
            {busy === "scan" ? (
              <div className="flex flex-col items-center gap-2 text-center" role="status" aria-live="polite">
                <video src={loadingVideo.url} autoPlay loop muted playsInline className="h-40 w-40 rounded-2xl object-contain" aria-label="Max is reading your resume" />
                <p className="text-sm font-medium">Max is reading your resume…</p>
                <p className="text-xs text-muted-foreground">{seconds}s — grading, ATS check and your best fixes</p>
              </div>
            ) : (
              <>
                <FileUp className={cn("text-primary", hasResume ? "mb-2 h-7 w-7" : "mb-4 h-12 w-12")} />
                <p className="font-display text-lg">{hasResume ? "Upload a new version" : "Drag & drop your resume here"}</p>
                <p className="text-sm text-muted-foreground">PDF, PNG, JPG or WEBP · scans work too</p>
              </>
            )}
            <input ref={input} type="file" accept={ACCEPT} hidden onChange={(e) => void pick(e.target.files?.[0])} />
          </div>
          <div className="text-center">
            <Button variant="ghost" size="sm" onClick={() => setPaste(!paste)} disabled={!!busy}>
              {paste ? "Hide text box" : "Paste resume text instead"}
            </Button>
          </div>
          {paste && (
            <div className="panel p-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={10}
                placeholder="Paste your resume text — contact details, experience, education, projects, skills."
                className="w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
              <div className="mt-3 flex justify-end">
                <Button onClick={() => void runScan({ fileName: "pasted-resume", text })} disabled={!!busy || text.trim().length < 80}>
                  Grade this resume
                </Button>
              </div>
            </div>
          )}

          <AnimatePresence>
            {review && (
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
                <GradeHeader review={review} />
                <AtsPanel review={review} />
                <SuggestionList review={review} sections={sections} applying={applying} onApply={apply} onFocus={setFocusLine}
                  open={review.suggestions.filter((s) => !s.applied).length} moreBusy={moreBusy} onMore={() => void generateMore()} />
              </motion.div>
            )}
          </AnimatePresence>

          {sections.length > 0 && (
            <Editor
              sections={sections}
              setSections={setSections}
              focusLine={focusLine}
              review={review}
              dirty={dirty}
              busy={busy}
              onSave={saveVersion}
              onRescan={() => void runScan({ fileName: versions[0]?.fileName ?? "resume", sections, note: "Re-scanned from editor" })}
            />
          )}

          {review && <DetectedFields review={review} />}

          {versions.length > 0 && <Versions versions={versions} onRestore={restore} />}

          <div className="panel flex flex-wrap items-center gap-3 p-4">
            <Sparkle className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-semibold">Daily quest: Tailor 1 bullet for a Job Radar role</p>
              <p className="text-sm text-muted-foreground">Job Radar is live — find a matched role, practice its interview, then tailor one bullet from its description.</p>
            </div>
            {quests.some((q) => q.id === "radar-tailor") ? (
              <span className="flex items-center gap-1 text-sm font-semibold text-success"><Check className="h-4 w-4" /> In your quest pool</span>
            ) : (
              <Button size="sm" onClick={() => addQuest({ id: "radar-tailor", title: "Tailor 1 bullet for a Job Radar role", xp: 100, category: "Hunt", period: "daily" })}>
                Add to quest pool
              </Button>
            )}
            <Button size="sm" variant="outline" asChild><Link to="/market">Open Job Radar</Link></Button>
          </div>

          {review && (
            <div className="panel glow p-6 text-center">
              <Sparkle className="mx-auto mb-2 h-6 w-6 text-accent" />
              <p className="text-sm text-muted-foreground">
                Level <span className="font-bold text-primary">{level}: {levelTitle(level)}</span> ·{" "}
                <span className="font-bold text-success">{xp.toLocaleString()} XP</span>
              </p>
              <Button asChild className="mt-4"><Link to="/">View Dashboard</Link></Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function GradeHeader({ review }: { review: StoredReview }) {
  const meta = GRADE_META[review.grade];
  return (
    <div className={cn("panel flex items-center gap-5 p-5", meta.border)}>
      <div className={cn("grid h-20 w-20 shrink-0 place-items-center rounded-lg border font-display text-5xl font-bold", meta.border, meta.bg, meta.text)}>
        {review.grade}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Resume grade{review.version ? ` · version ${review.version}` : ""}
            </p>
            <p className={cn("font-display text-lg font-bold", meta.text)}>{meta.label}</p>
          </div>
          <p className="font-display text-3xl font-bold">{review.score}<span className="text-sm text-muted-foreground">/100</span></p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div initial={{ width: 0 }} animate={{ width: `${review.score}%` }} transition={{ duration: 0.6, ease: "easeOut" }} className={cn("h-2 rounded-full", meta.fill)} />
        </div>
        {review.score <= XP_RULES.levelUpScore && (
          <p className="mt-2 text-xs text-muted-foreground">Raise it above {XP_RULES.levelUpScore} for a +{XP_RULES.levelUp} XP Level Up.</p>
        )}
        {review.summary && <p className="mt-3 text-sm text-muted-foreground">{review.summary}</p>}
        <div className="mt-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <span className="font-semibold text-primary">Final outcome: </span>{review.outcome || outcomeLabel(review.score)}
        </div>
      </div>
    </div>
  );
}

function AtsPanel({ review }: { review: StoredReview }) {
  const a = review.ats;
  if (!a) return null;
  const heads: [string, boolean][] = [["Experience", a.headers.experience], ["Education", a.headers.education], ["Projects", a.headers.projects]];
  return (
    <div className="panel p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">ATS compatibility</h2>
        <span className="font-display text-2xl font-bold">{a.score}<span className="text-sm text-muted-foreground">/100</span></span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className={cn("rounded-full border px-2.5 py-0.5", a.usesTablesOrColumns ? "border-destructive/50 text-destructive" : "border-success/50 text-success")}>
          {a.usesTablesOrColumns ? "Tables or columns may break parsing" : "Single-column layout"}
        </span>
        {heads.map(([h, ok]) => (
          <span key={h} className={cn("rounded-full border px-2.5 py-0.5", ok ? "border-success/50 text-success" : "border-accent/50 text-accent")}>
            {ok ? "✓" : "✗"} {h} heading
          </span>
        ))}
      </div>
      {a.issues.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
          {a.issues.map((i) => <li key={i} className="flex gap-2"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />{i}</li>)}
        </ul>
      )}
    </div>
  );
}

const TYPE_LABEL: Record<string, string> = { rewrite: "Action verb", metric: "Metric gap", ats: "ATS", general: "General" };

function SuggestionList({ review, sections, onFocus, open, moreBusy, onMore }: {
  review: StoredReview; sections: ResumeSection[]; applying: string | null;
  onApply: (s: ResumeSuggestion) => Promise<void>; onFocus: (id: string | null) => void;
  open: number; moreBusy: boolean; onMore: () => void;
}) {
  if (!review.suggestions.length) return null;
  const earned = review.suggestions.filter((s) => s.applied).reduce((a, s) => a + s.xp, 0);
  const total = review.suggestions.reduce((a, s) => a + s.xp, 0);
  const hint = open === 0
    ? `All ${SUGGESTION_BATCH} integrated — pull the next ${SUGGESTION_BATCH} highest-impact fixes.`
    : open === 1
      ? "Make this change, then upload or re-scan your resume to verify it."
      : `Make these ${open} changes, then upload or re-scan your resume — the grader checks them.`;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Resume quests</h2>
        <span className="font-mono text-xs text-muted-foreground">{earned} / {total} XP claimed</span>
      </div>
      {review.suggestions.map((s) => {
        const line = findLine(sections, s.lineId);
        return (
          <div key={s.id} className={cn("panel p-4 transition", s.applied && "opacity-60")}>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    {TYPE_LABEL[s.type ?? "general"] ?? CATEGORY_LABEL[s.category] ?? s.category}
                  </span>
                  <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">+{s.xp} XP</span>
                </div>
                <h3 className={cn("mt-2 font-semibold", s.applied && "line-through")}>{s.title}</h3>
                {s.detail && <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>}
                {s.type === "rewrite" && s.before && s.after && (
                  <div className="mt-3 space-y-1.5 text-sm">
                    <p className="rounded-md bg-destructive/5 p-2 text-muted-foreground"><span className="font-semibold text-destructive">Weak: </span>{s.before}</p>
                    <p className="rounded-md bg-success/10 p-2"><span className="font-semibold text-success">Suggested: </span>{s.after}</p>
                  </div>
                )}
                {s.type === "metric" && (
                  <div className="mt-3 space-y-1.5 text-sm">
                    {s.before && <p className="rounded-md bg-accent/10 p-2 text-muted-foreground">{line?.text ?? s.before}</p>}
                    {s.question && <p className="italic text-muted-foreground">{s.question}</p>}
                    {s.lineId && !s.applied && (
                      <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => onFocus(s.lineId ?? null)}>
                        Edit this line <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium", s.applied ? "border-success/40 text-success" : "text-muted-foreground")}
                title="Make the change, then upload or re-scan your resume — the grader confirms it">
                {s.applied ? <><Check className="h-3.5 w-3.5" /> done</> : "Upload to verify"}
              </span>
            </div>
          </div>
        );
      })}
      <div className="panel flex flex-wrap items-center gap-3 p-4">
        <Sparkle className={cn("h-5 w-5 shrink-0", open ? "text-muted-foreground" : "text-primary")} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Next {SUGGESTION_BATCH} fixes</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <Button size="sm" variant={open ? "outline" : "default"} disabled={!!open || moreBusy} onClick={onMore}>
          {moreBusy ? <Loader2 className="animate-spin" /> : <Sparkle className="h-3.5 w-3.5" />}
          {open ? `${open} open` : `Generate ${SUGGESTION_BATCH} more`}
        </Button>
      </div>
    </div>
  );
}

function Editor({ sections, setSections, focusLine, review, dirty, busy, onSave, onRescan }: {
  sections: ResumeSection[]; setSections: (s: ResumeSection[]) => void; focusLine: string | null; review: StoredReview | null;
  dirty: boolean; busy: null | "scan" | "save"; onSave: () => void; onRescan: () => void;
}) {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  useEffect(() => {
    if (!focusLine) return;
    const el = refs.current[focusLine];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus();
  }, [focusLine]);
  const flagged = new Set(review?.suggestions.filter((s) => !s.applied && s.lineId).map((s) => s.lineId));
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Resume editor</h2>
          <p className="text-sm text-muted-foreground">Edit any line. Highlighted lines have an open fix.</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={!dirty || !!busy} onClick={onSave}>
            {busy === "save" ? <Loader2 className="animate-spin" /> : <Save className="h-4 w-4" />} Save version
          </Button>
          <Button size="sm" disabled={!!busy} onClick={onRescan}>
            {busy === "scan" ? <Loader2 className="animate-spin" /> : <ScanLine className="h-4 w-4" />} Re-scan
          </Button>
        </div>
      </div>
      <div className="mt-4 space-y-5">
        {sections.map((s) => (
          <div key={s.id}>
            <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{s.heading}</p>
            <div className="mt-2 space-y-1.5">
              {s.lines.map((l) => (
                <textarea
                  key={l.id}
                  ref={(el) => { refs.current[l.id] = el; }}
                  value={l.text}
                  rows={Math.max(1, Math.ceil(l.text.length / 95))}
                  onChange={(e) => setSections(sections.map((x) => x.id !== s.id ? x : { ...x, lines: x.lines.map((y) => (y.id === l.id ? { ...y, text: e.target.value } : y)) }))}
                  className={cn(
                    "w-full resize-none rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring",
                    flagged.has(l.id) ? "border-accent/60 bg-accent/5" : "border-input",
                    focusLine === l.id && "ring-1 ring-primary",
                  )}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Versions({ versions, onRestore }: { versions: ResumeVersion[]; onRestore: (v: ResumeVersion) => void }) {
  return (
    <div className="panel p-5">
      <h2 className="flex items-center gap-2 font-display text-lg font-bold"><History className="h-4 w-4" /> Version history</h2>
      <ul className="mt-3 divide-y divide-border/60">
        {versions.map((v, i) => (
          <li key={v.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <div className="min-w-0">
              <p className="font-medium">Version {v.version}{i === 0 && <span className="ml-2 text-xs text-primary">current</span>}</p>
              <p className="truncate text-xs text-muted-foreground">
                {v.note ?? v.fileName} · {v.createdAt ? new Date(v.createdAt).toLocaleString() : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {v.score != null && <span className="font-mono text-xs">{v.grade} · {v.score}/100</span>}
              {i > 0 && (
                <Button size="sm" variant="ghost" onClick={() => onRestore(v)}><RotateCcw className="h-3.5 w-3.5" /> Restore</Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DetectedFields({ review }: { review: StoredReview }) {
  const f = review.fields;
  const rows = ([
    ["Name", f.name], ["Title", f.title], ["Email", f.email], ["Phone", f.phone], ["Location", f.location],
    ["Major", f.major ?? null], ["Degree level", f.degreeLevel ?? null],
    ["Graduation", f.graduationYear ? `${f.graduationYear}${f.graduated === false ? " (expected)" : ""}` : null],
    ["LinkedIn", f.linkedin], ["GitHub", f.github], ["Experience", f.yearsExperience ? `${f.yearsExperience} yrs` : null],
  ] as [string, string | null][]).filter((r): r is [string, string] => !!r[1]);
  const chips = [...f.skills, ...(f.frameworks ?? [])];
  if (!rows.length && !chips.length && !f.experience.length) return null;
  return (
    <div className="panel p-4">
      <h2 className="font-display text-lg font-bold">Fields we filled in</h2>
      <p className="text-sm text-muted-foreground">Taken from your resume — correct anything wrong in Settings.</p>
      {rows.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex min-w-0 justify-between gap-3 border-b border-border/50 pb-1 text-sm">
              <dt className="shrink-0 text-muted-foreground">{k}</dt><dd className="truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {[...new Set(chips)].map((s) => (
            <span key={s} className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">{s}</span>
          ))}
        </div>
      )}
      {(f.qualifications?.length ?? 0) > 0 && (
        <ul className="mt-3 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {f.qualifications!.map((q) => <li key={q}>{q}</li>)}
        </ul>
      )}
      {f.experience.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {f.experience.map((e, i) => (
            <li key={i} className="text-muted-foreground">
              <span className="text-foreground">{e.role ?? "Role"}</span>{e.company ? ` · ${e.company}` : ""}
              {e.start ? ` (${e.start}${e.end ? `–${e.end}` : "–present"})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function outcomeLabel(score: number) {
  if (score >= 90) return "Ready to send — apply with confidence.";
  if (score >= 80) return "Strong and ready to send; a couple of polish fixes will make it stand out.";
  if (score >= 65) return "A solid base — work through the top fixes and it'll be ready to send.";
  if (score > 0) return "Good start — tackle the top fixes first and rescan to see your score climb.";
  return "We couldn't read enough to grade — upload a clearer file or add more detail.";
}
