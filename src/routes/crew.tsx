import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, UsersRound } from "lucide-react";
import { PageHeader, Mascot } from "@/components/AppShell";

export const Route = createFileRoute("/crew")({
  head: () => ({
    meta: [
      { title: "Job Maxxers — DevUp" },
      { name: "description", content: "Your crew of fellow job seekers cheering each other on." },
      { property: "og:title", content: "Job Maxxers — DevUp" },
      { property: "og:description", content: "Your crew of fellow job seekers cheering each other on." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Better together" title="Job Maxxers" sub="Your crew of fellow job seekers cheering each other on." />
      <div className="panel flex flex-col items-center px-6 py-20 text-center">
        <UsersRound className="h-12 w-12 text-primary" />
        <h2 className="mt-6 text-3xl font-bold md:text-4xl">Your crew of fellow job seekers cheering each other on.</h2>
        <p className="mt-4 max-w-lg text-muted-foreground">Crew invites are coming soon.</p>
        <Link to="/quests" className="mt-8 inline-flex items-center gap-3 rounded-xl bg-primary px-7 py-4 font-semibold text-primary-foreground hover:opacity-90">Invite a friend <ArrowRight className="h-5 w-5" /></Link>
        <Mascot className="mt-10 h-24 w-24" />
      </div>
    </div>
  );
}
