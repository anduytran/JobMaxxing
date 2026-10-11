import { useCallback, useEffect, useRef, useState } from "react";
import { peerSignal } from "@/lib/peer.functions";

// Peer-to-peer audio for peer interviews. The host makes the WebRTC offer, the
// guest answers; full SDPs (ICE already gathered) travel through the session row.
export type CallState = "idle" | "connecting" | "connected" | "failed";

const ICE: RTCConfiguration = { iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] }] };

function gathered(pc: RTCPeerConnection) {
  return new Promise<void>((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const t = setTimeout(resolve, 4000);
    pc.addEventListener("icegatheringstatechange", () => {
      if (pc.iceGatheringState === "complete") { clearTimeout(t); resolve(); }
    });
  });
}

export function usePeerCall(opts: { sessionId: string | null; isHost: boolean; live: boolean; signal: { offer?: string; answer?: string } }) {
  const { sessionId, isHost, live, signal } = opts;
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const handled = useRef<string | null>(null);

  const hangUp = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    handled.current = null;
    setState("idle");
  }, []);

  const makePc = useCallback(async () => {
    pcRef.current?.close();
    const stream = streamRef.current ?? (await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }));
    streamRef.current = stream;
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    const pc = new RTCPeerConnection(ICE);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream));
    pc.ontrack = (e) => { if (audioRef.current) { audioRef.current.srcObject = e.streams[0] ?? null; void audioRef.current.play().catch(() => {}); } };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setState("connected");
      if (pc.connectionState === "failed") { setState("failed"); setError("Couldn't connect audio — your networks may block direct calls. Keep going by typing."); }
    };
    pcRef.current = pc;
    return pc;
  }, [muted]);

  // Host: start the call by posting an offer.
  const start = useCallback(async () => {
    if (!sessionId) return;
    setError(null);
    setState("connecting");
    try {
      const pc = await makePc();
      if (isHost) {
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc);
        await peerSignal({ data: { id: sessionId, sdp: pc.localDescription!.sdp, reset: true } });
        handled.current = null;
      }
    } catch (e) {
      setState("failed");
      setError((e as Error).name === "NotAllowedError" ? "Microphone blocked — allow it in your browser to talk." : (e as Error).message);
    }
  }, [sessionId, isHost, makePc]);

  // Apply the other side's SDP when it arrives.
  useEffect(() => {
    if (!live || !sessionId || state === "idle" || state === "failed") return;
    const pc = pcRef.current;
    if (!pc) return;
    void (async () => {
      try {
        if (isHost && signal.answer && handled.current !== signal.answer && pc.signalingState === "have-local-offer") {
          handled.current = signal.answer;
          await pc.setRemoteDescription({ type: "answer", sdp: signal.answer });
        }
        if (!isHost && signal.offer && handled.current !== signal.offer) {
          handled.current = signal.offer;
          const fresh = pc.signalingState === "stable" && !pc.remoteDescription ? pc : await makePc();
          await fresh.setRemoteDescription({ type: "offer", sdp: signal.offer });
          await fresh.setLocalDescription(await fresh.createAnswer());
          await gathered(fresh);
          await peerSignal({ data: { id: sessionId, sdp: fresh.localDescription!.sdp } });
        }
      } catch (e) { setError((e as Error).message); }
    })();
  }, [live, sessionId, isHost, signal.offer, signal.answer, state, makePc]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => { if (!live) hangUp(); }, [live, hangUp]);
  useEffect(() => hangUp, [hangUp]);

  return { state, error, muted, setMuted, start, hangUp, audioRef };
}
