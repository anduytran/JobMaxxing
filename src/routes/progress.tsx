import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useGame } from "@/lib/game";
import { PageHeader } from "@/components/AppShell";
import { ResumeScoreCard } from "@/components/ResumeScoreCard";
import { SkillRadar } from "@/components/SkillRadar";
import { useInterviewModePicker } from "@/components/InterviewModePicker";
import { ApplicationTracker, CareerProgressCard, RecentXpCard, SavedInterviewsCard, StreakCard } from "@/components/CareerBoard";
import { getResumeDashboard, setGoalFixes, fixesSummary, totalAwarded } from "@/lib/resume.functions";
import { getCareerDashboard, type CareerDashboard } from "@/lib/career.functions";
import { requireAuth } from "@/lib/auth";
import type { ResumeGrade } from "@/lib/resume";

// /progress — career board: progression, resume score, skill web, streak,
// recent XP, application tracker and saved interviews.
export const Route = createFileRoute("/progress")({
  beforeLoad: requireAuth,
  head: () => ({ meta: [
    { title: "Career — JobMaxxing" },
    { name: "description", content: "Your career dashboard: level, XP, resume score, skill ratings, streaks, applications and saved interviews." },
  ] }),
  component: ProgressPage,
});

function ProgressPage() {
  const game = useGame();
  const [career, setCareer] = useState<CareerDashboard | null>(null);
  const [resume, setResume] = useState<ResumeGrade | null>(null);
  const [resumeDone, setResumeDone] = useState(0);
  const [resumePending, setResumePending] = useState(0);
  const [resumeAwarded, setResumeAwarded] = useState(0);
  const { openInterviewMode, interviewModeDialog } = useInterviewModePicker();

  const load = useCallback(() => {
    getCareerDashboard().then(setCareer).catch(() => {});
    getResumeDashboard().then(async (r) => {
      if (!r) { setResume(null); setResumeDone(0); setResumePending(0); setResumeAwarded(0); return; }
      const { grade, goalFixes } = r;
      setResume(grade);
      if (!goalFixes.length && grade) {
        const ids = grade.suggestions.map((s) => s.id);
        const award = await setGoalFixes({ data: { ids } });
        setResumeDone(0); setResumePending(ids.length);
        setResumeAwarded(totalAwarded(grade, award.ok ? award.totals : {}));
      } else {
        const f = fixesSummary(grade, goalFixes);
        setResumeDone(f.done); setResumePending(f.pending);
        setResumeAwarded(totalAwarded(grade, goalFixes));
      }
    }).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const shuffle = () => {
    if (!resume) return;
    const pool = resume.suggestions.map((s) => s.id);
    const pick = pool.sort(() => Math.random() - 0.5).slice(0, 3);
    setGoalFixes({ data: { ids: pick } }).then(() => {
      setResumeDone(0); setResumePending(pick.length);
    }).catch(() => {});
  };

  const questsDone = game.quests.filter((q) => q.done).length;

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6">
      <PageHeader title="Career" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <CareerProgressCard
            xp={game.xp} level={game.level} levelXp={game.levelXp} activeTitle={game.activeTitle}
            questsDone={questsDone} interviews={career?.interviewCount ?? 0} rolesSaved={career?.radar.length ?? 0}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ResumeScoreCard resume={resume} done={resumeDone} pending={resumePending} totalAwarded={resumeAwarded} onShuffle={shuffle} refreshing={false} />
        </div>
        <div className="min-w-0 lg:col-span-3">
          <SkillRadar onPractice={openInterviewMode} />
        </div>
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          {career && <StreakCard streak={career.streak} />}
          {career && <RecentXpCard events={career.xpEvents} />}
        </div>
        <div className="min-w-0 lg:col-span-3">
          {career && <ApplicationTracker rows={career.radar} />}
        </div>
        <div className="min-w-0 lg:col-span-2">
          {career && <SavedInterviewsCard items={career.solo} onChanged={load} />}
        </div>
      </div>
      {interviewModeDialog}
    </main>
  );
}
