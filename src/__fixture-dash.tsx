import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { XpCareerCard } from "@/components/DashboardProgressCards";
import { ResumeScoreCard } from "@/components/ResumeScoreCard";

function Page() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="grid grid-cols-1 items-stretch gap-5 sm:grid-cols-2">
        <ResumeScoreCard review={null} score={72} loading={false} />
        <XpCareerCard xp={2450} level={3} levelXp={450} lastGain={{ amount: 15, key: 1 }} title="Product Engineer" />
      </div>
    </div>
  );
}

const rootRoute = createRootRoute({ component: Page });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/" });
const routeTree = rootRoute.addChildren([indexRoute]);
const router = createRouter({ routeTree });

export function mountDash(el: HTMLElement) {
  createRoot(el).render(<RouterProvider router={router} />);
}
