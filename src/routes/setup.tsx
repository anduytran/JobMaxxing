import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, FileUp, Loader2, Sparkle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { levelTitle, useGame } from "@/lib/game";
import {
  applyResumeSuggestion,
  getLatestResumeReview,
  reviewResume as reviewResumeFn,
} from "@/lib/resume.functions";
import { CATEGORY_LABEL, GRADE_META, type ResumeReview, type ResumeSuggestion } from "@/lib/resume";
import { cn } from "@/lib/utils";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Resume Setup — DevUp" },
      {
        name: "description",
        content: "Upload your resume to get a grade, the fixes worth XP that raise it, and your profile fields filled in for you.",
      },
      { property: "og:title", content: "Resume Setup — DevUp" },
      {
        property: "og:description",
        content: "Upload your resume to get a grade, the fixes worth XP that raise it, and your profile fields filled in for you.",
      },
    ],
  }),
  component: Setup,
});

const MIN_CHARS = 80;

/** Reads text out of a PDF in the browser. pdf.js loads only when a file is picked. */
async function extractPdfText(file: File): Promise<string> {
  const pdfjs = (await import("pdfjs-dist")) as unknown as {
    GlobalWorkerOptions: { workerSrc: string };
    getDocument(src: {
      data: ArrayBuffer;
    }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: { str: string }[] }> }> }> };
  };
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const pages: string[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 12); n++) {
    const page = await doc.getPage(n);
    const content = await page.getTextContent();
    pages.push(content.items.map((i) => i.str).join(" "));
  }
  return pages.join("\n").replace(/[ \t]+/g, " ").trim();
}

function Setup() {
  const { completeQuest, quests, saveDetails, xp, level, setXp } = useGame();
  const [fileName, setFileName] = useState<string | null>(null);
  const [status, setStatus] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<ResumeReview | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);
  const [text, setText] = useState("");
  const [applying, setApplying] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const bootstrapped = useRef(false);

  // A grade already earned stays visible after a reload.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void getLatestResumeReview().then((res) => {
      if (!res.ok || !res.review) return;
      setFileName(res.review.fileName);
      setReviewId(res.review.id);
      setReview(res.review);
      setStatus([`> scan://${res.review.fileName}`, `> grade ${res.review.grade} · ${res.review.score}/100 saved`]);
    });
  }, []);

  // Grading takes half a minute, so the wait counts up instead of looking stuck.
  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  const run = async (name: string, body: string) => {
    const words = body.split(/\s+/).filter(Boolean).length;
    setBusy(true);
    setError(null);
    setStatus([`> scan://${name}`, `> extracted ${words} words`, "> grading with the Resume Agent…"]);
    // A rejected call must still clear the working state, or the screen hangs on "grading".
    let res: Awaited<ReturnType<typeof reviewResumeFn>>;
    try {
      res = await reviewResumeFn({ data: { fileName: name, text: body } });
    } catch (err) {
      console.error(err);
      setBusy(false);
      setStatus([]);
      setError("The resume review didn't finish. Try again, or paste the text instead.");
      return;
    }
    setBusy(false);
    if (!res.ok) {
      setStatus([]);
      setError(res.error);
      return;
    }
    setReview(res.review);
    setReviewId(res.id);
    setStatus([
      `> scan://${name}`,
      `> extracted ${words} words`,
      `> grade ${res.review.grade} · ${res.review.score}/100`,
      `> ${res.review.suggestions.length} fix${res.review.suggestions.length === 1 ? "" : "es"} queued`,
    ]);
    void saveDetails({ resume: { fileName: name, text: "", uploadedAt: new Date().toISOString() } });
    if (!quests.find((q) => q.id === "resume")?.done) completeQuest("resume");
    toast.success(`Resume graded ${res.review.grade} · ${res.review.score}/100`, {
      description: `${res.review.suggestions.length} fixes worth XP are ready below.`,
    });
  };

  const pick = async (f?: File) => {
    if (!f) return;
    setReview(null);
    setReviewId(null);
    setError(null);
    setFileName(f.name);
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      setBusy(false);
      setPaste(true);
      setStatus([]);
      toast("That file isn't a PDF — paste its text instead.");
      return;
    }
    setBusy(true);
    setStatus([`> reading ${f.name}`]);
    try {
      const body = await extractPdfText(f);
      if (body.length < MIN_CHARS) {
        setBusy(false);
        setPaste(true);
        setStatus([`> reading ${f.name}`, "> no selectable text found (it may be a scan)"]);
        toast("Couldn't read text from that PDF — paste your resume text below.");
        return;
      }
      await run(f.name, body);
    } catch (err) {
      console.error(err);
      setBusy(false);
      setPaste(true);
      setStatus([]);
      toast.error("That PDF couldn't be read — paste your resume text instead.");
    }
  };

  const apply = async (s: ResumeSuggestion) => {
    if (!review || !reviewId) return;
    setApplying(s.id);
    const res = await applyResumeSuggestion({ data: { reviewId, suggestionId: s.id } });
    setApplying(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setReview({ ...review, suggestions: review.suggestions.map((x) => (x.id === s.id ? { ...x, applied: true } : x)) });
    setXp(res.xp);
    toast.success(res.awarded ? `Quest update: +${res.awarded} XP saved` : "Already claimed");
  };

  const reset = () => {
    setFileName(null);
    setReview(null);
    setReviewId(null);
    setStatus([]);
    setError(null);
    setPaste(false);
    setText("");
    if (input.current) input.current.value = "";
  };

  const claimed = review?.suggestions.filter((s) => s.applied).reduce((a, s) => a + s.xp, 0) ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Resume Setup</h1>
        <p className="text-muted-foreground">
          Upload your resume to get a grade, the fixes worth XP that raise it, and your profile fields filled in for you.
        </p>
      </div>

      {!fileName && (
        <>
          <div
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setPaste(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              void pick(e.dataTransfer.files[0]);
            }}
            className="panel grid cursor-pointer place-items-center border-2 border-dashed p-16 text-center transition hover:border-primary"
          >
            <FileUp className="mb-4 h-12 w-12 text-primary" />
            <p className="font-display text-lg">Drag &amp; drop your PDF here</p>
            <p className="text-sm text-muted-foreground">or click to browse</p>
            <input
              ref={input}
              type="file"
              accept="application/pdf"
              hidden
              onChange={(e) => void pick(e.target.files?.[0])}
            />
          </div>
          <div className="text-center">
            <Button variant="outline" size="sm" onClick={() => setPaste(true)}>
              Paste resume text instead
            </Button>
          </div>
        </>
      )}

      {fileName && (
        <div className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2 font-mono text-xs text-muted-foreground">
            <span className="truncate">scan://{fileName}</span>
            {busy && (
              <span className="flex shrink-0 items-center gap-2">
                <Loader2 className="h-3 w-3 animate-spin" /> working {seconds}s
              </span>
            )}
          </div>
          <div className="min-h-20 space-y-1 p-4 font-mono text-sm text-success">
            {status.map((l, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                {l}
              </motion.div>
            ))}
            {busy && <span className="inline-block h-4 w-2 animate-pulse bg-success" />}
          </div>
        </div>
      )}

      {error && (
        <div className="panel border-destructive/50 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
          <div className="mt-3">
            <Button size="sm" variant="outline" onClick={() => setPaste(true)}>
              Paste resume text
            </Button>
          </div>
        </div>
      )}

      {paste && (
        <div className="panel p-4">
          <label className="font-mono text-xs uppercase tracking-widest text-muted-foreground">Resume text</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            placeholder="Paste your resume text here — name, contact details, skills, experience, education."
            className="mt-2 w-full rounded-md border border-input bg-background p-3 font-mono text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="text-xs text-muted-foreground">{text.trim().length} characters</span>
            <Button
              onClick={() => void run(fileName ?? "pasted-resume", text)}
              disabled={busy || text.trim().length < MIN_CHARS}
            >
              {busy && <Loader2 className="animate-spin" />} Grade this resume
            </Button>
          </div>
        </div>
      )}

      <AnimatePresence>
        {review && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
            <GradeHeader review={review} />
            <SuggestionList review={review} applying={applying} onApply={apply} />
            <DetectedFields review={review} />
            <div className="panel glow p-6 text-center">
              <Sparkle className="mx-auto mb-2 h-6 w-6 text-accent" />
              <h2 className="text-xl font-bold">Profile unlocked</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Level <span className="font-bold text-primary">{level}: {levelTitle(level)}</span> ·{" "}
                <span className="font-bold text-success">{xp.toLocaleString()} XP</span>
                {claimed > 0 && <> · <span className="text-accent">{claimed} XP from resume fixes</span></>}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button asChild>
                  <Link to="/">View Dashboard</Link>
                </Button>
                <Button variant="outline" onClick={reset}>
                  Upload another
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function GradeHeader({ review }: { review: ResumeReview }) {
  const meta = GRADE_META[review.grade];
  return (
    <div className={cn("panel flex items-center gap-5 p-5", meta.border)}>
      <div
        className={cn(
          "grid h-20 w-20 shrink-0 place-items-center rounded-lg border font-display text-5xl font-bold",
          meta.border,
          meta.bg,
          meta.text,
        )}
      >
        {review.grade}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Resume grade
              {review.source !== "agent" && <span className="ml-2 normal-case tracking-normal">· built-in checker</span>}
            </p>
            <p className={cn("font-display text-lg font-bold", meta.text)}>{meta.label}</p>
          </div>
          <p className="font-display text-3xl font-bold">
            {review.score}
            <span className="text-sm text-muted-foreground">/100</span>
          </p>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${review.score}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className={cn("h-2 rounded-full", meta.fill)}
          />
        </div>
        {review.summary && <p className="mt-3 text-sm text-muted-foreground">{review.summary}</p>}
        <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
          {review.source === "raia" ? "graded by: DevUp Resume Agent" : "graded by: DevUp offline checker"}
        </p>
      </div>
    </div>
  );
}

function SuggestionList({
  review,
  applying,
  onApply,
}: {
  review: ResumeReview;
  applying: string | null;
  onApply: (s: ResumeSuggestion) => Promise<void>;
}) {
  const earned = review.suggestions.filter((s) => s.applied).reduce((a, s) => a + s.xp, 0);
  const total = review.suggestions.reduce((a, s) => a + s.xp, 0);
  if (!review.suggestions.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Fixes worth XP</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {earned} / {total} XP claimed
        </span>
      </div>
      {review.suggestions.map((s) => (
        <div key={s.id} className={cn("panel p-4 transition", s.applied && "opacity-60")}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                  {CATEGORY_LABEL[s.category] ?? s.category}
                </span>
                <span className="rounded border border-accent/40 bg-accent/10 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                  +{s.xp} XP
                </span>
              </div>
              <h3 className={cn("mt-2 font-semibold", s.applied && "line-through")}>{s.title}</h3>
              {s.detail && <p className="mt-1 text-sm text-muted-foreground">{s.detail}</p>}
            </div>
            <Button
              size="sm"
              variant={s.applied ? "outline" : "default"}
              disabled={s.applied || applying === s.id}
              onClick={() => void onApply(s)}
              className="shrink-0"
            >
              {applying === s.id ? (
                <Loader2 className="animate-spin" />
              ) : s.applied ? (
                <>
                  <Check className="h-3.5 w-3.5" /> done
                </>
              ) : (
                "Integrate"
              )}
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetectedFields({ review }: { review: ResumeReview }) {
  const f = review.fields;
  const rows = (
    [
      ["Name", f.name],
      ["Title", f.title],
      ["Email", f.email],
      ["Phone", f.phone],
      ["Location", f.location],
      ["LinkedIn", f.linkedin],
      ["GitHub", f.github],
      ["Experience", f.yearsExperience ? `${f.yearsExperience} yrs` : null],
    ] as [string, string | null][]
  ).filter((r): r is [string, string] => !!r[1]);

  if (!rows.length && !f.skills.length && !f.experience.length && !f.education.length) return null;

  return (
    <div className="panel p-4">
      <h2 className="font-display text-lg font-bold">Fields we filled in</h2>
      <p className="text-sm text-muted-foreground">Taken from your resume — correct anything wrong in Settings.</p>
      {rows.length > 0 && (
        <dl className="mt-3 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex min-w-0 justify-between gap-3 border-b border-border/50 pb-1 text-sm">
              <dt className="shrink-0 text-muted-foreground">{k}</dt>
              <dd className="truncate font-medium">{v}</dd>
            </div>
          ))}
        </dl>
      )}
      {f.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {f.skills.map((s) => (
            <span key={s} className="rounded border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-xs text-primary">
              {s}
            </span>
          ))}
        </div>
      )}
      {f.experience.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm">
          {f.experience.map((e, i) => (
            <li key={i} className="text-muted-foreground">
              <span className="text-foreground">{e.role ?? "Role"}</span>
              {e.company ? ` · ${e.company}` : ""}
              {e.start ? ` (${e.start}${e.end ? `–${e.end}` : "–present"})` : ""}
            </li>
          ))}
        </ul>
      )}
      {f.education.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm">
          {f.education.map((e, i) => (
            <li key={i} className="text-muted-foreground">
              <span className="text-foreground">{e.degree ?? "Degree"}</span>
              {e.school ? ` · ${e.school}` : ""}
              {e.year ? ` (${e.year})` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
