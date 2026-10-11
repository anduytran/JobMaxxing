// Curated ElevenLabs interviewer voices, shared by Settings and the server.
export type VoiceOption = { id: string; name: string; style: string };

export const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export const VOICES: VoiceOption[] = [
  { id: "JBFqnCBsd6RMkjVDRZzb", name: "George", style: "Warm, steady British male — the classic interviewer" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", style: "Calm, reassuring female — easygoing practice" },
  { id: "nPczCjzI2devNBz1zQrb", name: "Brian", style: "Deep, confident American male — senior hiring manager" },
  { id: "cgSgspJ2msm6clMCkdW9", name: "Jessica", style: "Bright, upbeat American female — friendly recruiter" },
  { id: "IKne3meq5aSn9XLyUdCD", name: "Charlie", style: "Casual, natural Australian male — startup chat" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", style: "Crisp, professional British female — formal panel" },
];

export const VOICE_IDS = VOICES.map((v) => v.id);
