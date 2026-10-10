import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, LineChart } from "lucide-react";
import { PageHeader, Mascot } from "@/components/AppShell";

export const Route = createFileRoute("/progress")({
  head: () => ({
    meta: [
      { title: "Career Progress — DevUp" },
      { name: "description", content: "Track your level, XP and milestones over time." },
      { property: "og:title", content: "Career Progress — DevUp" },
      { property: "og:description", content: "Track your level, XP and milestones over time." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Look how far you've come" title="Career Progress" sub="Track your level, XP and milestones over time." />
      <div className="panel flex flex-col items-center px-6 py-20 text-center">
        <LineChart className="h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-bold md:text-4xl">Track your level, XP and milestones over time.</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">Your progress chart will fill in as you complete quests and interviews.</p>
        <Link to="/quests" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground hover:opacity-90">See your quests <ArrowRight className="h-5 w-5" /></Link>
        <Mascot className="mt-10 h-24 w-24" />
      </div>
    </div>
  );
}
