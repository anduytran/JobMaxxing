// Client-side voice agent abstraction. The browser voice is the default;
// an ElevenLabs implementation plugs in here once an agent exists.
export interface VoiceAgent {
  speak(text: string): Promise<void>;
  listen(): Promise<string>; // resolves with the candidate's transcribed answer
  stop(): void;
}

type SR = { new (): any };
export type VoicePlaybackState = "ready" | "preparing" | "speaking";
type PlaybackObserver = (state: VoicePlaybackState) => void;

export function createBrowserVoice(onPlayback?: PlaybackObserver): VoiceAgent {
  let rec: any = null;
  let settlePlayback: (() => void) | undefined;
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
    listen: () =>
      new Promise((resolve, reject) => {
        const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
        const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
        if (!Ctor) return reject(new Error("Voice input isn't supported in this browser — type your answer instead."));
        // Generous on pauses: keep listening through short silences and only finish
        // after SILENCE_MS of quiet once the candidate has started talking.
        const SILENCE_MS = 3500;
        const START_MS = 10000; // time allowed before the first word
        let finalText = "";
        let interim = "";
        let done = false;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const finish = () => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          try { rec?.stop(); } catch { /* already stopped */ }
          const text = `${finalText} ${interim}`.trim();
          if (text) resolve(text); else reject(new Error("Didn't catch that — try again or type your answer."));
        };
        const arm = (ms: number) => { clearTimeout(timer); timer = setTimeout(finish, ms); };
        rec = new Ctor();
        rec.continuous = true;
        rec.interimResults = true;
        rec.onresult = (e: any) => {
          interim = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript as string;
            if (e.results[i].isFinal) finalText += ` ${t}`; else interim += ` ${t}`;
          }
          arm(SILENCE_MS);
        };
        rec.onerror = (e: any) => {
          if (e.error === "no-speech" || e.error === "aborted") return finish();
          done = true; clearTimeout(timer); reject(new Error(e.error ?? "Voice input failed"));
        };
        // Some browsers end the session on their own after a pause — restart until our timer decides.
        rec.onend = () => { if (!done) { try { rec.start(); } catch { finish(); } } };
        rec.start();
        arm(START_MS);
      }),
    stop: () => {
      rec?.abort?.();
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
    listen: () => { audio?.pause(); return browser.listen(); },
    stop: () => { generation++; audio?.pause(); settlePlayback?.(); browser.stop(); onPlayback?.("ready"); },
  };
}
