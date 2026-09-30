# SentinelX continuation checkpoint

Tasks 01–20 are Complete. Task 20 (Risk Scoring) passed its Windows/PostgreSQL
acceptance gate on 2026-09-30. Task 21 (Investigation Workspace) remains Not
Started and must not begin until the user requests it.

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

Pure Task 20 formula tests passed 4/4. Windows/PostgreSQL acceptance verification
passed on 2026-09-30 with:

`Deterministic severity/event-frequency risk formula, database generation, boundaries, API display and severity recalculation verified. Synthetic changes cleaned up.`

Migration 013 is now part of the applied append-only/checksum-tracked migration
chain. Do not edit migrations 001–013 or bypass migration checksum verification.

PostgreSQL remains hosted on the user's Windows computer. Task 20 requires no
external API or API key. Never expose or commit actual `.env` values or database
credentials.

When work resumes, read repository instructions, this handoff,
`docs/DEVELOPMENT_STATUS.md`, and `tasks/21-investigation-workspace.md` before
beginning. Proceed numerically from Task 21 only when requested.
