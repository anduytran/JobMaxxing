import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { InterviewFlow, type InterviewApi } from "@/components/InterviewFlow";
import { useGame } from "@/lib/game";
import {
  fetchJobPosting, generateInterviewQuestions, getInterviewAgents, gradeInterviewTranscript, parseJobDescription, parseJobUrl, saveSoloSession, sendInterviewTurn, speakInterviewLine, getScribeToken, startLiveInterview,
} from "@/lib/interview.functions";
import { awardRadarPracticeXp } from "@/lib/radar.functions";
import type { AgentStatus } from "@/lib/interview/types";

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
  errorComponent: ({ error }) => <div role="alert" className="p-10">{error.message}</div>,
});

const api: InterviewApi = {
  parseJob: (jd) => parseJobDescription({ data: { jd } }),
  fetchJob: (url) => fetchJobPosting({ data: { url } }),
  parseJobUrl: (url, hint) => parseJobUrl({ data: { url, hint } }),
  questions: (job, type, length) => generateInterviewQuestions({ data: { job, type, length, roast: false } }),
  saveSession: (job, type) => saveSoloSession({ data: { job, type } }) as Promise<{ id: string | null }>,
  startLive: (job, type, length, plan) => startLiveInterview({ data: { job, type, length, roast: false, plan } }),
  turn: (conversationId, text, phase, secondsLeft, lastQuestion) => sendInterviewTurn({ data: { conversationId, text, phase, secondsLeft, lastQuestion } }),
  speak: async (text) => (await speakInterviewLine({ data: { text } })).audio,
  scribeToken: async () => (await getScribeToken()).token,
  grade: (transcript, job, plan, type, sessionId) => gradeInterviewTranscript({ data: { transcript, job, plan, sessionId, type } }),
};

function Interview() {
  const agents = Route.useLoaderData() as AgentStatus;
  const search = Route.useSearch();
  const { completeQuest, claimInterviewXp, details, captions } = useGame();
  return (
    <InterviewFlow
      agents={agents} api={api} radar={search.radar} profileSkills={details.skills} captionsPref={captions}
      onGraded={async (g, savedId, radarJobId) => {
        completeQuest("mock1");
        const ivId = g.sessionId ?? savedId; if (g.xp > 0 && ivId) claimInterviewXp("solo", ivId);
        // A tailored practice for a Job Radar role pays a one-time +50 XP bonus.
        if (radarJobId) {
          const radarXp = await awardRadarPracticeXp({ data: { jobId: radarJobId } }).catch(() => null);
          if (radarXp?.ok && radarXp.awarded) toast.success("Tailored practice complete", { description: `+${radarXp.awarded} XP for practicing a Job Radar role.` });
        }
      }}
    />
  );
}
