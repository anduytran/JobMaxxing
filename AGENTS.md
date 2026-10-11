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

- ResumeScoreCard, DashboardProgressCards (merged Career card) and QuestMenu only read GameProvider and navigate; never award XP, create quests or change resets. Why: presentation reflects real workflows.
- Featured titles use the browser-safe quest-titles helper, render two lines and preserve saved titles. Why: display copy must not rewrite quests
- Max poses come from `MAX_POSES` (uploaded images as CDN pointers; sign-in shares wave) and `MAX_SCALE` in `src/components/Max.tsx` normalises each pose to the branding pose's measured silhouette at `clamp(140px,21svh,300px) * MAX_SCALE[pose]`; motion lives in global CSS and AppShell's MotionConfig. Why: one art mapping, one motion system; each canvas has different transparent padding.
- Game state (profile, XP, quests, resume reviews, interview sessions) persists in Neon Postgres through the Lovable connector gateway, not Lovable Cloud. Reads and writes stay in `createServerFn` handlers (`src/lib/devup.functions.ts`) using `src/lib/neon.server.ts` helpers — never from browser code, never localStorage; run schema changes once through the gateway or Neon's SQL editor. Why: the user chose Neon; request-time DDL multiplies one migration.
- Agents stay server-only with Raia/fallbacks. VoiceAgent reports playback and live captions; capture ends manually and mic tests stop tracks on exit. Keep typed fallback/report transcript. Why: real voice states, no leaks
- Accounts are email + password in Neon (`devup_user`, PBKDF2 hashes) with httpOnly cookie sessions (`devup_session`, SHA-256 of the token); private server functions scope by `requireUser()` from `src/lib/auth.server.ts`, and `startSession` sweeps expired sessions and keeps each user's newest few in one transaction. Why: Lovable Cloud auth is unavailable; sign-in is the natural prune point.
- One Raia conversation runs each live interview (Question agent, `/external/conversations` + `/messages`), each line voiced by ElevenLabs TTS on the server and candidate speech captured by browser speech recognition, falling back to the planned questions and browser voice. Why: the agent keeps context; the interview never dead-ends.
- Featured-quest card layouts (Max/backdrop offsets and sizes per quest type) live in Neon `devup_featured_layout` via `src/lib/layout.functions.ts`; only the editor email set there may save. Why: one designer tunes cards
- Resume grading uploads the original file (PDF/image) to the Raia Resume Agent via `/external/prompts/upload-url` + `files` (pdfjs text is only a fallback); Raia's instructions and output schema must match `normalizeReview` in `src/lib/interview/agents.server.ts`. Every scan or editor save is a `devup_resume_version` row, each grade a `devup_resume_review` linked by `version_id`, and one-time XP milestones use `milestone:*` reasons on `devup_xp_event` (unique index). Why: version history and idempotent XP need stable line ids.
- Resume fixes ship in batches of `SUGGESTION_BATCH` (`src/lib/resume.ts`), clamped in the grader prompt, `normalizeReview` and the fallback; only `moreResumeSuggestions` (`src/lib/resume.functions.ts`) issues the next batch and refuses while any current fix is unapplied. Why: the queue can't be skipped
- Never `order by id` after aliasing `id::text as id` — it sorts as text; qualify the table column. Why: '9' > '11' showed stale grades.

- Home's featured quest card fills the viewport (`min-h-[calc(100svh_-_4rem)]`, AppShell drops page padding only on `/`); greeting, shortcuts, resume score, career progress and Max tips live on `/progress`. Uploaded CDN scenes render as full-inset covers (portrait on mobile), centred on wide screens and low-centre on phones; the text column stops at `calc(50%_-_13svh_-_1.5rem)` from `md` up; interview-category quests get no slide; each slide shows its real quest XP and a `Start` link; `AppShell` keeps the leftmost `Lock In` mode picker. Why: artwork fills the screen; centred art keeps words clear of Max.
- Quest reset countdowns derive from `src/lib/reset-times.ts` (`nextDailyReset` = next 00:00 UTC, `nextWeeklyReset` = next Monday 00:00 UTC) and render only after hydration. Why: they must match the server's `date_trunc` flip; a server-rendered time would hydration-mismatch.
- Peer interviews share one `devup_peer_session` row (6-char code, host/guest, roles, question plan, transcript, grade) via `src/lib/peer.functions.ts`; both sides poll `getPeerSession` every 3s, no voice agent or Raia conversation, and the candidate's client grades once then saves with `peerSaveGrade`. Why: same generator and grader as the AI interview; a friend drives it.
