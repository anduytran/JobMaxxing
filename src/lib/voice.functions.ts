import { createServerFn } from "@tanstack/react-start";
import { DEFAULT_VOICE_ID, VOICE_IDS, VOICES } from "./voices";

/** The signed-in user's chosen interviewer voice. */
export const getInterviewVoice = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { neonExecute } = await import("./neon.server");
  const user = await requireUser();
  const { rows } = await neonExecute("select interview_voice from public.devup_profile where id = $1", [user.id]);
  const v = String(rows[0]?.["interview_voice"] ?? "");
  return { voiceId: VOICE_IDS.includes(v) ? v : DEFAULT_VOICE_ID };
});

export const setInterviewVoice = createServerFn({ method: "POST" })
  .inputValidator((i: { voiceId: unknown }) => {
    const voiceId = String(i.voiceId ?? "");
    if (!VOICE_IDS.includes(voiceId)) throw new Error("Unknown voice.");
    return { voiceId };
  })
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const { neonExecute } = await import("./neon.server");
    const user = await requireUser();
    await neonExecute("update public.devup_profile set interview_voice = $2, updated_at = now() where id = $1", [user.id, data.voiceId]);
    return { ok: true as const };
  });

/** Short sample line in a given voice, for the Settings preview button. */
export const previewInterviewVoice = createServerFn({ method: "POST" })
  .inputValidator((i: { voiceId: unknown }) => {
    const voiceId = String(i.voiceId ?? "");
    if (!VOICE_IDS.includes(voiceId)) throw new Error("Unknown voice.");
    return { voiceId };
  })
  .handler(async ({ data }) => {
    const { requireUser } = await import("./auth.server");
    const user = await requireUser();
    const { synthesize } = await import("./interview/agents.server");
    const name = VOICES.find((v) => v.id === data.voiceId)!.name;
    return { audio: await synthesize(`Hi, I'm ${name}. Thanks for joining — tell me a little about yourself.`, user.id, data.voiceId) };
  });
