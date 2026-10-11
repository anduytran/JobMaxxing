// Public demo interviews: anyone holding a secret demo link can run the full
// interview flow without an account. Nothing is written to any user — a demo
// "run" only tracks its call budget and Raia conversation, and the visitor's
// closing feedback is stored against the link for the editor to read.
import { createServerFn } from "@tanstack/react-start";
import { LENGTHS, type InterviewLength, type InterviewQuestion, type InterviewType, type ParsedJob, type TranscriptTurn } from "./interview/types";

const TYPES: InterviewType[] = ["technical", "behavioral", "mixed", "resume"];
const LENS = Object.keys(LENGTHS) as InterviewLength[];
const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const UUID = /^[0-9a-f-]{36}$/i;
/** Per-run ceiling on server calls (parse, questions, turns, voice) and lifetime. */
const RUN_CALLS = 220;
const RUN_HOURS = 4;

const tokenOf = (v: unknown) => (typeof v === "string" && TOKEN.test(v) ? v : null);
const runOf = (v: unknown) => {
  if (typeof v !== "string" || !UUID.test(v)) throw new Error("This demo session has ended. Reload the link to start again.");
  return v;
};

/** Spends one call from the run's budget; throws when the run or its link is no longer valid. */
async function useRun(runId: string): Promise<{ token: string; conversationId: string | null }> {
  const { neonExecute } = await import("./neon.server");
  const { rows } = await neonExecute(
    `update public.devup_demo_run r set calls = r.calls + 1
       from public.devup_demo_link l
      where r.id = $1::uuid and l.token = r.token and not l.revoked
        and r.calls < $2 and r.created_at > now() - make_interval(hours => $3)
     returning r.token, r.conversation_id`,
    [runId, RUN_CALLS, RUN_HOURS],
  );
  const r = rows[0];
  if (!r) throw new Error("This demo session has ended. Reload the link to start again.");
  return { token: String(r["token"]), conversationId: (r["conversation_id"] as string | null) ?? null };
}

const cleanJob = (j: ParsedJob): ParsedJob => ({
  title: j?.title ? String(j.title).slice(0, 200) : null,
  company: j?.company ? String(j.company).slice(0, 200) : null,
  location: j?.location ? String(j.location).slice(0, 200) : null,
  summary: String(j?.summary ?? "").slice(0, 2000),
  skills: (Array.isArray(j?.skills) ? j.skills : []).slice(0, 30).map((s) => String(s).slice(0, 80)),
  qualifications: (Array.isArray(j?.qualifications) ? j.qualifications : []).slice(0, 20).map((s) => String(s).slice(0, 400)),
  specialNotes: (Array.isArray(j?.specialNotes) ? j.specialNotes : []).slice(0, 10).map((s) => String(s).slice(0, 400)),
} as ParsedJob);

/** Is this link usable? Public: reveals only the label and whether uses remain. */
export const checkDemoLink = createServerFn({ method: "GET" })
  .inputValidator((i: { token: unknown }) => ({ token: tokenOf(i?.token) }))
  .handler(async ({ data }) => {
    if (!data.token) return { ok: false as const };
    const { neonExecute } = await import("./neon.server");
    const { rows } = await neonExecute(
      "select label, max_uses - uses as left from public.devup_demo_link where token = $1 and not revoked",
      [data.token],
    );
    const r = rows[0];
    if (!r) return { ok: false as const };
    return { ok: true as const, label: String(r["label"]), usesLeft: Math.max(0, Number(r["left"])) };
  });

/** Starts a demo run, spending one use of the link. */
export const beginDemoRun = createServerFn({ method: "POST" })
  .inputValidator((i: { token: unknown }) => ({ token: tokenOf(i?.token) }))
  .handler(async ({ data }) => {
    if (!data.token) throw new Error("This demo link isn't valid.");
    const { neonExecute } = await import("./neon.server");
    const { rows } = await neonExecute(
      `with l as (
         update public.devup_demo_link set uses = uses + 1
          where token = $1 and not revoked and uses < max_uses returning token
       )
       insert into public.devup_demo_run (token) select token from l returning id::text as id`,
      [data.token],
    );
    const id = rows[0]?.["id"];
    if (!id) throw new Error("This demo link has been used up. Ask for a new one.");
    return { runId: String(id) };
  });

export const demoParseJob = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; jd: unknown }) => {
    const jd = String(i?.jd ?? "").trim().slice(0, 20000);
    if (jd.length < 40) throw new Error("Paste a bit more of the job description.");
    return { runId: runOf(i?.runId), jd };
  })
  .handler(async ({ data }) => {
    await useRun(data.runId);
    const { parseJob } = await import("./interview/agents.server");
    return parseJob(data.jd);
  });

export const demoQuestions = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; job: ParsedJob; type: unknown; length: unknown; resumeText?: unknown }) => ({
    runId: runOf(i?.runId),
    job: cleanJob(i.job),
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
    length: (LENS.includes(i.length as InterviewLength) ? i.length : "standard") as InterviewLength,
    resumeText: typeof i.resumeText === "string" ? i.resumeText.slice(0, 6000) : "",
  }))
  .handler(async ({ data }) => {
    await useRun(data.runId);
    const { generateQuestions } = await import("./interview/agents.server");
    return generateQuestions(data.job, data.type, data.length, false, data.resumeText || undefined);
  });

export const demoStartLive = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; job: ParsedJob; type: unknown; length: unknown; plan: InterviewQuestion[] }) => ({
    runId: runOf(i?.runId),
    job: cleanJob(i.job),
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
    length: (LENS.includes(i.length as InterviewLength) ? i.length : "standard") as InterviewLength,
    plan: (Array.isArray(i.plan) ? i.plan.slice(0, 12) : []).map((q) => ({
      id: String(q.id).slice(0, 40), kind: q.kind === "technical" ? "technical" as const : "behavioral" as const,
      text: String(q.text).slice(0, 2000), skill: q.skill ? String(q.skill).slice(0, 100) : null,
      ...(q.probe ? { probe: String(q.probe).slice(0, 1000) } : {}),
    })) as InterviewQuestion[],
  }))
  .handler(async ({ data }) => {
    const run = await useRun(data.runId);
    const { startInterviewConversation } = await import("./interview/agents.server");
    // One Raia guest per link keeps the agent's user list tidy; the conversation itself is per run.
    const live = await startInterviewConversation({
      userId: `demo:${run.token}`, name: "Demo Guest", job: data.job, type: data.type, length: data.length, roast: false, plan: data.plan,
    });
    if (live) {
      const { neonExecute } = await import("./neon.server");
      await neonExecute("update public.devup_demo_run set conversation_id = $2 where id = $1::uuid", [data.runId, live.conversationId]);
    }
    return live;
  });

/** Continues only the conversation this run started — the id never comes from the browser. */
export const demoTurn = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; text: unknown; phase: unknown; secondsLeft: unknown; lastQuestion: unknown }) => {
    const text = String(i?.text ?? "").trim().slice(0, 4000);
    if (!text) throw new Error("Empty answer.");
    return {
      runId: runOf(i?.runId), text,
      phase: (i.phase === "candidate_questions" ? "candidate_questions" : "interview") as TranscriptTurn["phase"],
      secondsLeft: Number(i.secondsLeft) || 0,
      lastQuestion: i.lastQuestion === true,
    };
  })
  .handler(async ({ data }) => {
    const run = await useRun(data.runId);
    if (!run.conversationId) return null;
    const { continueInterviewConversation } = await import("./interview/agents.server");
    return continueInterviewConversation({ conversationId: run.conversationId, text: data.text, phase: data.phase, secondsLeft: data.secondsLeft, lastQuestion: data.lastQuestion });
  });

export const demoSpeak = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; text: unknown }) => {
    const text = String(i?.text ?? "").trim().slice(0, 1200);
    if (!text) throw new Error("Nothing to say.");
    return { runId: runOf(i?.runId), text };
  })
  .handler(async ({ data }) => {
    await useRun(data.runId);
    const { synthesize } = await import("./interview/agents.server");
    return { audio: await synthesize(data.text) };
  });

export const demoScribeToken = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown }) => ({ runId: runOf(i?.runId) }))
  .handler(async ({ data }) => {
    await useRun(data.runId);
    const key = process.env["ELEVENLABS_API_KEY"];
    if (!key) return { token: null as string | null };
    const res = await fetch("https://api.elevenlabs.io/v1/single-use-token/realtime_scribe", { method: "POST", headers: { "xi-api-key": key } });
    if (!res.ok) { console.error("Scribe token failed", res.status, await res.text()); return { token: null as string | null }; }
    const body = (await res.json()) as { token?: string };
    return { token: body.token ?? null };
  });

export const demoGrade = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; transcript: TranscriptTurn[]; job: ParsedJob }) => {
    if (!Array.isArray(i?.transcript) || i.transcript.length > 200) throw new Error("Invalid transcript.");
    return {
      runId: runOf(i.runId),
      job: cleanJob(i.job),
      transcript: i.transcript.map((t) => ({
        speaker: t.speaker === "interviewer" ? "interviewer" as const : "candidate" as const,
        phase: t.phase === "candidate_questions" ? "candidate_questions" as const : "interview" as const,
        text: String(t.text ?? "").slice(0, 4000),
        ...(t.questionId ? { questionId: String(t.questionId).slice(0, 40) } : {}),
      })) as TranscriptTurn[],
    };
  })
  .handler(async ({ data }) => {
    await useRun(data.runId);
    const { gradeInterview } = await import("./interview/agents.server");
    const grade = await gradeInterview(data.transcript, data.job);
    return { ...grade, ratings: [] as { skill: string; before: number; after: number }[], sessionId: null as string | null };
  });

/** The visitor's closing feedback — once per run. */
export const sendDemoFeedback = createServerFn({ method: "POST" })
  .inputValidator((i: { runId: unknown; rating: unknown; comment: unknown; score: unknown }) => {
    const rating = Math.round(Number(i?.rating));
    if (!(rating >= 1 && rating <= 5)) throw new Error("Pick a rating from 1 to 5.");
    const score = Math.round(Number(i?.score));
    return {
      runId: runOf(i?.runId), rating,
      comment: String(i?.comment ?? "").trim().slice(0, 2000) || null,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    };
  })
  .handler(async ({ data }) => {
    const { neonExecute } = await import("./neon.server");
    const { rows } = await neonExecute(
      `insert into public.devup_demo_feedback (token, run_id, rating, comment, score)
       select token, id, $2, $3, $4 from public.devup_demo_run where id = $1::uuid
       on conflict (run_id) do nothing returning id`,
      [data.runId, data.rating, data.comment, data.score],
    );
    return { ok: true, saved: rows.length > 0 };
  });

// ---------- editor: links and feedback (Settings) ----------

async function requireEditor() {
  const { currentUser } = await import("./auth.server");
  const { LAYOUT_EDITOR_EMAIL } = await import("./layout.functions");
  const user = await currentUser();
  if (!user || user.email.toLowerCase() !== LAYOUT_EDITOR_EMAIL) return null;
  return user;
}

export type DemoAdmin = {
  links: { token: string; label: string; maxUses: number; uses: number; revoked: boolean; createdAt: string }[];
  feedback: { id: string; label: string; rating: number; comment: string | null; score: number | null; createdAt: string }[];
};

/** Null for everyone except the editor account. */
export const getDemoAdmin = createServerFn({ method: "GET" }).handler(async (): Promise<DemoAdmin | null> => {
  if (!(await requireEditor())) return null;
  const { neonExecute } = await import("./neon.server");
  const { results } = await neonExecute<{ results: { rows: Record<string, unknown>[] }[] }>([
    { query: "select token, label, max_uses, uses, revoked, created_at from public.devup_demo_link order by created_at desc limit 50", params: [] },
    { query: `select f.id::text as id, l.label, f.rating, f.comment, f.score, f.created_at
                from public.devup_demo_feedback f join public.devup_demo_link l on l.token = f.token
               order by f.created_at desc limit 100`, params: [] },
  ]);
  return {
    links: (results[0]?.rows ?? []).map((r) => ({
      token: String(r["token"]), label: String(r["label"]), maxUses: Number(r["max_uses"]), uses: Number(r["uses"]),
      revoked: Boolean(r["revoked"]), createdAt: String(r["created_at"]),
    })),
    feedback: (results[1]?.rows ?? []).map((r) => ({
      id: String(r["id"]), label: String(r["label"]), rating: Number(r["rating"]),
      comment: (r["comment"] as string | null) ?? null, score: r["score"] == null ? null : Number(r["score"]), createdAt: String(r["created_at"]),
    })),
  };
});

export const createDemoLink = createServerFn({ method: "POST" })
  .inputValidator((i: { label: unknown; maxUses: unknown }) => ({
    label: String(i?.label ?? "").trim().slice(0, 80) || "Demo link",
    maxUses: Math.max(1, Math.min(500, Math.round(Number(i?.maxUses)) || 10)),
  }))
  .handler(async ({ data }) => {
    const user = await requireEditor();
    if (!user) return { ok: false as const, error: "Only the editor account can create demo links." };
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const { neonExecute } = await import("./neon.server");
    await neonExecute(
      "insert into public.devup_demo_link (token, label, max_uses, created_by) values ($1, $2, $3, $4)",
      [token, data.label, data.maxUses, user.id],
    );
    return { ok: true as const, token };
  });

export const revokeDemoLink = createServerFn({ method: "POST" })
  .inputValidator((i: { token: unknown }) => ({ token: tokenOf(i?.token) }))
  .handler(async ({ data }) => {
    if (!(await requireEditor()) || !data.token) return { ok: false as const };
    const { neonExecute } = await import("./neon.server");
    await neonExecute("update public.devup_demo_link set revoked = true where token = $1", [data.token]);
    return { ok: true as const };
  });
