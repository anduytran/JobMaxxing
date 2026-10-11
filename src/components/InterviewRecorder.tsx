// Asks for camera consent when an interview goes live, records camera + mic
// locally while it runs, and keeps the video in this tab for rewatching.
import { Circle, Download, Trash2, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  addRecording, recordingFileName, removeRecording, type InterviewRecording, type RecordingKind,
} from "@/lib/interview-recordings";

const MIMES = ["video/mp4;codecs=avc1,mp4a", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm"];

export function InterviewRecorder({ active, kind, title, onSaved }: {
  active: boolean; kind: RecordingKind; title: string;
  onSaved?: (recordingId: string) => void;
}) {
  const [ask, setAsk] = useState(false);
  const [recording, setRecording] = useState(false);
  const decided = useRef(false);
  const rec = useRef<{ mr: MediaRecorder; stream: MediaStream; chunks: Blob[]; started: number } | null>(null);
  const preview = useRef<HTMLVideoElement>(null);
  const meta = useRef({ kind, title, onSaved });
  meta.current = { kind, title, onSaved };
  // Draggable preview: null = default spot (top right); once dragged, absolute x/y.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    el.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      if (!drag.current) return;
      setPos({
        x: Math.min(Math.max(0, ev.clientX - drag.current.dx), window.innerWidth - r.width),
        y: Math.min(Math.max(0, ev.clientY - drag.current.dy), window.innerHeight - r.height),
      });
    };
    const up = () => {
      drag.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const stop = () => {
    const r = rec.current;
    if (!r) return;
    rec.current = null;
    setRecording(false);
    r.mr.onstop = () => {
      r.stream.getTracks().forEach((t) => t.stop());
      if (!r.chunks.length) return;
      const mime = r.mr.mimeType || "video/webm";
      const id = crypto.randomUUID();
      addRecording({
        id, kind: meta.current.kind, title: meta.current.title, interviewId: null,
        url: URL.createObjectURL(new Blob(r.chunks, { type: mime })), mime,
        at: Date.now(), seconds: Math.round((Date.now() - r.started) / 1000),
      });
      meta.current.onSaved?.(id);
      toast.success("Recording saved", { description: "Rewatch or download it from Career until you close this tab." });
    };
    if (r.mr.state !== "inactive") r.mr.stop(); else r.mr.onstop?.(new Event("stop"));
  };

  useEffect(() => {
    if (active && !decided.current) { decided.current = true; setAsk(true); }
    if (!active) { decided.current = false; setAsk(false); stop(); }
  }, [active]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => stop(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = async () => {
    setAsk(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: true });
      const mimeType = MIMES.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
      mr.start(1000);
      rec.current = { mr, stream, chunks, started: Date.now() };
      setRecording(true);
    } catch {
      toast.error("Couldn't start the camera", { description: "The interview continues without recording." });
    }
  };

  useEffect(() => {
    if (recording && preview.current && rec.current) preview.current.srcObject = rec.current.stream;
  }, [recording]);

  return (
    <>
      <AlertDialog open={ask} onOpenChange={setAsk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><Video className="h-5 w-5" />Record this interview?</AlertDialogTitle>
            <AlertDialogDescription>
              We'd use your camera and microphone to record a video of you during this interview so you can rewatch it afterwards.
              The video stays on this device only — it's never uploaded. You can download it, and it's gone when you close this tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No thanks</AlertDialogCancel>
            <AlertDialogAction onClick={() => void begin()}>Record me</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {recording && (
        <div
          className="fixed z-40 cursor-grab touch-none overflow-hidden rounded-xl border border-border bg-card shadow-lg active:cursor-grabbing"
          style={pos ? { left: pos.x, top: pos.y } : { top: 16, right: 16 }}
          onPointerDown={onDragStart}
          role="presentation"
          aria-label="Your camera preview — drag to move"
        >
          <video ref={preview} muted autoPlay playsInline className="pointer-events-none h-24 w-40 -scale-x-100 object-cover" aria-label="Your camera" />
          <div className="flex items-center justify-between gap-2 px-2 py-1 text-xs">
            <span className="flex items-center gap-1 font-medium text-destructive"><Circle className="h-2.5 w-2.5 animate-pulse fill-current" />Recording</span>
            <button type="button" className="text-muted-foreground underline hover:text-foreground" onClick={stop}>Stop</button>
          </div>
        </div>
      )}
    </>
  );
}

export function RecordingPlayer({ r, compact }: { r: InterviewRecording; compact?: boolean }) {
  return (
    <div className="space-y-2">
      <video src={r.url} controls playsInline className={compact ? "w-full max-w-md rounded-lg bg-muted" : "w-full rounded-xl bg-muted"} />
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{Math.floor(r.seconds / 60)}m {r.seconds % 60}s · kept in this tab only</span>
        <Button asChild size="sm" variant="outline" className="ml-auto">
          <a href={r.url} download={recordingFileName(r)}><Download className="h-3.5 w-3.5" />Download</a>
        </Button>
        <button type="button" aria-label="Delete recording" title="Delete recording" className="hover:text-destructive" onClick={() => removeRecording(r.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
