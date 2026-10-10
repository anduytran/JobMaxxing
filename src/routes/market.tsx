import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { PageHeader, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/market")({
  head: () => ({
    meta: [
      { title: "Job Radar — DevUp" },
      { name: "description", content: "Roles matched to your profile, refreshed as you grow." },
      { property: "og:title", content: "Job Radar — DevUp" },
      { property: "og:description", content: "Roles matched to your profile, refreshed as you grow." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Market,
});

const JOBS = [
  { title: "Product Designer", company: "Notion", match: 94 },
  { title: "Associate Product Designer", company: "Figma", match: 91 },
  { title: "Product Designer", company: "Linear", match: 88 },
];

function Market() {
  const { level } = useGame();
  const nav = useNavigate();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Build your next chapter" title="Job Radar" sub="Turn your potential into progress, one step at a time." />
      <div className="panel">
        <PanelHead title="Make the most of job radar" level={level} />
        <div className="px-8 pb-10 pt-6 md:px-12">
          {JOBS.map((j) => (
            <div key={j.company + j.title} className="flex items-center gap-4 border-t py-6 first:border-t-0">
              <div className="grid h-12 w-12 place-items-center rounded-xl border text-xl font-semibold">{j.company[0]}</div>
              <div className="flex-1">
                <div className="text-lg font-medium">{j.title}</div>
                <div className="text-sm text-muted-foreground">{j.company} · Remote · {j.match}% profile match</div>
              </div>
              <button onClick={() => nav({ to: "/interview" })}
                className="flex items-center gap-3 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90">
                View role <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
