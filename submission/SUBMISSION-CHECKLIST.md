# Final submission checklist

This is a private preparation checklist. Do not paste it into the public project story.

Checked items record preparation or verification completed on 22 September 2026. They do not mean the Devpost entry has already been submitted. Engineering evidence is summarized in `docs/TESTING.md`.

## Eligibility and entry

- [ ] Confirm Shivam meets the legal-age and geographic requirements.
- [ ] Resolve the supplied brief's inconsistency: the listing says “Students only,” while the descriptive rules welcome builders more broadly. Verify the official current rules or seek organizer clarification before final entry.
- [x] Official listing checked on 22 September 2026: **15 October 2026 at 09:30 IST** (00:00 EDT). Recheck before final entry and aim to submit at least a day earlier.
- [ ] Review current Devpost and organizer rules for team size, AI disclosure, originality, video length, and demo access.
- [ ] Confirm required profile and team membership details. Do not invent educational status or teammate contributions.

## Required fields

- [x] Project name: **Batchlight**.
- [x] Short description and full story prepared in `submission/devpost.md`.
- [x] Source published at `https://github.com/shi1720/HACK47`, with passing Linux CI for commit `a5da4ee`.
- [x] Public `https://shi1720.github.io/HACK47/` published and checked in a clean browser. It is described as a browser-only demo, with full-app setup linked separately.
- [ ] Public demo video URL with tested playback and audible narration.
- [x] Major technology and AI-use disclosure prepared in `docs/THIRD-PARTY.md`.
- [x] Working screenshots captured with synthetic-data labeling visible.
- [x] Editable pitch deck and one-pager prepared, rendered, and inspected in `output/`. Attach if the entry supports them.

## Live demo check

- [x] Opened the public demo in a clean browser with no developer session or cookies.
- [x] Fresh synthetic full-application workflow recorded and the silent video visually reviewed. Shivam's narration remains to be added.
- [x] PAP-2409 fixture and browser results match the script: 480 connected finished units, 300 shipped, 180 on hand, 120 needing investigation, and 240 with no recorded connection.
- [x] Full-app tests and the public browser demo save a rehearsal, resolve CHL-1909-X to PAP-2410 with a synthetic reference, and confirm the live scope changes while the earlier snapshot remains deeply equal in exported JSON.
- [x] **Evidence changes** captured and tested: CHL-1909-X shows earlier and current classifications and its recovered reference. Comparison tests separately cover batches added after the snapshot.
- [x] Browser and server PDFs downloaded and rendered. Public browser PDF export also passed after an offline reload.
- [x] Public host tested at a 390-pixel mobile viewport across seven routes, with no JavaScript errors.
- [x] Automated keyboard-only smoke passed on the live host: Tab/Enter navigation into the demo and recall workspace, save-modal focus trapping for 15 tabs, Escape close, and restored trigger focus. This is not human assistive-technology validation.
- [x] Public account-setup link checked: it explains that GitHub Pages does not host registration, login, or server synchronization.
- [x] Full-app automated checks cover authentication, recovery-code rotation, session invalidation, and separation between accounts.
- [x] Production browser-build checks cover first offline reload, server synchronization, and conflicting stock from independent browser contexts.
- [x] Browser checks confirm second-tab read-only behavior and preservation of a stale pending rehearsal's original snapshot.
- [x] Full-app integration checks cover server restart and SQLite online-backup restoration. Docker and a public account backend remain untested.
- [x] Initial repository pattern scan found no secret matches. Demo records are synthetic; a pattern scan is not proof that every possible secret format was detected.
- [x] Final staged-file pattern scan checked 101 text files with zero credential-pattern findings; runtime databases, environment files and recording intermediates are excluded. Product screenshots and PDFs use synthetic records.

## Final honesty check

- [x] Copy reviewed: no claim that no recorded connection means safe.
- [x] Copy reviewed: no invented customer validation, measured savings, revenue, or deployed uptime.
- [x] Pricing and unit economics visibly marked as hypotheses.
- [ ] The demo video states that Ember & Oak is synthetic.
- [x] Copy reviewed: no unqualified food-safety or legal-compliance guarantee.
- [x] Attribution names Shivam Gupta as creator and product owner, with substantial AI assistance disclosed and no invented manual contributions.
- [x] Final source and feature claims reviewed after code freeze, including the explicit limited-language PDF policy and public-demo/full-app distinction. Final local verification: 130 unit/integration tests and 12 browser workflows passed.

## Recording handoff

Use the supplied `output/video/batchlight-demo-silent.mp4` and read `output/video/voiceover-verbatim.txt`. Follow `submission/VIDEO-ASSEMBLY.md` to add Shivam's voiceover. `submission/DEMO-SCRIPT.md` also supports recording a fresh session. A silent screen recording is supporting footage, not the finished spoken demo. Do not present edited or accelerated footage as a measured performance benchmark. Verify the final upload, captions, resolution, and audio from a logged-out browser before pasting its link.
