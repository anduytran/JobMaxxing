// When the quest board flips back to empty. The server resets daily quests at
// midnight UTC and weekly quests at the start of the week (Monday), so the
// countdowns here use the same UTC boundaries — see the reset transaction in
// src/lib/devup.functions.ts.
export type ResetPeriod = "daily" | "weekly";

/** Midnight UTC after `now` — when daily quests unlock again. */
export function nextDailyReset(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(24, 0, 0, 0);
  return d;
}

/** Next Monday 00:00 UTC — when weekly quests unlock again. */
export function nextWeeklyReset(now: Date = new Date()): Date {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  const weekday = d.getUTCDay(); // 0 = Sunday … 6 = Saturday
  // Days until the *next* Monday; a Monday just reset, so always a full week.
  d.setUTCDate(d.getUTCDate() + ((8 - weekday) % 7 || 7));
  return d;
}

export function nextReset(period: ResetPeriod, now: Date = new Date()): Date {
  return period === "daily" ? nextDailyReset(now) : nextWeeklyReset(now);
}

/** "4h 12m 08s" — days only when there are days left, seconds only when it's close. */
export function formatTimeLeft(ms: number): string {
  if (ms <= 0) return "any second now";
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${String(seconds).padStart(2, "0")}s`;
  return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
}
