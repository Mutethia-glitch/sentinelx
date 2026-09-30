# SentinelX continuation checkpoint

Tasks 01–16 are Complete. Task 17 (Alert Correlation) is implemented and is
Verification Pending. Do not begin Task 18 until Task 17's Windows/PostgreSQL gate
passes and Task 17 is explicitly marked Complete.

Task 17 adds deterministic explainable correlation between Alerts and future
Incidents. Newly generated alerts are evaluated against prior alerts within a
fixed 900-second window.

A pair correlates only when:
- at least two signals match from user, sourceIp, host and threat category; and
- at least one match is an entity field (user, sourceIp or host).

This prevents category-only grouping while allowing cross-category correlation
when two entity relationships tie the alerts together.

Each persisted `alert_correlations` row records the matched fields,
timeDeltaSeconds and windowSeconds. Migration `010_alert_correlation.sql` stores
one canonical UUID-ordered row per alert pair and structurally rejects duplicate
and reverse-direction pairs.

Correlation groups are connected components of these pairwise edges. Correlation
does not create incidents, change alert status, merge alerts/events, use ML, or
invent confidence. Task 18 incident management remains Not Started.

Production alert generation invokes the correlation engine using the same
PostgreSQL transaction client supplied by event ingestion. Duplicate-suppressed
alerts are not correlated again. Correlation failure propagates so normal
ingestion can roll back rather than silently persisting a partial result.

Focused Task 13/17 pre-push tests passed 14/14. Full repository quality remains a
Windows/local gate because the complete repository cannot be materialized in this
environment.

The Windows/PostgreSQL acceptance gate is:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:correlation
```

Expected final verifier output:

`Explainable alert correlation, connected grouping, time-window rejection and pair deduplication verified. Synthetic changes rolled back.`

The verifier uses synthetic rules/events/alerts inside a transaction and rolls all
changes back. It checks same-category/entity correlation, cross-category two-entity
correlation, category-only rejection, the 15-minute boundary, connected grouping,
repeat-evaluation deduplication, duplicate-pair rejection and reverse-pair
rejection.

PostgreSQL remains hosted on the user's Windows computer. Task 17 requires no
external API or API key. Never expose or commit actual `.env` values or database
credentials.

Migrations remain append-only and checksum tracked. Do not edit applied migrations
001–010 after migration 010 is successfully applied.

After Task 17 verification passes, update this handoff, DEVELOPMENT_STATUS.md,
CORRELATION_ENGINE.md and tasks/17-alert-correlation.md to Complete. Then proceed
only when the user requests Task 18.
