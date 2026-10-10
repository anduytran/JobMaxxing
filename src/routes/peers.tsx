import { createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Users } from "lucide-react";
import { Max } from "@/components/Max";
import { PageHeader, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";
import { toast } from "sonner";

export const Route = createFileRoute("/peers")({
  head: () => ({
    meta: [
      { title: "Peer Interviews — JobMaxxing" },
      { name: "description", content: "Swap mock interviews with a real person and grow confident together." },
      { property: "og:title", content: "Peer Interviews — JobMaxxing" },
      { property: "og:description", content: "Swap mock interviews with a real person and grow confident together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { level } = useGame();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Build your next chapter" title="Peer Interviews" sub="Turn your potential into progress, one step at a time." />
      <div className="panel">
        <PanelHead title="Make the most of peer interviews" level={level} />
        <div className="flex flex-col items-center px-6 py-24 text-center">
          <Max pose="dap" className="mascot-float h-28 w-28" />
          <h2 className="mt-8 text-3xl font-bold md:text-4xl">Your next interview buddy is waiting.</h2>
          <p className="mt-4 max-w-lg text-muted-foreground">Schedule a practice session with a friend using an AI-generated interview script.</p>
          <button onClick={() => toast.info("Peer scheduling is coming soon — we'll pair you with someone at a similar level.")}
            className="hover-pop mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground hover:opacity-90">
            Schedule an interview <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
