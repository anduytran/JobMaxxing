// Server-only agent adapters for the mock interview pipeline.
// Each stage tries its configured Raia agent (via its Agent-Secret-Key env var);
// when no agent is configured it uses a deterministic built-in fallback.
import type {
  AgentStatus, InterviewGrade, InterviewLength, InterviewQuestion, InterviewType, ParsedJob, TranscriptTurn,
} from "./types";
import { LENGTHS } from "./types";

const RAIA = "https://api.raia2.com/external";
const ENV = {
  parser: "RAIA_JOB_PARSER_AGENT_SECRET_KEY",
  questions: "RAIA_QUESTION_AGENT_SECRET_KEY",
  grader: "RAIA_GRADER_AGENT_SECRET_KEY",
  voice: "ELEVENLABS_API_KEY",
} as const;

const key = (name: string) => process.env[name]?.trim() || undefined;

export function agentStatus(): AgentStatus {
  return {
    parser: key(ENV.parser) ? "raia" : "fallback",
    questions: key(ENV.questions) ? "raia" : "fallback",
    grader: key(ENV.grader) ? "raia" : "fallback",
    voice: key(ENV.voice) ? "elevenlabs" : "browser",
  };
}

/** Send one prompt to a Raia agent and parse its JSON reply. Returns null on any failure.
 *  Uses the stateless /external/prompts endpoint — no conversation user required. */
async function askRaia<T>(secretEnv: string, message: string, context: string): Promise<T | null> {
  const secret = key(secretEnv);
  if (!secret) return null;
  try {
    const res = await fetch(`${RAIA}/prompts`, {
      method: "POST",
      headers: { "Agent-Secret-Key": secret, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: context ? `${context}\n\n${message}` : message }),
    });
    if (!res.ok) { console.error("Raia prompt failed", res.status, await res.text()); return null; }
    const body = (await res.json()) as { response?: string };
    const text = body.response ?? "";
    return JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)) as T;
  } catch (err) {
    console.error("Raia agent error", err);
    return null;
  }
}

// ---------- Job parsing ----------
const SKILLS = [
  "JavaScript", "TypeScript", "React", "Node.js", "Python", "Java", "Go", "Rust", "C++", "C#", "SQL", "PostgreSQL",
  "MongoDB", "Redis", "GraphQL", "REST", "AWS", "GCP", "Azure", "Docker", "Kubernetes", "Terraform", "CI/CD",
  "Git", "Linux", "Next.js", "Vue", "Angular", "Tailwind", "Kafka", "Microservices", "System Design",
  "Machine Learning", "Testing", "Agile", "Leadership", "Communication",
];

function fallbackParse(jd: string): ParsedJob {
  const lower = jd.toLowerCase();
  const skills = SKILLS.filter((s) => lower.includes(s.toLowerCase()));
  const lines = jd.split(/\n|•|·|;/).map((l) => l.replace(/^[-*\s]+/, "").trim()).filter(Boolean);
  const qualifications = lines
    .filter((l) => /(years?|degree|experience|proficien|required|must|bachelor|master|familiar)/i.test(l))
    .slice(0, 8);
  const title = lines[0] && lines[0].length < 80 ? lines[0] : null;
  const loc = jd.match(/(?:location|based in|located in)[:\s]+([^\n.,;]+)/i);
  return { title, summary: jd.replace(/\s+/g, " ").slice(0, 280), skills, qualifications, location: loc?.[1]?.trim() ?? null, specialNotes: [] };
}

export async function parseJob(jd: string): Promise<ParsedJob> {
  const ai = await askRaia<ParsedJob>(ENV.parser, jd,
    "Extract from this job description: title (role title or null), summary (2-3 sentence description of the role), " +
    "skills[] (every skill, tool, or technology listed), qualifications[] (requirements like years of experience or degrees), " +
    "location (city/region/remote status or null), specialNotes[] (anything notable: visa, travel, on-call, clearance, perks). " +
    "Reply with JSON only: {title, summary, skills, qualifications, location, specialNotes}.");
  if (ai && Array.isArray(ai.skills)) {
    return {
      title: ai.title ?? null,
      summary: ai.summary ?? "",
      skills: ai.skills,
      qualifications: Array.isArray(ai.qualifications) ? ai.qualifications : [],
      location: ai.location ?? null,
      specialNotes: Array.isArray(ai.specialNotes) ? ai.specialNotes : [],
    };
  }
  return fallbackParse(jd);
}

// ---------- Question generation ----------
const TECH = [
  (s: string) => `Walk me through a project where you used ${s}. What trade-offs did you make?`,
  (s: string) => `How would you debug a production issue in a ${s} system you didn't write?`,
  (s: string) => `What's a common pitfall with ${s}, and how do you avoid it?`,
  (s: string) => `How would you design a scalable feature for this role using ${s}?`,
];
const BEHAV = [
  "Tell me about a time you disagreed with a teammate. How did you resolve it?",
  "Describe a project that failed or slipped. What did you learn?",
  "Tell me about a time you had to learn something quickly to deliver.",
  "Describe a moment you took ownership beyond your assigned work.",
  "How do you prioritize when everything feels urgent?",
];

function fallbackQuestions(job: ParsedJob, type: InterviewType, count: number, roast: boolean): InterviewQuestion[] {
  const skills = job.skills.length ? job.skills : ["your main stack"];
  const out: InterviewQuestion[] = [];
  for (let i = 0; out.length < count; i++) {
    const tech = type === "technical" || (type === "mixed" && i % 2 === 1);
    const skill = skills[i % skills.length] ?? null;
    let text = tech ? TECH[i % TECH.length]!(skill ?? "your stack") : BEHAV[i % BEHAV.length]!;
    if (roast) text = `${text} And skip the buzzwords.`;
    out.push({ id: `q${i + 1}`, kind: tech ? "technical" : "behavioral", text, skill: tech ? skill : null });
  }
  const opener = job.title ? `Thanks for joining. Why are you interested in the ${job.title} role?` : "Thanks for joining. Tell me briefly about yourself.";
  const first: InterviewQuestion = { id: "q0", kind: "behavioral", text: opener, skill: null };
  return [first, ...out].slice(0, count);
}

export async function generateQuestions(job: ParsedJob, type: InterviewType, length: InterviewLength, roast: boolean) {
  const count = LENGTHS[length].questions;
  const ai = await askRaia<{ questions: InterviewQuestion[] }>(ENV.questions, JSON.stringify(job),
    `Generate ${count} ${type} interview questions for this job. Tone: ${roast ? "tough, blunt" : "friendly"}. ` +
    `Reply JSON {questions:[{id,kind:"technical"|"behavioral",text,skill}]}.`);
  return ai?.questions?.length ? ai.questions.slice(0, count) : fallbackQuestions(job, type, count, roast);
}

// ---------- Grading ----------
const FILLER = /\b(um+|uh+|like|basically|actually|literally|you know|kind of|sort of)\b/gi;
const JARGON = /\b(synergy|leverage|paradigm|holistic|best-in-class|robust|scalable solution|cutting[- ]edge)\b/gi;
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function fallbackGrade(t: TranscriptTurn[], job: ParsedJob): InterviewGrade {
  const answers = t.filter((x) => x.speaker === "candidate" && x.phase === "interview").map((x) => x.text);
  const asked = t.filter((x) => x.speaker === "candidate" && x.phase === "candidate_questions").map((x) => x.text);
  const words = answers.map((a) => a.split(/\s+/).filter(Boolean).length);
  const avg = words.length ? words.reduce((a, b) => a + b, 0) / words.length : 0;
  const all = answers.join(" ");
  const skillHits = job.skills.filter((s) => all.toLowerCase().includes(s.toLowerCase())).length;
  const star = (all.match(/\b(situation|task|result|impact|because|so that|measured|\d+%)\b/gi) ?? []).length;

  const quality = clamp(answers.length ? 35 + Math.min(avg, 80) * 0.4 + skillHits * 6 + star * 3 : 0);
  const filler = (all.match(FILLER) ?? []).length + (all.match(JARGON) ?? []).length * 2;
  const lenPenalty = avg > 140 ? (avg - 140) * 0.3 : avg < 15 ? (15 - avg) * 2 : 0;
  const concise = clamp(answers.length ? 90 - lenPenalty - (filler / Math.max(1, words.reduce((a, b) => a + b, 0))) * 400 : 0);
  const goodQs = asked.filter((q) => q.split(/\s+/).length >= 6).length;
  const cq = clamp(asked.length ? 40 + goodQs * 25 + (asked.some((q) => /team|growth|success|challenge|roadmap/i.test(q)) ? 15 : 0) : 10);

  const overall = clamp(quality * 0.5 + concise * 0.3 + cq * 0.2);
  const strengths: string[] = [];
  const improvements: string[] = [];
  if (skillHits) strengths.push(`Referenced ${skillHits} skill(s) from the job description.`);
  else improvements.push("Tie answers back to the skills listed in the job description.");
  if (star >= 2) strengths.push("Gave concrete reasons and results."); else improvements.push("Use the STAR method — end with a measurable result.");
  if (avg > 140) improvements.push("Answers ran long; aim for 60–120 words each.");
  if (avg && avg < 15) improvements.push("Answers were very short; add one example per answer.");
  if (filler > 4) improvements.push("Cut filler words and buzzwords.");
  if (!asked.length) improvements.push("Always ask the interviewer at least one thoughtful question.");
  else if (goodQs) strengths.push("Asked thoughtful questions at the end.");

  return {
    overall,
    xp: Math.round(overall * 3) + goodQs * 25,
    metrics: {
      quality: { score: quality, feedback: `${answers.length} answers, ~${Math.round(avg)} words each.` },
      conciseness: { score: concise, feedback: filler ? `${filler} filler/jargon hits detected.` : "Clean, direct delivery." },
      candidateQuestions: { score: cq, feedback: asked.length ? `You asked ${asked.length} question(s).` : "No questions asked." },
      tone: null,
    },
    strengths,
    improvements,
  };
}

export async function gradeInterview(transcript: TranscriptTurn[], job: ParsedJob): Promise<InterviewGrade> {
  const ai = await askRaia<InterviewGrade>(ENV.grader, JSON.stringify({ job, transcript }),
    "Grade this mock interview on quality/accuracy, conciseness, the candidate's own questions, and tone if measurable. " +
    "Reply JSON {overall,xp,metrics:{quality:{score,feedback},conciseness:{score,feedback},candidateQuestions:{score,feedback},tone:null|{score,feedback}},strengths[],improvements[]}; scores 0-100, xp 0-400.");
  if (ai && typeof ai.overall === "number") return { ...ai, xp: Math.max(0, Math.min(400, Math.round(ai.xp))) };
  return fallbackGrade(transcript, job);
}

// ---------- Live interview conversation (Raia conversations endpoint) ----------
// The Question agent holds the running dialogue: each candidate turn is posted to the same
// conversation and the agent replies with one concise spoken line.

async function raiaPost<T>(secret: string, path: string, body: unknown): Promise<T> {
  const res = await fetch(`${RAIA}${path}`, {
    method: "POST",
    headers: { "Agent-Secret-Key": secret, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Raia ${path} failed [${res.status}]: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/** The Question agent answers in its JSON schema; pull out the line to speak. */
function spokenLine(raw: string): string {
  try {
    const j = JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)) as { questions?: { text?: string }[] };
    const t = j.questions?.map((q) => q.text).filter(Boolean).join(" ");
    if (t) return t;
  } catch { /* plain text reply */ }
  return raw.trim();
}

const TURN_RULES =
  "You are the live interviewer in a spoken mock interview. Speak naturally and concisely: at most 2 short sentences per turn " +
  "(optionally a brief acknowledgment of the candidate's last answer, then ONE question). Never list multiple questions. " +
  "Put your entire spoken line in questions[0].text.";

export async function startInterviewConversation(opts: {
  userId: string; name: string; job: ParsedJob; type: InterviewType; length: InterviewLength; roast: boolean; plan: InterviewQuestion[];
}): Promise<{ conversationId: string; reply: string } | null> {
  const secret = key(ENV.questions);
  if (!secret) return null;
  try {
    const [first = "DevUp", ...rest] = opts.name.trim().split(/\s+/);
    const user = await raiaPost<{ id: string }>(secret, "/users", {
      firstName: first, lastName: rest.join(" ") || "Candidate", fkId: opts.userId, source: "devup",
    });
    const context =
      `${TURN_RULES}\nTone: ${opts.roast ? "tough and blunt" : "friendly and professional"}. Interview type: ${opts.type}. ` +
      `Budget: about ${LENGTHS[opts.length].questions} questions in ~${Math.round(LENGTHS[opts.length].seconds / 60)} minutes.\n` +
      `Job: ${JSON.stringify(opts.job)}\nQuestion plan (adapt follow-ups to the answers): ${JSON.stringify(opts.plan.map((q) => q.text))}`;
    const conv = await raiaPost<{ id: string }>(secret, "/conversations", {
      conversationUserId: user.id, title: `Mock interview: ${opts.job.title ?? "role"}`.slice(0, 255), context: context.slice(0, 250000),
    });
    const msg = await raiaPost<{ message: string }>(secret, `/conversations/${conv.id}/messages`, {
      message: "The candidate has joined. Greet them in one short sentence and ask your first question.",
      context: TURN_RULES,
    });
    return { conversationId: conv.id, reply: spokenLine(msg.message) };
  } catch (err) {
    console.error("Raia conversation start failed", err);
    return null;
  }
}

export async function continueInterviewConversation(opts: {
  conversationId: string; text: string; phase: TranscriptTurn["phase"]; secondsLeft: number; lastQuestion: boolean;
}): Promise<string | null> {
  const secret = key(ENV.questions);
  if (!secret) return null;
  const steer =
    opts.phase === "candidate_questions"
      ? "The candidate is now asking YOU questions about the role. Answer briefly and honestly (you are an AI, not the company), then ask if they have anything else."
      : opts.lastQuestion || opts.secondsLeft < 20
        ? "Time is nearly up. Acknowledge the answer in one sentence and ask whether the candidate has any questions for you."
        : `About ${Math.max(0, Math.round(opts.secondsLeft))} seconds remain. Acknowledge briefly, then ask the next question (a follow-up if the answer was vague).`;
  try {
    const msg = await raiaPost<{ message: string }>(secret, `/conversations/${opts.conversationId}/messages`, {
      message: opts.text,
      context: `${TURN_RULES} ${steer}`,
    });
    return spokenLine(msg.message);
  } catch (err) {
    console.error("Raia conversation turn failed", err);
    return null;
  }
}

// ---------- ElevenLabs voice ----------
const VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George

export async function synthesize(text: string): Promise<string | null> {
  const apiKey = key(ENV.voice);
  if (!apiKey) return null;
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ text, model_id: "eleven_turbo_v2_5", voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3 } }),
  });
  if (!res.ok) { console.error("ElevenLabs TTS failed", res.status, await res.text()); return null; }
  const bytes = new Uint8Array(await res.arrayBuffer());
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
