// Client-side voice agent abstraction. The browser voice is the default;
// an ElevenLabs implementation plugs in here once an agent exists.
export interface VoiceAgent {
  speak(text: string): Promise<void>;
  listen(): Promise<string>; // resolves with the candidate's transcribed answer
  stop(): void;
}

type SR = { new (): any };

export function createBrowserVoice(): VoiceAgent {
  let rec: any = null;
  return {
    speak: (text) =>
      new Promise((resolve) => {
        if (typeof window === "undefined" || !window.speechSynthesis) return resolve();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1.05;
        u.onend = () => resolve();
        u.onerror = () => resolve();
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }),
    listen: () =>
      new Promise((resolve, reject) => {
        const w = window as unknown as { SpeechRecognition?: SR; webkitSpeechRecognition?: SR };
        const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
        if (!Ctor) return reject(new Error("Voice input isn't supported in this browser — type your answer instead."));
        rec = new Ctor();
        rec.continuous = false;
        rec.onresult = (e: any) => resolve(e.results[0][0].transcript as string);
        rec.onerror = (e: any) => reject(new Error(e.error ?? "Voice input failed"));
        rec.start();
      }),
    stop: () => {
      rec?.abort?.();
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
  };
}

// TODO(ElevenLabs): implement createElevenLabsVoice() using @elevenlabs/react's useConversation
// with a server-minted conversation token, feeding each generated question as a contextual update.
