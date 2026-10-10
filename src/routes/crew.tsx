import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { PageHeader, PanelHead } from "@/components/AppShell";
import { useGame } from "@/lib/game";
import { toast } from "sonner";

export const Route = createFileRoute("/crew")({
  head: () => ({
    meta: [
      { title: "Job Maxxers — JobMaxxing" },
      { name: "description", content: "Your crew of fellow job seekers cheering each other on." },
      { property: "og:title", content: "Job Maxxers — JobMaxxing" },
      { property: "og:description", content: "Your crew of fellow job seekers cheering each other on." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const CREW = [
  { name: "Jordan Lee", field: "Product design", level: 5 },
  { name: "Sam Rivera", field: "Software engineering", level: 6 },
  { name: "Taylor Kim", field: "Product management", level: 7 },
];

function Page() {
  const { level } = useGame();
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Build your next chapter" title="Job Maxxers" sub="Turn your potential into progress, one step at a time." pose="dap" />
      <div className="panel">
        <PanelHead title="Your crew of Job Maxxers" level={level} />
        <div className="px-8 pb-10 pt-6 md:px-12">
          {CREW.map((m) => (
            <div key={m.name} className="-mx-3 flex items-center gap-4 rounded-xl border-t px-3 py-6 transition-colors first:border-t-0 hover:bg-muted/60">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-sidebar-accent text-sm font-semibold text-primary transition-transform hover:scale-110">
                {m.name.split(" ").map((p) => p[0]).join("")}
              </div>
              <div className="flex-1">
                <div className="text-lg font-medium">{m.name}</div>
                <div className="text-sm text-muted-foreground">{m.field} · Level {m.level}</div>
              </div>
              <button onClick={() => toast.info("Crew connections are coming soon.")}
                className="hover-pop flex items-center gap-3 rounded-xl border px-5 py-3 text-sm font-medium hover:bg-muted">
                Connect <Plus className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
