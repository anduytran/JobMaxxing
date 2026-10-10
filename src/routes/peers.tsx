import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Users } from "lucide-react";
import { PageHeader, Mascot } from "@/components/AppShell";

export const Route = createFileRoute("/peers")({
  head: () => ({
    meta: [
      { title: "Peer Interviews — DevUp" },
      { name: "description", content: "Swap mock interviews with a real person and grow confident together." },
      { property: "og:title", content: "Peer Interviews — DevUp" },
      { property: "og:description", content: "Swap mock interviews with a real person and grow confident together." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Practice together" title="Peer Interviews" sub="Swap mock interviews with a real person and grow confident together." />
      <div className="panel flex flex-col items-center px-6 py-20 text-center">
        <Users className="h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-bold md:text-4xl">Swap mock interviews with a real person and grow confident together.</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">Peer matching is coming soon — we'll pair you with someone at a similar level.</p>
        <Link to="/quests" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground hover:opacity-90">Find an interview partner <ArrowRight className="h-5 w-5" /></Link>
        <Mascot className="mt-10 h-24 w-24" />
      </div>
    </div>
  );
}
