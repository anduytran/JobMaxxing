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
    voice: key(ENV.voice) && key("ELEVENLABS_INTERVIEW_AGENT_ID") ? "elevenlabs" : "browser",
  };
}

/** Send one message to a Raia agent and parse its JSON reply. Returns null on any failure. */
async function askRaia<T>(secretEnv: string, message: string, context: string): Promise<T | null> {
  const secret = key(secretEnv);
  if (!secret) return null;
  const headers = { "Agent-Secret-Key": secret, "Content-Type": "application/json" };
  try {
    const conv = await fetch(`${RAIA}/conversations`, {
      method: "POST", headers,
      body: JSON.stringify({ title: "DevUp mock interview", conversationUserId: "devup-demo-user" }),
    });
    if (!conv.ok) { console.error("Raia conversation failed", conv.status, await conv.text()); return null; }
    const { id } = (await conv.json()) as { id: string };
    const res = await fetch(`${RAIA}/conversations/${id}/messages`, {
      method: "POST", headers, body: JSON.stringify({ message, context }),
    });
    if (!res.ok) { console.error("Raia message failed", res.status, await res.text()); return null; }
    const body = (await res.json()) as { message?: string; content?: string };
    const text = body.message ?? body.content ?? "";
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
  return { title, summary: jd.replace(/\s+/g, " ").slice(0, 280), skills, qualifications };
}

export async function parseJob(jd: string): Promise<ParsedJob> {
  const ai = await askRaia<ParsedJob>(ENV.parser, jd,
    "Extract {title, summary, skills[], qualifications[]} from this job description. Reply with JSON only.");
  return ai && Array.isArray(ai.skills) ? ai : fallbackParse(jd);
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
  return [{ id: "q0", kind: "behavioral", text: opener, skill: null }, ...out].slice(0, count);
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
