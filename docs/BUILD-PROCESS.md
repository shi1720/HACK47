# OFFGRID build process

Batchlight was developed for HACK47: OFFGRID in the 2026 build period. This repository records the application, synthetic fixtures, tests, and submission materials. Git history is the authoritative change record.

Shivam Gupta is the project creator and product owner. The build used substantial AI assistance for research, design, implementation, testing, and writing. We do not claim undocumented manual coding contributions or invented customer research.

## Product decisions

The project began with a narrow question: how should a small food maker investigate a suspect ingredient when some production records are incomplete? That led to a three-state result rather than a single affected/unaffected split. The demo includes an intermediate mother sauce, multiple filling runs, recorded customer shipments, and an explicitly incomplete production sheet.

The product uses a deterministic domain engine so each classification has an inspectable record basis. It retains missing input uncertainty through downstream production. Quantities remain in the unit of their source, so kilograms of intermediate material do not get added to finished jars as if they were the same measure.

The interface places traceability beside the normal record-entry workflow. Source references accompany incoming lots, batches, and deliveries. Spreadsheet import reduces the need to enter everything manually. Saved snapshots and exports make a rehearsal reviewable after the underlying workspace changes.

The evidence-repair loop is central to the demonstration. A missing spice entry first creates a visible investigation group. A maker then adds the recovered source-lot evidence. The live result changes, while the saved rehearsal preserves the earlier incomplete record. That is an inspectable transition from uncertainty to a better-supported record, not a claim that software verified the physical food.

## Work added in this repository

- Domain schemas, stock-allocation checks, graph traversal, uncertainty propagation, and snapshot validation.
- Evidence-backed resolution of incomplete batch inputs, with updated live scope and preserved earlier recall snapshots.
- An evidence comparison showing the latest saved batch state beside its current classification and source record.
- Synthetic Ember & Oak teaching records, with no real customer or incident data.
- React interface for accounts, incoming lots, batches, deliveries, imports, trace results, saved rehearsals, and workspace settings.
- Express API with SQLite persistence, account isolation, request validation, sessions, recovery codes, and command retry protection.
- Browser storage, queued offline changes, a service worker, and conflict-aware synchronization.
- Browser and server report generation, source references, customer contact drafts, and export formats.
- Automated core, API, and browser workflow tests, plus deployment configuration.
- Commercial research, transparent pricing assumptions, recording script, editable pitch deck, and one-page brief.

Third-party libraries provide the framework, database driver, graph display, parsing, and PDF primitives. They are disclosed in `THIRD-PARTY.md`. We did not import another finished traceability application.

## What research changed

Primary competitor pages show that both lot traceability and recall rehearsals already exist for small producers. Lotpath and LotThread are direct alternatives, alongside other manufacturing and food-safety tools. The submission therefore makes no category-invention claim. The hypothesis to test is the usefulness of explicit missing-input uncertainty carried consistently through production, recipients, and exports, with local work that can synchronize later.

The FDA's primary page also makes a simplistic January 2026 compliance-deadline pitch inappropriate. Batchlight presents an operational rehearsal problem and does not promise regulatory compliance.

## Verification and next work

Run the repository's current test commands and read their results before making claims about coverage. Automated tests verify concrete invariants and workflows, not every possible production condition. Submission PDF and slide outputs were rendered and visually reviewed during creation.

On 22 September 2026, GitHub Linux CI passed the checks for commit `a5da4ee`, including 116 unit/integration tests and 12 browser workflows. GitHub Pages deployed successfully at `https://shi1720.github.io/HACK47/`. A clean-browser check against that public site passed the initial 480-unit trace, saving a rehearsal, first full offline reload, and offline PDF download, with no JavaScript errors. The public deployment is a browser-only build; these results do not imply a publicly hosted account backend. See `TESTING.md` for the reproduction commands and verification limits.

A further public-site check completed evidence repair and confirmed that the original exported snapshot remained deeply equal. Seven public routes also passed layout checks at a 390-pixel mobile viewport with no JavaScript errors. Later engineering fixes may increase the suite size; the figures above identify the specific verified commit rather than a permanent current total.

The build review exercised the full record-to-PDF journey, recovery-code rotation, account isolation, the first offline reload, command retry behavior, two-tab writer protection, conflicting stock from independent browser contexts, stale offline rehearsals, spreadsheet preview/import, and evidence repair without rewriting an earlier report. Mobile checks covered a 390-pixel viewport. Automated axe checks covered the landing page, registration, dashboard, lot register, and a record dialog; they do not establish complete accessibility compliance.

Backend integration checks also exercised process restart and SQLite online-backup restoration, including preserved authentication, command idempotency, saved report export, and audit history. Those tests use an isolated local environment. Browser tests use a production browser build with a local HTTP test server and development cookies; a separate backend check verifies production HTTPS requirements, secure cookies, and headers. The Docker runtime and a publicly hosted backend were not tested in that environment.

`scripts/benchmark.ts` records a reproducible synthetic domain benchmark in `artifacts/benchmark.json`. It measures validation, trace, and snapshot operations on the local machine, not browser interaction, a deployed service, or a customer workflow. It should not become a hosted latency or scale guarantee in the pitch.

The recording handoff contains real full-application footage in `output/video/batchlight-demo-silent.mp4`, matching narration in `output/video/voiceover-verbatim.txt`, and assembly instructions in `submission/VIDEO-ASSEMBLY.md`. Shivam's voiceover and a verified public video upload remain personal submission steps. The footage uses synthetic records and is not a measured customer performance result.

The next work should be supervised producer pilots, an independent security review, a backup-restore test on the actual hosted deployment, and qualified review of the incident workflow. Business validation must measure setup effort, correctness, repeated use, and willingness to pay. More features should follow observed needs rather than an assumed market.
