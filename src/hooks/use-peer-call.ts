import { useCallback, useEffect, useRef, useState } from "react";
import { peerSignal } from "@/lib/peer.functions";

// Peer-to-peer audio (and webcam, when both sides consent) for peer interviews.
// The host makes the WebRTC offer, the guest answers; full SDPs (ICE already
// gathered) travel through the session row. Both sides join automatically when
// the interview goes live. Video is only requested when `video` is true — i.e.
// both participants opted in — and revoking consent stops the local camera.
export type CallState = "idle" | "connecting" | "connected" | "failed";

const ICE: RTCConfiguration = {
  iceServers: [{ urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302", "stun:stun.cloudflare.com:3478"] }],
};
const CONNECT_TIMEOUT_MS = 25000;

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
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const myOffer = useRef<string | null>(null); // host: the offer we last posted
  const appliedAnswer = useRef<string | null>(null); // host: answer applied to myOffer
  const answeredOffer = useRef<string | null>(null); // guest: offer we last answered
  const userLeft = useRef(false);
  const autoStarted = useRef(false);
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const videoRef = useRef(video);
  videoRef.current = video;

  // Media elements mount and unmount with the UI (video panels only render once
  // both consent), so re-attach streams on every render instead of only in ontrack.
  useEffect(() => {
    const a = audioRef.current;
    if (a && a.srcObject !== remoteStream) { a.srcObject = remoteStream; if (remoteStream) void a.play().catch(() => {}); }
    const rv = remoteVideoRef.current;
    if (rv && rv.srcObject !== remoteStream) { rv.srcObject = remoteStream; if (remoteStream) void rv.play().catch(() => {}); }
    const lv = localVideoRef.current;
    const want = video && localStream?.getVideoTracks().length ? localStream : null;
    if (lv && lv.srcObject !== want) { lv.srcObject = want; if (want) void lv.play().catch(() => {}); }
  });

  const closePc = () => {
    const pc = pcRef.current;
    if (pc) { pc.ontrack = null; pc.onconnectionstatechange = null; pc.close(); }
    pcRef.current = null;
  };

  const hangUp = useCallback(() => {
    userLeft.current = true;
    closePc();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    myOffer.current = appliedAnswer.current = answeredOffer.current = null;
    setLocalStream(null);
    setRemoteStream(null);
    setState("idle");
  }, []);

  const makePc = useCallback(async () => {
    closePc();
    let stream = streamRef.current;
    const wantVideo = videoRef.current;
    const hasVideo = !!stream?.getVideoTracks().some((t) => t.readyState === "live");
    if (!stream || wantVideo !== hasVideo) {
      stream?.getTracks().forEach((t) => t.stop());
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: wantVideo ? { width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      streamRef.current = stream;
    }
    stream.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));
    setLocalStream(stream);
    const pc = new RTCPeerConnection(ICE);
    stream.getTracks().forEach((t) => pc.addTrack(t, stream!));
    // Always ask to receive audio + video so the other side's camera can arrive
    // even when our own camera is off.
    // (Host only: the answerer's m-lines come from the offer.)
    if (isHost && !stream.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });
    const remote = new MediaStream();
    pc.ontrack = (e) => {
      if (pcRef.current !== pc) return;
      remote.addTrack(e.track);
      setRemoteStream(new MediaStream(remote.getTracks()));
    };
    let timer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      if (pcRef.current === pc && pc.connectionState !== "connected") {
        setState("failed");
        setError("Couldn't reach your friend — one of your networks may block direct calls. Retry, or keep going by typing.");
      }
    }, CONNECT_TIMEOUT_MS);
    pc.onconnectionstatechange = () => {
      if (pcRef.current !== pc) return;
      if (pc.connectionState === "connected") {
        if (timer) { clearTimeout(timer); timer = null; }
        setError(null);
        setState("connected");
      }
      if (pc.connectionState === "failed") {
        setState("failed");
        setError("Couldn't connect — your networks may block direct calls. Retry, or keep going by typing.");
      }
      if (pc.connectionState === "disconnected") setState("connecting");
    };
    pcRef.current = pc;
    return pc;
  }, [isHost]);

  // Host posts a fresh offer; guest prepares a connection and waits for one.
  const start = useCallback(async () => {
    if (!sessionId) return;
    userLeft.current = false;
    setError(null);
    setState("connecting");
    try {
      const pc = await makePc();
      if (isHost) {
        await pc.setLocalDescription(await pc.createOffer());
        await gathered(pc);
        const sdp = pc.localDescription!.sdp;
        myOffer.current = sdp;
        appliedAnswer.current = null;
        await peerSignal({ data: { id: sessionId, sdp, reset: true } });
      } else {
        answeredOffer.current = null; // answer whatever offer is current
      }
    } catch (e) {
      setState("failed");
      setError((e as Error).name === "NotAllowedError" ? "Camera/microphone blocked — allow them in your browser to talk." : (e as Error).message);
    }
  }, [sessionId, isHost, makePc]);

  // Join automatically once the interview is live.
  useEffect(() => {
    if (!live) { autoStarted.current = false; return; }
    if (autoStarted.current || !sessionId) return;
    autoStarted.current = true;
    void start();
  }, [live, sessionId, start]);

  // Apply the other side's SDP when it arrives.
  const busy = useRef(false);
  const [recheck, setRecheck] = useState(0);
  const latest = useRef(signal);
  latest.current = signal;
  useEffect(() => {
    if (!live || !sessionId || state === "idle" || state === "failed" || busy.current) return;
    const pc = pcRef.current;
    if (!pc) return;
    const seen = { offer: signal.offer, answer: signal.answer };
    void (async () => {
      busy.current = true;
      try {
        if (isHost) {
          // Only accept an answer to the offer we actually posted (the row may still be stale).
          if (!signal.answer || signal.offer !== myOffer.current || signal.answer === appliedAnswer.current) return;
          if (pc.signalingState === "have-local-offer") {
            appliedAnswer.current = signal.answer;
            await pc.setRemoteDescription({ type: "answer", sdp: signal.answer });
          } else if (appliedAnswer.current) {
            // Guest rejoined with a new answer to our old offer: renegotiate.
            void start();
          }
        } else if (signal.offer && signal.offer !== answeredOffer.current) {
          answeredOffer.current = signal.offer;
          const fresh = pc.signalingState === "stable" && !pc.remoteDescription ? pc : await makePc();
          await fresh.setRemoteDescription({ type: "offer", sdp: signal.offer });
          await fresh.setLocalDescription(await fresh.createAnswer());
          await gathered(fresh);
          await peerSignal({ data: { id: sessionId, sdp: fresh.localDescription!.sdp, forOffer: signal.offer } });
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        busy.current = false;
        // Re-evaluate only if new signals arrived while we were busy.
        if (latest.current.offer !== seen.offer || latest.current.answer !== seen.answer) setRecheck((n) => n + 1);
      }
    })();
  }, [live, sessionId, isHost, signal.offer, signal.answer, state, makePc, start, recheck]);

  // Mutual video consent changed mid-call: the host re-offers so camera tracks are added/removed.
  const lastVideo = useRef(video);
  useEffect(() => {
    if (lastVideo.current === video) return;
    lastVideo.current = video;
    if (!video) {
      streamRef.current?.getVideoTracks().forEach((t) => { t.enabled = false; t.stop(); });
    }
    if (userLeft.current || !live) return;
    if (state === "idle" || state === "failed") void start();
    else if (isHost) void start();
    // Guest waits: the host's fresh offer triggers a new connection with the camera.
  }, [video, state, isHost, live, start]);

  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !muted));
  }, [muted]);

  useEffect(() => { if (!live) hangUp(); }, [live, hangUp]);
  useEffect(() => () => { autoStarted.current = false; hangUp(); }, [hangUp]);

  return { state, error, muted, setMuted, start, hangUp, audioRef, localVideoRef, remoteVideoRef };
}
