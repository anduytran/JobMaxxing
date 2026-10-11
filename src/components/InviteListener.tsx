import { useNavigate } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, PhoneCall, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { listIncomingInvites, respondInvite, type IncomingInvite } from "@/lib/friends.functions";
import { joinPeerSession } from "@/lib/peer.functions";

const COUNTDOWN_SECONDS = 30;

/** Global incoming-invite banner: polls while signed in and pops a card with a
 *  30-second countdown. Accepting joins the peer session and navigates to it. */
export function InviteListener() {
  const navigate = useNavigate();
  const [invite, setInvite] = useState<IncomingInvite | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const shown = useRef<Set<string>>(new Set());

  useEffect(() => {
    let stopped = false;
    const poll = async () => {
      try {
        const { invites } = await listIncomingInvites();
        if (stopped) return;
        const next = invites.find((i) => !shown.current.has(i.id));
        if (next) {
          shown.current.add(next.id);
          setInvite(next);
          try { new Audio("data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=").play().catch(() => {}); } catch { /* no audio */ }
        }
      } catch { /* signed out or network — stay quiet */ }
    };
    void poll();
    const t = setInterval(() => void poll(), 8000);
    return () => { stopped = true; clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!invite) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [invite]);

  // Auto-dismiss when the invite expires.
  useEffect(() => {
    if (!invite) return;
    const left = Date.parse(invite.expiresAt) - now;
    if (left <= 0) setInvite(null);
  }, [invite, now]);

  const respond = async (accept: boolean) => {
    if (!invite) return;
    setBusy(true);
    try {
      const res = await respondInvite({ data: { inviteId: invite.id, accept } });
      if (accept && res.code) {
        await joinPeerSession({ data: { code: res.code } });
        toast.success("You're in!", { description: "Joining your friend's session…" });
        setInvite(null);
        void navigate({ to: "/peers", search: { join: res.code } });
        return;
      }
      setInvite(null);
    } catch (e) {
      toast.error((e as Error).message);
      setInvite(null);
    } finally { setBusy(false); }
  };

  const left = invite ? Math.max(0, Math.min(COUNTDOWN_SECONDS, (Date.parse(invite.expiresAt) - now) / 1000)) : 0;

  return (
    <AnimatePresence>
      {invite && (
        <motion.div
          key={invite.id}
          initial={{ opacity: 0, y: -16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          className="fixed right-4 top-20 z-50 w-80 rounded-xl border-2 border-primary bg-card p-4 shadow-xl"
          role="alertdialog" aria-label="Interview invite"
        >
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{invite.senderName} invited you to a mock interview!</p>
              {invite.roleTitle && <p className="mt-0.5 truncate text-xs text-muted-foreground">{invite.roleTitle}</p>}
            </div>
            <button className="text-muted-foreground hover:text-foreground" aria-label="Dismiss invite" onClick={() => void respond(false)}>
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-200" style={{ width: `${(left / COUNTDOWN_SECONDS) * 100}%` }} />
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" disabled={busy} onClick={() => void respond(true)}>
              {busy && <Loader2 className="animate-spin" />} Accept
            </Button>
            <Button variant="outline" className="flex-1" disabled={busy} onClick={() => void respond(false)}>Decline</Button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
