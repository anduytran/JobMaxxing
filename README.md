# JobMaxxing

An AI orchestration platform for the job hunt. Server-side agents handle interviewing, grading, resume analysis, and job matching — coordinated into a single gamified pipeline where every interaction feeds the next one.

Live at https://jobmaxxing.work

## How the AI is orchestrated

- **Interview Question Agent** — runs one persistent conversation per live interview, generating the behavioral/technical/resume mix, deciding when the candidate is done, and signaling the app to auto-finish.
- **Grading Agent** — scores transcripts on answer quality, accuracy, conciseness, tone, and question quality (peer mode), then writes results that feed XP payouts and skill ratings.
- **Resume Grader Agent** — persistent per-user conversation: OCRs the resume, runs ATS checks, scores against a 100-point rubric, and returns top-3 fix batches that are verified on the next upload or rescan.
- **Skill Expert Agent** — ranks users on tracked skills (ratings can rise, never fall), and vets user-submitted custom skills before they're allowed into the system.
- **Job Parser Agent** — extracts skills and titles from pasted job descriptions or fetched posting URLs (with web-search fallback), and judges title relevance across adjacent roles rather than strict matching.
- **Voice pipeline** — ElevenLabs text-to-speech on the server for the interviewer's voice, real-time transcription for candidate speech, with browser speech recognition as a fallback and moderation that auto-stops on vulgarity.
- **Peer orchestration** — no signaling server: peer sessions coordinate both sides through one shared database row, WebRTC (STUN) carries audio and consent-gated webcam, and both participants are graded in one pass.
- **Token accounting** — every AI interaction is metered server-side, with per-action and average usage surfaced in the app.

## What the app does with it

- **AI mock interviews** — solo or peer, tailored to a job description, resume, or live job match, with a pulsing live-interview interface and graded post-interview reports with coach notes.
- **Job Radar** — pulls live listings, scores matches, tracks statuses, and hands any role straight into a tailored interview.
- **Gamified progression** — quests with daily/weekly resets, XP, ranks, a 7-day streak with milestone bonuses, an Elo-style skill rating system, and a capsule-machine store with collectible cosmetics for the Max mascot.
- **Career dashboard** — one aggregate view of career points, rank, streaks, rating history, skill web, goal roles, and interview history.
- **Public demo links** — shareable `/demo/$token` links that run the full interview flow for anonymous visitors, saving nothing to any user account.

## Tech stack

- **Frontend:** React 19 + TanStack Start (file-based routing, server functions, SSR), Tailwind CSS v4, Framer Motion, Recharts
- **Backend:** TanStack Start server functions; PostgreSQL (Neon) for all state; cookie-based sessions (email + password, PBKDF2)
- **AI:** Raia agent platform for API conversations; ElevenLabs for voice and transcription
- **Realtime:** WebRTC (STUN) for peer audio/video, browser speech recognition fallback
- **Jobs:** Adzuna API for Job Radar listings

## Development

```sh
npm i
npm run dev
```

Then open http://localhost:8080. Signup is invite-only; run the app's own sign-in flow to create an account.

## Notes

- All AI calls and database access happen server-side; the browser never talks to the database or agent APIs directly.
- Interview XP is paid out server-side only, once per graded interview — no client-supplied amounts.
- Job posting URLs are fetched only while signed in, with each redirect hop validated against private networks.

This project was built with [Lovable](https://lovable.dev).
