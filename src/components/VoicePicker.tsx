import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { VOICES } from "@/lib/voices";
import { getInterviewVoice, previewInterviewVoice, setInterviewVoice } from "@/lib/voice.functions";
import { cn } from "@/lib/utils";

/** Settings panel: choose the interviewer's voice, with a short preview of each. */
export function VoicePicker() {
  const [current, setCurrent] = useState<string | null>(null);
  const [busy, setBusy] = useState("");
  const audio = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    getInterviewVoice().then((r) => setCurrent(r.voiceId)).catch(() => setCurrent(VOICES[0].id));
    return () => audio.current?.pause();
  }, []);

  async function choose(id: string) {
    const prev = current;
    setCurrent(id);
    try { await setInterviewVoice({ data: { voiceId: id } }); toast.success(`${VOICES.find((v) => v.id === id)?.name} will run your interviews`); }
    catch { setCurrent(prev); toast.error("Couldn't save that voice. Try again."); }
  }

  async function preview(id: string) {
    setBusy(id);
    try {
      const r = await previewInterviewVoice({ data: { voiceId: id } });
      if (!r.audio) throw new Error();
      audio.current?.pause();
      audio.current = new Audio(`data:audio/mpeg;base64,${r.audio}`);
      await audio.current.play();
    } catch { toast.error("Preview isn't available right now."); }
    finally { setBusy(""); }
  }

  return (
    <div className="panel space-y-3 p-6">
      <div>
        <div className="font-semibold">Interviewer voice</div>
        <div className="text-sm text-muted-foreground">Who asks the questions in your solo interviews.</div>
      </div>
      <ul className="divide-y divide-border">
        {VOICES.map((v) => (
          <li key={v.id} className="flex items-center gap-3 py-2.5">
            <button type="button" onClick={() => choose(v.id)} aria-pressed={current === v.id} className="flex flex-1 items-center gap-3 text-left">
              <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2", current === v.id ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                {current === v.id && <Check className="h-3 w-3" />}
              </span>
              <span><span className="font-medium">{v.name}</span><span className="block text-sm text-muted-foreground">{v.style}</span></span>
            </button>
            <Button size="sm" variant="ghost" onClick={() => preview(v.id)} disabled={!!busy} aria-label={`Preview ${v.name}`}>
              {busy === v.id ? <Loader2 className="animate-spin" /> : <Play />}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
