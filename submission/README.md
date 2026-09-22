# Submission package

The application source and local run instructions live in the repository root. These files prepare the HACK47: OFFGRID entry and recording.

| File | Purpose |
| --- | --- |
| `submission/devpost.md` | Paste-ready project story and required submission fields. Replace the explanatory demo/video link lines with verified public URLs. |
| `submission/DEMO-SCRIPT.md` | Word-for-word narration with exact clicks and optional technical proof shots. |
| `submission/VIDEO-ASSEMBLY.md` | Recording, voiceover, FFmpeg assembly, and final playback checks. |
| `submission/JUDGE-REVIEW.md` | Skeptical internal rubric review, concrete weaknesses, and prioritized improvements. |
| `submission/SUBMISSION-CHECKLIST.md` | Private final review, including the eligibility inconsistency in the supplied brief. |
| `output/presentation/batchlight-pitch.pptx` | Editable nine-slide pitch. |
| `output/pdf/batchlight-one-pager.pdf` | One-page project brief. |
| `docs/BUSINESS.md` | Competitors, pricing hypotheses, costs, interview protocol, and commercial decision gates. |
| `docs/OPERATIONS.md` | Hosting, accounts, offline behavior, backups, and honest operational limits. |
| `docs/SOURCES.md` | Research and asset provenance. |
| `docs/THIRD-PARTY.md` | Major libraries, fonts, and AI-assistance disclosure. |

## Deck typography

The deck uses **DM Sans** and **Instrument Serif**. Install the font files in `submission/assets/fonts/` before editing or presenting on another machine. Font applications may substitute a default face when these fonts are unavailable. Their open licenses are included alongside them. All slide copy remains editable, and relevant external sources appear in speaker notes. Product screenshots use synthetic records.

## Rebuilding artifacts

`scripts/build-submission.py` builds the one-pager with ReportLab. `scripts/build-submission.mjs` builds and validates the PowerPoint through the Codex bundled `@oai/artifact-tool` runtime. Its optional environment variables support a different installed runtime location. Run these through the corresponding PDF and presentation skill workflows when regenerating. Drafts and validation receipts stay in `submission/.build/` and are not deliverables.

The app itself does not depend on this document-generation toolchain. Check the actual final files visually after regeneration. Do not treat a successful export as proof of layout quality.

## What remains personal

Record Shivam's narration using the script, upload the finished video, verify entrant eligibility and profile details, and complete the organizer's final entry fields. The package intentionally makes no fabricated claims about manual contributions, customers, revenue, or measured business results.

The public demonstration is planned at `https://shi1720.github.io/HACK47/`; verify publication before submission. It runs on the visitor's device. The full account application runs at `http://localhost:5180` after `npm ci` and `npm run dev`, and can be self-hosted with the documented production configuration. Do not conflate a public static demo with a deployed account service.
