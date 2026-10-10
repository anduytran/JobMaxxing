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

- ResumeScoreCard derives its random pending action, rank progress, and reward labels from the latest review and shared resume XP rules without awarding XP or changing reviews. Why: dashboard gamification must reflect the existing Resume Lab workflow.

- The top-bar QuestMenu derives capped daily and weekly lists from GameProvider without creating or modifying quests. Why: mission-menu presentation must preserve existing progression and reset rules.

- Featured quest display titles use the browser-safe quest-titles helper while preserving full saved titles. Why: concise card copy must not rewrite user quests or require data migrations.

- Max poses are centralized through MAX_POSES; uploaded mascot images use CDN asset pointers, and sign-in shares the same wave source. Why: one image mapping keeps artwork consistent everywhere without duplicating binary files.

- Shared motion lives in global CSS and AppShell's reduced-motion-aware MotionConfig; stateful encouragement stays in frontend components. Why: animation polish must not change persistence or existing interview and resume workflows.

- JobMaxxing persists game state (profile, XP, quests, resume reviews, interview sessions) in the connected Neon Postgres database through the Lovable connector gateway, not Lovable Cloud. Why: the user chose Neon as the backend and Lovable Cloud is disabled for this workspace. Keep all reads and writes inside `createServerFn` handlers in `src/lib/devup.functions.ts`, which use the gateway helpers in `src/lib/neon.server.ts`; never call the gateway from browser code and never store state in localStorage.
- Schema changes run once through the connector gateway (or Neon's SQL editor), never at request time. Why: request-time DDL multiplies a single migration into thousands of statements.
- Mock interview agents (job parser, question, grader) live behind server-only adapters in `src/lib/interview/agents.server.ts`; each uses its Raia agent when its secret env var is set and a built-in fallback otherwise, and voice goes through the `VoiceAgent` interface in `src/lib/interview/voice.ts`. Why: agents are added later without touching the UI flow.
- Accounts are email + password stored in Neon (`devup_user`, PBKDF2 hashes) with httpOnly cookie sessions (`devup_session`, SHA-256 of the token); every private server function scopes by `requireUser()` from `src/lib/auth.server.ts`. Why: Lovable Cloud auth is unavailable, and OAuth can be added later on the same session table.
- The live interview dialogue runs through one Raia conversation per interview (Question agent, `/external/conversations` + `/messages`), with each spoken line voiced by ElevenLabs TTS on the server and candidate speech captured by browser speech recognition; any failure falls back to the planned questions and browser voice. Why: the agent keeps context across turns while the interview never dead-ends.
- Featured-quest card layouts (Max/backdrop offsets and sizes per quest type) live in Neon `devup_featured_layout` via `src/lib/layout.functions.ts`; only the editor email set there may save. Why: one designer tunes the cards for everyone without code changes.
- Resume grading uploads the original file (PDF/image) to the Raia Resume Agent via `/external/prompts/upload-url` + `files` (pdfjs text is only a fallback); the agent's instructions and output JSON schema live in Raia and must match `normalizeReview` in `src/lib/interview/agents.server.ts`. Every scan or editor save is a `devup_resume_version` row, each grade a `devup_resume_review` linked by `version_id`, and one-time XP milestones use `milestone:*` reasons on `devup_xp_event` (unique index). Why: version history, scanned resumes and idempotent XP need the original file and stable line ids.
- Never `order by id` after aliasing `id::text as id` — it sorts as text; qualify the table column. Why: '9' > '11' showed stale grades.
- Session cleanup runs inside `startSession` (one transaction: sweep expired sessions, keep each user's newest few). Why: no cron exists, and sign-in is the natural point to prune the session table.
