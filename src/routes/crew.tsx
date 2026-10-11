import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";
import { FriendsPanel } from "@/components/FriendsPanel";
import { useGame } from "@/lib/game";

export const Route = createFileRoute("/crew")({
  head: () => ({
    meta: [
      { title: "Fellow Maxxers — JobMaxxing" },
      { name: "description", content: "Your fellow maxxers — add friends by email, see who's online, and invite them to an interview." },
      { property: "og:title", content: "Fellow Maxxers — JobMaxxing" },
      { property: "og:description", content: "Your fellow maxxers — add friends by email, see who's online, and invite them to an interview." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { level } = useGame();
  void level;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Build your next chapter" title="Fellow Maxxers" sub="Add friends by email, see who's online, and invite them into an interview." pose="dap" />
      <FriendsPanel />
    </div>
  );
}
