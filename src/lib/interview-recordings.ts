// Interview camera recordings kept in this browser tab's memory only — nothing
// is uploaded. They can be rewatched or downloaded until the tab is closed.
import { useSyncExternalStore } from "react";

export type RecordingKind = "solo" | "peer" | "demo";
export type InterviewRecording = {
  id: string;
  kind: RecordingKind;
  title: string;
  /** Saved interview row this recording belongs to, when known. */
  interviewId: string | null;
  url: string;
  mime: string;
  at: number;
  seconds: number;
};

let items: InterviewRecording[] = [];
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export function addRecording(r: InterviewRecording) { items = [r, ...items]; emit(); }
export function linkRecording(id: string, interviewId: string) {
  items = items.map((r) => (r.id === id ? { ...r, interviewId } : r)); emit();
}
export function removeRecording(id: string) {
  const r = items.find((x) => x.id === id);
  if (r) URL.revokeObjectURL(r.url);
  items = items.filter((x) => x.id !== id); emit();
}
const EMPTY: InterviewRecording[] = [];
export function useRecordings() {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => items, () => EMPTY);
}
export function recordingFileName(r: InterviewRecording) {
  const ext = r.mime.includes("mp4") ? "mp4" : "webm";
  const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "interview";
  return `jobmaxxing-${slug}-${new Date(r.at).toISOString().slice(0, 10)}.${ext}`;
}
