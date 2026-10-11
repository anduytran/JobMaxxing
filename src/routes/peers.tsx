import { createFileRoute } from "@tanstack/react-router";
import { Copy, Loader2, Send, Square, Timer, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Max } from "@/components/Max";
import { PageHeader } from "@/components/AppShell";
import { SkillText } from "@/components/skill-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { useGame } from "@/lib/game";
import { generateInterviewQuestions, gradeInterviewTranscript, parseJobDescription } from "@/lib/interview.functions";
import {
  createPeerSession, getPeerSession, joinPeerSession, peerAnswer, peerAskNext, peerEndSession, peerSaveGrade,
  type PeerSession,
} from "@/lib/peer.functions";
import { LENGTHS, type InterviewLength, type InterviewQuestion, type InterviewType, type ParsedJob } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/peers")({
  head: () => ({
    meta: [
      { title: "Peer Interviews — JobMaxxing" },
      { name: "description", content: "Swap mock interviews with a friend — same AI-generated questions, no voice agent." },
      { property: "og:title", content: "Peer Interviews — JobMaxxing" },
      { property: "og:description", content: "Match with a friend and run a real mock interview together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Stage = "intro" | "setup" | "review" | "options" | "lobby" | "live" | "report";

function Page() {
  const { gainXp } = useGame();
  const [stage, setStage] = useState<Stage>("intro");
  const [busy, setBusy] = useState(false);
  const [jd, setJd] = useState("");
  const [job, setJob] = useState<ParsedJob | null>(null);
  const [type, setType] = useState<InterviewType>("mixed");
  const [length, setLength] = useState<InterviewLength>("standard");
  const [role, setRole] = useState<"candidate" | "interviewer">("candidate");
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<PeerSession | null>(null);
  const [text, setText] = useState("");
  const [left, setLeft] = useState(LENGTHS.standard.seconds);
  const gradedRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const myRole: "candidate" | "interviewer" | null = useMemo(() => {
    if (!session) return null;
    // The current user is the host iff they created it; derive from role + who joined.
    // loadForUser scopes to participants, but we need to know which side we are:
    // the session carries hostId/guestId; compare against the cached "me" flag.
    return session.hostRole === "candidate" ? (session._meIsHost ? "candidate" : "interviewer") : (session._meIsHost ? "interviewer" : "candidate");
  }, [session]);

  // Poll the session while in a shared stage.
  useEffect(() => {
    if (!session || (stage !== "lobby" && stage !== "live" && stage !== "report")) return;
    let stop = false;
    const tick = async () => {
      try {
        const s = await getPeerSession({ data: { id: session.id } });
        if (stop) return;
        setSession((prev) => (prev ? { ...s, _meIsHost: prev._meIsHost } as PeerSession : s));
        if (s.status === "live" && stage === "lobby") setStage("live");
        if (s.status === "done") setStage("report");
      } catch { /* keep polling */ }
    };
    const t = setInterval(tick, 3000);
    void tick();
    return () => { stop = true; clearInterval(t); };
  }, [session?.id, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timer while live.
  useEffect(() => {
    if (stage !== "live") return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [stage]);

  // Auto-scroll the transcript.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [session?.transcript.length]);

  // The candidate's client grades the finished session once, then saves it.
  useEffect(() => {
    if (stage !== "report" || !session || session.grade || myRole !== "candidate") return;
    if (gradedRef.current === session.id) return;
    gradedRef.current = session.id;
    void (async () => {
      try {
        const g = await gradeInterviewTranscript({ data: { transcript: session.transcript, job: session.job } });
        await peerSaveGrade({ data: { id: session.id, grade: g } });
        setSession((prev) => (prev ? ({ ...prev, grade: g } as PeerSession) : prev));
        if (g.xp > 0) gainXp(g.xp, "peer interview");
      } catch (e) { toast.error((e as Error).message); }
    })();
  }, [stage, session, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  // Interviewer XP, once per session.
  const xpPaidRef = useRef<string | null>(null);
  useEffect(() => {
    if (stage === "report" && session?.grade && myRole === "interviewer" && xpPaidRef.current !== session.id) {
      xpPaidRef.current = session.id;
      gainXp(25, "peer interviewer");
      toast.success("+25 XP", { description: "Thanks for interviewing a friend." });
    }
  }, [stage, session?.grade, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    setBusy(true);
    try {
      const res = await parseJobDescription({ data: { jd } });
      setJob(res);
      setStage("review");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const create = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const qs = await generateInterviewQuestions({ data: { job, type, length, roast: false } });
      if (!qs.length) throw new Error("No interview questions were returned. Please try again.");
      const { id, code } = await createPeerSession({ data: { job, questions: qs, type, length, role } });
      setSession({ id, code, _meIsHost: true } as PeerSession);
      setLeft(LENGTHS[length].seconds);
      setStage("lobby");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const join = async () => {
    setBusy(true);
    try {
      const { id } = await joinPeerSession({ data: { code: joinCode } });
      const s = await getPeerSession({ data: { id } });
      setSession({ ...s, _meIsHost: false } as PeerSession);
      setLeft(LENGTHS[s.length].seconds);
      setStage(s.status === "live" ? "live" : "lobby");
      toast.success("You're in!", { description: `Practicing with ${s.hostName}.` });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const askNext = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await peerAskNext({ data: { id: session.id } });
      const s = await getPeerSession({ data: { id: session.id } });
      setSession((prev) => ({ ...s, _meIsHost: prev?._meIsHost ?? true } as PeerSession));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const answer = async () => {
    const v = text.trim();
    if (!v || !session) return;
    setText("");
    setBusy(true);
    try {
      await peerAnswer({ data: { id: session.id, text: v } });
      const s = await getPeerSession({ data: { id: session.id } });
      setSession((prev) => ({ ...s, _meIsHost: prev?._meIsHost ?? false } as PeerSession));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const end = async () => {
    if (!session) return;
    setBusy(true);
    try {
      await peerEndSession({ data: { id: session.id } });
      setStage("report");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const reset = () => {
    setStage("intro"); setSession(null); setJob(null); setJd(""); setJoinCode("");
    gradedRef.current = null; xpPaidRef.current = null;
  };

  const askedCount = session?.transcript?.filter((t) => t.speaker === "interviewer" && t.phase === "interview").length ?? 0;
  const allAsked = session?.questions ? session.current >= session.questions.length : false;
  const awaitingAnswer = session?.transcript?.length ? session.transcript[session.transcript.length - 1]?.speaker === "interviewer" : false;

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <PageHeader eyebrow="Build your next chapter" title="Peer Interviews" sub="Same AI-generated questions — but a friend interviews you, no voice agent." />

      {stage === "intro" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel flex flex-col items-center px-6 py-16 text-center">
            <Max pose="dap" className="mascot-float h-24 w-24" />
            <h2 className="mt-6 text-2xl font-bold">Host a session</h2>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">
              Paste a job description, get a question plan, and share a code with a friend. Pick whether you answer or interview.
            </p>
            <Button size="lg" className="mt-6" onClick={() => setStage("setup")}>Create a session</Button>
          </section>
          <section className="panel flex flex-col items-center px-6 py-16 text-center">
            <div className="grid h-24 w-24 place-items-center rounded-full bg-accent/15"><Users className="h-10 w-10 text-accent" /></div>
            <h2 className="mt-6 text-2xl font-bold">Join a friend</h2>
            <p className="mt-3 max-w-sm text-sm text-muted-foreground">Got a code? Enter it to jump into their session.</p>
            <form className="mt-6 flex w-full max-w-xs gap-2" onSubmit={(e) => { e.preventDefault(); void join(); }}>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABC123" maxLength={6}
                className="text-center font-mono text-lg tracking-[0.3em] uppercase" aria-label="Session code" />
              <Button type="submit" disabled={busy || joinCode.trim().length !== 6}>{busy && <Loader2 className="animate-spin" />} Join</Button>
            </form>
          </section>
        </div>
      )}

      {stage === "setup" && (
        <section className="panel space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl">1 · Paste a real job description</h2>
            <p className="text-sm text-muted-foreground">The same parser and question generator as the AI mock interview build your session.</p>
          </div>
          <Textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={10} placeholder="Senior Frontend Engineer — We're looking for 4+ years of React and TypeScript…" />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStage("intro")}>Back</Button>
            <Button onClick={analyze} disabled={busy || jd.trim().length < 40}>{busy && <Loader2 className="animate-spin" />} Analyze job</Button>
          </div>
        </section>
      )}

      {stage === "review" && job && (
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-xl">2 · What we found{job.title ? ` — ${job.title}` : ""}</h2>
          {job.location && <p className="font-mono text-xs text-accent">📍 {job.location}</p>}
          <p className="text-sm text-muted-foreground">{job.summary}</p>
          {job.skills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {job.skills.map((s) => <span key={s} className="rounded border border-border px-2 py-1 text-xs text-muted-foreground">{s}</span>)}
            </div>
          )}
          {job.qualifications.length > 0 && (
            <ul className="list-disc space-y-1 pl-5 text-sm">{job.qualifications.map((q) => <li key={q}><SkillText text={q} skills={job.skills} /></li>)}</ul>
          )}
          <div className="flex gap-2 border-t pt-4">
            <Button variant="outline" onClick={() => setStage("setup")}>Back</Button>
            <Button onClick={() => setStage("options")}>Looks correct — Continue</Button>
          </div>
        </section>
      )}

      {stage === "options" && job && (
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-xl">3 · Session options{job.title ? ` — ${job.title}` : ""}</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <Choice label="Interview type" value={type} onChange={setType}
              options={[["mixed", "Mixed"], ["technical", "Technical"], ["behavioral", "Behavioral"]]} />
            <Choice label="Length" value={length} onChange={setLength}
              options={(Object.keys(LENGTHS) as InterviewLength[]).map((k) => [k, LENGTHS[k].label])} />
            <Choice label="Your role" value={role} onChange={setRole}
              options={[["candidate", "I'll answer"], ["interviewer", "I'll interview"]]} />
          </div>
          <p className="text-sm text-muted-foreground">
            {role === "candidate"
              ? "Your friend reads the questions out loud (or in chat) and you type your answers. You earn the interview XP."
              : "You read the questions and your friend answers. They earn the interview XP; you earn +25 XP for hosting."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStage("review")}>Back</Button>
            <Button onClick={create} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create session</Button>
          </div>
        </section>
      )}

      {stage === "lobby" && session && (
        <section className="panel flex flex-col items-center px-6 py-20 text-center">
          <Max pose="wave" className="mascot-float h-24 w-24" />
          <h2 className="mt-6 text-2xl font-bold">Waiting for your friend…</h2>
          <p className="mt-2 text-sm text-muted-foreground">Share this code — the session starts as soon as they join.</p>
          <div className="mt-6 flex items-center gap-3">
            <div className="rounded-lg border-2 border-primary bg-primary/10 px-8 py-4 font-mono text-4xl font-bold tracking-[0.4em] text-primary">{session.code}</div>
            <Button variant="outline" size="icon" aria-label="Copy code" onClick={() => { void navigator.clipboard.writeText(session.code); toast.success("Code copied"); }}>
              <Copy />
            </Button>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Checking for your friend every few seconds…</p>
          <Button variant="ghost" className="mt-6" onClick={reset}>Cancel session</Button>
        </section>
      )}

      {stage === "live" && session && (
        <section className="flex min-h-[36rem] flex-col border-y bg-card">
          <div className="flex items-center gap-3 border-b p-4">
            <div className="grid h-9 w-9 place-items-center rounded bg-primary text-primary-foreground"><Users className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="text-sm font-semibold">
                {myRole === "candidate" ? `${session.hostRole === "interviewer" ? session.hostName : session.guestName} is interviewing you` : `You're interviewing ${session.hostRole === "candidate" ? session.hostName : session.guestName}`}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {allAsked ? "Wrap-up — candidate's questions" : `Question ${Math.min(askedCount + 1, session.questions.length)} / ${session.questions.length}`}
              </div>
            </div>
            <div className={cn("flex items-center gap-1 font-mono text-sm", left < 30 && "text-destructive")}>
              <Timer className="h-4 w-4" /> {fmt(left)}
            </div>
          </div>
          <Progress value={(askedCount / Math.max(1, session.questions.length)) * 100} className="h-1 rounded-none" />

          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {session.transcript.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {myRole === "interviewer" ? "Ask the first question when you're both ready." : "Waiting for the first question…"}
              </p>
            )}
            {session.transcript.map((t, i) => (
              <div key={i} className={cn("max-w-[80%] rounded-lg border px-4 py-3 text-sm", t.speaker === "interviewer" ? "bg-muted/50" : "ml-auto border-primary/40 bg-primary/10")}>
                <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">
                  {t.speaker === "interviewer" ? "Interviewer" : "Candidate"}
                </div>
                {t.text}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2 border-t p-4">
            {myRole === "interviewer" && (
              <>
                {!allAsked && (
                  <Button onClick={askNext} disabled={busy || awaitingAnswer}>
                    {busy && <Loader2 className="animate-spin" />} {awaitingAnswer ? "Waiting for answer…" : askedCount === 0 ? "Ask first question" : "Ask next question"}
                  </Button>
                )}
                <Button variant="destructive" onClick={end} disabled={busy}><Square /> End interview</Button>
              </>
            )}
            {myRole === "candidate" && (
              <form className="flex w-full max-w-2xl gap-2" onSubmit={(e) => { e.preventDefault(); void answer(); }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} disabled={busy || !awaitingAnswer}
                  placeholder={allAsked ? "Ask your interviewer a question…" : "Type your answer…"} aria-label="Your answer" />
                <Button type="submit" size="icon" aria-label="Send" disabled={busy || !text.trim() || !awaitingAnswer}><Send /></Button>
              </form>
            )}
          </div>
        </section>
      )}

      {stage === "report" && session && (
        <section className="panel space-y-5 p-6">
          {session.grade ? (
            <>
              <div className="text-center">
                <div className="font-display text-6xl font-bold text-primary text-glow">{session.grade.overall}</div>
                <div className="font-mono text-xs text-muted-foreground">
                  OVERALL SCORE · {myRole === "candidate" ? `+${session.grade.xp} XP EARNED` : "+25 XP FOR INTERVIEWING"}
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <Metric label="Quality & accuracy" m={session.grade.metrics.quality} />
                <Metric label="Conciseness" m={session.grade.metrics.conciseness} />
              </div>
              <div className="grid gap-4 text-sm md:grid-cols-2">
                <ul className="space-y-1">{session.grade.strengths.map((s) => <li key={s}>✓ {s}</li>)}</ul>
                <ul className="space-y-1 text-muted-foreground">{session.grade.improvements.map((s) => <li key={s}>→ {s}</li>)}</ul>
              </div>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin" /> Grading the interview…</p>
          )}
          <details className="text-sm">
            <summary className="cursor-pointer font-mono text-xs text-muted-foreground">TRANSCRIPT</summary>
            <div className="mt-2 space-y-1">{session.transcript.map((t, i) => <p key={i}><b>{t.speaker === "interviewer" ? "Interviewer" : "Candidate"}:</b> {t.text}</p>)}</div>
          </details>
          <Button onClick={reset}>New session</Button>
        </section>
      )}
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Choice<T extends string>({ label, value, onChange, options }: { label: string; value: T; onChange: (v: T) => void; options: [T, string][] }) {
  return (
    <div>
      <div className="mb-2 font-mono text-xs text-muted-foreground">{label.toUpperCase()}</div>
      <div className="flex flex-wrap gap-2">
        {options.map(([v, l]) => (
          <Button key={v} type="button" size="sm" variant={value === v ? "default" : "outline"} onClick={() => onChange(v)}>{l}</Button>
        ))}
      </div>
    </div>
  );
}

function Metric({ label, m }: { label: string; m: { score: number; feedback: string } }) {
  return (
    <div className="rounded border p-3">
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-mono">{m.score}</span></div>
      <Progress value={m.score} />
      <p className="mt-2 text-xs text-muted-foreground">{m.feedback}</p>
    </div>
  );
}
