# Running and operating Batchlight

Batchlight is a self-hostable hackathon application with server validation, account isolation, persistent records, local browser storage, and automated tests. The public GitHub Pages build is a browser-only demonstration; it does not host the account server. These controls are not a claim of an independent security audit or suitability for unsupervised food-safety operations. Use synthetic data for evaluation. Operational use needs a responsible producer, a tested hosting setup, and qualified workflow review.

## Public demonstration and full application

The public demonstration is live at `https://shi1720.github.io/HACK47/`. On 22 September 2026, a clean-browser check verified the 480-unit trace, a saved rehearsal, the first full offline reload, and a PDF export while disconnected, with no JavaScript errors. It runs the trace, evidence repair, saved rehearsal, import, and browser PDF workflows entirely on the visitor's device. Records remain in that browser's IndexedDB; clearing site storage removes them. This build has no hosted account login, cloud backup, or server synchronization. Its account-setup page links to the full application's setup instructions.

The full application runs locally or on a host configured with a persistent disk and an HTTPS domain. It includes actual registration, login, recovery, account isolation, SQLite persistence, and offline command synchronization. No third-party API key is needed for either build. The repository includes Docker deployment configuration, but a working local development run does not establish that a particular production host or Docker environment has been tested.

## Local development

Use Node.js 22, as in the Docker image and CI configuration, with a working native `better-sqlite3` module. Install the locked dependencies rather than floating package versions.

```sh
npm ci
npm run dev
```

`npm run dev` starts the browser development server at `http://localhost:5180` and the API at `http://127.0.0.1:3087`. Vite proxies `/api` to the server. The server creates `data/batchlight.sqlite` on first use. No model API key is required. These development ports are deliberately separate from the Docker service's port 3001.

`npm run build` performs TypeScript checking, builds the browser application, and bundles the server. `npm test` runs core and API tests. `npm run test:e2e` runs the browser suite using the repository's Playwright configuration. Review the test setup before running it against a database containing valuable records.

## Environment

Copy `.env.example` to a private `.env` file and supply variables through the hosting platform, shell, or Node's `--env-file` flag. Do not assume `npm start` loads a dotenv file automatically.

| Variable | Meaning |
| --- | --- |
| `PORT` | HTTP listener, default 3001 when unspecified. Development sets 3087. Integer from 1 to 65535. |
| `HOST` | Listener interface, default `0.0.0.0`. Use `127.0.0.1` behind a local reverse proxy. |
| `DATABASE_PATH` | Persistent SQLite file. Default `./data/batchlight.sqlite`. |
| `NODE_ENV` | Set `production` for HTTPS cookies, production headers, and static serving. |
| `APP_ORIGIN` | Exact browser origin, including scheme and optional port. No path or trailing slash. Production requires HTTPS. |
| `TRUST_PROXY` | Set `1` only when traffic always passes through the intended single trusted proxy. Otherwise omit it. |

For example, after building, start with a private environment file containing the deployment's actual values:

```sh
node --env-file=.env dist-server/index.js
```

The production server serves `dist/` and the API on the same origin. Keep a persistent disk mounted at `DATABASE_PATH`. A stateless filesystem will lose records during a replacement or redeploy. Use one application instance with local SQLite. Horizontal replicas, network-shared database files, and distributed rate limiting are not implemented.

Configure TLS at the reverse proxy or hosting platform. Set `APP_ORIGIN` to the exact public HTTPS origin. Incorrect configuration deliberately causes rejected browser writes or server startup failure. The health endpoint is `GET /api/health`; it checks database access and returns `{ "status": "ok", "version": "1.0.0" }`.

### Docker option

The repository includes a multistage `Dockerfile` and `docker-compose.yml`. Set `APP_ORIGIN` in a private `.env` file to the real public HTTPS origin, configure a reverse proxy on that origin, and run:

```sh
docker compose up --build -d
docker compose ps
docker compose logs --tail=50 batchlight
```

Compose binds port 3001 to the host's loopback interface and keeps SQLite in the `batchlight-data` volume. The container runs as an unprivileged user with a read-only root filesystem. Its application-data volume remains writable. The supplied Compose configuration enables trust for one proxy, so keep the backend private to the intended proxy. Back up the named volume using a consistent SQLite backup, and never use `docker compose down -v` on valuable records.

## Accounts and recovery

Registration creates one account and one private workspace. Team invitations, role management, enterprise SSO, and email verification are not implemented. Passwords require at least 12 characters and are stored as salted scrypt hashes. The server stores a hash of each random session token and sets an HTTP-only cookie. Production uses secure cookies. Sessions last up to seven days.

Save the recovery code shown at registration in a password manager. Recovery requires the account email and that code. A successful recovery rotates the code and invalidates old sessions. The application does not send password-reset email. Losing both the password and recovery code has no self-service recovery path.

On the full server application, the demo creates a separate synthetic workspace per visitor and expires after 24 hours. Start another demo session for a fresh fixture. The public GitHub Pages demo instead stores its synthetic workspace only in the browser and has no server expiry. Neither demonstration should contain real production records.

## Offline operation

The browser stores a workspace copy and pending commands in IndexedDB. Load the production application once while connected before relying on its service worker for cached use. A local demo operates only on that device and does not become a hosted account automatically. Signed-in offline changes remain queued until synchronization succeeds. Development-server availability is not evidence of an offline installation.

One tab per browser profile owns the workspace writer lock. Another tab opens read-only so it cannot overwrite pending device records. Close the original tab and reload the second to take over. Browsers without the required Web Locks support also remain read-only, with existing records available for export. Use a current browser over HTTPS or localhost. Test separate devices with separate browser profiles, not two tabs sharing IndexedDB.

On reconnect, the client fetches the current server revision and submits queued commands. The server validates each write in a transaction. A command ID prevents a retry from applying the same write twice. A changed revision or invalid stock allocation causes a visible error rather than silently overwriting the authoritative workspace.

Treat unsynchronized results as provisional. Keep the device copy until queued work is resolved. If a conflict occurs, export the pending records, compare them with the server's records, and re-enter the corrected operation. Only discard pending work after preserving what needs review. Do not clear browser storage as a first troubleshooting step.

A pending rehearsal is stricter than an ordinary record write. If the authoritative revision changed after that rehearsal was saved, synchronization pauses and preserves the original device snapshot and pending queue. It does not silently calculate a new scope for the old report. Export the report, all records, and pending changes. Sign in to the original account if needed; then use **Workspace & data → Resolve by keeping the server copy → Keep server copy** only after preserving the evidence. Re-enter corrected records and create a fresh rehearsal. There is no automatic merge for a conflicting saved report.

Network failure, an expired session, or a different signed-in account does not authorize discarding pending records. The original account must be restored before reconciling with its server copy. Device record time is retained on successful synchronization; server audit time separately records when the server accepted the command. Neither is an independent trusted timestamp.

Browser storage is not application-level encrypted. Use a trusted device, an operating-system account lock, and an encrypted disk. Signing out clears the device cache after pending work is resolved. An expired server session does not remotely erase a disconnected browser's saved copy.

## Backups and restoration

Workspace JSON export is useful for portability, but it is not a full server backup. Account hashes, session state, command history, and audit records live in SQLite. Schedule consistent database backups and store them outside the application host with restricted access and encryption. Set an explicit retention period based on the producer's needs and applicable obligations.

Use SQLite's online backup API rather than copying only the main database file while WAL writes are active. The following example creates a consistent backup without modifying the source. Choose a new destination path on a protected volume:

```sh
python3 - data/batchlight.sqlite /secure/backups/batchlight-2026-09-22.sqlite <<'PY'
from pathlib import Path
import sqlite3, sys
source, target = map(Path, sys.argv[1:])
if not source.is_file():
    raise SystemExit('Source database does not exist')
if target.exists():
    raise SystemExit('Choose a new backup filename')
target.parent.mkdir(parents=True, exist_ok=True)
with sqlite3.connect(f'file:{source.resolve()}?mode=ro', uri=True) as src:
    with sqlite3.connect(target) as dst:
        src.backup(dst)
        result = dst.execute('PRAGMA integrity_check').fetchone()[0]
        if result != 'ok':
            raise SystemExit(result)
target.chmod(0o600)
print(f'Backup verified: {target}')
PY
```

For a restore rehearsal, stop a test instance, point `DATABASE_PATH` at a copy of the backup, and start it with a separate local origin and port. Verify login, records, saved recall packs, and a new write. Record the elapsed recovery time. A successful file copy is not a restore test.

For a live restore, stop writes, preserve the existing database and its `-wal`/`-shm` companions, restore the verified backup into a new location, and change `DATABASE_PATH`. Do not leave old WAL files beside a newly restored file. Confirm integrity before reopening service. Restoring a backup also restores historical session rows; revoke sessions as part of a security-related recovery.

## Monitoring and limits

- Monitor `/api/health`, process exits, disk space, backup completion, and restore verification.
- The server limits JSON requests to 6 MB; the browser caps combined import files at 5 MB. Serialized workspaces are limited to 32,000,000 bytes, including saved snapshots. Workspaces are stored as JSON within SQLite, so this release targets small operations. Repeated full snapshots consume capacity as records grow.
- A single import accepts at most 5,000 records. Production ancestry is limited to 128 steps; a deeper graph is rejected before trace paths are materialized. These are explicit resource bounds, not business-capacity guarantees.
- Request throttling uses process memory. Restarting the server clears those counters.
- Log errors without request bodies, customer records, passwords, or tokens.
- Keep system and Node security updates current, and run dependency review before deployment.
- The audit log chains hashes to help detect record inconsistency. It is not independently anchored or protected against an administrator rewriting the entire database. Do not describe it as immutable or tamper-proof.
- Source-reference text records what a user entered. The application does not upload, OCR, or independently verify original paper documents.
- There is no automatic customer messaging, regulatory filing, contamination detection, cross-contact model, or payment collection.

## PDF character support

Both PDF exporters use built-in Helvetica fonts with the limited WinAnsi character set. This includes printable ASCII, Latin-1 accented characters, and supported punctuation such as curly quotes and en/em dashes. Other scripts, emoji, decomposed combining accents, and unsupported control characters are rejected before a PDF is created. The error identifies the field and Unicode code point. The server returns HTTP 422 for this case, and the browser shows the export error.

Batchlight does not transliterate, normalize, or alter the stored evidence to fit the font. Original Unicode text remains in the records. Export the saved snapshot or full workspace as JSON for complete evidence, or use CSV for the corresponding tabular fields. JSON and CSV exports continue to support the original Unicode text. Multilingual PDF output requires a future font and shaping implementation; the current release does not claim it.

## Incident workflow

Use the three classifications precisely. A recorded connection is evidence of a stored path, not proof of contamination. “Needs investigation” represents unresolved evidence. “No recorded connection” is never a food-safety clearance.

Saving a rehearsal creates an internal snapshot. Selecting an incident record does not notify customers or initiate a regulatory recall. Review original records, physical stock, missing movements, and the producer's established incident process with the responsible lead. Contact drafts in an export require human review and deliberate sending through the producer's own communication channels.

### Resolving a missing input

When a maker recovers the evidence for an incomplete batch, the resolution workflow adds the missing source inputs with a reference and explanation. The live trace uses the corrected record. Earlier saved recall snapshots retain the evidence and uncertainty that existed when they were created.

**Evidence changes** compares the current trace with the latest saved rehearsal for the same source. It shows earlier and current batch classifications and the production evidence that changed. Batches created after the snapshot are labeled separately. This comparison does not describe every shipment change; inspect **Customer deliveries** for the current distribution. The comparison leaves the saved report unchanged.

Use a resolution only to document historical evidence, not to authorize new production. Historical consumption from a currently held ingredient can still need recording. Quantity, source-reference, and date validation still apply. A lot's hold status is recorded information, not a physical production lock or authorization system. A human remains responsible for stock control and for checking the original documents. No classification change creates a food-safety clearance.

Resolution appends missing inputs and a review reference to a record marked incomplete. It cannot change existing input quantities or reopen a completed record. A complete-record typo needs review outside this limited correction flow; do not work around it by creating a misleading duplicate. General versioned record correction remains future work.

## Release checklist

Before using real records, complete the current test suite, verify two-account isolation through the intended full-application host, exercise browser offline/reconnect behavior, verify persistence across restart, restore a backup, and review the workflow with a qualified food-safety practitioner. Confirm the limitations above are acceptable for the intended operation. Record what was tested and on which deployment instead of claiming generic “production readiness.”
