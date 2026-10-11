import { describe, expect, it, vi } from "vitest";
import { createBrowserVoice, createElevenLabsVoice, spokenWordAt } from "./voice";

describe("Spoken question alignment", () => {
  it("bounds duration-based words and handles empty captions", () => {
    expect(spokenWordAt("", 0.5)).toBe(-1);
    expect(spokenWordAt("Tell me about teamwork.", -1)).toBe(0);
    expect(spokenWordAt("Tell me about teamwork.", 1)).toBe(3);
    expect(spokenWordAt("Tell me about teamwork.", 0.5)).toBeGreaterThan(0);
  });

  it("uses browser speech word boundaries and clears on completion", async () => {
    const words: number[] = [];
    vi.stubGlobal("SpeechSynthesisUtterance", class { constructor(public text: string) {} });
    vi.stubGlobal("speechSynthesis", {
      cancel() {},
      speak(u: { onstart: () => void; onboundary: (e: { name: string; charIndex: number }) => void; onend: () => void }) {
        u.onstart();
        u.onboundary({ name: "word", charIndex: 5 });
        u.onend();
      },
    });
    await createBrowserVoice(undefined, (word) => words.push(word)).speak("Tell me about teamwork.");
    expect(words).toEqual([-1, 0, 1, -1]);
    vi.unstubAllGlobals();
  });

  it("never plays synthesis that completes after cancellation", async () => {
    let resolveAudio: (audio: string) => void = () => {};
    const makeAudio = vi.fn();
    vi.stubGlobal("Audio", makeAudio);
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const voice = createElevenLabsVoice(() => new Promise((resolve) => { resolveAudio = resolve; }));
    const pending = voice.speak("Cancelled question");
    voice.stop();
    resolveAudio("audio");
    await pending;
    expect(makeAudio).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});