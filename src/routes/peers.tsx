import { createFileRoute } from "@tanstack/react-router";
import { Check, Copy, Loader2, Mic, MicOff, Phone, PhoneOff, Send, ShieldAlert, Square, Timer, Users, Video, VideoOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { WornMax } from "@/components/Wearables";
import { PageHeader } from "@/components/AppShell";
import { FriendsPanel } from "@/components/FriendsPanel";
import { SkillText } from "@/components/skill-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { usePeerCall } from "@/hooks/use-peer-call";
import { useGame } from "@/lib/game";
import { generateInterviewQuestions, getScribeToken, parseJobDescription } from "@/lib/interview.functions";
import { createBrowserVoice, withScribeListening, type VoiceAgent } from "@/lib/interview/voice";
import {
  createPeerSession, getPeerSession, joinPeerSession, peerAskNext, peerEndSession, peerGrade, peerReady, peerSay, peerSetChecks, peerVideoConsent,
  type PeerSession,
} from "@/lib/peer.functions";
import { LENGTHS, type InterviewLength, type InterviewType, type ParsedJob } from "@/lib/interview/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/peers")({
  validateSearch: (s: Record<string, unknown>) => ({ join: typeof s["join"] === "string" ? s["join"] : undefined }),
  head: () => ({
    meta: [
      { title: "Peer Interviews — JobMaxxing" },
      { name: "description", content: "Mock interview a friend over a live voice call — AI-planned questions, live checklist, and graded feedback for both of you." },
      { property: "og:title", content: "Peer Interviews — JobMaxxing" },
      { property: "og:description", content: "Match with a friend, talk it out live, and both get graded." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Stage = "intro" | "setup" | "review" | "options" | "lobby" | "live" | "report";
const QUESTION_SECONDS = 180;
const capitalize = (s: string) =>
  s.trim().replace(/\bi\b/g, "I").replace(/(^|[.!?]\s+)([a-z])/g, (_m, p: string, c: string) => p + c.toUpperCase());

function Page() {
  const { claimInterviewXp } = useGame();
  const joinParam = Route.useSearch().join;
  const [stage, setStage] = useState<Stage>("intro");
  const [busy, setBusy] = useState(false);
  const [jd, setJd] = useState("");
  const [job, setJob] = useState<ParsedJob | null>(null);
  const [type, setType] = useState<InterviewType>("mixed");
  const [length, setLength] = useState<InterviewLength>("standard");
  const [role, setRole] = useState<"candidate" | "interviewer">("candidate");
  const [joinCode, setJoinCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [session, setSession] = useState<PeerSession | null>(null);
  const [text, setText] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [skew, setSkew] = useState(0);
  const [listening, setListening] = useState(false);
  const [caption, setCaption] = useState("");
  const voiceRef = useRef<VoiceAgent | null>(null);
  const gradeAsked = useRef<string | null>(null);
  const gradeTries = useRef(0);
  const xpPaid = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const myRole = session ? ((session.meIsHost === (session.hostRole === "interviewer")) ? "interviewer" : "candidate") : null;
  const videoConsent = session?.signal.video ?? {};
  const myVideoConsent = session ? (session.meIsHost ? videoConsent.host : videoConsent.guest) : false;
  const bothVideoConsent = !!(videoConsent.host && videoConsent.guest);
  const readyFlags = session?.signal.ready ?? {};
  const myReady = session ? !!(session.meIsHost ? readyFlags.host : readyFlags.guest) : false;
  const bothReady = !!(readyFlags.host && readyFlags.guest);
  const call = usePeerCall({ sessionId, isHost: !!session?.meIsHost, live: stage === "live", signal: session?.signal ?? {}, video: bothVideoConsent });

  const refresh = async (id = sessionId) => {
    if (!id) return;
    const s = await getPeerSession({ data: { id } });
    setSkew(new Date(s.serverNow).getTime() - Date.now());
    setSession(s);
    setStage((st) => (s.status === "done" ? "report" : s.status === "live" && (st === "lobby" || st === "intro") ? "live" : st));
  };

  // Poll while shared (faster while live so signalling and lines feel instant).
  useEffect(() => {
    if (!sessionId || !["lobby", "live", "report"].includes(stage)) return;
    if (stage === "report" && session?.grade) return;
    const t = setInterval(() => void refresh().catch(() => {}), stage === "live" ? 1500 : 3000);
    void refresh().catch(() => {});
    return () => clearInterval(t);
  }, [sessionId, stage, session?.grade]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (stage !== "live") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [stage]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [session?.transcript?.length]);

  // Stop capturing when the interview leaves the live stage.
  useEffect(() => { if (stage !== "live") { voiceRef.current?.stop(); setListening(false); } }, [stage]);
  useEffect(() => () => voiceRef.current?.stop(), []);

  // Ask the server to grade both sides once the session is done.
  useEffect(() => {
    if (stage !== "report" || !session || session.flag || session.grade || session.grading) return;
    if (gradeAsked.current === session.id) return;
    gradeAsked.current = session.id;
    void peerGrade({ data: { id: session.id } }).then(() => refresh()).catch((e) => { if (gradeTries.current++ < 2) setTimeout(() => { gradeAsked.current = null; void refresh().catch(() => {}); }, 5000); toast.error(`Grading failed — retrying shortly. ${(e as Error).message}`); });
  }, [stage, session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Feed each side's score into XP once.
  useEffect(() => {
    if (stage !== "report" || !session?.grade || !myRole || xpPaid.current === session.id) return;
    xpPaid.current = session.id;
    claimInterviewXp("peer", session.id);
  }, [stage, session?.grade, myRole]); // eslint-disable-line react-hooks/exhaustive-deps

  const analyze = async () => {
    setBusy(true);
    try { setJob(await parseJobDescription({ data: { jd } })); setStage("review"); }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const create = async () => {
    if (!job) return;
    setBusy(true);
    try {
      const qs = await generateInterviewQuestions({ data: { job, type, length, roast: false } });
      if (!qs.length) throw new Error("No interview questions were returned. Please try again.");
      const res = await createPeerSession({ data: { job, questions: qs, type, length, role } });
      setSessionId(res.id); setCode(res.code); setStage("lobby");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const join = async (override?: string) => {
    const useCode = (override ?? joinCode).trim().toUpperCase();
    if (useCode.length !== 6) return;
    setBusy(true);
    try {
      const { id } = await joinPeerSession({ data: { code: useCode } });
      setSessionId(id);
      await refresh(id);
      setStage((st) => (st === "intro" ? "lobby" : st));
      toast.success("You're in!", { description: "Start the call to talk with your friend." });
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  // Auto-join when arriving from an accepted invite (?join=CODE).
  const autoJoined = useRef(false);
  useEffect(() => {
    if (!joinParam || autoJoined.current) return;
    autoJoined.current = true;
    void join(joinParam);
  }, [joinParam]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await refresh(); } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  const say = (line: string) => act(async () => {
    const v = capitalize(line);
    if (!v || !session) return;
    const r = await peerSay({ data: { id: session.id, text: v } });
    if (r.stopped) toast.error("Interview stopped", { description: r.message ?? undefined });
    else if (!r.ok) toast.warning(r.message ?? "Line not sent.");
  });

  const startSpeaking = async () => {
    voiceRef.current ??= withScribeListening(createBrowserVoice(), async () => (await getScribeToken()).token, () => [...(session?.job?.skills ?? []), session?.job?.title ?? ""]);
    setCaption(""); setListening(true);
    try {
      const heard = await voiceRef.current.listen((t) => setCaption(t));
      if (heard.trim()) await say(heard);
    } catch (e) { toast.error((e as Error).message); } finally { setListening(false); setCaption(""); }
  };

  const toggleCheck = (qid: string, idx: number) => {
    if (!session) return;
    const cur = session.checks[qid] ?? [];
    const next = cur.includes(idx) ? cur.filter((n) => n !== idx) : [...cur, idx];
    setSession({ ...session, checks: { ...session.checks, [qid]: next } });
    void peerSetChecks({ data: { id: session.id, questionId: qid, ticked: next } }).catch((e) => toast.error((e as Error).message));
  };

  const reset = () => {
    call.hangUp();
    setStage("intro"); setSession(null); setSessionId(null); setCode(""); setJob(null); setJd(""); setJoinCode("");
    gradeAsked.current = null; xpPaid.current = null;
  };

  const askedCount = session?.transcript?.filter((t) => t.speaker === "interviewer" && t.phase === "interview").length ?? 0;
  const allAsked = session?.questions ? session.current >= session.questions.length : false;
  const currentQ = session && askedCount ? session.questions[askedCount - 1] : undefined;
  const serverNow = now + skew;
  const qLeft = session?.questionStartedAt ? Math.max(0, QUESTION_SECONDS - Math.floor((serverNow - Date.parse(session.questionStartedAt)) / 1000)) : QUESTION_SECONDS;
  const totalLeft = session?.startedAt ? Math.max(0, LENGTHS[session.length].seconds - Math.floor((serverNow - Date.parse(session.startedAt)) / 1000)) : session ? LENGTHS[session.length].seconds : 0;
  const partner = session ? (session.meIsHost ? session.guestName : session.hostName) : null;
  const ticks = useMemo(() => Object.values(session?.checks ?? {}).reduce((n, a) => n + a.length, 0), [session?.checks]);

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <PageHeader eyebrow="Build your next chapter" title="Peer Interviews" sub="AI-planned questions, a live voice call with a friend, and graded feedback for both of you." />

      {stage === "intro" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="panel flex flex-col items-center px-6 py-16 text-center">
            <WornMax pose="dap" className="mascot-float h-24 w-24" />
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

      {stage === "intro" && <FriendsPanel />}

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
              options={[["mixed", "Mixed"], ["technical", "Technical"], ["behavioral", "Behavioral"], ["resume", "Resume"]]} />
            <Choice label="Length" value={length} onChange={setLength}
              options={(Object.keys(LENGTHS) as InterviewLength[]).map((k) => [k, LENGTHS[k].label])} />
            <Choice label="Your role" value={role} onChange={setRole}
              options={[["candidate", "I'll answer"], ["interviewer", "I'll interview"]]} />
          </div>
          <p className="text-sm text-muted-foreground">
            {role === "candidate"
              ? "Your friend reads the questions over a live call and you answer out loud. Both of you are graded and earn XP."
              : "You read the questions aloud and tick a live checklist while your friend answers. Both of you are graded and earn XP."}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStage("review")}>Back</Button>
            <Button onClick={create} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Create session</Button>
          </div>
        </section>
      )}

      {stage === "lobby" && (
        <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-[1fr_20rem]">
          <section className="panel flex flex-col items-center px-6 py-20 text-center">
            <WornMax pose="wave" className="mascot-float h-24 w-24" />
            <h2 className="mt-6 text-2xl font-bold">Waiting for your friend…</h2>
            <p className="mt-2 text-sm text-muted-foreground">Share this code, or invite a friend directly — they'll get a pop-up to join.</p>
            <div className="mt-6 flex items-center gap-3">
              <div className="rounded-lg border-2 border-primary bg-primary/10 px-8 py-4 font-mono text-4xl font-bold tracking-[0.4em] text-primary">{code || session?.code}</div>
              <Button variant="outline" size="icon" aria-label="Copy code" onClick={() => { void navigator.clipboard.writeText(code); toast.success("Code copied"); }}>
                <Copy />
              </Button>
            </div>
            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Checking for your friend every few seconds…</p>
            <Button variant="ghost" className="mt-6" onClick={reset}>Cancel session</Button>
          </section>
          <FriendsPanel inviteCode={code || session?.code} roleTitle={job?.title ?? null} />
        </div>
      )}

      {stage === "live" && session && (
        <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
          <section className="flex min-h-[36rem] flex-col border-y bg-card">
            <audio ref={call.audioRef} autoPlay playsInline className="hidden" />
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
              <div className="grid h-9 w-9 place-items-center rounded bg-primary text-primary-foreground"><Users className="h-4 w-4" /></div>
              <div className="flex-1">
                <div className="text-sm font-semibold">{myRole === "candidate" ? `${partner ?? "Your friend"} is interviewing you` : `You're interviewing ${partner ?? "your friend"}`}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {allAsked ? "Wrap-up — candidate's questions" : `Question ${Math.min(askedCount + 1, session.questions.length)} / ${session.questions.length}`}
                </div>
              </div>
              <div className="flex items-center gap-4 font-mono text-sm">
                {bothReady ? (
                  <>
                    <span className={cn("flex items-center gap-1", askedCount && qLeft < 30 && "text-destructive")} title="This question">
                      <Timer className="h-4 w-4" /> Q {fmt(askedCount ? qLeft : QUESTION_SECONDS)}
                    </span>
                    <span className={cn("text-muted-foreground", totalLeft < 60 && "text-destructive")} title="Whole interview">Total {fmt(totalLeft)}</span>
                  </>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground" title="The clock starts once you're both ready">
                    <Timer className="h-4 w-4" /> Starts when you're both ready
                  </span>
                )}
              </div>
            </div>
            <Progress value={(askedCount / Math.max(1, session.questions.length)) * 100} className="h-1 rounded-none" />
            {askedCount > 0 && qLeft === 0 && !allAsked && (
              <p className="bg-destructive/10 px-4 py-2 text-center text-xs text-destructive">Time's up on this question — wrap up and move on.</p>
            )}

            <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
              {call.state === "idle" || call.state === "failed" ? (
                <Button size="sm" variant="outline" onClick={() => void call.start()}><Phone /> {call.state === "failed" ? "Retry call" : "Start voice call"}</Button>
              ) : (
                <>
                  <span className={cn("font-mono", call.state === "connected" ? "text-accent" : "text-muted-foreground")}>
                    {call.state === "connected" ? "● Live audio" : "Connecting audio…"}
                  </span>
                  {call.state === "connected" && !bothReady && (
                    myReady ? (
                      <span className="flex items-center gap-1 text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Waiting for {partner ?? "your friend"} to ready up…</span>
                    ) : (
                      <Button size="sm" onClick={() => void act(() => peerReady({ data: { id: session.id, on: true } }))} disabled={busy}>
                        <Check /> I'm ready
                      </Button>
                    )
                  )}
                  {bothReady && <span className="font-mono text-accent">● Both ready</span>}
                  <Button size="sm" variant="ghost" onClick={() => call.setMuted(!call.muted)}>{call.muted ? <MicOff /> : <Mic />} {call.muted ? "Unmute" : "Mute"}</Button>
                  <Button size="sm" variant="ghost" onClick={call.hangUp}><PhoneOff /> Leave call</Button>
                </>
              )}
              {myVideoConsent ? (
                bothVideoConsent ? (
                  <Button size="sm" variant="ghost" onClick={() => void act(() => peerVideoConsent({ data: { id: session.id, on: false } }))} disabled={busy}>
                    <VideoOff /> Camera off
                  </Button>
                ) : (
                  <span className="flex items-center gap-1 text-muted-foreground"><Video className="h-3.5 w-3.5" /> Waiting for {partner ?? "your friend"} to allow camera…</span>
                )
              ) : (
                <Button size="sm" variant="outline" onClick={() => void act(() => peerVideoConsent({ data: { id: session.id, on: true } }))} disabled={busy}>
                  <Video /> Turn on camera
                </Button>
              )}
              {call.error && <span className="text-destructive">{call.error}</span>}
            </div>

            {bothVideoConsent && (
              <div className="grid grid-cols-2 gap-2 border-b bg-muted/30 p-2">
                <div className="relative overflow-hidden rounded-lg border bg-black/80">
                  <video ref={call.remoteVideoRef} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" aria-label={`${partner ?? "Partner"}'s camera`} />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">{partner ?? "Partner"}</span>
                </div>
                <div className="relative overflow-hidden rounded-lg border bg-black/80">
                  <video ref={call.localVideoRef} autoPlay playsInline muted className="aspect-[4/3] w-full -scale-x-100 object-cover" aria-label="Your camera" />
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">You</span>
                </div>
              </div>
            )}

            <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
              {session.transcript.length === 0 && (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  {!bothReady
                    ? "Once the call connects, both of you press \"I'm ready\" — the clock starts then."
                    : myRole === "interviewer" ? "Reveal the first question and read it aloud." : "Wait for the first question…"}
                </p>
              )}
              {session.transcript.map((t, i) => (
                <div key={i} className={cn("max-w-[80%] rounded-lg border px-4 py-3 text-sm", t.speaker === "interviewer" ? "bg-muted/50" : "ml-auto border-primary/40 bg-primary/10")}>
                  <div className="mb-1 font-mono text-[10px] uppercase text-muted-foreground">{t.speaker === "interviewer" ? "Interviewer" : "Candidate"}</div>
                  {t.text}
                </div>
              ))}
              {listening && caption && <p className="ml-auto max-w-[80%] text-right text-sm italic text-muted-foreground">{caption}…</p>}
            </div>

            <div className="space-y-3 border-t p-4">
              <div className="flex flex-wrap items-center justify-center gap-2">
                {listening ? (
                  <Button onClick={() => voiceRef.current?.finishListening()}><Square /> Done speaking</Button>
                ) : (
                  <Button variant="outline" onClick={() => void startSpeaking()} disabled={busy || (myRole === "candidate" && !askedCount)}>
                    <Mic /> {myRole === "interviewer" ? "Transcribe a follow-up" : allAsked ? "Ask your question" : "Answer (transcribe)"}
                  </Button>
                )}
                {myRole === "interviewer" && !allAsked && (
                  <Button onClick={() => void act(() => peerAskNext({ data: { id: session.id } }))} disabled={busy || !bothReady}
                    title={bothReady ? undefined : "The interview starts once you're both ready"}>
                    {busy && <Loader2 className="animate-spin" />} {askedCount === 0 ? "Reveal first question" : "Next question"}
                  </Button>
                )}
                {myRole === "interviewer" && (
                  <Button variant="destructive" onClick={() => void act(() => peerEndSession({ data: { id: session.id } }))} disabled={busy}><Square /> End interview</Button>
                )}
              </div>
              <form className="mx-auto flex w-full max-w-2xl gap-2" onSubmit={(e) => { e.preventDefault(); const v = text; setText(""); void say(v); }}>
                <Input value={text} onChange={(e) => setText(e.target.value)} disabled={busy || (myRole === "candidate" && !askedCount)}
                  placeholder="Or type a line…" aria-label="Type a line" />
                <Button type="submit" size="icon" aria-label="Send" disabled={busy || !text.trim()}><Send /></Button>
              </form>
              <p className="text-center text-[11px] text-muted-foreground"><ShieldAlert className="mr-1 inline h-3 w-3" />Moderated live: slurs, threats or harassment end the interview; repeated profanity does too.</p>
            </div>
          </section>

          <aside className="panel space-y-3 p-4">
            {myRole === "interviewer" ? (
              <>
                <h3 className="font-display text-lg">Live checklist</h3>
                {currentQ ? (
                  <>
                    <p className="text-sm text-muted-foreground">Tick each point as they hit it.</p>
                    <p className="text-sm font-medium">{currentQ.text}</p>
                    <ul className="space-y-2">
                      {currentQ.checklist.map((c, i) => {
                        const on = (session.checks[currentQ.id] ?? []).includes(i);
                        return (
                          <li key={i}>
                            <button type="button" onClick={() => toggleCheck(currentQ.id, i)}
                              className={cn("flex w-full items-start gap-2 rounded border p-2 text-left text-sm transition-colors", on ? "border-accent bg-accent/15" : "hover:bg-muted/50")}>
                              <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border", on && "border-accent bg-accent text-accent-foreground")}>{on && <Check className="h-3 w-3" />}</span>
                              {c}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : <p className="text-sm text-muted-foreground">Reveal the first question to see what to listen for.</p>}
                {session.questions[session.current] && (
                  <div className="border-t pt-3 text-xs text-muted-foreground"><b>Up next:</b> {session.questions[session.current]!.text}</div>
                )}
              </>
            ) : (
              <>
                <h3 className="font-display text-lg">Tips</h3>
                <p className="text-sm text-muted-foreground">Answer out loud, then hit "Done speaking" so your words land in the transcript. Aim for about two minutes per answer — situation, what you did, the result.</p>
                {allAsked && <p className="text-sm font-medium text-primary">Your turn: ask your interviewer a question or two.</p>}
              </>
            )}
          </aside>
        </div>
      )}

      {stage === "report" && session && (
        <section className="panel space-y-5 p-6">
          {session.flag ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <ShieldAlert className="h-10 w-10 text-destructive" />
              <h2 className="text-xl font-bold">Interview stopped by moderation</h2>
              <p className="text-sm text-muted-foreground">{session.flag} It wasn't graded and no XP was awarded.</p>
            </div>
          ) : session.grade ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <ScoreBlock title="Candidate" you={myRole === "candidate"} overall={session.grade.overall} xp={session.grade.xp} />
                {session.interviewerGrade && <ScoreBlock title="Interviewer" you={myRole === "interviewer"} overall={session.interviewerGrade.overall} xp={session.interviewerGrade.xp} />}
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-3">
                  <h3 className="font-display text-lg">Candidate feedback</h3>
                  <Metric label="Quality & accuracy of answers" m={session.grade.metrics.quality} />
                  <Metric label="Conciseness" m={session.grade.metrics.conciseness} />
                  <Metric label="Questions they asked" m={session.grade.metrics.candidateQuestions} />
                  {session.grade.metrics.tone && <Metric label="Tone" m={session.grade.metrics.tone} />}
                  <Bullets good={session.grade.strengths} bad={session.grade.improvements} />
                </div>
                {session.interviewerGrade && (
                  <div className="space-y-3">
                    <h3 className="font-display text-lg">Interviewer feedback</h3>
                    <Metric label="Quality & accuracy of questions" m={session.interviewerGrade.metrics.quality} />
                    <Metric label="Conciseness" m={session.interviewerGrade.metrics.conciseness} />
                    <Metric label="Follow-up questions" m={session.interviewerGrade.metrics.followUps} />
                    {session.interviewerGrade.metrics.tone && <Metric label="Tone" m={session.interviewerGrade.metrics.tone} />}
                    <p className="text-xs text-muted-foreground">Checklist: {ticks} key point(s) ticked.</p>
                    <Bullets good={session.interviewerGrade.strengths} bad={session.interviewerGrade.improvements} />
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className="flex items-center justify-center gap-2 py-12 text-muted-foreground"><Loader2 className="animate-spin" /> Grading both of you…</p>
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

function ScoreBlock({ title, you, overall, xp }: { title: string; you: boolean; overall: number; xp: number }) {
  return (
    <div className={cn("rounded border p-4 text-center", you && "border-primary")}>
      <div className="font-mono text-xs text-muted-foreground">{title.toUpperCase()}{you ? " · YOU" : ""}</div>
      <div className="font-display text-5xl font-bold text-primary">{overall}</div>
      <div className="font-mono text-xs text-muted-foreground">+{xp} XP</div>
    </div>
  );
}

function Bullets({ good, bad }: { good: string[]; bad: string[] }) {
  return (
    <div className="space-y-1 text-sm">
      {good.map((s) => <p key={s}>✓ {s}</p>)}
      {bad.map((s) => <p key={s} className="text-muted-foreground">→ {s}</p>)}
    </div>
  );
}

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

function Metric({ label, m }: { label: string; m: { score: number; feedback: string } | null | undefined }) {
  if (!m) return null;
  return (
    <div className="rounded border p-3">
      <div className="mb-1 flex justify-between text-sm"><span>{label}</span><span className="font-mono">{m.score}</span></div>
      <Progress value={m.score} />
      <p className="mt-2 text-xs text-muted-foreground">{m.feedback}</p>
    </div>
  );
}
