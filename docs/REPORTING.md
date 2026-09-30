# Task 26 — Reporting

Task 26 implements FR-033 using persisted SentinelX data only.

## Report types

- Security summary: `GET /api/reports/security`
- Incident report: `GET /api/reports/incidents/{incidentId}`

Both require `reports.read`, which is available to the three approved reader roles.

The security summary accepts `from`, `to`, and `format`. Dates are inclusive ISO-8601 timestamps and ranges longer than 366 days are rejected. The single-incident report accepts only `format`. `format` is `json` or `csv`.

## Data integrity

Reports run in PostgreSQL `REPEATABLE READ, READ ONLY` transactions. Statistics are derived from persisted security events, alerts, incidents, investigation notes, and response actions. No demonstration values are injected.

The security summary includes event/alert/incident counts, severity distributions, active incidents, average incident risk, incident categories, and recorded response outcomes for the selected range.

The incident report includes authoritative incident state, assignment, risk, linked alerts, investigation notes, and recorded response actions.

CSV export is intentionally simple and portable: nested report fields are flattened into `section,key,value` rows. Formula-like text cells beginning with `=`, `+`, `-` or `@` (including after
leading whitespace/control characters) receive an apostrophe prefix so spreadsheet
software treats them as text. Real numeric values retain their numeric form.
JSON remains the canonical structured format and preserves original values.

Task 26 adds no schema migration and no external report vendor.

## Verification

Run:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:reports
```

Expected:

`Stored-data security summaries, incident reports, date ranges, JSON/CSV export, RBAC and read-only reporting verified. Synthetic changes cleaned up.`

## Completion

Task is **Complete**. On 2026-09-30, the Windows quality suite passed 137/137 and the corresponding PostgreSQL acceptance verifier reported:

`Stored-data security summaries, incident reports, date ranges, JSON/CSV export, RBAC and read-only reporting verified. Synthetic changes cleaned up.`
