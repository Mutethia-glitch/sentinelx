# SentinelX continuation checkpoint

Tasks 01–17 are Complete. Task 17 (Alert Correlation) passed its
Windows/PostgreSQL acceptance gate on 2026-09-30. Task 18 (Incident Management)
remains Not Started and must not begin until the user requests it.

Task 17 adds deterministic explainable correlation between Alerts and future
Incidents. Newly generated alerts are evaluated against prior alerts within a
fixed 900-second window.

A pair correlates only when:
- at least two signals match from user, sourceIp, host and threat category; and
- at least one match is an entity field (user, sourceIp or host).

This prevents category-only grouping while allowing cross-category correlation
when two entity relationships tie alerts together.

Each persisted `alert_correlations` row records matchedFields, timeDeltaSeconds
and windowSeconds. Migration `010_alert_correlation.sql` stores one canonical
UUID-ordered row per alert pair and structurally rejects duplicate/reverse pairs.

Correlation groups are connected components of these pairwise edges. Correlation
does not create incidents, change alert status, merge alerts/events, use ML, or
invent confidence. Task 18 incident management remains Not Started.

Production alert generation invokes the correlation engine using the same
PostgreSQL transaction client supplied by event ingestion. Duplicate-suppressed
alerts are not correlated again, and correlation failure propagates so normal
ingestion can roll back rather than silently persisting a partial result.

Focused Task 13/17 tests passed 14/14. Windows/PostgreSQL acceptance verification
passed on 2026-09-30 with:

`Explainable alert correlation, connected grouping, time-window rejection and pair deduplication verified. Synthetic changes rolled back.`

Migration 010 is now part of the applied append-only/checksum-tracked chain. Do not
edit migrations 001–010 or bypass migration checksum verification.

PostgreSQL remains hosted on the user's Windows computer. Task 17 requires no
external API or API key. Never expose or commit actual `.env` values or database
credentials.

When work resumes, read repository instructions, this handoff,
`docs/DEVELOPMENT_STATUS.md`, and `tasks/18-incident-management.md` before
beginning. Proceed numerically from Task 18 only when requested.
