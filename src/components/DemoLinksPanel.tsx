import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDemoLink, getDemoAdmin, revokeDemoLink } from "@/lib/demo.functions";
import { cn } from "@/lib/utils";

/** Settings panel (editor account only): make secret demo links and read visitor feedback. */
export function DemoLinksPanel() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["demo-admin"], queryFn: () => getDemoAdmin(), staleTime: 15_000 });
  const [label, setLabel] = useState("");
  const [uses, setUses] = useState("10");
  const [busy, setBusy] = useState(false);
  if (!q.data) return null;
  const { links, feedback } = q.data;
  const urlFor = (t: string) => `${window.location.origin}/demo/${t}`;
  const copy = (t: string) => { void navigator.clipboard.writeText(urlFor(t)); toast.success("Demo link copied"); };

  const create = async () => {
    setBusy(true);
    const res = await createDemoLink({ data: { label, maxUses: Number(uses) } }).catch((e) => ({ ok: false as const, error: (e as Error).message }));
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setLabel("");
    copy(res.token);
    void qc.invalidateQueries({ queryKey: ["demo-admin"] });
  };
  const revoke = async (t: string) => {
    await revokeDemoLink({ data: { token: t } });
    void qc.invalidateQueries({ queryKey: ["demo-admin"] });
  };

  return (
    <div className="panel space-y-5 p-6">
      <div>
        <div className="font-semibold">Demo links</div>
        <p className="text-sm text-muted-foreground">Anyone with a link can try a full interview without an account. Nothing is saved to anyone; each visit uses one of the link's uses.</p>
      </div>
      <form className="flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); void create(); }}>
        <Input aria-label="Link name" placeholder="Who is it for? e.g. Judges" value={label} onChange={(e) => setLabel(e.target.value)} className="min-w-48 flex-1" />
        <Input aria-label="Number of interviews" type="number" min={1} max={500} value={uses} onChange={(e) => setUses(e.target.value)} className="w-24" />
        <Button type="submit" disabled={busy}>{busy && <Loader2 className="animate-spin" />}Create link</Button>
      </form>
      {links.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {links.map((l) => (
            <li key={l.token} className={cn("flex flex-wrap items-center justify-between gap-2 p-3 text-sm", l.revoked && "opacity-50")}>
              <span className="min-w-0"><b>{l.label}</b><span className="ml-2 text-muted-foreground">{l.uses} of {l.maxUses} used{l.revoked ? " · turned off" : ""}</span></span>
              {!l.revoked && (
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copy(l.token)}><Copy className="h-3.5 w-3.5" />Copy</Button>
                  <Button size="sm" variant="ghost" onClick={() => void revoke(l.token)}>Turn off</Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <div>
        <div className="mb-2 text-sm font-semibold">Visitor feedback</div>
        {feedback.length ? (
          <ul className="space-y-2">
            {feedback.map((f) => (
              <li key={f.id} className="rounded-lg bg-muted p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex text-primary" aria-label={`${f.rating} of 5`}>{Array.from({ length: 5 }, (_, i) => <Star key={i} className={cn("h-3.5 w-3.5", i < f.rating && "fill-current")} />)}</span>
                  <span>{f.label}</span>
                  {f.score != null && <span>· scored {f.score}%</span>}
                  <span>· {new Date(f.createdAt).toLocaleString()}</span>
                </div>
                {f.comment && <p className="mt-1">{f.comment}</p>}
              </li>
            ))}
          </ul>
        ) : <p className="text-sm text-muted-foreground">No feedback yet.</p>}
      </div>
    </div>
  );
}
