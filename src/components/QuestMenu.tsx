import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Swords, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useGame } from "@/lib/game";
import { questTitleLines } from "@/lib/quest-titles";

export function QuestMenu() {
  const { quests } = useGame();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); };
  const show = () => { cancel(); setOpen(true); };
  const hide = () => { cancel(); timer.current = setTimeout(() => setOpen(false), 200); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  const groups = [{ label: "Daily", period: "daily", limit: 4 }, { label: "Weekly", period: "weekly", limit: 3 }];
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button variant="outline" aria-label="Daily and weekly quests" onPointerEnter={e => { if (e.pointerType === "mouse") show(); }} onPointerLeave={hide} className="gap-2 rounded-md"><Swords className="h-4 w-4" /><span className="hidden sm:inline">Quests</span></Button></PopoverTrigger>
    <PopoverContent align="end" sideOffset={10} onPointerEnter={cancel} onPointerLeave={hide} onOpenAutoFocus={e => e.preventDefault()} className="w-[min(380px,calc(100vw-24px))] overflow-hidden p-0">
      <div className="flex items-center justify-between border-b bg-muted/40 px-5 py-4"><h2 className="text-sm font-bold uppercase tracking-wider">Mission briefing</h2><Swords className="h-4 w-4 text-primary" /></div>
      {groups.map(group => {
        const all = quests.filter(q => q.period === group.period);
        const rows = all.sort((a,b) => Number(a.done)-Number(b.done)).slice(0,group.limit);
        return <section key={group.period} aria-label={`${group.label} quests`} className="border-b px-5 py-4">
          <div className="mb-3 flex justify-between text-xs font-semibold uppercase tracking-wider"><h3>{group.label} quests</h3><span className="text-muted-foreground">{all.filter(q=>q.done).length} / {all.length}</span></div>
          {rows.length ? <div className="space-y-3">{rows.map(q => <Link key={q.id} to="/quests" onClick={()=>setOpen(false)} title={q.title} className="group flex items-center gap-3">
            <span className={`grid h-8 w-8 shrink-0 place-items-center border ${q.done ? "border-success/40 bg-success/10 text-success" : "border-primary/30 bg-primary/10 text-primary"}`}>{q.done ? <Check className="h-4 w-4" /> : <Zap className="h-4 w-4" />}</span>
            <div className="min-w-0 flex-1"><p className="min-h-[2.75em] text-sm font-medium leading-snug group-hover:text-primary"><span className="block">{questTitleLines(q.title)[0]}</span><span className="block">{questTitleLines(q.title)[1]}</span></p><div className="mt-1.5 h-1 bg-muted"><div className={`h-full bg-success ${q.done ? "w-full" : "w-0"}`} /></div></div>
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">+{q.xp} XP</span>
          </Link>)}</div> : <p className="text-sm text-muted-foreground">No {group.period} quests yet.</p>}
        </section>;
      })}
      <Button asChild variant="ghost" className="h-12 w-full justify-between rounded-none px-5"><Link to="/quests" onClick={()=>setOpen(false)}>All quests<ArrowRight className="h-4 w-4" /></Link></Button>
    </PopoverContent>
  </Popover>;
}