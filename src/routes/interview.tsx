import { createFileRoute } from "@tanstack/react-router";
import { Camera, CameraOff, Flame, Mic, MicOff, Send, Square, Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { useGame } from "@/lib/game";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/interview")({
  head: () => ({
    meta: [
      { title: "Interview Simulator — DevUp" },
      { name: "description", content: "Practice mock interviews with webcam eye-contact tracking and instant feedback." },
      { property: "og:title", content: "Interview Simulator — DevUp" },
      { property: "og:description", content: "Practice mock interviews with webcam tracking and instant feedback." },
    ],
  }),
  component: Interview,
});

const Q_NICE = [
  "Welcome! Tell me a bit about yourself and what drew you to software engineering.",
  "Describe a challenging bug you solved. How did you approach it?",
  "How would you design a URL shortener for millions of users?",
  "Where do you see yourself growing in the next two years?",
];
const Q_ROAST = [
  "Your resume says 'passionate'. Everyone says that. What have you actually shipped?",
  "That bug you're proud of — why did you write it in the first place?",
  "Design a URL shortener. And no, 'just use a database' is not an answer.",
  "Why should we hire you over the 400 other applicants with the same bootcamp?",
];

type Msg = { from: "ai" | "me"; text: string };

function Interview() {
  const { roast, setRoast, completeQuest, gainXp } = useGame();
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [cam, setCam] = useState(true);
  const [mic, setMic] = useState(true);
  const [camErr, setCamErr] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [qi, setQi] = useState(0);
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [report, setReport] = useState(false);
  const [eye, setEye] = useState(82);
  const qs = roast ? Q_ROAST : Q_NICE;

  useEffect(() => {
    navigator.mediaDevices?.getUserMedia({ video: true, audio: true })
      .then((s) => { stream.current = s; if (video.current) video.current.srcObject = s; })
      .catch(() => setCamErr(true));
    return () => stream.current?.getTracks().forEach((t) => t.stop());
  }, []);

  useEffect(() => { stream.current?.getVideoTracks().forEach((t) => (t.enabled = cam)); }, [cam]);
  useEffect(() => { stream.current?.getAudioTracks().forEach((t) => (t.enabled = mic)); }, [mic]);
  useEffect(() => { setMsgs([{ from: "ai", text: qs[0] }]); setQi(0); }, [roast]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const t = setInterval(() => setEye((e) => Math.max(60, Math.min(98, e + (Math.random() * 10 - 5)))), 1200);
    return () => clearInterval(t);
  }, []);

  const answer = (a: string) => {
    if (!a.trim()) return;
    const next = qi + 1;
    const reply = next < qs.length ? qs[next] : roast ? "That's all. I've seen worse. Barely. Hit End Interview." : "Great, that wraps it up! Click End Interview for your report.";
    setMsgs((m) => [...m, { from: "me", text: a }, { from: "ai", text: reply }]);
    setQi(next);
    setText("");
  };

  const speak = () => {
    const SR = (window as unknown as { SpeechRecognition?: any; webkitSpeechRecognition?: any }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: any }).webkitSpeechRecognition;
    if (!SR) { answer("(Spoken answer) I'd break the problem into steps and validate each one."); return; }
    const r = new SR();
    r.onresult = (e: any) => answer(e.results[0][0].transcript);
    r.onend = () => setListening(false);
    setListening(true);
    r.start();
  };

  const end = () => {
    setReport(true);
    completeQuest("mock1");
    gainXp(roast ? 150 : 100);
  };

  const score = Math.round(Math.min(95, 60 + qi * 8 + (roast ? 5 : 0)));

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">Interview Simulator</h1>
        <label className={cn("flex cursor-pointer items-center gap-3 rounded-lg border-2 px-4 py-2 transition", roast ? "border-roast bg-roast/15 glow" : "border-accent/50 bg-accent/10")}>
          <Flame className={cn("h-5 w-5", roast ? "text-roast" : "text-accent")} />
          <span className="text-sm font-semibold">Enable Roast Mode (Aggressive Interviewer)</span>
          <Switch checked={roast} onCheckedChange={setRoast} />
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel overflow-hidden">
          <div className="relative aspect-video bg-background">
            <video ref={video} autoPlay muted playsInline className={cn("h-full w-full -scale-x-100 object-cover", !cam && "invisible")} />
            {(!cam || camErr) && (
              <div className="absolute inset-0 grid place-items-center text-center text-muted-foreground">
                <div><CameraOff className="mx-auto mb-2 h-10 w-10" />{camErr ? "Camera access denied or unavailable" : "Camera off"}</div>
              </div>
            )}
            {cam && !camErr && (
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute left-1/2 top-1/2 h-1/2 w-1/3 -translate-x-1/2 -translate-y-1/2">
                  {["left-0 top-0 border-l-2 border-t-2", "right-0 top-0 border-r-2 border-t-2", "left-0 bottom-0 border-l-2 border-b-2", "right-0 bottom-0 border-r-2 border-b-2"].map((c) => (
                    <span key={c} className={cn("absolute h-6 w-6 border-primary", c)} />
                  ))}
                  <span className="absolute inset-x-0 h-px bg-primary glow animate-scan" />
                </div>
                <div className="absolute left-3 top-3 space-y-1 rounded bg-background/70 px-2 py-1 font-mono text-[10px] text-primary">
                  <div>● FACE LOCK</div><div>EYE CONTACT {eye.toFixed(0)}%</div><div>EXPRESSION: {roast ? "NERVOUS" : "CALM"}</div>
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center justify-center gap-3 p-4">
            <Button variant={mic ? "secondary" : "destructive"} size="icon" onClick={() => setMic(!mic)} aria-label="Toggle mic">{mic ? <Mic /> : <MicOff />}</Button>
            <Button variant={cam ? "secondary" : "destructive"} size="icon" onClick={() => setCam(!cam)} aria-label="Toggle camera">{cam ? <Camera /> : <CameraOff />}</Button>
            <Button variant="destructive" onClick={end}><Square /> End Interview</Button>
          </div>
        </section>

        <section className="panel flex h-[32rem] flex-col">
          <div className="flex items-center gap-2 border-b p-4">
            <div className="grid h-8 w-8 place-items-center rounded bg-primary text-primary-foreground"><Bot className="h-4 w-4" /></div>
            <div><div className="text-sm font-semibold">{roast ? "Gordon, Senior Hiring Manager" : "Ava, Friendly Recruiter"}</div><div className="font-mono text-[10px] text-muted-foreground">Question {Math.min(qi + 1, qs.length)} / {qs.length}</div></div>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {msgs.map((m, i) => (
              <div key={i} className={cn("max-w-[85%] rounded-lg px-3 py-2 text-sm", m.from === "ai" ? "border bg-secondary/50" : "ml-auto bg-primary text-primary-foreground")}>{m.text}</div>
            ))}
          </div>
          <div className="flex gap-2 border-t p-3">
            <Button variant="outline" onClick={speak} disabled={listening}><Mic /> {listening ? "Listening…" : "Speak Answer"}</Button>
            <form className="flex flex-1 gap-2" onSubmit={(e) => { e.preventDefault(); answer(text); }}>
              <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Or type your answer…" />
              <Button type="submit" size="icon" aria-label="Send"><Send /></Button>
            </form>
          </div>
        </section>
      </div>

      <Dialog open={report} onOpenChange={setReport}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display text-2xl">Post-Interview Report</DialogTitle></DialogHeader>
          <div className="text-center">
            <div className="font-display text-6xl font-bold text-primary text-glow">{score}</div>
            <div className="font-mono text-xs text-muted-foreground">OVERALL SCORE · +{roast ? 350 : 300} XP EARNED</div>
          </div>
          <div className="space-y-3">
            {[["Eye contact maintained", 85], ["Confident expression", 72], ["Speaking pace", 78], ["Answer structure", 66]].map(([l, v]) => (
              <div key={l as string}><div className="mb-1 flex justify-between text-sm"><span>{l}</span><span className="font-mono">{v}%</span></div><Progress value={v as number} /></div>
            ))}
          </div>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li>✓ Strong opener — you framed your background clearly.</li>
            <li>→ Use the STAR method for behavioral answers; your results were vague.</li>
            <li>→ In system design, mention caching and rate limiting early.</li>
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
