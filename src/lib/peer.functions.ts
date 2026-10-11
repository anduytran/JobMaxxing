import { createServerFn } from "@tanstack/react-start";
import type { InterviewGrade, InterviewLength, InterviewQuestion, InterviewType, ParsedJob, TranscriptTurn } from "./interview/types";

// Peer interviews: two signed-in friends share one session row in Neon. The
// question plan comes from the same generator as the AI mock interview, but
// there is no voice agent and no Raia conversation — the friend reads the
// questions and the candidate types answers. Both sides poll getPeerSession.

export type PeerRole = "candidate" | "interviewer";
export type PeerSession = {
  id: string;
  code: string;
  hostId: string;
  hostName: string;
  guestId: string | null;
  guestName: string | null;
  hostRole: PeerRole;
  job: ParsedJob;
  questions: InterviewQuestion[];
  type: InterviewType;
  length: InterviewLength;
  status: "waiting" | "live" | "done";
  current: number;
  transcript: TranscriptTurn[];
  grade: InterviewGrade | null;
  /** Client-only marker: set by the page, never stored — which side am I? */
  _meIsHost?: boolean;
};

const TYPES = ["technical", "behavioral", "mixed"] as const;
const LENS = ["short", "standard", "long"] as const;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

const makeCode = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");

type Row = Record<string, unknown>;
const toSession = (r: Row): PeerSession => ({
  id: String(r.id),
  code: String(r.code),
  hostId: String(r.host_id),
  hostName: String(r.host_name),
  guestId: r.guest_id ? String(r.guest_id) : null,
  guestName: r.guest_name ? String(r.guest_name) : null,
  hostRole: r.host_role === "interviewer" ? "interviewer" : "candidate",
  job: r.job as ParsedJob,
  questions: (r.questions as InterviewQuestion[]) ?? [],
  type: (TYPES.includes(r.type as InterviewType) ? r.type : "mixed") as InterviewType,
  length: (LENS.includes(r.length as InterviewLength) ? r.length : "standard") as InterviewLength,
  status: (["waiting", "live", "done"].includes(String(r.status)) ? r.status : "waiting") as PeerSession["status"],
  current: Number(r.current) || 0,
  transcript: (r.transcript as TranscriptTurn[]) ?? [],
  grade: (r.grade as InterviewGrade | null) ?? null,
});

async function loadForUser(id: string, userId: string): Promise<PeerSession> {
  const { neonQuery } = await import("./neon.server");
  const { rows } = await neonQuery(
    "select * from public.devup_peer_session where id = $1::uuid and (host_id = $2::uuid or guest_id = $2::uuid)",
    [id, userId],
  );
  if (!rows.length) throw new Error("Session not found.");
  return toSession(rows[0]);
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
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string; name?: string; email?: string };
    const { neonExecute } = await import("./neon.server");
    const name = user.name ?? user.email?.split("@")[0] ?? "Host";
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = makeCode();
      try {
        const { rows } = await neonExecute(
          `insert into public.devup_peer_session (code, host_id, host_name, host_role, job, questions, type, length)
           values ($1, $2::uuid, $3, $4, $5::jsonb, $6::jsonb, $7, $8) returning id`,
          [code, user.id, name, data.role, JSON.stringify(data.job), JSON.stringify(data.questions), data.type, data.length],
        );
        return { id: String(rows[0].id), code };
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
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string; name?: string; email?: string };
    const { neonExecute, neonQuery } = await import("./neon.server");
    const { rows } = await neonQuery("select * from public.devup_peer_session where code = $1", [data.code]);
    if (!rows.length) throw new Error("No session with that code.");
    const s = toSession(rows[0]);
    if (s.hostId === user.id) return { id: s.id };
    if (s.guestId && s.guestId !== user.id) throw new Error("That session already has two people.");
    if (s.status === "done") throw new Error("That session is already finished.");
    const name = user.name ?? user.email?.split("@")[0] ?? "Guest";
    await neonExecute(
      "update public.devup_peer_session set guest_id = $2::uuid, guest_name = $3, status = 'live' where id = $1::uuid",
      [s.id, user.id, name],
    );
    return { id: s.id };
  });

export const getPeerSession = createServerFn({ method: "GET" })
  .inputValidator((i: { id: unknown }) => {
    const id = String(i.id ?? "");
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid session.");
    return { id };
  })
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string };
    return loadForUser(data.id, user.id);
  });

// Interviewer asks the next planned question.
export const peerAskNext = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string };
    const s = await loadForUser(data.id, user.id);
    if (s.status !== "live") throw new Error("The session is not live.");
    const amInterviewer = (s.hostId === user.id) === (s.hostRole === "interviewer");
    if (!amInterviewer) throw new Error("Only the interviewer asks questions.");
    const q = s.questions[s.current];
    if (!q) throw new Error("No questions left.");
    const last = s.current + 1 >= s.questions.length;
    const turn: TranscriptTurn = { speaker: "interviewer", phase: "interview", text: q.text, questionId: q.id };
    const transcript = [...s.transcript, turn];
    if (last) {
      transcript.push({ speaker: "interviewer", phase: "candidate_questions", text: "That covers my questions — do you have any questions for me?" });
    }
    const { neonExecute } = await import("./neon.server");
    await neonExecute(
      "update public.devup_peer_session set current = current + 1, transcript = $2::jsonb where id = $1::uuid",
      [s.id, JSON.stringify(transcript)],
    );
    return { ok: true };
  });

// Candidate answers (or asks their wrap-up question).
export const peerAnswer = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; text: unknown }) => {
    const text = String(i.text ?? "").trim().slice(0, 4000);
    if (!text) throw new Error("Empty answer.");
    return { id: String(i.id ?? ""), text };
  })
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string };
    const s = await loadForUser(data.id, user.id);
    if (s.status !== "live") throw new Error("The session is not live.");
    const amCandidate = (s.hostId === user.id) === (s.hostRole === "candidate");
    if (!amCandidate) throw new Error("Only the candidate answers.");
    const asked = s.transcript.filter((t) => t.speaker === "interviewer" && t.phase === "interview").length;
    if (!asked) throw new Error("Wait for the first question.");
    const phase: TranscriptTurn["phase"] = s.current >= s.questions.length ? "candidate_questions" : "interview";
    const q = s.questions[Math.min(asked - 1, s.questions.length - 1)];
    const transcript = [...s.transcript, { speaker: "candidate", phase, text: data.text, questionId: q?.id } satisfies TranscriptTurn];
    const { neonExecute } = await import("./neon.server");
    await neonExecute("update public.devup_peer_session set transcript = $2::jsonb where id = $1::uuid", [s.id, JSON.stringify(transcript)]);
    return { ok: true };
  });

// Either participant ends the session; the candidate's side grades it.
export const peerEndSession = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown }) => ({ id: String(i.id ?? "") }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string };
    const s = await loadForUser(data.id, user.id);
    if (s.status === "done") return { ok: true };
    const { neonExecute } = await import("./neon.server");
    await neonExecute("update public.devup_peer_session set status = 'done' where id = $1::uuid", [s.id]);
    return { ok: true };
  });

export const peerSaveGrade = createServerFn({ method: "POST" })
  .inputValidator((i: { id: unknown; grade: InterviewGrade }) => ({ id: String(i.id ?? ""), grade: i.grade }))
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = (await requireUser()) as { id: string };
    const s = await loadForUser(data.id, user.id);
    const { neonExecute } = await import("./neon.server");
    await neonExecute("update public.devup_peer_session set grade = $2::jsonb, status = 'done' where id = $1::uuid", [s.id, JSON.stringify(data.grade)]);
    return { ok: true };
  });
