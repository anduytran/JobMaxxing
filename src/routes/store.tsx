import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/AppShell";

export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Store — JobMaxxing" },
      { name: "description", content: "Spend what you earn on JobMaxxing rewards — coming soon." },
      { property: "og:title", content: "Store — JobMaxxing" },
      { property: "og:description", content: "Spend what you earn on JobMaxxing rewards — coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: StorePage,
});

function StorePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader eyebrow="Coming soon" title="Store" sub="Rewards for the work you put in are on the way." pose="dap" />
    </div>
  );
}
