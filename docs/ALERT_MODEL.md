# Alert model — Task 15

Task 15 defines SentinelX alerts as distinct persisted security signals created by qualifying deterministic detections. An alert is not a raw event and is not an incident.

## Persisted alert fields

Migration `008_alert_model.sql` extends the existing `alerts` table with the Task 15 signal snapshot:

| Field | Meaning |
|---|---|
| rule_id | Detection rule that generated the alert. |
| trigger_event_id | Event whose evaluation caused alert creation. |
| category_code | Threat/category snapshot at alert creation. |
| threat_level | LOW, MEDIUM, HIGH, or CRITICAL severity snapshot. |
| source | Canonical event source that triggered the alert. |
| created_at | Alert generation timestamp. |
| affected_entities | JSON object containing populated canonical sourceIp, destinationIp, user, and host values. |
| status | Task 15 initial alert state; currently only `NEW`. |
| confidence | Optional calibrated confidence in the range 0–1; deterministic Task 15 rules leave this null. |
| match_reason | Explainable rule-match reason. |
| match_evidence | Threshold/window/grouping and evidence-event identifiers. |

The pre-existing `alert_events` relation remains the evidence link between an alert and all events selected by the detection threshold. `trigger_event_id` identifies the specific event whose evaluation produced the signal.

## Threat and severity

`category_code` is the alert's threat/category snapshot and references the approved threat taxonomy. `threat_level` remains the independent severity field.

Both are copied from the generating detection rule when the alert is created, so later rule edits do not silently rewrite the historical alert signal.

## Affected entities

Task 15 records only canonical entity fields already present on the triggering normalized event:

- sourceIp
- destinationIp
- user
- host

Null/unknown values are omitted. Task 15 does not invent assets, identities, ownership, geolocation, or other context not present in the event.

## Status boundary

Every generated Task 15 alert starts in `NEW`. Migration 008 constrains the Task 15 model to that value. Task 16 owns alert-management workflows and may introduce approved additional states and transitions; Task 15 does not implement them early.

## Confidence boundary

Confidence is nullable and constrained to 0–1 when present. SentinelX's deterministic Task 15 rules do not have a calibrated probability model, so generated rule alerts store `confidence = null`.

No arbitrary score is fabricated from severity, threshold count, or rule category. A later task may populate confidence only when an implemented method provides a meaningful interpretation and validation.

## Existing-alert backfill

Migration 008 is append-only. It does not modify migrations 001–007. Existing alerts are upgraded from their rule/evidence links:

- trigger event is selected from `alert_events`, prioritizing the recorded triggerEventId when present;
- category is restored from recorded match evidence, with the rule category as fallback;
- source and affected entities are derived from the selected trigger event.

The migration fails instead of silently inventing required Task 15 fields if an existing alert cannot be upgraded.

## Verification

Focused model/persistence regressions cover required fields, affected-entity extraction, nullable confidence, duplicate suppression, and existing Task 13 detection behavior.

PostgreSQL integration coverage is available through:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:alert-model:integration
```

The Windows/PostgreSQL acceptance verifier is:

```powershell
node scripts/migrate.js
npm.cmd run verify:alert-model
```

Expected output:

`Alert rule/event/threat/severity/source/timestamp/entities/status and nullable confidence verified. Synthetic changes rolled back.`

The verifier executes inside a transaction and rolls back its synthetic rule, event, alert, category-state change, and constraint probes. It does not print credentials and requires no external API or API key.

Task 16, not Task 15, owns alert listing, filtering, detail retrieval, status handling, and analyst workflows.
