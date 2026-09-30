# Incident risk scoring — Task 20

Task 20 implements a deterministic, explainable incident risk score on a 0–100
scale. It is an operational prioritization score, not a probability that an attack
is real and not an AI prediction.

## Formula version 1

The score uses only factors that SentinelX currently implements and can verify:

`riskScore = min(100, severityPoints + eventFrequencyPoints)`

Severity points:

| Incident severity | Points |
|---|---:|
| LOW | 20 |
| MEDIUM | 40 |
| HIGH | 60 |
| CRITICAL | 80 |

The event-frequency factor is operationalized as the number of **distinct security
events linked as evidence through the incident's alerts**.

`eventFrequencyPoints = min(20, max(0, distinctEvidenceEvents - 1) × 2)`

This means:

| Distinct evidence events | Frequency points |
|---:|---:|
| 0 | 0 |
| 1 | 0 |
| 2 | 2 |
| 5 | 8 |
| 10 | 18 |
| 11 or more | 20 |

Examples:

- LOW + 1 event = 20
- MEDIUM + 2 events = 42
- HIGH + 4 events = 66
- CRITICAL + 2 events = 82
- CRITICAL + 11+ events = 100

The score is capped at 100.

## Why confidence is not used yet

Task 15 deliberately leaves deterministic alert confidence null because SentinelX
does not yet have a calibrated probability model. Treating null confidence as zero,
one, or an arbitrary midpoint would fabricate evidence.

Therefore Task 20 v1 does not use alert confidence. If a later implemented method
produces calibrated confidence with a documented meaning, a future formula version
may include it explicitly.

## Why asset impact is not used yet

The Task 20 objective lists factors such as asset impact, but SentinelX currently
has no approved asset inventory, asset-criticality field, or impact scale.

Task 20 does not invent one. A later approved asset model may introduce an impact
factor through a new documented risk-formula version.

## Event-frequency interpretation

SentinelX currently has linked evidence events but no approved incident-duration or
rate model. For that reason, v1 uses distinct linked evidence-event count as the
frequency/volume factor rather than inventing an events-per-minute denominator.

Duplicate references to the same evidence event count once.

## Persistence and database integrity

Append-only migration `013_incident_risk_scoring.sql` adds:

- `risk_event_count`
- `risk_score`
- `risk_formula_version`
- `risk_calculated_at`

`risk_score` is a PostgreSQL generated column. It cannot be independently written;
PostgreSQL derives it from the stored incident severity and evidence-event count
using the same version-1 formula.

Existing incidents are backfilled by counting distinct evidence events through
`incident_alerts → alert_events`.

New incidents refresh their stored evidence-event count after their alert links are
created. Task 19 severity changes automatically recompute the generated risk score.

No incident lifecycle status, threat-taxonomy category, assignment, or resolution
state changes the risk formula.

## API and UI

The existing incident list/detail APIs return a read-only risk object:

```json
{
  "score": 82,
  "eventCount": 2,
  "formulaVersion": 1,
  "calculatedAt": "2026-09-30T..."
}
```

The `/incidents` console displays the score and its evidence-event/formula
metadata.

There is intentionally no "edit risk" API or UI control. Authorized analysts
adjust the supported underlying incident severity through Task 19; the risk score
then recalculates deterministically.

## Boundary behavior

- event count must be a non-negative integer;
- unsupported severity values are rejected by the existing incident model/database;
- event-frequency contribution never exceeds 20 points;
- total score never exceeds 100;
- risk score is generated rather than freely mutable;
- incident status changes do not alter risk;
- taxonomy changes alone do not alter risk.

## Verification

Focused pure Task 20 formula tests passed 4/4 before repository update. The
existing Task 18 creation regression was updated to require evidence-count refresh.

PostgreSQL integration:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:risk:integration
```

Browser integration:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:risk:ui
```

Windows/PostgreSQL acceptance:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:risk
```

Expected verifier output:

`Deterministic severity/event-frequency risk formula, database generation, boundaries, API display and severity recalculation verified. Synthetic changes cleaned up.`

No external API or API key is required.


## Completion

Task 20 is Complete. Pure Task 20 formula tests passed 4/4, and the
Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`Deterministic severity/event-frequency risk formula, database generation, boundaries, API display and severity recalculation verified. Synthetic changes cleaned up.`

Task 21 Investigation Workspace remains separate and Not Started. No external API
or API key is required.
