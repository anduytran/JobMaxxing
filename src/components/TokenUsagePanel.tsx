import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { getTokenUsage } from "@/lib/usage.functions";

/** Friendly names for the action labels stored in the database. */
const LABELS: Record<string, string> = {
  "job parse": "Job parsing",
  "radar titles": "Job Radar matching",
  "interview questions": "Interview questions",
  "interview turns": "Live interview",
  "interview grade": "Interview grading",
  "interviewer grade": "Peer interviewer grading",
  "resume grade": "Resume grading",
  "resume fixes": "Next resume fixes",
  "skill ratings": "Skill ratings",
  "skill check": "Skill checks",
  voice: "Spoken voice",
};

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Settings panel: how many AI tokens this account has used, split by action.
 * Reads the running total from the app's own database.
 */
export function TokenUsagePanel() {
  const q = useQuery({
    queryKey: ["token-usage"],
    queryFn: () => getTokenUsage(),
    staleTime: 30_000,
  });

  const data = q.data;
  const biggest = data?.byAction[0]?.tokens ?? 0;

  return (
    <div className="panel space-y-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-semibold">Token usage</div>
          <div className="text-sm text-muted-foreground">
            What the AI helpers behind your interviews, resume grades and skill ratings have used.
          </div>
        </div>
        {q.isFetching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {q.isPending ? (
        <div className="text-sm text-muted-foreground">Loading…</div>
      ) : !data ? (
        <div className="text-sm text-muted-foreground">
          Sign in to see the AI usage on your account.
        </div>
      ) : data.total === 0 ? (
        <div className="text-sm text-muted-foreground">
          Nothing used yet — run an interview, grade a resume or refresh your skills to start a tally.
        </div>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tabular-nums">{fmt(data.total)}</span>
            <span className="text-sm text-muted-foreground">
              tokens across {fmt(data.calls)} {data.calls === 1 ? "action" : "actions"}
            </span>
          </div>

          <div className="space-y-2">
            {data.byAction.map((row) => (
              <div key={row.action} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{LABELS[row.action] ?? row.action}</span>
                  <span className="tabular-nums text-muted-foreground">
                    {fmt(row.tokens)}
                    <span className="ml-1 text-xs">({row.calls})</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${biggest ? Math.max(3, (row.tokens / biggest) * 100) : 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {data.recent.length > 0 && (
            <div className="space-y-1 border-t pt-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Latest
              </div>
              {data.recent.map((r, i) => (
                <div key={`${r.action}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {LABELS[r.action] ?? r.action}
                    <span className="ml-2 text-xs">
                      {r.at ? new Date(r.at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                    </span>
                  </span>
                  <span className="tabular-nums">{fmt(r.tokens)}</span>
                </div>
              ))}
            </div>
          )}

          {data.hasEstimates && (
            <div className="text-xs text-muted-foreground">
              Live interview turns and spoken voice are counted from the words sent through them —
              the rest are the exact figures the AI service reports.
            </div>
          )}
        </>
      )}
    </div>
  );
}
