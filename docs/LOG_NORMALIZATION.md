# Log normalization — Task 09

The deterministic `normalizeRawEvent(input)` service converts two explicitly
supported simulated JSON formats into the Task 07 canonical structure. These
formats support repeatable academic demonstrations, not claims of vendor support.
No vendor parsers, live monitoring, severity inference or detection are added.

## Input envelope

`{format, source, rawData}` is required with exactly these three fields. `source`
is the submitted source label and must be approved by ingestion. `rawData` is an
object whose entire JSON content is retained, including unmapped fields.
`format` is exactly `simulated-flat-v1` or `simulated-nested-v1`.

| Canonical field | simulated-flat-v1 raw path | simulated-nested-v1 raw path |
|---|---|---|
| timestamp | time | event.time |
| type | event_type | event.type |
| sourceIp | src_ip | network.source_ip |
| destinationIp | dst_ip | network.destination_ip |
| user | actor | identity.user |
| host | device | identity.host |
| action | operation | event.action |
| status | outcome | event.status |
| severity | level | event.severity |

Timestamp and type are mandatory. Timestamp requires an explicit timezone and
becomes UTC. Source and text fields use the existing canonical validation. Severity
is trimmed and uppercased, then must be LOW, MEDIUM, HIGH or CRITICAL; omitted/null
severity stays null. Missing optional source fields stay null, with no guessed
IP, user, host, outcome or level. Unknown raw fields are evidence only and do not
change canonical values. Nested event/network/identity sections must be objects
when present. No format auto-detection, alias guessing or numeric severity mapping
is performed.

The raw object is copied losslessly using existing JSON/depth/size validation;
it is never rewritten by normalization. Metadata records
`{normalization: {format: "supported format name", version: 1}}` as derived provenance,
not as a source field. Identical inputs produce identical outputs. Unsupported
formats, malformed sections, missing required data and invalid canonical values
produce a sanitized `Unsupported or malformed raw event.` error.

## API and persistence

`POST /api/events/raw` accepts the envelope, using the same session, live
`events.ingest` grant, approved source list, exact Origin, 8 KiB JSON body limit,
status codes and transactional event/audit persistence as `/api/events`.
HTTP 201 returns the event receipt. Invalid normalization is HTTP 400 and stores
nothing. Viewer/Management is denied. The original canonical endpoint remains
compatible. Neither endpoint runs detection or creates alerts/incidents.
No new migration is needed.

## Verification

`npm run quality` includes 18 tests, with consistency, copied evidence, unknown
optional fields, unsupported formats, malformed sections and raw API boundaries.
`npm run test:ingestion:integration` uses a disposable PostgreSQL database with
`SENTINELX_TEST_DATABASE=1`; both raw fixtures pass through real authenticated
HTTP ingestion, with normalized values, raw evidence, provenance and audit checked.
The identity and event regression suites also pass when run sequentially.

After pulling main, restart your server. On Windows, use the PowerShell window
with PostgreSQL connection settings:

```powershell
node scripts/verify-normalization.js
```

Expected: `Log normalization and raw evidence persistence verified.` This inserts
and removes its own synthetic records after checking both supported formats.
In a second PowerShell window, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-ingestion.ps1 -Raw
```

Enter your Administrator application credentials privately. Expected:
`Raw normalization API and malformed input rejection verified.` This API verifier
retains one accepted synthetic event/audit record and logs out its own session.
The execution-policy override applies only to that PowerShell process. Both local checks were confirmed on Windows/PostgreSQL 18.6 on 2026-09-30. Task 09 is Complete.
