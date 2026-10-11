import { useCallback, useEffect, useRef, useState } from "react";
import { peerSignal } from "@/lib/peer.functions";

// Peer-to-peer audio (and webcam, when both sides consent) for peer interviews.
// The host makes the WebRTC offer, the guest answers; full SDPs (ICE already
// gathered) travel through the session row. Video is only ever requested when
// `video` is true — i.e. both participants opted in — and revoking consent
// disables the local track without renegotiation.
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

export function usePeerCall(opts: {
  sessionId: string | null;
  isHost: boolean;
  live: boolean;
  signal: { offer?: string; answer?: string };
  video: boolean;
}) {
  const { sessionId, isHost, live, signal, video } = opts;
  const [state, setState] = useState<CallState>("idle");
  const [muted, setMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const handled = useRef<string | null>(null);
  const videoRef = useRef(video);
  videoRef.current = video;

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
    let stream = streamRef.current;
    const wantVideo = videoRef.current;
    const hasVideo = !!stream?.getVideoTracks().length;
    if (!stream || (wantVideo && !hasVideo)) {
      stream?.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: wantVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      streamRef.current = stream;
    }
    stream.getAudioTracks().forEach((t) => (t.enabled = !muted));
    if (localVideoRef.current) localVideoRef.current.srcObject = wantVideo ? stream : null;
    const pc = new RTCPeerConnection(ICE);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream!));
    pc.ontrack = (e) => {
      const remote = e.streams[0] ?? null;
      if (e.track.kind === "video" && remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = remote;
        void remoteVideoRef.current.play().catch(() => {});
      } else if (audioRef.current) {
        audioRef.current.srcObject = remote;
        void audioRef.current.play().catch(() => {});
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "connected") setState("connected");
      if (pc.connectionState === "failed") { setState("failed"); setError("Couldn't connect — your networks may block direct calls. Keep going by typing."); }
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
      setError((e as Error).name === "NotAllowedError" ? "Camera/microphone blocked — allow them in your browser to talk." : (e as Error).message);
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

  // When mutual video consent arrives mid-call, the host re-offers with a video track.
  const videoStarted = useRef(false);
  useEffect(() => {
    if (!video) { videoStarted.current = false; return; }
    if (videoStarted.current) return;
    videoStarted.current = true;
    if (state === "connected" || state === "connecting") {
      if (isHost) void start();
    } else if (state === "idle") {
      void start();
    }
  }, [video, state, isHost, start]);

  // Consent revoked: stop sending camera frames locally (no renegotiation needed).
  useEffect(() => {
    if (video) return;
    streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = false; t.stop(); });
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
  }, [video]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => { if (!live) hangUp(); }, [live, hangUp]);
  useEffect(() => hangUp, [hangUp]);

  return { state, error, muted, setMuted, start, hangUp, audioRef, localVideoRef, remoteVideoRef };
}
