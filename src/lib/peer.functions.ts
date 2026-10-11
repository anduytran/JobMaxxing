import { createServerFn } from "@tanstack/react-start";
import type { InterviewGrade, InterviewLength, InterviewQuestion, InterviewType, ParsedJob, TranscriptTurn } from "./interview/types";
import { MAX_STRIKES, moderate } from "./moderation";

// Peer interviews: two signed-in friends share one session row in Neon. The
// question plan comes from the same generator as the AI mock interview. Audio
// goes peer-to-peer over WebRTC (offer/answer signalled through this row);
// each side's own browser transcribes its speech into the shared transcript.
// Every line is moderated; the Grader grades both sides at the end.

export type PeerRole = "candidate" | "interviewer";
export type PeerQuestion = InterviewQuestion & { checklist: string[] };
export type PeerInterviewerGrade = {
  overall: number;
  xp: number;
  metrics: { quality: { score: number; feedback: string }; conciseness: { score: number; feedback: string }; followUps: { score: number; feedback: string }; tone: { score: number; feedback: string } | null };
  strengths: string[];
  improvements: string[];
};
export type PeerSession = {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  hostRole: PeerRole;
  job: ParsedJob;
  questions: PeerQuestion[];
  type: InterviewType;
  length: InterviewLength;
  status: "waiting" | "live" | "done";
  current: number;
  transcript: TranscriptTurn[];
  grade: InterviewGrade | null;
  interviewerGrade: PeerInterviewerGrade | null;
  grading: boolean;
  checks: Record<string, number[]>;
  signal: { offer?: string; answer?: string; video?: { host?: boolean; guest?: boolean }; ready?: { host?: boolean; guest?: boolean } };
  flag: string | null;
  strikes: Record<string, number>;
  startedAt: string | null;
  questionStartedAt: string | null;
  serverNow: string;
  meIsHost: boolean;
};

const TYPES = ["technical", "behavioral", "mixed", "resume"] as const;
const LENS = ["quick", "short", "standard", "long"] as const;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const makeCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

type Row = Record<string, unknown>;
const iso = (v: unknown) => (v ? new Date(String(v)).toISOString() : null);
const toSession = (r: Row, userId: string): PeerSession => {
  const grade = (r["grade"] as (InterviewGrade & { pending?: boolean }) | null) ?? null;
  return {
    id: String(r["id"]),
    code: String(r["code"]),
    hostId: String(r["host_id"]),
    hostName: String(r["host_name"]),
    guestId: r["guest_id"] ? String(r["guest_id"]) : null,
    guestName: r["guest_name"] ? String(r["guest_name"]) : null,
    hostRole: r["host_role"] === "interviewer" ? "interviewer" : "candidate",
    job: r["job"] as ParsedJob,
    questions: ((r["questions"] as PeerQuestion[]) ?? []).map((q) => ({ ...q, checklist: q.checklist ?? [] })),
    type: (TYPES.includes(r["type"] as InterviewType) ? r["type"] : "mixed") as InterviewType,
    length: (LENS.includes(r["length"] as InterviewLength) ? r["length"] : "standard") as InterviewLength,
    status: (["waiting", "live", "done"].includes(String(r["status"])) ? r["status"] : "waiting") as PeerSession["status"],
    current: Number(r["current"]) || 0,
    transcript: (r["transcript"] as TranscriptTurn[]) ?? [],
    grade: grade && !grade.pending ? grade : null,
    interviewerGrade: (r["interviewer_grade"] as PeerInterviewerGrade | null) ?? null,
    grading: !!grade?.pending,
    checks: (r["checks"] as Record<string, number[]>) ?? {},
    signal: (r["signal"] as PeerSession["signal"]) ?? {},
    flag: r["flag"] ? String(r["flag"]) : null,
    strikes: (r["strikes"] as Record<string, number>) ?? {},
    startedAt: iso(r["started_at"]),
    questionStartedAt: iso(r["question_started_at"]),
    serverNow: new Date().toISOString(),
    meIsHost: String(r["host_id"]) === userId,
  };
};

const roleOf = (s: PeerSession, userId: string): PeerRole =>
  (s.hostId === userId) === (s.hostRole === "interviewer") ? "interviewer" : "candidate";

async function me() {
  const { requireUser } = await import("./auth.server");
  return (await requireUser()) as { id: string; name?: string; email?: string };
}

async function loadForUser(id: string, userId: string): Promise<PeerSession> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid session.");
  const { neonQuery } = await import("./neon.server");
  const { rows } = await neonQuery(
    "select * from public.devup_peer_session where id = $1::uuid and (host_id = $2::uuid or guest_id = $2::uuid)",
    [id, userId],
  );
  if (!rows.length) throw new Error("Session not found.");
  return toSession(rows[0]!, userId);
}

export const createPeerSession = createServerFn({ method: "POST" })
  .inputValidator((i: { job: ParsedJob; questions: InterviewQuestion[]; type: unknown; length: unknown; role: unknown }) => ({
    job: i.job,
    questions: Array.isArray(i.questions) ? i.questions.slice(0, 12) : [],
    type: (TYPES.includes(i.type as InterviewType) ? i.type : "mixed") as InterviewType,
    length: (LENS.includes(i.length as InterviewLength) ? i.length : "standard") as InterviewLength,
    role: (i.role === "interviewer" ? "interviewer" : "candidate") as PeerRole,
  }))
  .handler(async ({ data }) => {
    if (!data.questions.length) throw new Error("No questions to practice with.");
    const user = await me();
    const { neonExecute } = await import("./neon.server");
    const { checklistFor } = await import("./interview/agents.server");
    const questions: PeerQuestion[] = data.questions.map((q) => ({ ...q, checklist: checklistFor(q) }));
    const name = user.name ?? user.email?.split("@")[0] ?? "Host";
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = makeCode();
      try {
        const { rows } = await neonExecute(
          `insert into public.devup_peer_session (code, host_id, host_name, host_role, job, questions, type, length)
           values ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, $8) returning id`,
          [code, user.id, name, data.role, JSON.stringify(data.job), JSON.stringify(questions), data.type, data.length],
        );
        return { id: String(rows[0]!["id"]), code };
      } catch (e) {
        if (attempt === 2 || !String((e as Error).message).includes("unique")) throw e;
      }
    }
    throw new Error("Could not create a session.");
  });

export const joinPeerSession = createServerFn({ method: "POST" })
  .inputValidator((i: { code: unknown }) => {
    const code = String(i.code ?? "").trim().toUpperCase();
    if (!/^[A-Z0-9]{6}$/.test(code)) throw new Error("Enter the 6-character code your friend shared.");
    return { code };
  })
  .handler(async ({ data }) => {
    const user = await me();
    const { neonExecute, neonQuery } = await import("./neon.server");
    const { rows } = await neonQuery("select * from public.devup_peer_session where code = $1", [data.code]);
    if (!rows.length) throw new Error("No session with that code.");
    const s = toSession(rows[0]!, user.id);
    if (s.hostId === user.id) return { id: s.id };
    if (s.guestId && s.guestId !== user.id) throw new Error("That session already has two people.");
    if (s.status === "done") throw new Error("That session is already finished.");
    const name = user.name ?? user.email?.split("@")[0] ?? "Guest";
    // The clock does NOT start here — it starts when both sides mark ready (peerReady).
    await neonExecute(
      "update public.devup_peer_session set guest_id = $2::uuid, guest_name = $3, status = 'live' where id = $1::uuid",
      [s.id, user.id, name],
    );
    return { id: s.id };
  });

export const getPeerSession = createServerFn({ method: "GET" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => loadForUser(data.id, (await me()).id));

// Interviewer moves on to the next planned question (reads it aloud over the call).
export const peerAskNext = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    if (s.status !== "live") throw new Error("The session is not live.");
    if (roleOf(s, user.id) !== "interviewer") throw new Error("Only the interviewer asks questions.");
    const q = s.questions[s.current];
    if (!q) throw new Error("No questions left.");
    const transcript: TranscriptTurn[] = [...s.transcript, { speaker: "interviewer", phase: "interview", text: q.text, questionId: q.id }];
    if (s.current + 1 >= s.questions.length) {
      transcript.push({ speaker: "interviewer", phase: "candidate_questions", text: "That covers my questions — do you have any questions for me?" });
    }
    const { neonExecute } = await import("./neon.server");
    await neonExecute(
      "update public.devup_peer_session set current = current + 1, question_started_at = now(), transcript = $2::jsonb where id = $1::uuid",
      [s.id, JSON.stringify(transcript)],
    );
    return { ok: true };
  });

// Either side adds a spoken (transcribed) or typed line. Every line is moderated first.
export const peerSay = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; text: unknown }) => {
    const text = String(i.text ?? "").trim().slice(0, 4000);
    if (!text) throw new Error("Nothing to send.");
    return { id: String(i.id ?? ""), text };
  })
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    if (s.status !== "live") throw new Error("The session is not live.");
    const role = roleOf(s, user.id);
    const { neonExecute } = await import("./neon.server");
    const verdict = moderate(data.text);
    if (verdict.level !== "ok") {
      const strikes = { ...s.strikes, [user.id]: (s.strikes[user.id] ?? 0) + 1 };
      const stop = verdict.level === "severe" || strikes[user.id]! >= MAX_STRIKES;
      const flag = stop ? `Stopped: ${verdict.reason} from the ${role}.` : null;
      await neonExecute(
        `update public.devup_peer_session set strikes = $2::jsonb, flag = coalesce(flag, $3), status = case when $3::text is null then status else 'done' end where id = $1::uuid`,
        [s.id, JSON.stringify(strikes), flag],
      );
      if (stop) return { ok: false, stopped: true, message: flag };
      return { ok: false, stopped: false, message: `Line not sent — ${verdict.reason!.toLowerCase()}. Strike ${strikes[user.id]}/${MAX_STRIKES}.` };
    }
    const asked = s.transcript.filter((t) => t.speaker === "interviewer" && t.phase === "interview").length;
    if (role === "candidate" && !asked) throw new Error("Wait for the first question.");
    const phase: TranscriptTurn["phase"] = s.current >= s.questions.length ? "candidate_questions" : "interview";
    const q = s.questions[Math.max(0, Math.min(asked - 1, s.questions.length - 1))];
    const turn: TranscriptTurn = { speaker: role, phase, text: data.text, questionId: q?.id };
    await neonExecute(
      "update public.devup_peer_session set transcript = transcript || $2::jsonb where id = $1::uuid",
      [s.id, JSON.stringify([turn])],
    );
    return { ok: true, stopped: false, message: null };
  });

// Interviewer's live checklist ticks for one question.
export const peerSetChecks = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; questionId: unknown; ticked: unknown }) => ({
    id: String(i.id ?? ""),
    questionId: String(i.questionId ?? "").slice(0, 60),
    ticked: Array.isArray(i.ticked) ? i.ticked.map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n < 10) : [],
  }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    if (roleOf(s, user.id) !== "interviewer") throw new Error("Only the interviewer keeps the checklist.");
    const { neonExecute } = await import("./neon.server");
    await neonExecute(
      "update public.devup_peer_session set checks = jsonb_set(checks, array[$2::text], $3::jsonb) where id = $1::uuid",
      [s.id, data.questionId, JSON.stringify(data.ticked)],
    );
    return { ok: true };
  });

// WebRTC signalling: the host posts the offer, the guest the answer (full SDP, ICE gathered).
// Writes are atomic jsonb updates so a late answer never clobbers a newer offer,
// and an answer is only stored when it answers the offer currently on the row.
export const peerSignal = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; sdp: unknown; reset?: unknown; forOffer?: unknown }) => ({
    id: String(i.id ?? ""), sdp: String(i.sdp ?? "").slice(0, 20000), reset: !!i.reset,
    forOffer: typeof i.forOffer === "string" ? i.forOffer.slice(0, 20000) : "",
  }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    const { neonExecute } = await import("./neon.server");
    if (s.meIsHost) {
      await neonExecute(
        "update public.devup_peer_session set signal = jsonb_build_object('offer', $2::text, 'video', coalesce(signal->'video', '{}'::jsonb)) where id = $1::uuid",
        [s.id, data.sdp],
      );
      return { ok: true };
    }
    await neonExecute(
      "update public.devup_peer_session set signal = jsonb_set(signal, '{answer}', to_jsonb($2::text)) where id = $1::uuid and signal->>'offer' = $3",
      [s.id, data.sdp, data.forOffer],
    );
    return { ok: true };
  });

// Webcam consent: each side opts in (or revokes) independently; video only
// flows when both flags are true. Stored on the signal row so both polls see it.
export const peerVideoConsent = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; on: unknown }) => ({ id: String(i.id ?? ""), on: !!i.on }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    const { neonExecute } = await import("./neon.server");
    const video = { ...(s.signal.video ?? {}), [s.meIsHost ? "host" : "guest"]: data.on };
    await neonExecute(
      "update public.devup_peer_session set signal = jsonb_set(signal, '{video}', $2::jsonb) where id = $1::uuid",
      [s.id, JSON.stringify(video)],
    );
    return { ok: true };
  });

// Ready handshake: each side opts in once the call is connected. The interview
// clock (started_at) only starts when both flags are true.
export const peerReady = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; on: unknown }) => ({ id: String(i.id ?? ""), on: !!i.on }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    if (s.status !== "live") throw new Error("The session is not live.");
    const { neonExecute } = await import("./neon.server");
    const ready = { ...(s.signal.ready ?? {}), [s.meIsHost ? "host" : "guest"]: data.on };
    const both = !!(ready.host && ready.guest);
    await neonExecute(
      `update public.devup_peer_session
       set signal = jsonb_set(signal, '{ready}', $2::jsonb),
           started_at = case when $3 and started_at is null then now() else started_at end
       where id = $1::uuid`,
      [s.id, JSON.stringify(ready), both],
    );
    return { ok: true, both };
  });

export const peerEndSession = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    if (s.status === "done") return { ok: true };
    const { neonExecute } = await import("./neon.server");
    await neonExecute("update public.devup_peer_session set status = 'done' where id = $1::uuid", [s.id]);
    return { ok: true };
  });

// Grade both sides once. The first caller claims the job; flagged sessions are not graded.
export const peerGrade = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => {
    const user = await me();
    const s = await loadForUser(data.id, user.id);
    if (s.status !== "done" || s.flag || s.grade) return { ok: true };
    const { neonExecute } = await import("./neon.server");
    const claim = await neonExecute(
      `update public.devup_peer_session set grade = '{"pending":true}'::jsonb
       where id = $1::uuid and (grade is null or (grade->>'pending' = 'true' and now() - coalesce(question_started_at, started_at, now()) > interval '10 minutes')) returning id`,
      [s.id],
    );
    if (!claim.rows.length) return { ok: true };
    const { gradeInterview, gradeInterviewer } = await import("./interview/agents.server");
    const asked = s.transcript.filter((t) => t.speaker === "interviewer" && t.phase === "interview").length;
    const total = s.questions.slice(0, asked).reduce((n, q) => n + q.checklist.length, 0);
    const ticked = Object.values(s.checks).reduce((n, a) => n + a.length, 0);
    try {
      const candidateId = s.hostRole === "candidate" ? s.hostId : s.guestId;
      const interviewerId = s.hostRole === "interviewer" ? s.hostId : s.guestId;
      const [candidate, interviewer] = await Promise.all([
        gradeInterview(s.transcript, s.job, candidateId ?? undefined),
        gradeInterviewer(s.transcript, s.job, { asked, ticked, total }, interviewerId ?? undefined),
      ]);
      await neonExecute(
        "update public.devup_peer_session set grade = $2::jsonb, interviewer_grade = $3::jsonb where id = $1::uuid",
        [s.id, JSON.stringify(candidate), JSON.stringify(interviewer)],
      );
      // Candidate's skill ratings move with the graded answer quality.
      const candidateId = s.hostRole === "candidate" ? s.hostId : s.guestId;
      if (candidateId) {
        const { applySessionRatings, scoredItems } = await import("./mmr.server");
        await applySessionRatings(candidateId, scoredItems(s.questions, asked, candidate.metrics.quality.score))
          .catch((e) => console.error("rating update failed", e));
      }
      // Skill Expert re-rates both people (candidate and interviewer) from this session.
      const interviewerId = s.hostRole === "interviewer" ? s.hostId : s.guestId;
      const { refreshSkills } = await import("./skills.server");
      const pick = (g: { overall: number; metrics: Record<string, { score: number } | null>; strengths: string[]; improvements: string[] }) => ({
        overall: g.overall, metrics: Object.fromEntries(Object.entries(g.metrics).map(([k, v]) => [k, v ? v.score : null])),
        strengths: g.strengths, improvements: g.improvements,
      });
      await Promise.all([
        candidateId && refreshSkills(candidateId, { kind: "peer interview (candidate)", job: s.job?.title ?? null, ...pick(candidate) }),
        interviewerId && refreshSkills(interviewerId, { kind: "peer interview (interviewer)", job: s.job?.title ?? null, ...pick(interviewer) }),
      ].map((p) => Promise.resolve(p).catch((e) => console.error("skill refresh failed", e))));
      // Both sides keep their daily streak alive with a graded session.
      const { bumpStreak } = await import("./career.functions");
      await Promise.all(
        [candidateId, interviewerId].filter(Boolean).map((id) => bumpStreak(id as string).catch((e) => console.error("streak update failed", e))),
      );
      // Save the session to both users' Career history.
      const jobTitle = s.job?.title ?? null;
      const peerType = (TYPES as readonly string[]).includes(s.type) ? s.type : s.questions.some((q) => q.kind === "technical") ? (s.questions.every((q) => q.kind === "technical") ? "technical" : "mixed") : "behavioral";
      await Promise.all([
        candidateId && neonExecute(
          `insert into public.devup_interview (user_id, job, type, overall, grade, transcript) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
          [candidateId, jobTitle, `peer ${peerType}`, Math.round(Number(candidate.overall) || 0), JSON.stringify(candidate), JSON.stringify(s.transcript)],
        ),
        interviewerId && neonExecute(
          `insert into public.devup_interview (user_id, job, type, overall, grade, transcript) values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
          [interviewerId, jobTitle, `peer ${peerType} (interviewer)`, Math.round(Number(interviewer.overall) || 0), JSON.stringify(interviewer), JSON.stringify(s.transcript)],
        ),
      ].map((p) => Promise.resolve(p).catch((e) => console.error("peer interview save failed", e))));
    } catch (e) {
      await neonExecute("update public.devup_peer_session set grade = null where id = $1::uuid", [s.id]);
      throw e;
    }
    return { ok: true };
  });
