import { createRoot } from "react-dom/client";
import { createRootRoute, createRoute, createRouter, RouterProvider } from "@tanstack/react-router";
import { questTitleLines } from "@/lib/quest-titles";

const TITLES = [
  "Solve 2 LeetCode Easy problems",
  "Run a behavioral mock interview",
  "Rewrite one resume bullet with a metric",
  "Build a small project that uses your target role's main framework",
  "Fix",
];

function Page() {
  return (
    <div className="mx-auto max-w-6xl p-8">
      <div className="max-w-xl">
        {TITLES.map((t) => {
          const [a, b] = questTitleLines(t);
          return (
            <div key={t} className="mb-6 rounded-2xl border bg-hero px-14 py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/70">Today's featured quest · Skills</p>
              <h2 data-title={t} className="mt-5 min-h-[2.2em] break-words text-2xl font-bold leading-[1.1] sm:text-3xl">
                <span className="block">{a}</span>
                <span className="block">{b}</span>
              </h2>
              <p className="mt-4 text-muted-foreground">One problem at a time — that's how sharp gets built.</p>
            </div>
          );
        })}
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
