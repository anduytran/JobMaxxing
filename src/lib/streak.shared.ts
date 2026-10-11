// Browser-safe streak rules, shared by the server award path and the Career cards.
// Keep this module free of database and server imports.

/** XP paid the first time a streak reaches each 7-day mark (7, 14, 21 …). */
export const STREAK_BONUS_XP = 250;

/** The next 7-day mark that still has a bonus to collect. */
export const nextStreakBonus = (current: number) => (Math.floor(Math.max(0, current) / 7) + 1) * 7;
