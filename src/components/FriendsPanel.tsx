import { Check, Loader2, Search, Send, UserPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listFriends, removeFriend, respondFriendRequest, searchUsers, sendFriendRequest, sendInterviewInvite,
  type FriendRow,
} from "@/lib/friends.functions";
import { cn } from "@/lib/utils";

const STATUS_DOT: Record<FriendRow["status"], string> = {
  online: "bg-success",
  in_interview: "bg-primary",
  offline: "bg-muted-foreground/40",
};
const STATUS_LABEL: Record<FriendRow["status"], string> = {
  online: "Online",
  in_interview: "In an interview",
  offline: "Offline",
};

/** Friends list + requests + search. When `inviteCode` is set (host waiting in
 *  the lobby), each friend gets an Invite button that pings them in-app. */
export function FriendsPanel({ inviteCode, roleTitle }: { inviteCode?: string | undefined; roleTitle?: string | null }) {
  const [friends, setFriends] = useState<FriendRow[]>([]);
  const [requests, setRequests] = useState<{ id: string; name: string; email: string }[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: string; name: string; email: string }[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [invited, setInvited] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const data = await listFriends();
      setFriends(data.friends);
      setRequests(data.requests);
    } catch { /* signed-out edge — ignore */ }
  }, []);

  useEffect(() => {
    void reload();
    const t = setInterval(() => void reload(), 15000);
    return () => clearInterval(t);
  }, [reload]);

  useEffect(() => {
    if (query.trim().length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      try { setResults((await searchUsers({ data: { query } })).results); } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const act = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try { await fn(); if (done) toast.success(done); await reload(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(null); }
  };

  const invite = (f: FriendRow) => act(`inv-${f.id}`, async () => {
    await sendInterviewInvite({ data: { friendId: f.id, code: inviteCode!, roleTitle: roleTitle ?? null } });
    setInvited((s) => new Set(s).add(f.id));
  }, `Invite sent to ${f.name}`);

  const known = new Set(friends.map((f) => f.id));

  return (
    <section className="panel space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-display text-lg">Your crew</h3>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find people by email or name" className="pl-9" aria-label="Search users" />
      </div>
      {results.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {results.map((r) => (
            <li key={r.id} className="flex items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.name}</div>
                <div className="truncate text-xs text-muted-foreground">{r.email}</div>
              </div>
              {known.has(r.id) ? (
                <span className="text-xs text-muted-foreground">Friends</span>
              ) : (
                <Button size="sm" variant="outline" disabled={busy === `add-${r.id}`}
                  onClick={() => void act(`add-${r.id}`, async () => {
                    const res = await sendFriendRequest({ data: { friendId: r.id } });
                    toast.success(res.accepted ? `You're now friends with ${r.name}` : `Request sent to ${r.name}`);
                  })}>
                  {busy === `add-${r.id}` ? <Loader2 className="animate-spin" /> : <UserPlus className="h-4 w-4" />}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {requests.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Requests</p>
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-2 rounded-lg border bg-accent/5 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{r.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{r.email}</div>
                </div>
                <Button size="icon" variant="outline" aria-label={`Accept ${r.name}`} disabled={busy === r.id}
                  onClick={() => void act(r.id, () => respondFriendRequest({ data: { requestId: r.id, accept: true } }), `${r.name} added to your crew`)}>
                  <Check className="h-4 w-4 text-success" />
                </Button>
                <Button size="icon" variant="ghost" aria-label={`Decline ${r.name}`} disabled={busy === r.id}
                  onClick={() => void act(r.id, () => respondFriendRequest({ data: { requestId: r.id, accept: false } }))}>
                  <X className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {friends.length === 0 ? (
        <p className="text-sm text-muted-foreground">No friends yet — search above to add your crew, then invite them straight into a session.</p>
      ) : (
        <ul className="space-y-1.5">
          {friends.map((f) => (
            <li key={f.id} className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-muted/50">
              <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", STATUS_DOT[f.status])} title={STATUS_LABEL[f.status]} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{f.name}</div>
                <div className="text-xs text-muted-foreground">{STATUS_LABEL[f.status]}</div>
              </div>
              {inviteCode && f.status !== "in_interview" && (
                invited.has(f.id) ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-success"><Check className="h-3.5 w-3.5" /> Invited</span>
                ) : (
                  <Button size="sm" variant="outline" disabled={busy === `inv-${f.id}`} onClick={() => void invite(f)}>
                    {busy === `inv-${f.id}` ? <Loader2 className="animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />} Invite
                  </Button>
                )
              )}
              {!inviteCode && (
                <Button size="icon" variant="ghost" aria-label={`Remove ${f.name}`} disabled={busy === `rm-${f.id}`}
                  onClick={() => void act(`rm-${f.id}`, () => removeFriend({ data: { friendId: f.id } }))}>
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
