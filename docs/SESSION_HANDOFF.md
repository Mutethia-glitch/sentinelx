# SentinelX continuation checkpoint

Tasks 01–19 are Complete. Task 20 (Risk Scoring) is implemented and is
Verification Pending. Do not begin Task 21 until Task 20's Windows/PostgreSQL gate
passes and Task 20 is explicitly marked Complete.

Task 20 implements deterministic incident risk formula version 1 on a 0–100 scale:

`risk = min(100, severityPoints + frequencyPoints)`

Severity points:
- LOW = 20
- MEDIUM = 40
- HIGH = 60
- CRITICAL = 80

Frequency/volume input is the count of distinct security events linked as evidence
through the incident's alerts.

`frequencyPoints = min(20, max(0, distinctEvidenceEvents - 1) * 2)`

Examples:
- LOW + 1 evidence event = 20
- MEDIUM + 2 = 42
- HIGH + 4 = 66
- CRITICAL + 2 = 82
- CRITICAL + 11 or more = 100

Task 20 does not use confidence because Task 15 intentionally leaves deterministic
alert confidence null until a calibrated method exists. It does not use asset
impact because SentinelX has no approved asset inventory/criticality model. No
placeholder factor, AI prediction, taxonomy multiplier, or lifecycle multiplier is
invented.

Migration `013_incident_risk_scoring.sql` adds:
- risk_event_count
- generated risk_score
- risk_formula_version
- risk_calculated_at

The PostgreSQL `risk_score` column is generated from threat_level and
risk_event_count, so it cannot be independently overwritten. Existing incidents are
backfilled from incident_alerts → alert_events. New incident creation refreshes the
distinct evidence-event count after alert links are created.

Task 19 severity reassessment automatically recomputes risk through PostgreSQL.
Incident status changes do not alter risk. The incident API/UI exposes a read-only
risk object with score, evidence-event count, formula version and calculation time;
there is no manual risk override endpoint/control.

Pure Task 20 formula tests passed 4/4 before repository update. The Task 18 incident
creation regression was updated for the evidence-count refresh. PostgreSQL and
browser verification entry points are implemented.

Run the Windows/PostgreSQL acceptance gate:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:risk
```

Expected final output:

`Deterministic severity/event-frequency risk formula, database generation, boundaries, API display and severity recalculation verified. Synthetic changes cleaned up.`

Optional explicit disposable-database checks:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:risk:integration
npm.cmd run test:risk:ui
```

PostgreSQL remains hosted on the user's Windows computer. Task 20 requires no
external API or API key. Never expose or commit actual `.env` values or database
credentials.

Migrations remain append-only/checksum tracked. Migration 013 has not yet been
confirmed applied in the Windows database; after it applies successfully, do not
edit migrations 001–013.

Task 21 (Investigation Workspace) remains Not Started.
