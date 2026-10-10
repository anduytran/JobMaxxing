# Roadmap

## Resume score card
- [x] Show the actual score, grade rank, next score target, and existing XP milestones.
- [x] Display a random pending resume improvement as a bullet, with another-item control and Resume Lab link.
- [ ] Verify resume-card shuffle and Resume Lab navigation signed-in — blocked by unavailable account session; public page has no runtime errors.

## Quest menu
- [x] Remove the next-power-move section.
- [x] Add a hoverable and clickable top-bar mission menu showing at most two daily and three weekly quests from existing progress.
- [ ] Verify menu behavior in a signed-in preview — blocked by unavailable signed-in session; preview compiles and public page has no runtime errors.

## Original Max images
- [x] Replace the five redrawn poses with the supplied original images, including sign-in.
- [x] Verify all five original images load in the preview and visually confirm waving Max on sign-in; build clean.

## Max reference redraw
- [x] Redraw branding, wave, resume, interview, and skills poses as clean vectors from the supplied references.
- [x] Replace the five traced drawings everywhere, including sign-in, and check their details in browser renders.

## Featured quest polish
- [x] Make the gym floor full-width and unify pale tracing colors without altering equipment; vector rendering checked.
- [x] Place quest arrows at the left and right card edges; source checks and build passed.
- [x] Verify signed-in card navigation visually — arrows sit outside both card edges, counter centred at the bottom, quest title is the headline, no "Pick another"; no console errors.
- [x] Move the featured quest label and title into the card headline; label stays on one line.
- [x] Replace the fixed hero sentence with a line written for the featured quest's type (skills, interview, resume, job hunt, branding).
- [x] Stop headline nodes stacking when clicking through quests; one headline updates in place and animates without remounting.

## Motion and personality
- [x] Add personable mascot interactions, staggered entrances, and tactile controls.
- [x] Add XP celebration and contextual encouragement without changing saved data or workflows.
- [x] Verify mascot interaction, interview navigation, and reduced-motion behavior in the signed-in preview; no runtime errors.

## Persistence in Neon (no Lovable Cloud)
- [x] Daily quests reset every day, weekly quests reset every week (schedule stored in Neon).
- [x] Per-user reduced-motion preference persisted in Neon and applied app-wide.
- [x] Verify resets and the preference in the signed-in preview; build clean.

## Job Radar (Adzuna + Neon)
- [x] Create `devup_job_radar` in Neon (listing cache, statuses, viewed flags) and the idempotent `radar:*` XP index.
- [x] Server functions: fetch/score/cache listings, status changes (+25 XP on save), review batches (+10 XP per 5 viewed), tailored-practice bonus (+50 XP once).
- [x] Job Radar page: preferences editor, refresh, ranked matches with skill chips, status pipeline, external role links.
- [x] One-click "Practice interview" hands a role's description to the mock interview and auto-analyzes it.
- [x] Verify the whole flow signed-in in the preview: refresh matches, save a role (+25 XP), view roles, run a tailored practice interview (+50 XP); build clean.
