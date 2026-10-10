# Resume Grader rebuild

Confirmed with the Raia API: prompts accept uploaded files (`/external/prompts/upload-url`), and agents can hold a vector store of files (`/external/agent-files/upload` + `add-to-vector-store`). So reading, comparing to good resumes, and grading all happen in Raia.

## Flow
1. **Landing page** (signed-out `/`): JobMaxxing intro, Sign up / Sign in. Sign-up stays invite-only (3 emails).
2. **Sign-up step 2 (optional):** "Upload your resume" with Skip. Skipping leaves an open "Upload Resume" quest.
3. **Upload → Raia Resume Agent:** the PDF/image file is uploaded to Raia via a signed prompt-file URL, and the agent reads it (handles scanned resumes). It returns:
   - parsed fields (major, education, degree level, grad year, qualifications, job history, skills, frameworks) → fills the profile
   - ATS check: tables/columns risk, missing/unclear Experience, Education, Projects headers
   - grade + score /100, compared against the "good resumes" in its vector store
   - weak bullets with an action-verb rewrite (before → after)
   - metric gaps: bullets lacking numbers, with a prompting question
4. **Resume Lab editor:** resume shown as editable sections/bullets. Accepting a suggestion swaps the bullet in and saves a new version; you can also edit by hand.
5. **Version history:** list of past versions with their scores; re-scan any version.

## XP
- +20 first completed scan (once)
- +15 per accepted fix (once per suggestion)
- +50 "Level Up" first time score goes above 80
- Daily quest "Tailor 1 bullet for a Job Radar role" — added now, unlocks when Job Radar ships (needs the Adzuna key)

## Good-resume library
- An upload script for the Resume Agent's Raia vector store. You send example resumes; I upload them. The agent prompt is updated to compare against them.

## Out of scope
- No Neon embeddings / pgvector (Raia only, per your choice).
- Job Radar itself (waits on the Adzuna key).

## Technical details
- Neon tables (one-time migration): `devup_resume` (user, current version), `devup_resume_version` (resume id, version no., sections jsonb, source file name, created), `devup_resume_feedback` (version id, grade, score, ats jsonb, suggestions jsonb with type `rewrite|metric|ats|general`, source). Existing `devup_resume_review` rows migrate to version 1.
- XP claims keyed by suggestion id; milestones (`first_scan`, `score_80`) idempotent via XP-event keys.
- `src/lib/interview/agents.server.ts`: `reviewResumeFile()` → upload-url → PUT file → `/external/prompts` with file id; text fallback stays (pdfjs text) if file upload fails, with `details.source` recorded.
- `src/lib/resume.functions.ts`: scan, accept suggestion, save edit, list versions.
- Routes: signed-out landing in `index.tsx`/AuthScreen, onboarding step in sign-up, `setup.tsx` becomes editor + history.
