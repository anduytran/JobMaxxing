import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { routeTree } from "./routeTree.gen";
import { MAX_POSES } from "./components/Max";

/** Full-screen loader. If a page takes more than ~15s, say so instead of
 *  leaving people staring at a spinner. */
function PendingScreen() {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 15000);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="flex max-w-sm flex-col items-center text-center">
        <img src={MAX_POSES.wave} alt="" className="mascot-float h-28 w-28 object-contain" />
        <p className="mt-6 text-sm font-semibold text-foreground">Loading…</p>
        {slow && (
          <p className="mt-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            This is taking longer than usual — the process might be a while. Come back and visit later.
          </p>
        )}
      </div>
    </div>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
    defaultPendingMs: 150,
    defaultPendingComponent: PendingScreen,
  });

  return router;
};
