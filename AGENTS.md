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

- DevUp persists game state (profile, XP, quests, resume reviews, interview sessions) in the connected Neon Postgres database through the Lovable connector gateway, not Lovable Cloud. Why: the user chose Neon as the backend and Lovable Cloud is disabled for this workspace. Keep all reads and writes inside `createServerFn` handlers in `src/lib/devup.functions.ts`, which use the gateway helpers in `src/lib/neon.server.ts`; never call the gateway from browser code and never store state in localStorage.
- Schema changes run once through the connector gateway (or Neon's SQL editor), never at request time. Why: request-time DDL multiplies a single migration into thousands of statements.
- Mock interview agents (job parser, question, grader) live behind server-only adapters in `src/lib/interview/agents.server.ts`; each uses its Raia agent when its secret env var is set and a built-in fallback otherwise, and voice goes through the `VoiceAgent` interface in `src/lib/interview/voice.ts`. Why: agents are added later without touching the UI flow.
