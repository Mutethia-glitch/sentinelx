# SentinelX continuation checkpoint

Tasks 01–14 are Complete. Task 15 (Alert Model) is implemented and is Verification Pending.
Do not begin Task 16 until Task 15's Windows/PostgreSQL gate passes and Task 15 is
explicitly marked Complete.

Task 15 extends generated alerts into distinct persisted security signals. Each new
alert now retains:

- generating rule id;
- trigger event id;
- threat/category snapshot;
- LOW/MEDIUM/HIGH/CRITICAL severity;
- canonical event source;
- alert-generation timestamp;
- populated affected entities (sourceIp, destinationIp, user, host);
- initial status NEW;
- nullable confidence;
- explainable match reason/evidence;
- all selected evidence-event links through alert_events.

Append-only migration `008_alert_model.sql` adds the new alert fields and backfills
existing Task 13 alerts from their rule/event evidence before enforcing required
fields. Do not edit applied migrations 001–008 after migration 008 is successfully
applied.

Deterministic Task 15 rule alerts store `confidence=null`. SentinelX does not invent
an uncalibrated probability from severity, threshold count, or category. The
database accepts confidence only in the range 0–1 when a later implemented method
has a meaningful value.

Task 15 defines only the initial `NEW` alert status. Task 16 owns alert listing,
details, filtering, analyst workflows, and any approved additional alert states.
Task 16 remains Not Started.

Focused Task 13–15 local regressions passed 11/11 before the repository update.
The PostgreSQL integration test is `tests/integration/alert-model.test.js`.

The local Windows/PostgreSQL acceptance gate is:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:alert-model
```

Expected final verifier output:

`Alert rule/event/threat/severity/source/timestamp/entities/status and nullable confidence verified. Synthetic changes rolled back.`

The verifier runs synthetic changes inside a transaction and rolls them back. It
also verifies that out-of-range confidence and unapproved Task 15 status values are
rejected. It does not print credentials. Task 15 requires no external API or API key.

PostgreSQL remains hosted on the user's Windows computer. Keep actual credentials
private and never expose or commit `.env`. The application reads environment
variables and does not automatically load `.env`.

After the Task 15 Windows/PostgreSQL gate passes, update this file,
`docs/DEVELOPMENT_STATUS.md`, `docs/ALERT_MODEL.md`, and
`tasks/15-alert-model.md` to Complete. Then proceed only when the user requests
Task 16.
