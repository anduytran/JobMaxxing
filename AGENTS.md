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
- Max poses come from `MAX_POSES` (uploaded images as CDN pointers; sign-in shares wave) and `MAX_SCALE` in `src/components/Max.tsx` normalises each pose to the branding pose's measured silhouette at `clamp(140px,21svh,300px) * MAX_SCALE[pose]`; motion lives in global CSS and AppShell's MotionConfig. Why: one art mapping, one motion system; each canvas has different transparent padding.
- Game state (profile, XP, quests, resume reviews, interview sessions) persists in Neon Postgres through the Lovable connector gateway, not Lovable Cloud. Reads and writes stay in `createServerFn` handlers (`src/lib/devup.functions.ts`) using `src/lib/neon.server.ts` helpers — never from browser code, never localStorage; run schema changes once through the gateway or Neon's SQL editor. Why: the user chose Neon; request-time DDL multiplies one migration
- Agents stay server-only with Raia/fallbacks. VoiceAgent reports playback and live captions; capture ends manually and mic tests stop tracks on exit. Keep typed fallback/report transcript. Why: no leaks
- Accounts are email + password in Neon (`devup_user`, PBKDF2 hashes) with httpOnly cookie sessions (`devup_session`, SHA-256 of the token); private server functions scope by `requireUser()` from `src/lib/auth.server.ts`, and `startSession` sweeps expired sessions and keeps each user's newest few in one transaction. Why: Lovable Cloud auth is unavailable; sign-in is the natural prune point
- One Raia conversation runs each live interview (Question agent, `/external/conversations` + `/messages`), each line voiced by ElevenLabs TTS on the server and candidate speech captured by browser speech recognition, falling back to the planned questions and browser voice. Why: the agent keeps context; the interview never dead-ends
- Featured-quest card layouts (Max/backdrop offsets and sizes per quest type) live in Neon `devup_featured_layout` via `src/lib/layout.functions.ts`; only the editor email set there may save. Why: one tuner
- Resume grading uploads the original file (PDF/image) to the Raia Resume Agent via `/external/prompts/upload-url` + `files` (pdfjs text is only a fallback); Raia's instructions and output schema must match `normalizeReview` in `src/lib/interview/agents.server.ts`. Every scan or editor save is a `devup_resume_version` row, each grade a `devup_resume_review` linked by `version_id`, and one-time XP milestones use `milestone:*` reasons on `devup_xp_event` (unique index). Why: stable ids for history and XP.
- Resume fixes ship in batches of `SUGGESTION_BATCH` (`src/lib/resume.ts`), clamped in the grader prompt, `normalizeReview` and the fallback; only `moreResumeSuggestions` (`src/lib/resume.functions.ts`) issues the next batch and refuses while any current fix is unapplied. Why: no skipping
- Never `order by id` after aliasing `id::text as id`; qualify the column. Why: text sort

- Home's featured quest card fills the viewport (`min-h-[calc(100svh_-_4rem)]`, AppShell drops page padding only on `/`); greeting, shortcuts, resume score, career progress and Max tips live on `/progress`. Uploaded CDN scenes render as full-inset covers (portrait on mobile), centred on wide screens and low-centre on phones; the text column stops at `calc(50%_-_13svh_-_1.5rem)` from `md` up; interview-category quests get no slide; each slide shows its real quest XP and a `Start` link; `AppShell` keeps the leftmost `Lock In` mode picker. Why: art fills screen, words clear of Max.
- Quest reset countdowns derive from `src/lib/reset-times.ts` (`nextDailyReset` = next 00:00 UTC, `nextWeeklyReset` = next Monday 00:00 UTC) and render only after hydration. Why: match server `date_trunc`; avoid hydration mismatch.

- Peer interviews share one `devup_peer_session` row via `src/lib/peer.functions.ts`: WebRTC audio signalled through its `signal` column (host offers, guest answers only the current offer via atomic jsonb writes, both auto-join when live, STUN only), each side's browser transcribes its own lines into `peerSay`, which runs `src/lib/moderation.ts` (severe = stop, 3 profanity strikes = stop); `peerGrade` claims and grades both sides server-side once. Why: no signalling server; one grade.
- Skill ratings never decrease: MMR (`src/lib/mmr.server.ts`) and Raia Skill Expert (`src/lib/skills.server.ts`) write with `greatest()`, rise capped per refresh. Why: unfakeable
- Interview entry points open the Solo/Peer picker (`src/components/InterviewModePicker.tsx`) instead of navigating; Job Radar "Practice Interview for this Role" still goes straight to solo with its role context. Why: one place to choose who interviews you, tailored practice keeps its job context
