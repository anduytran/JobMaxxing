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

- ResumeScoreCard, DashboardProgressCards (merged Career card) and QuestMenu only read GameProvider and navigate; never award XP, create quests or change resets. Why: presentation reflects real workflows
- Featured titles use the browser-safe quest-titles helper, render two lines and preserve saved titles. Why: display copy must not rewrite quests
- Max poses come from `MAX_POSES` (uploaded images as CDN pointers) and `MAX_SCALE` in `src/components/Max.tsx` normalises each pose to the branding pose's silhouette at `clamp(140px,21svh,300px) * MAX_SCALE[pose]`; motion lives in global CSS and AppShell's MotionConfig. Why: one art mapping, one motion system.
- Game state (profile, XP, quests, resume reviews, interviews) persists in Neon Postgres through the Lovable connector gateway, not Lovable Cloud. Reads and writes stay in `createServerFn` handlers using `src/lib/neon.server.ts` helpers — never browser code, never localStorage; run schema changes once through the gateway. Why: the user chose Neon; request-time DDL multiplies one migration
- Agents stay server-only. VoiceAgent reports playback, captions and words (browser boundaries/audio-duration estimates); cancel on exit. Radar parsing is click-only. Why: safe, editable context.
- Accounts are email + password in Neon (`devup_user`, PBKDF2) with httpOnly cookie sessions (`devup_session`, SHA-256 of the token); private server functions scope by `requireUser()` from `src/lib/auth.server.ts`; `startSession` sweeps expired sessions and keeps the newest few. Why: Lovable Cloud auth is unavailable; sign-in is the natural prune point
- One Raia conversation runs each live interview, each line voiced by ElevenLabs TTS on the server and candidate speech captured by browser speech recognition, falling back to planned questions and browser voice. Why: the agent keeps context; the interview never dead-ends
- Featured-quest card layouts (Max/backdrop offsets and sizes per quest type) live in Neon `devup_featured_layout` via `src/lib/layout.functions.ts`; only the editor email set there may save. Why: one tuner
- Resume grading uploads the original file to the Raia Resume Agent via `/external/prompts/upload-url` (pdfjs text is only a fallback); Raia's output must match `normalizeReview` in `src/lib/interview/agents.server.ts`. Every scan/editor save is a `devup_resume_version` row, each grade a `devup_resume_review` linked by `version_id`, and one-time XP milestones use `milestone:*` reasons on `devup_xp_event` (unique index). Why: stable ids for history and XP.
- Resume fixes ship in batches of `SUGGESTION_BATCH` (`src/lib/resume.ts`), clamped in the grader prompt, `normalizeReview` and the fallback; only `moreResumeSuggestions` issues the next batch and refuses while any current fix is unapplied. Why: no skipping
- Never `order by id` after aliasing `id::text as id`; qualify it. Why: text sort

- Home's featured quest card fills the viewport; greeting, shortcuts, resume score, career progress and Max tips live on `/progress`. Uploaded CDN scenes render as full-inset covers, portrait variants on phones; interview-category quests get no slide; each slide shows its real quest XP and a `Start` link. Why: art fills screen, words clear of Max.
- Quest reset countdowns derive from `src/lib/reset-times.ts` (next daily reset = 00:00 UTC, weekly = Monday 00:00 UTC) and render only after hydration. Why: match server `date_trunc`; avoid hydration mismatch.

- Peer interviews share one `devup_peer_session` row via `src/lib/peer.functions.ts`: WebRTC audio signalled through its `signal` column (atomic jsonb, STUN only); the clock starts only when both sides mark ready via peerReady; lines go through `peerSay` + `src/lib/moderation.ts`; `peerGrade` grades both sides once. Why: no signalling server; one grade.
- Skill ratings never decrease: MMR (`src/lib/mmr.server.ts`) and Raia Skill Expert (`src/lib/skills.server.ts`) write with `greatest()`, rise capped per refresh. Why: unfakeable
- Interview entry points open the Solo/Peer picker (`src/components/InterviewModePicker.tsx`) instead of navigating; Job Radar "Practice Interview for this Role" still goes straight to solo with its role context. Why: one place to choose who interviews you, tailored practice keeps its job context
- Career dashboard (/progress) reads one aggregate, `getCareerDashboard` in `src/lib/career.functions.ts` (streaks, goals, Elo history in `devup_skill_rating_log` written on every rating rise, saved radar roles with skill gaps, peer sessions). Graded interviews and resume scans call `bumpStreak`. Why: one dashboard source
