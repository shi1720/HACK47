# Final submission checklist

This is a private preparation checklist. Do not paste it into the public project story.

## Eligibility and entry

- [ ] Confirm Shivam meets the legal-age and geographic requirements.
- [ ] Resolve the supplied brief's inconsistency: the listing says “Students only,” while the descriptive rules welcome builders more broadly. Verify the official current rules or seek organizer clarification before final entry.
- [ ] Confirm the official deadline remains **15 October 2026 at 09:30 IST**. Aim to submit at least a day earlier.
- [ ] Review current Devpost and organizer rules for team size, AI disclosure, originality, video length, and demo access.
- [ ] Confirm required profile and team membership details. Do not invent educational status or teammate contributions.

## Required fields

- [ ] Project name: **Batchlight**.
- [ ] Short description and full story from `submission/devpost.md`.
- [ ] Source link: `https://github.com/shi1720/HACK47` and correct repository visibility.
- [ ] Verify `https://shi1720.github.io/HACK47/` after publication. Describe it as a browser-only demo, with full-app setup linked separately.
- [ ] Public demo video URL with tested playback and audible narration.
- [ ] Major technology and AI-use disclosure from `docs/THIRD-PARTY.md`.
- [ ] Working screenshots with synthetic-data labeling visible.
- [ ] Pitch deck and one-pager from `output/` if the entry supports attachments.

## Live demo check

- [ ] Open the demo in a clean browser with no developer session or cookies.
- [ ] Use a fresh synthetic workspace and follow the full demo script.
- [ ] Confirm PAP-2409 results match the script: 480 connected finished units, 300 shipped, 180 on hand, 120 needing investigation, and 240 with no recorded connection.
- [ ] Save a rehearsal, resolve CHL-1909-X to PAP-2410 with a synthetic evidence reference, and confirm the live scope changes while the earlier snapshot retains its uncertainty. Reset to a fresh demo before the main recording.
- [ ] In **Evidence changes**, verify CHL-1909-X shows its earlier and current classifications and the recovered reference. Batches added after the snapshot must be labeled separately.
- [ ] Confirm the PDF opens and identifies the rehearsal and unresolved evidence.
- [ ] Test the public host on a mobile viewport and with keyboard navigation.
- [ ] Confirm the public account-setup link explains that GitHub Pages does not host registration, login, or server synchronization.
- [ ] On the full application, confirm login, sign-out, recovery behavior, and separation between two accounts.
- [ ] Verify offline behavior only after the production build has loaded once. Demonstrate server synchronization and conflict handling on the full application.
- [ ] Confirm a second tab is read-only, and a stale pending rehearsal keeps its original snapshot instead of being recomputed.
- [ ] On the full application, check persistence after a server restart and perform a backup restore rehearsal. Do not claim a cloud or Docker deployment was tested if only a local process was tested.
- [ ] Confirm the source repository contains no secrets or private customer data.

## Final honesty check

- [ ] No claim that no recorded connection means safe.
- [ ] No claims of real customer validation, measured savings, revenue, or deployed uptime without evidence.
- [ ] Pricing and unit economics remain visibly marked as hypotheses.
- [ ] The demo video states that Ember & Oak is synthetic.
- [ ] No unqualified food-safety or legal-compliance guarantee.
- [ ] Attribution: Shivam Gupta is creator and product owner, with substantial AI assistance disclosed. Do not invent manual contributions.
- [ ] Re-read final source and feature claims after code freeze. Remove claims for any feature that did not ship.

## Recording handoff

Use `submission/DEMO-SCRIPT.md` and `submission/VIDEO-ASSEMBLY.md`. Record a real application session and add Shivam's voiceover. A silent screen recording is supporting footage, not the finished spoken demo. Do not present edited or accelerated footage as a measured performance benchmark. Verify the final upload, captions, resolution, and audio from a logged-out browser before pasting its link.
