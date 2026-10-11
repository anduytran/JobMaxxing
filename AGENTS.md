<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules

- ResumeScoreCard, DashboardProgressCards and QuestMenu only read GameProvider and navigate; never award XP, create quests or change resets. Why: presentation reflects real workflows
- Featured titles use the browser-safe quest-titles helper, render two lines and preserve saved titles. Why: display copy must not rewrite quests
- Max poses come from `MAX_POSES` (CDN pointers) and `MAX_SCALE` in `src/components/Max.tsx`, normalised to the branding silhouette at `clamp(140px,21svh,300px) * MAX_SCALE[pose]`; motion lives in global CSS and AppShell's MotionConfig. Why: one art mapping, one motion system.
- Game state persists in Neon Postgres through the Lovable connector gateway, not Lovable Cloud. Reads and writes stay in `createServerFn` handlers using `src/lib/neon.server.ts` helpers — never browser code, never localStorage; run schema changes once through the gateway. Why: the user chose Neon; request-time DDL multiplies one migration
- Agents stay server-only. VoiceAgent reports playback, captions and words (browser boundaries/audio-duration estimates); cancel on exit. Radar parsing is click-only. Why: safe, editable context.
- Accounts are email + password in Neon (`devup_user`, PBKDF2) with httpOnly cookie sessions (`devup_session`, SHA-256 of the token); private server functions scope by `requireUser()` from `src/lib/auth.server.ts`; `startSession` sweeps expired sessions, keeps the newest few. Why: Lovable Cloud auth is unavailable; sign-in is the natural prune point
- One Raia conversation runs each live interview, each line voiced by ElevenLabs TTS on the server and candidate speech captured by browser speech recognition, falling back to planned questions and browser voice. Why: the agent keeps context; the interview never dead-ends

- Featured-quest card layouts live in Neon `devup_featured_layout` via `src/lib/layout.functions.ts`; only the editor email set there may save. Why: one tuner
- Never `order by id` after `id::text as id`; qualify it. Why: text sort
- Store economy (`src/lib/store.functions.ts`): points = sum(devup_xp_event) − sum(devup_purchase.cost); boosters multiply XP at award time in devup.functions; themes apply via `data-theme` on <html>. Why: points track XP with no extra writes

- Home's featured card fills the viewport (full-inset CDN scenes, portrait on phones; real quest XP + `Start`); everything else lives on `/progress`. Why: art fills screen
- Quest reset countdowns derive from `src/lib/reset-times.ts` (next daily reset = 00:00 UTC, weekly = Monday 00:00 UTC) and render only after hydration. Why: match server `date_trunc`; avoid hydration mismatch.

- Peer interviews share one `devup_peer_session` row via `src/lib/peer.functions.ts`: WebRTC audio signalled through its `signal` column (atomic jsonb, STUN only); the clock starts only when both sides mark ready via peerReady; lines go through `peerSay` + `src/lib/moderation.ts`; `peerGrade` grades both sides once. Why: no signalling server; one grade
- Skill ratings never decrease: MMR (`src/lib/mmr.server.ts`) and Raia Skill Expert (`src/lib/skills.server.ts`) write with `greatest()`, rises capped. Why: unfakeable
- Interview entry points open `InterviewModePicker`; only Job Radar practice goes straight to solo with its role. Why: one chooser; tailored practice keeps context
- Career dashboard (/progress) reads one aggregate, `getCareerDashboard` in `src/lib/career.functions.ts` (streaks, goals, Elo history in `devup_skill_rating_log`, saved radar roles with skill gaps, peer sessions). Graded interviews and resume scans call `bumpStreak`. Why: one dashboard source
- Friends/invites live in `src/lib/friends.functions.ts`; presence is derived from sessions, `InviteListener` polls, and invites carry the peer code so accepting calls joinPeerSession. Why: no realtime server; reuses the peer flow
- Tracked skills may be custom, but a new one must pass the Skill Expert's check (`vetSkill`) before it is added. Why: only real skills get rated
- New Max pose art is trimmed to the shared framing (figure fills its square, feet on the bottom) before getting a `MAX_SCALE`. Why: wide margins float out of the mobile card
- Interview XP is paid only by `claimInterviewXp` from the stored grade, once per `iv:` reason; no endpoint takes a client XP amount. Why: no XP minting
- User-supplied URLs are fetched only signed-in, through `assertPublicUrl` per redirect hop. Why: no private-network fetches
- `/demo/$token` runs `InterviewFlow` signed out via `demo.functions` only: secret links, per-run call budget, no user writes. Why: public demo, bounded cost
- Wearable placement comes from `placeWearable` in `src/lib/wearable-fit.ts` (measured per-pose anchors + user-dragged spots in `devup_profile.wearable_spots`); every dressed Max uses it. Why: one fit per pose
- Interviewer voice is a curated list in `src/lib/voices.ts`, saved in `devup_profile.interview_voice`; demo links keep the default voice. Why: server validates voice ids
- Interview camera recordings are consent-gated by `InterviewRecorder` and live only in tab memory (`src/lib/interview-recordings.ts`, blob URLs), rewatchable/downloadable but never uploaded. Why: no file storage chosen yet
