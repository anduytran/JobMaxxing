import { useEffect, useRef, useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Hourglass } from "lucide-react";
import { formatTimeLeft, nextReset, type ResetPeriod } from "@/lib/reset-times";
import { cn } from "@/lib/utils";

/**
 * Ticks once a second. It starts empty so the server render and the first
 * browser render can never disagree about the time.
 */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * "Daily expiration in 4h 12m 08s" — the clock on the current quest board.
 * When it runs out, the fresh board is pulled in so the ticks clear themselves.
 */
export function ResetCountdown({
  period,
  label = "Expiration in",
  className,
}: {
  period: ResetPeriod;
  label?: string;
  className?: string;
}) {
  const now = useNow();
  const router = useRouter();
  const refreshed = useRef(false);
  const target = now ? nextReset(period, now) : null;
  const left = now && target ? target.getTime() - now.getTime() : null;

  useEffect(() => {
    if (left === null || left > 0 || refreshed.current) return;
    refreshed.current = true;
    void router.invalidate();
  }, [left, router]);

  if (!now || !target || left === null) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}
      title={`Resets ${target.toLocaleString()}`}
    >
      <Hourglass className="h-3.5 w-3.5" aria-hidden />
      <span>
        {label} {formatTimeLeft(left)}
      </span>
    </span>
  );
}
