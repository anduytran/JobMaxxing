import { CalendarClock, Check, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FriendsPanel } from "@/components/FriendsPanel";
import {
  listFriends, listScheduledInterviews, respondScheduledInterview, type ScheduledInterview,
} from "@/lib/friends.functions";

/** Top-nav social menu: friends + presence, add by email, invite, schedule. */
export function SocialMenu() {
  const [online, setOnline] = useState(0);
  const [pending, setPending] = useState(0);
  const [scheduled, setScheduled] = useState<ScheduledInterview[]>([]);

  const reload = useCallback(async () => {
    try {
      const [f, s] = await Promise.all([listFriends(), listScheduledInterviews()]);
      setOnline(f.friends.filter((x) => x.status !== "offline").length);
      setPending(f.requests.length + s.filter((x) => !x.mine && x.status === "pending").length);
      setScheduled(s);
    } catch { /* signed out */ }
  }, []);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 10000);
    return () => clearInterval(t);
  }, [reload]);

  const respond = async (id: string, action: "accept" | "cancel") => {
    try { await respondScheduledInterview({ data: { id, action } }); await reload(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <Popover onOpenChange={(o) => o && void reload()}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center gap-2 rounded-full border bg-card px-3.5 py-1.5 text-sm font-semibold transition-shadow hover:shadow-md" aria-label="Friends">
          <UsersRound className="h-4 w-4 text-primary" />
          Friends
          {online > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><span className="h-2 w-2 rounded-full bg-success" />{online}</span>}
          {pending > 0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">{pending}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="max-h-[75vh] w-96 overflow-y-auto">
        {scheduled.length > 0 && (
          <div className="mb-4 space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><CalendarClock className="h-3.5 w-3.5" /> Scheduled</p>
            <ul className="space-y-1.5">
              {scheduled.map((s) => (
                <li key={s.id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{s.withName}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(s.at).toLocaleString([], { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      {" · "}{s.status === "accepted" ? "Confirmed" : s.mine ? "Waiting" : "Asked you"}
                    </div>
                  </div>
                  {!s.mine && s.status === "pending" && (
                    <Button size="icon" variant="outline" aria-label="Accept" onClick={() => void respond(s.id, "accept")}><Check className="h-4 w-4 text-success" /></Button>
                  )}
                  <Button size="icon" variant="ghost" aria-label="Cancel" onClick={() => void respond(s.id, "cancel")}><X className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FriendsPanel social onChange={() => void reload()} />
      </PopoverContent>
    </Popover>
  );
}
