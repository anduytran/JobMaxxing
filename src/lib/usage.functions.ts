import { createServerFn } from "@tanstack/react-start";

/**
 * The signed-in user's token totals for the Settings panel. Returns null when
 * signed out so the page can render without a sign-in wall.
 */
export const getTokenUsage = createServerFn({ method: "GET" }).handler(async () => {
  const { currentUser } = await import("./auth.server");
  const user = await currentUser();
  if (!user) return null;
  const { getTokenUsageSummary } = await import("./usage.server");
  return getTokenUsageSummary(user.id).catch((e) => {
    console.error("token usage read failed", e);
    return null;
  });
});
