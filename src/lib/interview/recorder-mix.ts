// Mixes the interviewer's synthesized voice into the local interview recording.
// While a recording is active, each ElevenLabs audio element is routed through a
// shared AudioContext into a MediaStreamDestination; the recorder combines that
// stream with the microphone track so the saved video carries both sides.
let ctx: AudioContext | null = null;
let dest: MediaStreamAudioDestinationNode | null = null;
const sources = new Set<MediaElementAudioSourceNode>();

/** Start an interviewer-audio mix. Returns the mixed audio stream, or null if unsupported. */
export function beginRecorderMix(): MediaStream | null {
  try {
    ctx ??= new AudioContext();
    void ctx.resume();
    endRecorderMix();
    dest = ctx.createMediaStreamDestination();
    return dest.stream;
  } catch {
    return null;
  }
}

export function endRecorderMix() {
  sources.forEach((s) => {
    try { s.disconnect(); } catch { /* already disconnected */ }
  });
  sources.clear();
  dest = null;
}

/** Route a playing audio element into the active recording mix (no-op when not recording). */
export function mixElementIntoRecording(el: HTMLAudioElement) {
  if (!ctx || !dest) return;
  try {
    const src = ctx.createMediaElementSource(el);
    // MediaElementSource takes over the element's output, so reconnect to speakers too.
    src.connect(ctx.destination);
    src.connect(dest);
    sources.add(src);
  } catch {
    /* element already routed or context closed */
  }
}
