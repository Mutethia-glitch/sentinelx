# Controlled event ingestion — Task 08

`POST /api/events` accepts one canonical Task 07 event. It requires a live session,
Administrator or Security Analyst (`events.ingest`), an exact `APP_ORIGIN` Origin
header and `application/json`. Viewer/Management has no ingestion grant. Roles
are read live, with the database rechecking the actor's active role before writing.
No client role header or request field grants access.

The configured source allowlist is `EVENT_INGEST_SOURCES`, a comma-separated list
of 1–20 distinct labels containing letters, numbers, dots, underscores or hyphens
(maximum 100 characters each). The default is only `sentinelx-simulated`, the
approved synthetic fixture shipped in `fixtures/events/simulated-login.json`.
Empty or malformed configuration prevents startup. Operators must approve actual
sources before adding them. The source label is a controlled caller assertion,
not cryptographic proof of a vendor/host; machine connectors are future work.
Changes require restarting the server.

The body follows [SECURITY_EVENTS.md](SECURITY_EVENTS.md), with an 8 KiB HTTP limit
shared with existing JSON mutation routes. Arrays/batches, unknown fields, malformed
JSON, invalid event fields, compressed payloads and other content types are rejected.
Task 08 accepts already canonical inputs. Vendor-to-canonical mappings, normalization
rules and detection are not implemented here.

## Response and persistence

Successful ingestion returns HTTP 201:

```json
{"event":{"id":"generated UUID","receivedAt":"UTC time","normalizedAt":"UTC time"}}
```

The response omits submitted raw evidence. The event and attributed `EVENT_INGESTED`
audit record commit together. Audit context contains source/type, not raw evidence.
If either write fails, neither persists. Existing migrations are sufficient.
No deduplication contract is introduced; resubmitting a valid event creates another
record. The local verifier intentionally retains its accepted synthetic event and
audit record as ingestion evidence.

| HTTP status | Meaning |
|---|---|
| 400 | Invalid JSON or canonical event. |
| 401 | Missing, expired or revoked session. |
| 403 | Wrong role, unapproved source or rejected Origin. |
| 404 / 405 | Unknown exact route / wrong method. |
| 413 / 415 | Oversized body / unsupported content type or encoding. |
| 503 | Sanitized backend failure; no driver details. |

## Verification

`npm run quality` checks model, ingestion policy and HTTP boundaries alongside
identity regressions (16 tests). `npm run test:ingestion:integration` uses a
disposable PostgreSQL database with `SENTINELX_TEST_DATABASE=1`; it checks live
sessions, persisted evidence, actor-attributed audit, invalid payloads, revoked
roles and transaction rollback on audit failure. Run shared-database suites sequentially.

On Windows, pull main and restart the server in the window with database settings.
In a second PowerShell window at the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ingestion.ps1
```

This process-only execution-policy override runs the repository verifier; it does
not change the machine policy. Enter the Administrator application email/passphrase
privately. Expected: `Event ingestion and invalid payload rejection verified.`
The verifier logs out its own session without affecting other login sessions.
Then repeat with the existing Viewer/Management test account:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ingestion.ps1 -ExpectDenied
```

Expected: `Viewer ingestion permission rejection verified.` Both local checks were confirmed on Windows/PostgreSQL 18.6 on 2026-09-30. Task 08 is Complete. Use your configured approved source in the fixture
if you deliberately changed the default allowlist; do not submit real credentials.
