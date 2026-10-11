import { Link } from "@tanstack/react-router";
import { Captions, Keyboard, Loader2, Mic, RotateCcw, Send, Square, Volume2, VolumeX } from "lucide-react";
import { InterviewVoicePresence, type InterviewVoiceState } from "@/components/InterviewVoicePresence";
import { InterviewMicrophoneCheck } from "@/components/InterviewMicrophoneCheck";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { toast } from "sonner";
import { AcknowledgeDisclosure, InterviewDisclosure } from "@/components/InterviewDisclosure";
import { SkillText } from "@/components/skill-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  LENGTHS, type AgentStatus, type InterviewGrade, type InterviewLength, type InterviewQuestion,
  type InterviewType, type ParsedJob, type TranscriptTurn,
} from "@/lib/interview/types";
import { createBrowserVoice, createElevenLabsVoice, withScribeListening, type VoiceAgent, type VoicePlaybackState } from "@/lib/interview/voice";
import { cn } from "@/lib/utils";
import { InterviewRecorder, RecordingPlayer } from "@/components/InterviewRecorder";
import { linkRecording, useRecordings } from "@/lib/interview-recordings";

type Stage = "setup" | "review" | "options" | "live" | "your_questions" | "grading" | "report";

/** Server calls the flow needs. The signed-in page and the public demo supply
 *  their own implementations; the screens and voice handling are shared. */
export type InterviewApi = {
  parseJob: (jd: string) => Promise<ParsedJob>;
  fetchJob?: (url: string) => Promise<{ text: string }>;
  parseJobUrl?: (url: string, hint: string) => Promise<ParsedJob>;
  questions: (job: ParsedJob, type: InterviewType, length: InterviewLength) => Promise<InterviewQuestion[]>;
  saveSession?: (job: ParsedJob, type: InterviewType) => Promise<{ id: string | null } | null>;
  startLive: (job: ParsedJob, type: InterviewType, length: InterviewLength, plan: InterviewQuestion[]) => Promise<{ conversationId: string; reply: string } | null>;
  turn: (conversationId: string, text: string, phase: TranscriptTurn["phase"], secondsLeft: number, lastQuestion: boolean) => Promise<{ reply: string; done: boolean } | null>;
  speak: (text: string) => Promise<string | null>;
  scribeToken: () => Promise<string | null>;
  grade: (transcript: TranscriptTurn[], job: ParsedJob, plan: InterviewQuestion[], type: InterviewType, savedId: string | null) =>
    Promise<InterviewGrade & { ratings?: { skill: string; before: number; after: number }[]; sessionId?: string | null }>;
};

export function InterviewFlow({ agents, api, radar, profileSkills = [], captionsPref = true, onGraded, demo, setupExtra, reportExtra }: {
  agents: AgentStatus;
  api: InterviewApi;
  radar?: string | undefined;
  profileSkills?: string[];
  captionsPref?: boolean;
  /** Runs after grading (quests, XP, Job Radar bonus). */
  onGraded?: (g: InterviewGrade & { sessionId?: string | null }, savedId: string | null, radarJobId: string | null) => void | Promise<void>;
  /** Demo mode: no XP, skill changes or Home link. */
  demo?: boolean;
  setupExtra?: (fillJd: (text: string) => void) => ReactNode;
  reportExtra?: (g: InterviewGrade) => ReactNode;
}) {
  const search = { radar };
  const details = { skills: profileSkills };
  const [stage, setStage] = useState<Stage>("setup");
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
  const [ratings, setRatings] = useState<{ skill: string; before: number; after: number }[]>([]);
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [left, setLeft] = useState(LENGTHS.standard.seconds);
  const [ack, setAck] = useState(false);
  const voice = useRef<VoiceAgent | null>(null);
  const [spokenWord, setSpokenWord] = useState(-1);
  const immersive = stage === "live" || stage === "your_questions" || stage === "grading";
  const [playback, setPlayback] = useState<VoicePlaybackState>("ready");
  const [typing, setTyping] = useState(false);
  const [liveCaption, setLiveCaption] = useState("");
  const [captionsOn, setCaptionsOn] = useState(captionsPref);
  const captureGeneration = useRef(0);
  const jobTerms = useRef<string[]>([]);
  jobTerms.current = job ? [...(job.skills ?? []), job.title].filter((x): x is string => typeof x === "string") : [];

  const [convId, setConvId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [recId, setRecId] = useState<string | null>(null);
  const recordings = useRecordings();
  const myRecording = recordings.find((r) => r.id === recId);
  const savedRef = useRef<string | null>(null);
  savedRef.current = savedId;
  useEffect(() => {
    const base = agents.voice === "elevenlabs"
      ? createElevenLabsVoice((t) => api.speak(t), setPlayback, setSpokenWord)
      : createBrowserVoice(setPlayback, setSpokenWord);
    voice.current = withScribeListening(base, () => api.scribeToken(), () => jobTerms.current);
    return () => { captureGeneration.current++; voice.current?.stop(); };
  }, [agents.voice]);
  const stopVoice = () => {
    captureGeneration.current++;
    voice.current?.stop();
    setListening(false);
    setPlayback("ready");
    setLiveCaption("");
  };
  const voiceState: InterviewVoiceState = stage === "grading" ? "grading" : listening ? "listening" : thinking ? "thinking" : playback;
  const currentCaption = [...turns].reverse().find((turn) => turn.speaker === "interviewer")?.text;

  // Set when the Question agent concludes the interview: the closing line
  // plays out, then the interview ends itself — no End press needed.
  const autoFinish = useRef(false);
  const captionBox = useRef<HTMLParagraphElement>(null);
  useFollowWord(captionBox, spokenWord, currentCaption ?? "");

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
  // description for review; parsing starts only after Analyze job.
  useEffect(() => {
    if (!search.radar || radarBootstrapped.current) return;
    radarBootstrapped.current = true;
    radarJobId.current = search.radar;
    setStage("setup");
    let stored = "";
    let url = "";
    try {
      stored = sessionStorage.getItem("jobmaxxing:radar-jd") ?? "";
      url = sessionStorage.getItem("jobmaxxing:radar-url") ?? "";
      sessionStorage.removeItem("jobmaxxing:radar-jd");
      sessionStorage.removeItem("jobmaxxing:radar-url");
    } catch { /* The user can paste the full description if storage is unavailable. */ }
    setJd(stored);
    // Prefer the live posting: fetch the role's URL and hand its text to the
    // Job Parser. When the page can't be read directly, the Job Parser itself
    // web-searches the URL (its URL mode). Last resort: the radar summary
    // stays in the box for Analyze job.
    if (url) {
      setBusy(true);
      (api.fetchJob ? api.fetchJob(url) : Promise.reject(new Error("unavailable")))
        .then(({ text }) => { setJd(text); return analyze(text); })
        .catch(async () => {
          const job = api.parseJobUrl ? await api.parseJobUrl(url, stored).catch(() => null) : null;
          if (job) {
            setJob(job);
            setMine(job.skills.filter((s) => details.skills.some((u) => u.toLowerCase() === s.toLowerCase())));
            setStage("review");
          }
        })
        .finally(() => setBusy(false));
    }
  }, [search.radar]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async (jdText: string = jd) => {
    setBusy(true);
    try {
      const res = await api.parseJob(jdText);
      setJob(res);
      setMine(res.skills.filter((s) => details.skills.some((u) => u.toLowerCase() === s.toLowerCase()))); setStage("review");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const start = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const qs = await api.questions(job, type, length);
      const saved = api.saveSession ? await api.saveSession(job, type).catch(() => null) : null;
      setSavedId(saved?.id ?? null);
      const live = await api.startLive(job, type, length, qs).catch(() => null);
      const first = qs[0];
      if (!first) throw new Error("No interview questions were returned. Please try again.");
      setConvId(live?.conversationId ?? null);
      setQuestions(qs); setQi(0); setTurns([]); setLeft(LENGTHS[length].seconds); setStage("live");
      say(live?.reply ?? first.text, "interview", first.id);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const toTail = (lead: string) => {
    stopVoice();
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
        const turn = await api.turn(convId, v, "interview", left, last).catch(() => null);
        setThinking(false);
        if (turn) {
          // Guardrail: question budget — the agent was told to wrap up and invite questions.
          if (last) { setStage("your_questions"); return say(turn.reply, "candidate_questions"); }
          // The agent concluded the candidate is done: closing line, then auto-end.
          if (turn.done) { autoFinish.current = true; return say(turn.reply, "interview"); }
          setQi(next);
          return say(turn.reply, "interview", questions[next]?.id);
        }
      }
      if (last) return toTail("Thanks, that covers my questions.");
      setQi(next);
      const nextQuestion = questions[next];
      if (nextQuestion) say(nextQuestion.text, "interview", nextQuestion.id);
    } else if (stage === "your_questions") {
      setTurns((x) => [...x, { speaker: "candidate", phase: "candidate_questions", text: v }]);
      if (convId) {
        setThinking(true);
        const turn = await api.turn(convId, v, "candidate_questions", 0, true).catch(() => null);
        setThinking(false);
        if (turn) {
          if (turn.done) { autoFinish.current = true; return say(turn.reply, "candidate_questions"); }
          return say(turn.reply, "candidate_questions");
        }
      }
      say("Great question — the team would love to dig into that. Anything else?", "candidate_questions");
    }
  };

  const speak = async () => {
    const currentVoice = voice.current;
    if (!currentVoice) return;
    const generation = ++captureGeneration.current;
    currentVoice.stop();
    setLiveCaption(""); setTyping(false);
    setListening(true);
    try {
      const captured = await currentVoice.listen((caption) => { if (generation === captureGeneration.current) setLiveCaption(caption); });
      if (generation === captureGeneration.current) {
        setListening(false);
        setLiveCaption("");
        void answer(capitalizeTranscript(captured));
      }
    } catch (e) { if (generation === captureGeneration.current) toast.error((e as Error).message); }
    finally { if (generation === captureGeneration.current) setListening(false); }
  };

  // Click to answer, click again to send — mirrors the toggle button (Space or click).
  useEffect(() => {
    if (stage !== "live" && stage !== "your_questions") return;
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;
      e.preventDefault();
      if (listening) voice.current?.finishListening();
      else if (!thinking && playback === "ready") void speak();
    };
    window.addEventListener("keydown", down);
    return () => { window.removeEventListener("keydown", down); };
  }); // no deps: always reads the latest state via closure refresh each render

  const finish = async () => {
    stopVoice();
    if (!job) return;
    setStage("grading");
    try {
      const g = await api.grade(turns, job, questions, type, savedId);
      if (g.sessionId) savedRef.current = g.sessionId;
      if (recId && savedRef.current) linkRecording(recId, savedRef.current);
      setGrade(g);
      setRatings(g.ratings ?? []);
      setStage("report");
      const radarId = radarJobId.current;
      radarJobId.current = null;
      await onGraded?.(g, savedId, radarId);
    } catch (e) { toast.error((e as Error).message); setStage("your_questions"); }
  };

  // Auto-end: once the agent's closing line has finished playing (or right
  // away when voice is off), run the same finish flow as the End button.
  useEffect(() => {
    if (!autoFinish.current || thinking) return;
    if (stage !== "live" && stage !== "your_questions") return;
    if (voiceOn && playback !== "ready") return;
    autoFinish.current = false;
    const t = setTimeout(() => void finish(), 700);
    return () => clearTimeout(t);
  }, [thinking, playback, stage, turns, voiceOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { stopVoice(); setTyping(false); setConvId(null); setStage("setup"); setGrade(null); setTurns([]); setJob(null); setAck(false); setRecId(null); radarJobId.current = null; autoFinish.current = false; };

  return (
    <div className={cn(immersive ? "w-full" : "mx-auto max-w-[1500px] space-y-4 px-4 py-6 md:px-10 md:py-10")}>
      <InterviewRecorder active={stage === "live" || stage === "your_questions"} kind={demo ? "demo" : "solo"} title={job?.title ?? "Mock interview"}
        onSaved={(id) => { setRecId(id); if (savedRef.current) linkRecording(id, savedRef.current); }} />
      {!immersive && <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Build your next chapter</p>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">Set Up Your Interview</h1>
          <p className="mt-2 text-lg text-muted-foreground">Paste description, answer questions, and improve your confidence</p>
        </div>
      </div>}




      {stage === "setup" && (
        <section className="panel space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl">1 · Paste a real job description</h2>
            <p className="text-sm text-muted-foreground">Find a posting that matches the role you want and paste the full text.</p>
          </div>
          {setupExtra?.(setJd)}
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
            <div className="mb-2 font-mono text-xs text-muted-foreground">{demo ? "SKILLS — tap the ones you have" : "SKILLS — yours are pre-selected from your profile; tap to adjust"}</div>
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
              options={[["mixed", "Mixed"], ["technical", "Technical"], ["behavioral", "Behavioral"], ["resume", "Resume"]]} />
            <Choice label="Length" value={length} onChange={setLength}
              options={(Object.keys(LENGTHS) as InterviewLength[]).map((k) => [k, LENGTHS[k].label])} />
          </div>
          <InterviewDisclosure job={job} />
          <InterviewMicrophoneCheck />
          <AcknowledgeDisclosure checked={ack} onChange={setAck} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setStage("review")}>Back</Button>
            <Button onClick={start} disabled={busy || !ack}>{busy && <Loader2 className="animate-spin" />} Start {LENGTHS[length].label} {type} interview</Button>
            {!ack && <span className="text-xs text-muted-foreground">Confirm the box above to start.</span>}
          </div>
        </section>
      )}

      {(stage === "live" || stage === "your_questions" || stage === "grading") && (
        <section aria-label="Live interview" className="flex min-h-[calc(100svh-4rem)] w-full flex-col bg-background">
          {/* Compact header: role, progress, time */}
          <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b px-5 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{job?.title || "Mock interview"}</div>
              <div className="text-xs text-muted-foreground">{LENGTHS[length].label} {type} · with Ava</div>
            </div>
            <div className="order-last w-full sm:order-none sm:w-auto" aria-label="Interview progress">
              <div className="mb-1 text-center text-xs font-medium text-muted-foreground">
                {stage === "live" ? `Question ${Math.min(qi + 1, questions.length)} of ${questions.length}` : stage === "grading" ? "Wrapping up" : "Your questions"}
              </div>
              <ol className="flex gap-1">
                {questions.map((_, i) => {
                  const done = stage !== "live" || i < qi;
                  return <li key={i} aria-current={stage === "live" && i === qi ? "step" : undefined}
                    className={cn("h-1.5 w-full rounded-full sm:w-10", done ? "bg-primary" : stage === "live" && i === qi ? "bg-primary/45" : "bg-muted")} />;
                })}
              </ol>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("font-mono text-sm tabular-nums", left < 30 && stage === "live" && "text-destructive")}>{fmt(Math.max(0, left))}</span>
              <Button variant="ghost" size="sm" disabled={stage === "grading" || thinking} onClick={finish}>End</Button>
            </div>
          </header>

          {/* Question */}
          <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-6 py-8">
            <div className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {stage === "grading" ? "Interview complete" : stage === "your_questions" ? "Your turn to ask" : questions[qi]?.kind === "technical" ? "Technical question" : "Behavioral question"}
            </div>
            {currentCaption && stage !== "grading" ? (
              <p ref={captionBox} className="max-h-[40svh] overflow-hidden scroll-smooth break-words text-2xl font-medium leading-relaxed text-foreground md:text-4xl md:leading-snug" aria-label="Current question">
                <SpokenQuestion text={currentCaption} activeWord={spokenWord} />
              </p>
            ) : (
              <p className="text-2xl font-medium text-muted-foreground">{stage === "grading" ? "Reviewing your answers…" : "Getting the next question ready…"}</p>
            )}
          </div>

          {/* Answer area */}
          <div className="mx-auto mb-6 flex w-full max-w-4xl flex-col items-center gap-6 border-t px-6 pt-6 sm:flex-row">
            <div className="shrink-0 scale-75 sm:scale-90"><InterviewVoicePresence state={voiceState} /></div>
            <div className="flex-1 text-center sm:text-left">
              <div className="text-sm font-semibold">
                {voiceState === "speaking" || voiceState === "preparing" ? "Ava is asking…" : listening ? "Listening — take your time" : thinking ? "Thinking it over" : "Your turn to answer"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Click the mic or press Space to start, and again when you're done.</p>
            </div>
            <button
              type="button"
              aria-label={listening ? "Click to end your answer" : "Click to answer"}
              disabled={thinking || stage === "grading" || playback !== "ready"}
              onClick={() => { if (listening) voice.current?.finishListening(); else void speak(); }}
              className={cn("hidden h-14 w-14 shrink-0 place-items-center rounded-full border-2 transition md:grid",
                listening ? "border-primary bg-primary text-primary-foreground" : "border-foreground/60 hover:border-primary hover:text-primary",
                (thinking || stage === "grading" || playback !== "ready") && "opacity-40")}
            >
              {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
          </div>

          {/* Caption bubble */}
          {captionsOn && listening && liveCaption && stage !== "grading" && (
            <div className="mx-auto mb-6 w-full max-w-xl px-6">
              <p className="rounded-lg border bg-background px-5 py-3 text-center text-sm shadow-sm" aria-live="off">
                {listening ? (liveCaption || "…") : <SpokenQuestion text={currentCaption ?? ""} activeWord={spokenWord} />}
              </p>
            </div>
          )}

          {/* Typing fallback */}
          {typing && (
            <form className="mx-auto mb-4 flex w-full max-w-xl gap-2 px-6" onSubmit={(e) => { e.preventDefault(); void answer(text); }}>
              <Input aria-label="Your answer" value={text} onChange={(e) => setText(e.target.value)} disabled={thinking || stage === "grading" || playback !== "ready"}
                placeholder={stage === "live" ? "Type your answer…" : "Ask the interviewer a question…"} />
              <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim() || thinking || stage === "grading" || playback !== "ready"}><Send /></Button>
            </form>
          )}

          {/* Footer */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <button type="button" onClick={() => setCaptionsOn(!captionsOn)} aria-pressed={captionsOn} className={cn("flex items-center gap-1.5 hover:text-foreground", captionsOn && "font-semibold text-foreground")}>
                <Captions className="h-3.5 w-3.5" /> Captions {captionsOn ? "on" : "off"}
              </button>
              <button type="button" onClick={() => { if (currentCaption && voiceOn) void voice.current?.speak(currentCaption); }} disabled={!currentCaption || !voiceOn || stage === "grading"} className="flex items-center gap-1.5 hover:text-foreground disabled:opacity-40">
                <RotateCcw className="h-3.5 w-3.5" /> Replay question
              </button>
              <button type="button" onClick={() => { setVoiceOn(!voiceOn); stopVoice(); }} aria-pressed={voiceOn} className="flex items-center gap-1.5 hover:text-foreground">
                {voiceOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />} Sound
              </button>
              <button type="button" onClick={() => setTyping(!typing)} aria-pressed={typing} className={cn("flex items-center gap-1.5 hover:text-foreground", typing && "font-semibold text-foreground")}>
                <Keyboard className="h-3.5 w-3.5" /> Type instead
              </button>
              {/* Mobile answer control (the hold button is hidden on small screens) */}
              <span className="md:hidden">
                <Button size="sm" onClick={listening ? () => voice.current?.finishListening() : speak} disabled={thinking || stage === "grading" || playback !== "ready"}>
                  {listening ? <Square /> : <Mic />} {listening ? "Done speaking" : "Speak"}
                </Button>
              </span>
            </div>
          </div>
        </section>
      )}

      {stage === "report" && grade && (() => {
        const used = Math.max(0, LENGTHS[length].seconds - left);
        const asked = turns.filter((t) => t.speaker === "interviewer").length;
        const metrics: [string, { score: number; feedback: string }][] = [
          ["Answer quality", grade.metrics.quality],
          ["Conciseness", grade.metrics.conciseness],
          ["Your questions", grade.metrics.candidateQuestions],
          ...(grade.metrics.tone ? [["Tone", grade.metrics.tone] as [string, { score: number; feedback: string }]] : []),
        ];
        const answers = pairAnswers(turns);
        const well = grade.strengths.slice(0, 3).map((n) => ({ n, a: matchAnswer(n, answers) }));
        const next = grade.improvements.slice(0, 3).map((n) => ({ n, a: matchAnswer(n, answers) }));
        const changed = ratings.filter((r) => r.after !== r.before);
        return (
          <section className="mx-auto max-w-4xl space-y-8">
            <header>
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {job?.title ?? "Mock interview"} · {Math.min(asked, questions.length)} questions · {Math.floor(used / 60)}m {used % 60}s
              </div>
              <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">{summaryLine(grade)}</h1>
              {grade.metrics.quality.feedback && <p className="mt-3 max-w-2xl text-muted-foreground">{grade.metrics.quality.feedback}</p>}
            </header>

            <div className="grid gap-8 rounded-2xl border bg-card p-6 md:grid-cols-2 md:gap-0 md:divide-x">
              <CoachNotes title="What went well" tone="good" notes={well} empty="Finishing the session is a win. Next round, we'll find a specific strength." />
              <CoachNotes title="Try next time" tone="next" notes={next} empty="Nothing major — keep doing what you did." className="md:pl-6" />
            </div>

            <div className="grid gap-6 md:grid-cols-[1fr_auto]">
              <div>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold">Scores</h2>
                  <span className="text-xs text-muted-foreground">Overall {grade.overall}%{!demo && ` · +${grade.xp} XP`}</span>
                </div>
                <dl className="divide-y border-y">
                  {metrics.map(([l, m]) => (
                    <div key={l} className="grid grid-cols-[8rem_1fr_3rem] items-center gap-3 py-2.5 text-sm">
                      <dt className="text-muted-foreground">{l}</dt>
                      <div className="h-1 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", m.score >= 80 ? "bg-success" : "bg-primary")} style={{ width: `${m.score}%` }} /></div>
                      <dd className="text-right font-mono tabular-nums">{m.score}</dd>
                    </div>
                  ))}
                </dl>
                {!demo && changed.length > 0 && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Skills moved: {changed.map((r, i) => <span key={r.skill}>{i > 0 && ", "}<b className="text-foreground">{r.skill}</b> {r.after} (+{r.after - r.before})</span>)}
                  </p>
                )}
              </div>
              <div className="flex flex-col items-start gap-2 md:w-56">
                <Button onClick={reset} className="w-full">{demo ? "Try another round" : "Practice again"}</Button>
                {!demo && <Button asChild variant="ghost" className="w-full"><Link to="/">Back to Home</Link></Button>}
                <p className="text-xs text-muted-foreground">Another round on the same role is the fastest way to lift your weakest score.</p>
              </div>
            </div>

            {myRecording && (
              <div className="space-y-2">
                <h2 className="text-sm font-semibold">Rewatch your interview</h2>
                <RecordingPlayer r={myRecording} />
              </div>
            )}

            <details className="text-sm">
              <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">Read full transcript</summary>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto border-l pl-4">{turns.map((t, i) => <p key={i}><b>{t.speaker === "interviewer" ? "Interviewer" : "You"}:</b> {t.text}</p>)}</div>
            </details>
            {reportExtra?.(grade)}
          </section>
        );
      })()}
    </div>
  );
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Speech recognition returns lowercase text; restore sentence capitalization before sending.
const capitalizeTranscript = (s: string) =>
  s.replace(/(^\s*[a-z])|([.?!]\s+[a-z])/g, (m) => m.toUpperCase()).replace(/\bi\b/g, "I").replace(/\bi(')(?=[a-z])/gi, "I$1");

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
  const good = m.score >= 80;
  return (
    <div className="rounded-2xl border bg-card p-6">
      <div className="text-sm font-medium text-muted-foreground">{label}</div>
      <div className="mt-2 flex items-baseline gap-1"><span className="font-display text-5xl font-bold">{m.score}</span><span className="text-sm text-muted-foreground">%</span></div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", good ? "bg-success" : "bg-primary")} style={{ width: `${m.score}%` }} />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{m.feedback}</p>
    </div>
  );
}


function useFollowWord(box: RefObject<HTMLElement | null>, word: number, text: string) {
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (word < 0) { el.scrollTop = 0; return; }
    const span = el.children[word] as HTMLElement | undefined;
    if (!span) return;
    // Keep the spoken word around the upper third of the box.
    el.scrollTo({ top: Math.max(0, span.offsetTop - el.offsetTop - el.clientHeight / 3), behavior: "smooth" });
  }, [box, word, text]);
}

function SpokenQuestion({ text, activeWord }: { text: string; activeWord: number }) {
  return <>{(text.match(/\S+/g) ?? []).map((word, index) => <span key={index} className={index === activeWord ? "rounded-sm bg-primary/15 text-primary" : undefined}>{word}{" "}</span>)}</>;
}

type AnswerRef = { q: number; question: string; answer: string };

/** Pairs each candidate answer with the interviewer line before it. */
function pairAnswers(turns: { speaker: string; text: string }[]): AnswerRef[] {
  const out: AnswerRef[] = [];
  let last = "";
  for (const t of turns) {
    if (t.speaker === "interviewer") last = t.text;
    else if (t.text.trim()) out.push({ q: out.length + 1, question: last, answer: t.text });
  }
  return out;
}

const words = (s: string) => new Set(s.toLowerCase().match(/[a-z]{5,}/g) ?? []);

/** Ties a coach note to the answer it most likely refers to (word overlap); null when unclear. */
function matchAnswer(note: string, answers: AnswerRef[]): AnswerRef | null {
  const nw = words(note);
  let best: AnswerRef | null = null, score = 1;
  for (const a of answers) {
    const aw = words(`${a.question} ${a.answer}`);
    let s = 0; nw.forEach((w) => { if (aw.has(w)) s++; });
    if (s > score) { score = s; best = a; }
  }
  return best;
}

function summaryLine(g: InterviewGrade): string {
  const top = g.strengths[0]?.replace(/\.$/, "");
  if (g.overall >= 80) return `Strong session.${top ? ` ${top}.` : ""}`;
  if (g.overall >= 60) return `A solid round with clear room to sharpen.${top ? ` ${top}.` : ""}`;
  if (g.overall >= 35) return "You've got the start of good answers — the next step is more detail and structure.";
  return "This one was a warm-up. Short answers made it hard to show what you know.";
}

function CoachNotes({ title, tone, notes, empty, className }: { title: string; tone: "good" | "next"; notes: { n: string; a: AnswerRef | null }[]; empty: string; className?: string }) {
  return (
    <div className={className}>
      <h2 className="flex items-center gap-2 font-display text-xl font-bold">
        <span className={cn("h-2 w-2 rounded-full", tone === "good" ? "bg-success" : "bg-primary")} />{title}
      </h2>
      <ul className="mt-3 divide-y">
        {notes.map(({ n, a }) => (
          <li key={n} className="py-3 text-sm">
            <p>{n}</p>
            {a && <p className="mt-1 text-xs text-muted-foreground">On Q{a.q}: “{a.answer.length > 90 ? `${a.answer.slice(0, 90)}…` : a.answer}”</p>}
          </li>
        ))}
        {!notes.length && <li className="py-3 text-sm text-muted-foreground">{empty}</li>}
      </ul>
    </div>
  );
}
