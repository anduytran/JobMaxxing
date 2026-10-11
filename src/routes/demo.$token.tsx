import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { FileText, Loader2, Star, Upload } from "lucide-react";
import { toast } from "sonner";
import { InterviewFlow, type InterviewApi } from "@/components/InterviewFlow";
import { Max } from "@/components/Max";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getInterviewAgents } from "@/lib/interview.functions";
import {
  beginDemoRun, checkDemoLink, demoGrade, demoParseJob, demoQuestions, demoScribeToken, demoSpeak, demoStartLive, demoTurn, sendDemoFeedback,
} from "@/lib/demo.functions";
import type { AgentStatus, InterviewGrade } from "@/lib/interview/types";
import { extractPdfText } from "@/lib/pdf-text";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/demo/$token")({
  head: () => ({
    meta: [
      { title: "Try a mock interview — JobMaxxing demo" },
      { name: "description", content: "Run a real AI mock interview for any job, no account needed, and get graded feedback." },
      { property: "og:title", content: "Try a mock interview — JobMaxxing demo" },
      { property: "og:description", content: "Paste a job, talk through a live AI interview, and get graded feedback. No sign-up." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: async ({ params }) => {
    const [link, agents] = await Promise.all([checkDemoLink({ data: { token: params.token } }), getInterviewAgents()]);
    return { link, agents: agents as AgentStatus };
  },
  component: Demo,
  errorComponent: ({ error }) => <div role="alert" className="p-10">{(error as Error).message}</div>,
  notFoundComponent: () => <div className="p-10">This demo link doesn't exist.</div>,
});

async function readFileText(f: File): Promise<string> {
  if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) return extractPdfText(f);
  if (f.type.startsWith("text/") || /\.(txt|md)$/i.test(f.name)) return (await f.text()).trim();
  return "";
}

function Demo() {
  const { token } = Route.useParams();
  const { link, agents } = Route.useLoaderData();
  const [runId, setRunId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [resume, setResume] = useState<{ name: string; text: string } | null>(null);
  const run = useRef<string | null>(null);

  if (!link.ok) return <Shell><Gone text="This demo link isn't active. Ask whoever shared it for a new one." /></Shell>;

  const begin = async () => {
    setStarting(true);
    try {
      const { runId: id } = await beginDemoRun({ data: { token } });
      run.current = id; setRunId(id);
    } catch (e) { toast.error((e as Error).message); } finally { setStarting(false); }
  };

  if (!runId) {
    return (
      <Shell>
        <section className="panel mx-auto flex max-w-2xl flex-col items-center px-6 py-16 text-center">
          <Max pose="interview" className="h-28 w-28" />
          <p className="mt-6 text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">JobMaxxing demo</p>
          <h1 className="mt-2 text-4xl font-bold">Try a real mock interview</h1>
          <p className="mt-4 max-w-lg text-muted-foreground">Add your resume if you like, paste a job description, pick your interview style, then answer out loud. You'll get graded feedback at the end. No account, and nothing is saved to anyone.</p>
          {link.usesLeft > 0
            ? <Button size="lg" className="mt-8 px-7 py-6 text-base" onClick={() => void begin()} disabled={starting}>{starting && <Loader2 className="animate-spin" />}Start the demo</Button>
            : <p className="mt-8 text-sm text-muted-foreground">This demo link has been used up. Ask for a new one.</p>}
        </section>
      </Shell>
    );
  }

  const id = () => run.current ?? runId;
  const api: InterviewApi = {
    parseJob: async (jd) => {
      // A job "upload" lands as text in the box; very short pastes may be a link, which the demo doesn't fetch.
      return demoParseJob({ data: { runId: id(), jd } });
    },
    questions: (job, type, length) => demoQuestions({ data: { runId: id(), job, type, length, resumeText: resume?.text ?? "" } }),
    startLive: (job, type, length, plan) => demoStartLive({ data: { runId: id(), job, type, length, plan } }),
    turn: (_conv, text, phase, secondsLeft, lastQuestion) => demoTurn({ data: { runId: id(), text, phase, secondsLeft, lastQuestion } }),
    speak: async (text) => (await demoSpeak({ data: { runId: id(), text } })).audio,
    scribeToken: async () => (await demoScribeToken({ data: { runId: id() } })).token,
    grade: (transcript, job) => demoGrade({ data: { runId: id(), transcript, job } }),
  };

  return (
    <Shell bare>
      <InterviewFlow
        demo agents={agents} api={api}
        setupExtra={<DemoUploads resume={resume} onResume={setResume} />}
        reportExtra={(g) => <DemoFeedback runId={id()} grade={g} />}
      />
    </Shell>
  );
}

function Shell({ children, bare }: { children: React.ReactNode; bare?: boolean }) {
  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center justify-between border-b px-5 py-3">
        <span className="font-display text-lg font-bold">JobMaxxing</span>
        <span className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">Demo · nothing is saved</span>
      </header>
      <main className={cn(!bare && "p-4 md:p-10")}>{children}</main>
    </div>
  );
}

function Gone({ text }: { text: string }) {
  return <section className="panel mx-auto max-w-xl p-10 text-center text-muted-foreground">{text}</section>;
}

/** Resume and job-description uploads. Files are read in the browser; only their text is sent. */
function DemoUploads({ resume, onResume }: { resume: { name: string; text: string } | null; onResume: (r: { name: string; text: string } | null) => void }) {
  const resumeInput = useRef<HTMLInputElement>(null);
  const jdInput = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  const pickResume = async (f: File | undefined) => {
    if (!f) return;
    setReading(true);
    const text = await readFileText(f).catch(() => "");
    setReading(false);
    if (text.length < 80) return void toast.error("Couldn't read text from that file. Try a text-based PDF or a .txt file.");
    onResume({ name: f.name, text: text.slice(0, 6000) });
    toast.success("Resume added — choose the Resume interview style to be asked about it.");
  };
  const pickJd = async (f: File | undefined) => {
    if (!f) return;
    const text = await readFileText(f).catch(() => "");
    if (text.length < 40) return void toast.error("Couldn't read text from that file. Paste the description instead.");
    // Fill the description box the flow reads from.
    const box = document.querySelector<HTMLTextAreaElement>("textarea");
    if (box) {
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
      setter?.call(box, text.slice(0, 20000));
      box.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  return (
    <div className="grid gap-3 md:grid-cols-2">
      <div className="rounded-xl border border-dashed p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><FileText className="h-4 w-4" />Your resume <span className="font-normal text-muted-foreground">(optional)</span></div>
        <p className="mt-1 text-xs text-muted-foreground">{resume ? `Using ${resume.name}.` : "PDF or .txt. Lets the interviewer ask about your own projects."}</p>
        <div className="mt-3 flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => resumeInput.current?.click()} disabled={reading}>
            {reading ? <Loader2 className="animate-spin" /> : <Upload className="h-3.5 w-3.5" />}{resume ? "Replace" : "Upload resume"}
          </Button>
          {resume && <Button type="button" size="sm" variant="ghost" onClick={() => onResume(null)}>Remove</Button>}
        </div>
        <input ref={resumeInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => { void pickResume(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
      <div className="rounded-xl border border-dashed p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><Upload className="h-4 w-4" />Job description file</div>
        <p className="mt-1 text-xs text-muted-foreground">Upload a PDF or .txt of the posting, or paste it below.</p>
        <Button type="button" size="sm" variant="outline" className="mt-3" onClick={() => jdInput.current?.click()}><Upload className="h-3.5 w-3.5" />Upload job description</Button>
        <input ref={jdInput} type="file" accept=".pdf,.txt,application/pdf,text/plain" className="hidden" onChange={(e) => { void pickJd(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}

function DemoFeedback({ runId, grade }: { runId: string; grade: InterviewGrade }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const send = async () => {
    if (!rating) return void toast.error("Pick a star rating first.");
    setState("sending");
    try { await sendDemoFeedback({ data: { runId, rating, comment, score: grade.overall } }); setState("done"); }
    catch (e) { setState("idle"); toast.error((e as Error).message); }
  };
  if (state === "done") return <section className="panel p-6 text-center"><b>Thanks for the feedback!</b> <span className="text-muted-foreground">It goes straight to the JobMaxxing team.</span></section>;
  return (
    <section aria-label="Your feedback" className="panel space-y-4 p-6">
      <div>
        <h2 className="font-display text-2xl font-bold">How was the demo?</h2>
        <p className="text-sm text-muted-foreground">Your rating and comments are shared anonymously with the team.</p>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setRating(n)} className="p-1 text-primary">
            <Star className={cn("h-7 w-7", n <= rating && "fill-current")} />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} placeholder="What worked, what felt off, what would make you use it?" />
      <Button onClick={() => void send()} disabled={state === "sending"}>{state === "sending" && <Loader2 className="animate-spin" />}Send feedback</Button>
    </section>
  );
}
