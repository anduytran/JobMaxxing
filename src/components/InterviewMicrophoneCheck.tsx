import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export function InterviewMicrophoneCheck() {
  const [active, setActive] = useState(false);
  const [level, setLevel] = useState(0);
  const [device, setDevice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const stream = useRef<MediaStream | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const frame = useRef(0);
  const generation = useRef(0);
  const cleanup = () => {
    generation.current++;
    cancelAnimationFrame(frame.current);
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    void audio.current?.close();
    audio.current = null;
  };
  useEffect(() => cleanup, []);
  const stop = () => { cleanup(); setActive(false); setLevel(0); };
  const test = async () => {
    cleanup();
    const current = generation.current;
    setBusy(true); setError("");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      if (current !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      const context = new AudioContext();
      audio.current = context;
      await context.resume();
      if (current !== generation.current) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(media).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      setDevice(media.getAudioTracks()[0]?.label || "Default microphone");
      setActive(true);
      const update = () => {
        if (current !== generation.current) return;
        analyser.getFloatTimeDomainData(samples);
        const rms = Math.sqrt(samples.reduce((total, value) => total + value * value, 0) / samples.length);
        setLevel(Math.min(100, Math.round(rms * 500)));
        frame.current = requestAnimationFrame(update);
      };
      update();
    } catch (e) {
      if (current !== generation.current) return;
      cleanup(); setActive(false);
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access in your browser." : "Microphone unavailable. Check your browser’s input device and permissions.");
    } finally { if (current === generation.current || !stream.current) setBusy(false); }
  };
  return (
    <div className="space-y-3 border-t py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="font-semibold">Microphone check</h3><p className="text-sm text-muted-foreground">{device || "Default browser microphone"}</p></div>
        <Button variant="outline" onClick={active ? stop : test} disabled={busy}>{active ? <Square /> : <Mic />}{active ? "Stop test" : busy ? "Connecting…" : "Test microphone"}</Button>
      </div>
      {active && <><Progress value={level} aria-label="Microphone input level" /><p className="text-sm text-muted-foreground" role="status">{level > 5 ? "Microphone picking up sound" : "Waiting for sound"}</p></>}
      {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
    </div>
  );
}