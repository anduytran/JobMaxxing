// Client-side voice agent abstraction. The browser voice is the default;
// an ElevenLabs implementation plugs in here once an agent exists.
export interface VoiceAgent {
  speak(text: string): Promise<void>;
  listen(onTranscript?: (text: string) => void): Promise<string>;
  finishListening(): void;
  stop(): void;
}

type SR = { new (): any };
export type VoicePlaybackState = "ready" | "preparing" | "speaking";
type PlaybackObserver = (state: VoicePlaybackState) => void;

export function createBrowserVoice(onPlayback?: PlaybackObserver): VoiceAgent {
  let rec: any = null;
  let settlePlayback: (() => void) | undefined;
  let finishCapture: (() => void) | undefined;
  let cancelCapture: (() => void) | undefined;
  return {
    speak: (text) =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
        settlePlayback?.();
        onPlayback?.("preparing");
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        const finish = () => { onPlayback?.("ready"); resolve(); };
        settlePlayback = finish;
        u.onstart = () => onPlayback?.("speaking");
        u.onend = finish;
        u.onerror = finish;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }),
    listen: (onTranscript) =>
      new Promise((resolve, reject) => {
        const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
        const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
        if (!Ctor) return reject(new Error("Voice input isn't supported in this browser — type your answer instead."));
        cancelCapture?.();
        let completed = "";
        let sessionText = "";
        let done = false;
        let restartTimer: ReturnType<typeof setTimeout> | undefined;
        const transcript = () => `${completed} ${sessionText}`.trim();
        const clear = () => {
          clearTimeout(restartTimer);
          finishCapture = undefined;
          cancelCapture = undefined;
        };
        const finish = () => {
          if (done) return;
          done = true;
          clear();
          try { rec?.stop(); } catch { /* already stopped */ }
          const text = transcript();
          if (text) resolve(text); else reject(new Error("Didn't catch that — try again or type your answer."));
        };
        finishCapture = finish;
        cancelCapture = () => {
          if (done) return;
          done = true; clear();
          rec?.abort?.();
          reject(new Error("Voice capture cancelled."));
        };
        rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = navigator.language || "en-US";
        rec.onresult = (e: any) => {
          if (done) return;
          // Rebuild the current session, rather than appending repeated final results.
          sessionText = Array.from(e.results as ArrayLike<any>).map((result) => result[0].transcript as string).join(" ");
          onTranscript?.(transcript());
        };
        rec.onerror = (e: any) => {
          if (done || e.error === "no-speech") return;
          done = true; clear();
          rec?.abort?.();
          reject(new Error(e.error === "not-allowed" ? "Microphone access was denied. Check your browser permissions." : e.error ?? "Voice input failed"));
        };
        // A natural pause never submits. Restart browser-ended capture until Done speaking.
        rec.onend = () => {
          if (done) return;
          completed = transcript(); sessionText = "";
          restartTimer = setTimeout(() => { if (!done) { try { rec.start(); } catch { finish(); } } }, 250);
        };
        try { rec.start(); } catch { done = true; clear(); reject(new Error("Could not start microphone capture. Please try again.")); }
      }),
    finishListening: () => finishCapture?.(),
    stop: () => {
      cancelCapture?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
      settlePlayback?.();
      onPlayback?.("ready");
    },
  };
}

/** ElevenLabs voice: the server synthesizes each line; listening still uses browser speech recognition.
 *  Falls back to the browser voice for any line ElevenLabs can't produce. */
export function createElevenLabsVoice(synth: (text: string) => Promise<string | null>, onPlayback?: PlaybackObserver): VoiceAgent {
  const browser = createBrowserVoice(onPlayback);
  let audio: HTMLAudioElement | null = null;
  let generation = 0;
  let settlePlayback: (() => void) | undefined;
  return {
    speak: async (text) => {
      const current = ++generation;
      audio?.pause();
      settlePlayback?.();
      onPlayback?.("preparing");
      const b64 = await synth(text).catch(() => null);
      if (current !== generation) return;
      if (!b64) return browser.speak(text);
      await new Promise<void>((resolve) => {
        audio = new Audio(`data:audio/mpeg;base64,${b64}`);
        const finish = () => { onPlayback?.("ready"); resolve(); };
        settlePlayback = finish;
        audio.onplaying = () => onPlayback?.("speaking");
        audio.onended = finish;
        audio.onerror = finish;
        audio.play().catch(finish);
      });
    },
    listen: (onTranscript) => { audio?.pause(); return browser.listen(onTranscript); },
    finishListening: () => browser.finishListening(),
    stop: () => { generation++; audio?.pause(); settlePlayback?.(); browser.stop(); onPlayback?.("ready"); },
  };
}
