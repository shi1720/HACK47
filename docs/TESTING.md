# Verification evidence

Verified on 22 September 2026. These are engineering checks on synthetic records, not customer validation, a security audit, or food-safety certification.

The initial published commit `a5da4ee` also passed the complete [GitHub Linux CI run](https://github.com/shi1720/HACK47/actions/runs/35688264097). The live [GitHub Pages demo](https://shi1720.github.io/HACK47/) passed a separate clean-browser test: tracing, saving, repairing the evidence, comparing the new classification, and proving the original downloaded snapshot remains identical after repair and reload. Its first full offline reload and offline PDF export passed with zero JavaScript errors. All seven app routes fit a 390px viewport; account setup correctly explains the full application's self-hosting requirement.

| Check | Result and scope |
| --- | --- |
| TypeScript | Strict type checking passes across client, shared engine and server |
| Unit / integration suite | 130 tests across six files, including 16 backend tests, 9 evidence-comparison tests and 14 PDF text checks |
| Browser suite | 12 Chromium workflows; actual production-built UI and real SQLite API |
| Dependency review | `npm audit` reported zero known vulnerabilities in the locked dependency tree |
| Installation | A clean lockfile installation completed; CI repeats installation on Linux |
| PDF output | Both browser and server PDFs downloaded as actual PDF files and were rendered for visual inspection |
| Documents | Nine-slide pitch deck and one-page brief rendered and inspected |

The domain suite covers connected and intermediate batches, uncertainty propagation, missing sources, cycle and date rejection, duplicate codes, fixed-precision stock limits, import atomicity, saved snapshots, ancestry limits, and corrections that preserve historical evidence. Comparison tests distinguish changed classifications, changes to evidence without a classification change, and records added after a snapshot.

The final PDF checks reject unsupported text before either exporter produces a file, verify HTTP 422 and the complete-evidence JSON alternative, and keep Unicode records unchanged. Separate text extraction from actual server and browser PDFs confirmed supported accented Latin and WinAnsi punctuation. Multilingual PDF rendering remains unsupported; this guard prevents silent corruption.

The server suite checks authentication, rotated recovery codes, session revocation, request origin and CSRF enforcement, tenant isolation, stale revisions, idempotency, audit consistency, snapshot validation, persistent SQLite restart, and restoration from an online database backup. A restored test instance can log in, recover records, export its saved PDF, and accept a new valid command.

Browser workflows cover real record entry through PDF export, account recovery, separate account isolation, evidence repair, mobile layout, three-file CSV import and duplicate rejection, first offline reload, offline PDF export, offline synchronization, competing-tab lock takeover, independent-device stock conflicts, wrong-account pending-work protection, and a saved offline rehearsal whose server base changed. Automated axe checks cover the landing page, registration, dashboard, record list, active form, and evidence comparison. Automated checks are not a substitute for testing with assistive-technology users.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm audit
```

Playwright creates a disposable database at `data/e2e.sqlite`, serves the built frontend on port 5175 and API on 3002, and retains failure traces. The test database is ignored by Git. Do not point this suite at valuable records. The production service worker is included in the browser tests.

For a separately running public browser build:

```sh
DEMO_URL=https://shi1720.github.io/HACK47/ node scripts/verify-demo.mjs
```

That check starts a synthetic local workspace, verifies the 480-unit trace, saves a report, performs the first full offline reload and exports its PDF while disconnected. It tests the browser build; it does not claim a hosted account server exists.

## Performance experiment

Run `npx tsx scripts/benchmark.ts`; the measured fixture and environment are recorded in [benchmark.json](../artifacts/benchmark.json). The local Apple M4 Pro / Node 22 run processed a synthetic 5,000-batch, 5,000-shipment graph in about 47 ms median for validation and tracing, and about 109 ms for saving its snapshot. This is an in-process engine measurement, not an end-to-end upload time, real customer workload, or production throughput guarantee. Its approximately 4.7 MB serialized workspace also illustrates why snapshots need explicit storage limits.

Ancestry depth 128 is accepted and 129 rejected. Individual imports are limited to 5,000 records and 5 MB combined input, API requests to 6 MB, and stored workspaces to 32,000,000 bytes. The product targets small operations; this benchmark does not establish capacity beyond these bounds.

## Remaining verification

- Docker configuration is provided but container execution was not tested because the local Docker daemon was unavailable.
- No public full-server production host, hosting-provider restore, external penetration test, or multi-browser certification has been completed.
- No producer interview, observed customer rehearsal, willingness-to-pay test, or qualified food-safety workflow review has been completed. The business plan explicitly treats these as the next validation gates.
- The app does not independently verify source references, physical stock, cross-contact, or the truth of user-entered records.

Use the [operations guide](OPERATIONS.md) before deploying the account server and repeat persistence, backup, origin, cookie and offline checks on the actual intended host.
