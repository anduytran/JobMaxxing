import { createFileRoute } from "@tanstack/react-router";
import { Bot, Flame, Loader2, Mic, Send, Square, Timer, Volume2, VolumeX } from "lucide-react";
import { Max } from "@/components/Max";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AcknowledgeDisclosure, InterviewDisclosure } from "@/components/InterviewDisclosure";
import { SkillText } from "@/components/skill-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useGame } from "@/lib/game";
import {
  generateInterviewQuestions, getInterviewAgents, gradeInterviewTranscript, parseJobDescription, sendInterviewTurn, speakInterviewLine, startLiveInterview,
} from "@/lib/interview.functions";
import { awardRadarPracticeXp, setRadarStatus } from "@/lib/radar.functions";
import {
  LENGTHS, type AgentStatus, type InterviewGrade, type InterviewLength, type InterviewQuestion,
  type InterviewType, type ParsedJob, type TranscriptTurn,
} from "@/lib/interview/types";
import { createBrowserVoice, createElevenLabsVoice, type VoiceAgent } from "@/lib/interview/voice";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "AI Mock Interview — JobMaxxing" },
      { name: "description", content: "Paste a real job post and run a timed AI mock interview, then get graded feedback and XP." },
      { property: "og:title", content: "AI Mock Interview — JobMaxxing" },
      { property: "og:description", content: "Job-specific AI mock interviews with graded feedback and XP rewards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    radar: typeof s["radar"] === "string" && /^[0-9]{1,20}$/.test(s["radar"]) ? s["radar"] : undefined,
  }),
  loader: () => getInterviewAgents(),
  staleTime: 5 * 60_000, // agent status rarely changes; skip the refetch on every visit
  component: Interview,
});

type Stage = "intro" | "setup" | "review" | "options" | "live" | "your_questions" | "grading" | "report";

function Interview() {
  const agents = Route.useLoaderData() as AgentStatus;
  const search = Route.useSearch();
  const { roast, setRoast, completeQuest, gainXp, details } = useGame();
  const [stage, setStage] = useState<Stage>("intro");
  const [jd, setJd] = useState("");
  const radarJobId = useRef<string | null>(null);
  const radarBootstrapped = useRef(false);
  const [type, setType] = useState<InterviewType>("mixed");
  const [length, setLength] = useState<InterviewLength>("standard");
  const [job, setJob] = useState<ParsedJob | null>(null);
  const [mine, setMine] = useState<string[]>([]);
  const toggleMine = (s: string) => setMine((m) => (m.includes(s) ? m.filter((x) => x !== s) : [...m, s]));
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [qi, setQi] = useState(0);
  const [turns, setTurns] = useState<TranscriptTurn[]>([]);
  const [grade, setGrade] = useState<InterviewGrade | null>(null);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [left, setLeft] = useState(LENGTHS.standard.seconds);
  const [ack, setAck] = useState(false);
  const voice = useRef<VoiceAgent | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const [convId, setConvId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    voice.current = agents.voice === "elevenlabs"
      ? createElevenLabsVoice(async (t) => (await speakInterviewLine({ data: { text: t } })).audio)
      : createBrowserVoice();
    return () => voice.current?.stop();
  }, [agents.voice]);
  useEffect(() => { scroller.current?.scrollTo({ top: 1e6, behavior: "smooth" }); }, [turns]);

  const say = (t: string, phase: TranscriptTurn["phase"], questionId?: string) => {
    setTurns((x) => [...x, { speaker: "interviewer", phase, text: t, questionId }]);
    if (voiceOn) void voice.current?.speak(t);
  };

  // Guardrail: physical time limit.
  useEffect(() => {
    if (stage !== "live") return;
    const t = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [stage]);
  useEffect(() => { if (stage === "live" && left <= 0) toTail("Looks like we're at time."); }, [left, stage]); // eslint-disable-line react-hooks/exhaustive-deps

  // Job Radar hand-off: one-click practice for a radar role pre-fills the job
  // description and runs the analysis immediately.
  useEffect(() => {
    if (!search.radar || radarBootstrapped.current) return;
    radarBootstrapped.current = true;
    radarJobId.current = search.radar;
    const stored = sessionStorage.getItem("jobmaxxing:radar-jd") ?? "";
    sessionStorage.removeItem("jobmaxxing:radar-jd");
    if (stored.trim().length >= 40) {
      setJd(stored);
      setStage("setup");
      void analyze(stored);
    }
  }, [search.radar]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async (jdText: string = jd) => {
    setBusy(true);
    try {
      const res = await parseJobDescription({ data: { jd: jdText } });
      setJob(res);
      setMine(res.skills.filter((s) => details.skills.some((u) => u.toLowerCase() === s.toLowerCase()))); setStage("review");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const start = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const qs = await generateInterviewQuestions({ data: { job, type, length, roast } });
      const live = await startLiveInterview({ data: { job, type, length, roast, plan: qs } }).catch(() => null);
      setConvId(live?.conversationId ?? null);
      setQuestions(qs); setQi(0); setTurns([]); setLeft(LENGTHS[length].seconds); setStage("live");
      say(live?.reply ?? qs[0]!.text, "interview", qs[0]!.id);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const toTail = (lead: string) => {
    setStage("your_questions");
    say(`${lead} Before we wrap up — do you have any questions for me?`, "candidate_questions");
  };

  const answer = async (a: string) => {
    const v = a.trim();
    if (!v || thinking) return;
    setText("");
    if (stage === "live") {
      const q = questions[qi];
      setTurns((x) => [...x, { speaker: "candidate", phase: "interview", text: v, questionId: q?.id }]);
      const next = qi + 1;
      const last = next >= questions.length;
      if (convId) {
        // The Question agent writes the next spoken line from the running conversation.
        setThinking(true);
        const reply = await sendInterviewTurn({ data: { conversationId: convId, text: v, phase: "interview", secondsLeft: left, lastQuestion: last } }).catch(() => null);
        setThinking(false);
        if (reply) {
          // Guardrail: question budget — the agent was told to wrap up and invite questions.
          if (last) { setStage("your_questions"); return say(reply, "candidate_questions"); }
          setQi(next);
          return say(reply, "interview", questions[next]?.id);
        }
      }
      if (last) return toTail("Thanks, that covers my questions.");
      setQi(next);
      say(questions[next]!.text, "interview", questions[next]!.id);
    } else if (stage === "your_questions") {
      setTurns((x) => [...x, { speaker: "candidate", phase: "candidate_questions", text: v }]);
      if (convId) {
        setThinking(true);
        const reply = await sendInterviewTurn({ data: { conversationId: convId, text: v, phase: "candidate_questions", secondsLeft: 0, lastQuestion: true } }).catch(() => null);
        setThinking(false);
        if (reply) return say(reply, "candidate_questions");
      }
      say(roast ? "Fair question. I'll note it. Anything else, or are we done?" : "Great question — the team would love to dig into that. Anything else?", "candidate_questions");
    }
  };

  const speak = async () => {
    setListening(true);
    try { answer(await voice.current!.listen()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setListening(false); }
  };

  const finish = async () => {
    voice.current?.stop();
    if (!job) return;
    setStage("grading");
    try {
      const g = await gradeInterviewTranscript({ data: { transcript: turns, job } });
      setGrade(g);
      setStage("report");
      completeQuest("mock1");
      if (g.xp > 0) gainXp(g.xp, "mock interview");
      // A tailored practice for a Job Radar role pays a one-time +50 XP bonus.
      if (radarJobId.current) {
        const radarXp = await awardRadarPracticeXp({ data: { jobId: radarJobId.current } }).catch(() => null);
        if (radarXp?.ok && radarXp.awarded) {
          toast.success("Tailored practice complete", { description: `+${radarXp.awarded} XP for practicing a Job Radar role.` });
        }
        radarJobId.current = null;
      }
    } catch (e) { toast.error((e as Error).message); setStage("your_questions"); }
  };

  const reset = () => { setConvId(null); setStage("intro"); setGrade(null); setTurns([]); setJob(null); setAck(false); radarJobId.current = null; };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Build your next chapter</p>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">AI Mock Interview</h1>
          <p className="mt-2 text-lg text-muted-foreground">Turn your potential into progress, one step at a time.</p>
          {stage !== "intro" && <Stepper stage={stage} />}
        </div>
        <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2 transition", roast ? "border-roast bg-roast/15 glow" : "border-accent/50 bg-accent/10")}>
          <Flame className={cn("h-5 w-5", roast ? "text-roast" : "text-accent")} />
          <span className="text-sm font-semibold">Roast Mode</span>
          <Switch checked={roast} onCheckedChange={setRoast} disabled={stage !== "setup" && stage !== "review" && stage !== "options"} />
        </label>
      </div>

      {stage !== "intro" && <AgentBadges agents={agents} />}

      {stage === "intro" && (
        <section className="panel">
          <div className="flex flex-col items-center px-6 py-24 text-center">
            <Max pose="interview" className="mascot-float h-28 w-28" />
            <h2 className="mt-8 text-3xl font-bold md:text-4xl">Confidence comes with practice.</h2>
            <p className="mt-4 max-w-lg text-muted-foreground">Practice personalized technical or behavioral questions and get a sample feedback report.</p>
            <Button size="lg" className="mt-8 px-7 py-6 text-base" onClick={() => setStage("setup")}>Start practicing</Button>
          </div>
        </section>
      )}

      {stage === "setup" && (
        <section className="panel space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl">1 · Paste a real job description</h2>
            <p className="text-sm text-muted-foreground">Find a posting that matches the role you want and paste the full text.</p>
          </div>
          <Textarea value={jd} onChange={(e) => setJd(e.target.value)} rows={10} placeholder="Senior Frontend Engineer — We're looking for 4+ years of React and TypeScript…" />
          <Button onClick={() => analyze()} disabled={busy || jd.trim().length < 40}>
            {busy && <Loader2 className="animate-spin" />} Analyze job
          </Button>
        </section>
      )}

      {stage === "review" && job && (
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-xl">2 · What we found{job.title ? ` — ${job.title}` : ""}</h2>
          {job.location && <p className="font-mono text-xs text-accent">📍 {job.location}</p>}
          <p className="text-sm text-muted-foreground">{job.summary}</p>
          <div>
            <div className="mb-2 font-mono text-xs text-muted-foreground">SKILLS — yours are pre-selected from your profile; tap to adjust</div>
            <div className="flex flex-wrap gap-2">
              {job.skills.length ? job.skills.map((s) => (
                <button key={s} type="button" aria-pressed={mine.includes(s)} onClick={() => toggleMine(s)}
                  className={cn("rounded border px-2 py-1 text-xs transition-colors", mine.includes(s) ? "border-primary bg-primary/20 text-primary" : "border-border text-muted-foreground hover:border-primary/50")}>
                  {mine.includes(s) ? "✓ " : ""}{s}
                </button>))
                : <span className="text-sm text-muted-foreground">No known skills detected — questions will be general.</span>}
            </div>
          </div>
          {job.qualifications.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-xs text-muted-foreground">QUALIFICATIONS</div>
              <ul className="list-disc space-y-1 pl-5 text-sm">{job.qualifications.map((q) => <li key={q}><SkillText text={q} skills={mine} /></li>)}</ul>
            </div>
          )}
          {job.specialNotes.length > 0 && (
            <div>
              <div className="mb-2 font-mono text-xs text-muted-foreground">SPECIAL NOTES</div>
              <ul className="list-disc space-y-1 pl-5 text-sm text-accent">{job.specialNotes.map((n) => <li key={n}><SkillText className="text-accent" text={n} skills={mine} /></li>)}</ul>
            </div>
          )}
          <p className="border-t pt-4 text-sm text-muted-foreground">Does this look right? Continuing confirms the details.</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStage("setup")}>Back</Button>
            <Button onClick={() => setStage("options")}>Looks correct — Continue</Button>
          </div>
        </section>
      )}

      {stage === "options" && job && (
        <section className="panel space-y-4 p-6">
          <h2 className="font-display text-xl">3 · Interview options{job.title ? ` — ${job.title}` : ""}</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <Choice label="Interview type" value={type} onChange={setType}
              options={[["mixed", "Mixed"], ["technical", "Technical"], ["behavioral", "Behavioral"]]} />
            <Choice label="Length" value={length} onChange={setLength}
              options={(Object.keys(LENGTHS) as InterviewLength[]).map((k) => [k, LENGTHS[k].label])} />
          </div>
          <InterviewDisclosure job={job} />
          <AcknowledgeDisclosure checked={ack} onChange={setAck} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setStage("review")}>Back</Button>
            <Button onClick={start} disabled={busy || !ack}>{busy && <Loader2 className="animate-spin" />} Start {LENGTHS[length].label} {type} interview</Button>
            {!ack && <span className="text-xs text-muted-foreground">Confirm the box above to start.</span>}
          </div>
        </section>
      )}

      {(stage === "live" || stage === "your_questions" || stage === "grading") && (
        <section className="panel flex h-[36rem] flex-col">
          <div className="flex items-center gap-3 border-b p-4">
            <div className="grid h-9 w-9 place-items-center rounded bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
            <div className="flex-1">
              <div className="text-sm font-semibold">{roast ? "Gordon, Senior Hiring Manager" : "Ava, Friendly Recruiter"}</div>
              <div className="font-mono text-[10px] text-muted-foreground">
                {stage === "live" ? `Question ${qi + 1} / ${questions.length}` : "Your questions for the interviewer"}
              </div>
            </div>
            <div className={cn("flex items-center gap-1 font-mono text-sm", left < 30 && stage === "live" && "text-destructive")}>
              <Timer className="h-4 w-4" /> {fmt(Math.max(0, left))}
            </div>
            <Button variant="ghost" size="icon" onClick={() => { setVoiceOn(!voiceOn); voice.current?.stop(); }} aria-label="Toggle interviewer voice">
              {voiceOn ? <Volume2 /> : <VolumeX />}
            </Button>
          </div>
          {stage === "live" && <Progress value={(qi / Math.max(1, questions.length)) * 100} className="h-1 rounded-none" />}
          <div ref={scroller} className="flex-1 space-y-3 overflow-y-auto p-4">
            {turns.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.speaker === "interviewer" ? "border bg-secondary/50" : "ml-auto bg-primary text-primary-foreground")}>{m.text}</div>
            ))}
            {thinking && <div className="max-w-[85%] animate-pulse rounded-lg border bg-secondary/50 px-3 py-2 text-sm text-muted-foreground">Interviewer is thinking…</div>}
            {stage === "grading" && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Grading your interview…</div>}
          </div>
          <div className="flex flex-wrap gap-2 border-t p-3">
            <Button variant="outline" onClick={speak} disabled={listening || thinking || stage === "grading"}><Mic /> {listening ? "Listening…" : "Speak"}</Button>
            <form className="flex min-w-[12rem] flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); answer(text); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} disabled={stage === "grading"}
                placeholder={stage === "live" ? "Type your answer…" : "Ask the interviewer a question…"} />
              <Button type="submit" size="icon" aria-label="Send" disabled={stage === "grading"}><Send /></Button>
            </form>
            {stage === "live" && <Button variant="secondary" onClick={() => toTail("Let's stop the questions here.")}>Skip to my questions</Button>}
            {stage === "your_questions" && <Button variant="destructive" onClick={finish}><Square /> End interview</Button>}
          </div>
        </section>
      )}

      {stage === "report" && grade && (
        <section className="panel space-y-5 p-6">
          <div className="text-center">
            <div className="font-display text-6xl font-bold text-primary text-glow">{grade.overall}</div>
            <div className="font-mono text-xs text-muted-foreground">OVERALL SCORE · +{grade.xp} XP EARNED</div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Metric label="Quality & accuracy" m={grade.metrics.quality} />
            <Metric label="Conciseness" m={grade.metrics.conciseness} />
            <Metric label="Your questions" m={grade.metrics.candidateQuestions} />
            {grade.metrics.tone ? <Metric label="Tone" m={grade.metrics.tone} />
              : <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">Tone scoring — coming soon</div>}
          </div>
          <div className="grid gap-4 md:grid-cols-2 text-sm">
            <ul className="space-y-1">{grade.strengths.map((s) => <li key={s}>✓ {s}</li>)}</ul>
            <ul className="space-y-1 text-muted-foreground">{grade.improvements.map((s) => <li key={s}>→ {s}</li>)}</ul>
          </div>
          <details className="text-sm">
            <summary className="cursor-pointer font-mono text-xs text-muted-foreground">TRANSCRIPT</summary>
            <div className="mt-2 space-y-1">{turns.map((t, i) => <p key={i}><b>{t.speaker === "interviewer" ? "Interviewer" : "You"}:</b> {t.text}</p>)}</div>
          </details>
          <Button onClick={reset}>New interview</Button>
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

const STEPS: [Stage[], string][] = [
  [["setup"], "Job"], [["review"], "Review"], [["options"], "Options"], [["live"], "Interview"], [["your_questions"], "Your Qs"], [["grading", "report"], "Report"],
];
function Stepper({ stage }: { stage: Stage }) {
  const idx = useMemo(() => STEPS.findIndex(([s]) => s.includes(stage)), [stage]);
  return (
    <div className="mt-1 flex gap-2 font-mono text-[10px]">
      {STEPS.map(([, l], i) => <span key={l} className={i <= idx ? "text-primary" : "text-muted-foreground"}>{i + 1}.{l}</span>)}
    </div>
  );
}

function AgentBadges({ agents }: { agents: AgentStatus }) {
  const items: [string, boolean][] = [
    ["Job parser", agents.parser === "raia"], ["Question agent", agents.questions === "raia"],
    ["Voice (ElevenLabs)", agents.voice === "elevenlabs"], ["Grader agent", agents.grader === "raia"],
  ];
  return (
    <div className="flex flex-wrap gap-2 font-mono text-[10px]">
      {items.map(([l, live]) => (
        <span key={l} className={cn("rounded border px-2 py-1", live ? "border-primary text-primary" : "text-muted-foreground")}>
          {l}: {live ? "AI agent" : "built-in"}
        </span>
      ))}
    </div>
  );
}
