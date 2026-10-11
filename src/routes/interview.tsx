import { createFileRoute, Link } from "@tanstack/react-router";
import { Captions, Keyboard, Loader2, Mic, RotateCcw, Send, Square, Volume2, VolumeX } from "lucide-react";
import { InterviewVoicePresence, type InterviewVoiceState } from "@/components/InterviewVoicePresence";
import { InterviewMicrophoneCheck } from "@/components/InterviewMicrophoneCheck";
import { Max } from "@/components/Max";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AcknowledgeDisclosure, InterviewDisclosure } from "@/components/InterviewDisclosure";
import { SkillText } from "@/components/skill-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useGame } from "@/lib/game";
import {
  fetchJobPosting, generateInterviewQuestions, getInterviewAgents, gradeInterviewTranscript, parseJobDescription, parseJobUrl, saveSoloSession, sendInterviewTurn, speakInterviewLine, getScribeToken, startLiveInterview,
} from "@/lib/interview.functions";
import { awardRadarPracticeXp, setRadarStatus } from "@/lib/radar.functions";
import {
  LENGTHS, type AgentStatus, type InterviewGrade, type InterviewLength, type InterviewQuestion,
  type InterviewType, type ParsedJob, type TranscriptTurn,
} from "@/lib/interview/types";
import { createBrowserVoice, createElevenLabsVoice, withScribeListening, type VoiceAgent, type VoicePlaybackState } from "@/lib/interview/voice";
import { cn } from "@/lib/utils";


export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Set Up Your Interview — JobMaxxing" },
      { name: "description", content: "Paste a real job post and run a timed AI mock interview, then get graded feedback and XP." },
      { property: "og:title", content: "Set Up Your Interview — JobMaxxing" },
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
  const { completeQuest, gainXp, details } = useGame();
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
  const [captionsOn, setCaptionsOn] = useState(true);
  const captureGeneration = useRef(0);
  const jobTerms = useRef<string[]>([]);
  jobTerms.current = job ? [...(job.skills ?? []), job.title].filter((x): x is string => typeof x === "string") : [];

  const [convId, setConvId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  useEffect(() => {
    const base = agents.voice === "elevenlabs"
      ? createElevenLabsVoice(async (t) => (await speakInterviewLine({ data: { text: t } })).audio, setPlayback, setSpokenWord)
      : createBrowserVoice(setPlayback, setSpokenWord);
    voice.current = withScribeListening(base, async () => (await getScribeToken()).token, () => jobTerms.current);
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
      fetchJobPosting({ data: { url } })
        .then(({ text }) => { setJd(text); return analyze(text); })
        .catch(async () => {
          const job = await parseJobUrl({ data: { url } }).catch(() => null);
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
      const res = await parseJobDescription({ data: { jd: jdText } });
      setJob(res);
      setMine(res.skills.filter((s) => details.skills.some((u) => u.toLowerCase() === s.toLowerCase()))); setStage("review");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const start = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const qs = await generateInterviewQuestions({ data: { job, type, length, roast: false } });
      const saved = await saveSoloSession({ data: { job, type } }).catch(() => null);
      setSavedId(saved?.id ?? null);
      const live = await startLiveInterview({ data: { job, type, length, roast: false, plan: qs } }).catch(() => null);
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
      const nextQuestion = questions[next];
      if (nextQuestion) say(nextQuestion.text, "interview", nextQuestion.id);
    } else if (stage === "your_questions") {
      setTurns((x) => [...x, { speaker: "candidate", phase: "candidate_questions", text: v }]);
      if (convId) {
        setThinking(true);
        const reply = await sendInterviewTurn({ data: { conversationId: convId, text: v, phase: "candidate_questions", secondsLeft: 0, lastQuestion: true } }).catch(() => null);
        setThinking(false);
        if (reply) return say(reply, "candidate_questions");
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
      const g = await gradeInterviewTranscript({ data: { transcript: turns, job, plan: questions, sessionId: savedId } });
      setGrade(g);
      setRatings(g.ratings ?? []);
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

  const reset = () => { stopVoice(); setTyping(false); setConvId(null); setStage("intro"); setGrade(null); setTurns([]); setJob(null); setAck(false); radarJobId.current = null; };

  return (
    <div className={cn(immersive ? "w-full" : "mx-auto max-w-6xl space-y-4 px-4 py-6 md:px-10 md:py-10")}>
      {!immersive && <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Build your next chapter</p>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">Set Up Your Interview</h1>
          <p className="mt-2 text-lg text-muted-foreground">Paste description, answer questions, and improve your confidence</p>
        </div>
      </div>}



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
          {/* Header */}
          <div className="flex items-center justify-between gap-4 p-5">
            <div>
              <div className="text-sm font-semibold">Ava, Friendly Recruiter</div>
              <div className="text-xs text-muted-foreground">
                {job?.title ? `${job.title}. ` : ""}{LENGTHS[length].label} {type} interview.
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={cn("font-mono text-sm", left < 30 && stage === "live" && "text-destructive")}>{fmt(Math.max(0, left))} left</span>
              <Button variant="outline" size="sm" disabled={stage === "grading" || thinking} onClick={finish}>End interview</Button>
            </div>
          </div>

          {currentCaption && stage !== "grading" && (
            <div className="mx-auto w-full max-w-4xl px-6 py-6 md:py-8">
              <p className="max-h-48 overflow-y-auto break-words text-center text-2xl font-medium leading-relaxed text-foreground md:text-3xl" aria-label="Current question">
                <SpokenQuestion text={currentCaption} activeWord={spokenWord} />
              </p>
            </div>
          )}

          {/* Orb stage */}
          <div className="relative grid min-h-72 flex-1 grid-cols-1 items-center justify-items-center gap-8 px-6 py-8 md:grid-cols-[1fr_240px_1fr]">
            <div className="hidden w-full max-w-64 justify-self-start md:block">
              <div className="mb-2 h-px w-6 bg-foreground/40" />
              <div className="text-sm font-semibold">
                {stage === "live" ? `Question ${qi + 1} of ${questions.length}` : stage === "grading" ? "Interview complete" : "Your questions"}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {stage === "grading" ? "Reviewing your interview."
                  : stage === "your_questions" ? "Ask the interviewer anything."
                  : `${questions[qi]?.kind === "technical" ? "Technical" : "Behavioral"}. ${voiceState === "speaking" || voiceState === "preparing" ? "The interviewer is speaking." : voiceState === "listening" ? "Listening to you." : voiceState === "thinking" ? "Thinking." : "Your turn to answer."}`}
              </div>
            </div>
            <InterviewVoicePresence state={voiceState} />
            <div className="hidden w-full max-w-64 flex-col items-center gap-3 text-center md:flex">
              <button
                type="button"
                aria-label={listening ? "Click to end your answer" : "Click to answer"}
                disabled={thinking || stage === "grading" || playback !== "ready"}
                onClick={() => { if (listening) voice.current?.finishListening(); else void speak(); }}
                className={cn("grid h-14 w-14 place-items-center rounded-full border-2 transition",
                  listening ? "border-primary bg-primary text-primary-foreground" : "border-foreground/60 hover:border-primary hover:text-primary",
                  (thinking || stage === "grading" || playback !== "ready") && "opacity-40")}
              >
                {listening ? <Square className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <div className="text-sm font-semibold">{listening ? "Click to end" : "Click to answer"}</div>
              <p className="text-xs text-muted-foreground">Click the mic or press Space to start talking, then click again (or press Space) when you're done.</p>
            </div>
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
            <span>{stage === "live" ? `Question ${qi + 1} of ${questions.length}` : stage === "grading" ? "Reviewing interview" : "Your questions"}</span>
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
        const work = grade.improvements.slice(0, 3);
        return (
          <section className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Interview complete. {grade.overall}%.</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {job?.title ?? "Mock interview"}. {Math.min(asked, questions.length)} questions in {Math.floor(used / 60)} minutes {used % 60} seconds.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                <span className="text-primary">◆</span> +{grade.xp} XP earned
              </span>
            </div>
            <div className={cn("grid gap-4", metrics.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3")}>
              {metrics.map(([l, m]) => <Metric key={l} label={l} m={m} />)}
            </div>
            {ratings.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {ratings.map((r) => {
                  const d = r.after - r.before;
                  return (
                    <span key={r.skill} className="rounded-full border bg-card px-3 py-1 text-xs">
                      <b>{r.skill}</b> {r.after} <span className={d >= 0 ? "text-success" : "text-primary"}>{d >= 0 ? "+" : ""}{d}</span>
                    </span>
                  );
                })}
              </div>
            )}
            <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
              <div className="rounded-2xl border bg-card p-6">
                <h2 className="font-display text-2xl font-bold">What to work on</h2>
                <ol className="mt-4 space-y-3">
                  {work.map((s, i) => (
                    <li key={s} className="flex gap-3 rounded-xl bg-muted p-4">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary">{i + 1}</span>
                      <span className="text-sm">{s}</span>
                    </li>
                  ))}
                  {!work.length && <li className="text-sm text-muted-foreground">Nothing major — keep it up.</li>}
                </ol>
                {grade.strengths.length > 0 && (
                  <>
                    <h3 className="mt-6 text-sm font-semibold">What went well</h3>
                    <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{grade.strengths.map((s) => <li key={s}>✓ {s}</li>)}</ul>
                  </>
                )}
              </div>
              <div className="flex flex-col items-start gap-3 rounded-2xl border bg-card p-6">
                <h2 className="font-display text-2xl font-bold">Keep the streak going</h2>
                <p className="text-sm text-muted-foreground">Another session on the same role is the fastest way to lift your weakest score.</p>
                <Button onClick={reset} className="mt-1">New interview</Button>
                <details className="w-full text-sm">
                  <summary className="inline-flex cursor-pointer list-none rounded-md border bg-background px-4 py-2 font-medium">Read full transcript</summary>
                  <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{turns.map((t, i) => <p key={i}><b>{t.speaker === "interviewer" ? "Interviewer" : "You"}:</b> {t.text}</p>)}</div>
                </details>
                <Link to="/" className="px-4 py-2 text-sm font-medium">Back to Home</Link>
              </div>
            </div>
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


function SpokenQuestion({ text, activeWord }: { text: string; activeWord: number }) {
  return <>{(text.match(/\S+/g) ?? []).map((word, index) => <span key={index} className={index === activeWord ? "rounded-sm bg-primary/15 text-primary" : undefined}>{word}{" "}</span>)}</>;
}
