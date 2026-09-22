# Third-party technology and AI disclosure

**Shivam Gupta is the project creator and product owner. Batchlight was built with substantial AI assistance for research, design, implementation, testing, and writing.** This statement does not attribute specific manual coding work that has not been documented.

The repository contains the application developed for HACK47: OFFGRID. It builds on the libraries below rather than an existing finished traceability product. No real customer data, endorsements, interviews, or incident outcomes were used in the synthetic demonstration.

## Application dependencies

Exact installed versions and transitive dependencies are recorded in `package-lock.json`. Keep that file when reproducing the build. The license labels below come from installed package metadata and do not replace the packages' full license texts.

| Technology | Use | License in package metadata |
| --- | --- | --- |
| React and React DOM | Application interface | MIT |
| TypeScript | Shared typed application and domain logic | Apache-2.0 |
| Vite and React plugin | Development server and browser build | MIT |
| Express | HTTP API and production static serving | MIT |
| better-sqlite3 | SQLite persistence and transactions | MIT |
| SQLite | Embedded database engine | Public domain |
| Zod | Input and domain schemas | MIT |
| React Router | Browser navigation | MIT |
| React Flow / `@xyflow/react` | Interactive trace graph | MIT |
| PDFKit | Server-generated recall packs | MIT |
| jsPDF and jsPDF-AutoTable | Browser-generated PDF export | MIT |
| Papa Parse | CSV parsing | MIT |
| Helmet | HTTP security headers | MIT |
| express-rate-limit | Request throttling | MIT |
| cookie-parser and compression | Cookie parsing and response compression | MIT |
| Lucide React | Interface icons | ISC |
| DM Sans and Instrument Serif | Product and submission typography | SIL Open Font License 1.1 |

The application PDF engines use built-in Helvetica with WinAnsi character coverage, rather than the interface fonts. A shared guard explicitly refuses unsupported PDF text before export. It supports a limited Western character set, not every language or emoji. Records remain Unicode, and JSON/CSV export preserves text in their included fields without transliteration. See `OPERATIONS.md` for the complete-evidence JSON fallback. The deck and one-page brief separately use the bundled DM Sans and Instrument Serif files.

## Development and verification

Vitest, Supertest, Playwright, tsx, esbuild, concurrently, and the relevant DefinitelyTyped packages support building and testing. Playwright and TypeScript use Apache-2.0 licenses. The other listed development packages use MIT licenses in their package metadata. Node.js provides the runtime and cryptographic primitives. Review distribution notices for the full transitive dependency tree when shipping a packaged release.

`@axe-core/playwright` supports automated accessibility checks and is licensed under MPL-2.0 in its installed package metadata. An automated accessibility scan is useful evidence, not a complete accessibility audit.

## Submission production

The editable PowerPoint uses OpenAI's bundled `@oai/artifact-tool` tooling. The one-page PDF uses ReportLab, with Poppler for visual inspection. Bundled document tooling is a build-time aid and is not required to run the web application. Font files and their SIL license texts are included in `submission/assets/fonts/` so the deck can retain its typography when edited.

## AI use

OpenAI Codex assisted product research, decision-making, visual design, implementation, test creation, debugging, documentation, and submission writing. The project's graph calculation is deterministic and does not require a model API or send business records to an AI service. There is no API key requirement for the core application.

All final claims should be reviewed by the entrant. AI assistance does not establish customer demand, compliance, food safety, or defect-free operation.

## Data and sources

The Ember & Oak workspace, supplier names, lot codes, customer contacts, shipments, and rehearsal results are synthetic fixtures authored for the project. Customer email addresses use reserved example domains. Source references in the demo describe fictional production sheets and delivery notes.

Competitive and regulatory sources are listed in `docs/SOURCES.md`. The product does not copy third-party customer testimonials, logos, product screenshots, or proprietary datasets.
