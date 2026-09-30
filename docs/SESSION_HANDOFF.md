# SentinelX continuation checkpoint

Tasks 01–15 are Complete. Task 15 (Alert Model) passed its Windows/PostgreSQL
acceptance gate on 2026-09-30. Task 16 (Alert Management) remains Not Started
and must not begin until the user requests it.

Task 15 extends generated alerts into distinct persisted security signals. Each
alert retains:

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

Append-only migration `008_alert_model.sql` adds the Task 15 fields and backfills
existing Task 13 alerts from their rule/event evidence before enforcing required
fields. Do not edit applied migrations 001–008 or bypass migration checksums.

Deterministic Task 15 rule alerts store `confidence=null`; SentinelX does not
invent an uncalibrated probability. Confidence is constrained to 0–1 when present.

Task 15 defines only the initial `NEW` alert status. Task 16 owns alert listing,
details, filtering, analyst workflows, and any approved additional alert states.

Focused Task 13–15 regressions passed 11/11. Windows/PostgreSQL verification passed
on 2026-09-30 with:

`Alert rule/event/threat/severity/source/timestamp/entities/status and nullable confidence verified. Synthetic changes rolled back.`

The verifier runs synthetic changes inside a transaction and rolls them back. It
does not print credentials. Task 15 requires no external API or API key.

PostgreSQL remains hosted on the user's Windows computer. Keep actual credentials
private and never expose or commit `.env`. The application reads environment
variables and does not automatically load `.env`.

When work resumes, read repository instructions, this handoff,
`docs/DEVELOPMENT_STATUS.md`, and `tasks/16-alert-management.md` before
beginning. Proceed numerically from Task 16 only when requested.
