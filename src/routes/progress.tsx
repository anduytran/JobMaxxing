import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useGame } from "@/lib/game";
import { PageHeader } from "@/components/AppShell";
import { ResumeScoreCard } from "@/components/ResumeScoreCard";
import { SkillRadar } from "@/components/SkillRadar";
import { useInterviewModePicker } from "@/components/InterviewModePicker";
import { ApplicationTracker, CareerProgressCard, RecentXpCard, RecordingsCard, SavedInterviewsCard, StreakCard } from "@/components/CareerBoard";
import { getLatestResumeReview } from "@/lib/resume.functions";
import { getCareerDashboard, type CareerDashboard } from "@/lib/career.functions";
import type { StoredReview } from "@/lib/resume";

// /progress — career board: progression, resume score, skill web, streak,
// recent XP, application tracker and saved interviews.
export const Route = createFileRoute("/progress")({
  head: () => ({ meta: [
    { title: "Career — JobMaxxing" },
    { name: "description", content: "Your career dashboard: level, XP, resume score, skill ratings, streaks, applications and saved interviews." },
  ] }),
  component: ProgressPage,
});

function ProgressPage() {
  const game = useGame();
  const [career, setCareer] = useState<CareerDashboard | null>(null);
  const [review, setReview] = useState<StoredReview | null>(null);
  const { openInterviewMode, interviewModeDialog } = useInterviewModePicker();

  const load = useCallback(() => {
    getCareerDashboard().then(setCareer).catch(() => {});
    getLatestResumeReview().then((r) => { if (r.ok) setReview(r.review); }).catch(() => {});
  }, []);

  useEffect(load, [load]);

  const questsDone = game.quests.filter((q) => q.done).length;

  return (
    <main className="mx-auto w-full max-w-[1700px] space-y-5 px-4 py-6">
      <PageHeader eyebrow="Your journey" title="Career" sub="Everything you've earned, practiced and applied for — in one place." />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="min-w-0 lg:col-span-3">
          <CareerProgressCard
            xp={game.xp} level={game.level} levelXp={game.levelXp} activeTitle={game.activeTitle}
            questsDone={questsDone} interviews={career?.interviewCount ?? 0} rolesSaved={career?.radar.length ?? 0}
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <ResumeScoreCard review={review} score={review?.score} />
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
          <RecordingsCard />
        </div>
      </div>
      {interviewModeDialog}
    </main>
  );
}
