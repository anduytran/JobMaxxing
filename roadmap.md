# Roadmap

## Quest titles always two lines
- [x] Split each display quest title into two balanced lines for the featured headline and the top-bar quest menu; saved titles untouched.
- [x] Verify representative titles render as exactly two lines with no clipping in a browser render; build clean.


## Dashboard trim
- [x] Remove the quest card and the "Your quests" list from the dashboard; quests stay reachable from the top-bar menu, the featured card and /quests.
- [x] Merge total XP and career rank into one Level & XP card (ring, XP total, level progress, rank progression).
- [ ] Verify the trimmed dashboard with live account data — blocked by unavailable signed-in session; checked in an isolated browser fixture with sample values.


## Dashboard mastery cards
- [x] Revamp resume, quests, total XP, and career cards with clear objectives, real progress, choice, and encouraging feedback.
- [x] Verify four-column rendering, resume shuffle, daily/weekly controls, and link destinations in an isolated browser fixture; progression unchanged, no competitive data invented.
- [ ] Verify dashboard cards with live account data — blocked by unavailable signed-in session.

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

## Full-screen featured card
- [x] Featured quest fills the whole screen edge to edge (height = viewport minus the top bar); the greeting, Interviews / Resume Lab shortcuts, resume + Career cards and "Max says" move below the fold.
- [x] Scenes, Max and the floating chips scale with the taller card (clamp on viewport height) and stay clear of the arrows, headline and help button.
- [x] Verified in the browser: card height 1736 of a 1800 viewport with a 64px bar, no element overlaps, no horizontal scroll, no console errors; build clean.

## Lock In moves onto the card
- [x] Top nav trimmed to Home · Collection · Career · Store; the diamond Lock In tab is gone from desktop and mobile.
- [x] The featured card's primary button now reads "Lock In" on both the quest slide and the mock interview slide; verified in the browser with no console errors and a clean build.
- [ ] The Interview / Resume Lab / Job Radar page at /lock-in now has no button pointing to it, so Job Radar cannot be reached by clicking anything — decide whether to link it from the top bar or the dashboard.

## Quest expiration clocks
- [x] Daily and weekly countdowns ("Daily expiration in 1h 3m 51s", "Weekly expiration in 1d 1h 3m") on the Quest Log and in the mission briefing group headers, from the same UTC midnight / Monday boundaries the server resets on.
- [x] Verified in the browser: both clocks render, tick down each second, and the fresh board is pulled in when one runs out; no console errors, build clean.

## Uploaded full-screen quest scenes
- [x] Replace partitioned scenes with uploaded stage, gym and meadow backgrounds spanning the entire featured screen.
- [x] Use portrait stage, gym and meadow images on mobile; keep Max and quest controls above the art.
- [x] Isolated browser check: all three scenes load at full screen width/height, portrait sources select on mobile, carousel works with no runtime errors; live account check remains unavailable.
- [x] Add the supplied portrait gym image as the skills card's mobile source (served from the CDN, preloaded with the other scenes); verified at 390x844 that the portrait gym is the image actually painted, edge to edge, with no console errors.


- Max is centred on both axes of the featured card on wide screens (verified signed-in at 1830x1075: mascot centre = card centre, 0px horizontal, 0.5px vertical, no overlap with the headline, Lock In, dots, counter or Missions panel); on phones he keeps the horizontal centre but sits low so the stacked text stays readable.

## Missions panel placement and layering
- [x] Missions panel now hangs off the card's right edge (8px in) and is wider (up to 512px, shrinking with the window so Max and the arrow keep their space); styled with the app's own tokens (cream card, dark text, sage/orange accents) instead of black glass.
- [x] #OPENTOWORK ring now renders behind Max, in front of the billboard scene, by preceding his image in the DOM.
- [x] Verified signed-in at 1830x1075 and 1100x800: panel 512/366px wide, 8px from the right edge, next arrow cream with a dark chevron and ~12px clear of the panel, no panel/arrow/Max overlaps, ring behind Max; no console errors, build clean.

## Mock interview Max cleaned
- [x] Removed the pale gray ground oval under his feet and the white wedge left in the crook of his bent arm, by clearing those pixels' alpha (no redraw, no change to his shape or colours); published as a new CDN asset and repointed the interview pose in `MAX_POSES`.
- [x] Verified on the live signed-in dashboard: the mock interview slide paints the cleaned file, with no shadow oval, no white patch in the arm's negative space, and his feet and arm contours complete; build clean.

## Max size parity
- [x] Measure how much of each pose canvas Max actually fills and normalise every pose to the branding pose with per-pose scale factors.
- [x] Cap the featured card's text column to Max's centred footprint so the headline and paragraph clear him at desktop and phone sizes.
- [x] Stop the interview-category daily quest from repeating the mock-interview scene in the carousel.
- [x] Verify all four slides render at matching rendered heights (within 4%), with clear text and arrow spacing, and the temporary verification sign-in removed.

## Lock In tab
- [x] Hang Lock In at the featured card's top-left as a hard-edged rectangle and point it at where the featured quest is completed.
- [x] Verify on the live signed-in dashboard that every slide's tab is square-cornered, flush to the card's top edge, clear of the eyebrow, Max and the arrows, and carries that quest's destination; temporary sign-in removed, build clean.

## Lock In in the nav
- [x] Keep `Lock In` as the nav's one loud button and the leftmost option, with the section tabs centred behind it.
- [x] Take the hanging `Lock In` tab off the featured card and drop the now-unused card helpers (`LOCK_IN_TAB`, `QUEST_LINK`, `featLink`), restoring the card's original top padding.
- [x] Make the button a hard-edged rectangle that fills the nav's whole height with a right arrow at its end, drop the lightning bolt, and keep its label centred against the other tabs.
- [x] Move it inside the centred tab group so it sits immediately left of `Home`, giving the order Lock In · Home · Collection · Career · Store.
- [x] Verify on the live signed-in dashboard that the button is the first item of the tab group (Lock In ends 4px before Home begins), spans the nav's full 64px height flush with the tabs, carries only `ArrowRight`, and that `/lock-in` still opens the mode picker; temporary sign-in removed, build clean.


