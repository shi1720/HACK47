# Batchlight

## Tagline

See what your records prove, and what they don't.

## Short description

Batchlight helps small food makers trace a suspect ingredient, investigate missing records, and repair the evidence behind a recall rehearsal. It updates the live scope when new evidence arrives while preserving what earlier reports actually knew.

## Inspiration

Imagine a sauce maker receives a supplier message about a suspect lot of smoked paprika. Some went into a base sauce, some into finished jars, and some jars have already shipped. One production sheet is incomplete. The hard question is not simply “Where did the ingredient go?” It is also “Which answers can our records actually support?”

That is the moment Batchlight is designed for. This scenario and every record in the demo are synthetic. We have not conducted customer interviews or measured real recall outcomes yet.

## What it does

Batchlight provides one workspace for incoming lots, production batches, shipments, and recall rehearsals. A maker can follow a suspect ingredient through multiple stages of production, see the recorded customers and quantities, and export a dated recall pack with source references and unresolved gaps.

The result has three states:

- **Recorded connection:** the stored records contain a path from the selected lot to this batch.
- **Needs investigation:** incomplete records leave a possible connection unresolved, including uncertainty inherited from earlier production.
- **No recorded connection:** the stored records contain no path. This is not a safety judgment.

The synthetic Ember & Oak example starts with paprika lot PAP-2409. It demonstrates 480 connected jars, including 300 shipped and 180 on hand, alongside 120 jars needing investigation and 240 with no recorded connection. A nested base sauce makes the trace more than a direct ingredient lookup.

The demonstration then closes the loop: a maker supplies the missing spice-lot evidence for the uncertain run. The current trace changes accordingly. **Evidence changes** compares the earlier classification and source record with the current one, including the recovered reference. A rehearsal saved before that correction still contains the original uncertainty, so later knowledge does not silently rewrite the earlier record.

The full self-hosted application includes account login, workspace isolation, server validation, and queued offline work. Reconnection validates commands against the server's current records instead of silently accepting conflicting stock changes. The public GitHub Pages demonstration runs the trace, repair, rehearsal, and export workflows in the browser only; it does not host account login or server synchronization. Setup instructions and automated tests for the full application are in the repository.

## How we built it

The application uses TypeScript, React, Vite, and an Express server with SQLite persistence. Its trace engine traverses an ingredient-and-batch graph. Explicit incomplete-record flags propagate uncertainty into downstream batches. Domain validation checks quantities, references, chronology, and available stock before accepting a write. Recall snapshots preserve the records used at the time of a rehearsal.

The interface uses a restrained cream-and-forest palette, readable production tables, and a visible distinction between evidence and uncertainty. A maker can inspect the underlying records rather than trusting an unexplained score.

Core traceability, data validation, authentication, tenant isolation, and complete browser workflows have automated tests. See the repository's current test report and commands for the exact verification scope.

## What makes it different

Lot traceability and mock recalls are established categories. Lotpath and LotThread offer recall drills, while Stocksmith, FoodDocs, and FourFoxes offer related production and traceability workflows. Our product hypothesis is narrower: a small maker will value an explicit uncertainty-and-repair workflow. Missing inputs propagate uncertainty into downstream batches, evidence-backed corrections change the current scope, and prior reports retain their original basis. The same distinction stays visible in customer lists and exports, including when work begins offline.

We deliberately use deterministic trace calculations. The same records produce the same classifications. AI assisted the build, but an AI model does not decide whether a batch is connected to an ingredient.

## Challenges we addressed

The difficult part was preserving honest uncertainty. If a batch has a missing input record, its descendants must not appear unrelated merely because no ingredient edge exists. Quantity accounting also has to distinguish intermediate material from finished units and prevent the same stock from being consumed twice. Offline edits add another constraint: a device may have stale stock information, so the server must resolve writes before they become authoritative.

## Commercial potential

Our initial target is the owner of a small sauce or preserve business supplying a few retail or wholesale customers. A proposed $29 per producer per month plan would fund a hosted workspace and managed backups, with free local rehearsal as the entry point. This is a pricing hypothesis. There are no paying customers, revenue, payment integration, or validated willingness-to-pay claims. This release is self-hostable; the proposed managed service is not currently offered.

The next business test is five observed recall rehearsals using consenting producers' own records, followed by a paid pilot offer. We will measure time to identify recipients, unresolved evidence, setup burden, repeated use, and support cost. Adoption and willingness to pay matter more than adding a large feature list.

## What is next

Before operational use with real food records, we would run supervised pilots, complete independent security review, test backup restoration in the hosted environment, and validate the workflow with a qualified food-safety practitioner. Further product work includes permissions for larger teams, stronger record correction workflows, import adapters, and reminders for periodic rehearsals.

Batchlight is a traceability and rehearsal tool. It does not detect contamination, certify food safety, or guarantee compliance. Makers remain responsible for their records and incident decisions.

## Built with

TypeScript, React, Vite, Express, SQLite, better-sqlite3, Zod, React Flow, PDFKit, jsPDF, jsPDF-AutoTable, Papa Parse, Vitest, Playwright, Lucide, DM Sans, Instrument Serif, and substantial AI assistance through OpenAI Codex. Complete technology and license disclosure: `docs/THIRD-PARTY.md`.

## Team and attribution

**Shivam Gupta - project creator and product owner. Built with substantial AI assistance for research, design, implementation, testing, and writing.**

The project was created for HACK47: OFFGRID in the 2026 build period. It uses third-party libraries and fonts, with original application logic, product design, fixtures, tests, and submission materials in this repository. Synthetic names and scenarios do not represent customers or endorsements.

## Submission links

- Source: https://github.com/shi1720/HACK47
- Browser-only demo: https://shi1720.github.io/HACK47/ — publication and clean-browser operation still require verification before submission.
- Full application with accounts: run `npm ci` and `npm run dev`, then open `http://localhost:5180`. Docker and production-host setup are documented in the repository.
- Demo video: record `submission/DEMO-SCRIPT.md`, upload the finished video, and paste its public link into Devpost.

Paste only verified public URLs into Devpost's URL fields. The public demo is browser-only; do not describe it as a hosted account service. Remove the publication-status note only after the live URL has been tested. Check the recorded video immediately before submission.
