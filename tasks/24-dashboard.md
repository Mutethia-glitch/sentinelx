# Task 24: Dashboard

## Status
Complete

## Objective
Build the security-operations dashboard using real SentinelX data for events, alerts, incidents, severity, threats, trends, and response metrics.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Build the security-operations dashboard using real SentinelX data for events, alerts, incidents, severity, threats, trends, and response metrics.

## Explicitly Out of Scope
Do not use hard-coded decorative metrics.

## Dependencies
Complete the preceding tasks required by the sequence before implementing this task. Do not bypass dependencies merely to make the interface appear complete.

## Non-Negotiable Implementation Rules
1. Preserve SentinelX terminology and the existing architecture.
2. Do not introduce Supabase.
3. Do not invent requirements that are not in this repository.
4. Do not add unrelated commercial-SIEM features.
5. Do not replace deterministic detection with machine learning unless this task explicitly requires ML.
6. Do not add offensive security tooling or destructive response actions.
7. Keep secrets in environment variables and never commit credentials.
8. Validate API inputs.
9. Enforce authorization on the backend.
10. Add tests for important behavior.
11. Update documentation when an architectural/API behavior changes.
12. If something is ambiguous, choose the smallest solution consistent with the existing SentinelX architecture and document the decision.

## Acceptance Criteria
Displayed metrics trace to real data and update correctly.

Authenticated dashboard snapshots use PostgreSQL REPEATABLE READ READ ONLY.
All-time totals, rolling 24-hour activity, severity/status distributions, leading
threat categories, seven UTC calendar-day trends and recorded response outcomes
are derived from existing security_events, alerts, incidents and response_actions.
Refreshing after synthetic data changes updates the correct metrics without
inventing demonstration figures or changing source records.

## Required Deliverables
Dashboard.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Implemented `GET /api/dashboard` with live `dashboard.read` authorization and no arbitrary filters; all approved roles may view safe aggregate metrics.
- Uses one PostgreSQL REPEATABLE READ READ ONLY transaction for a consistent snapshot.
- `/dashboard` UI renders all-time totals, 24-hour activity, severity/status, top threat categories, response outcomes and seven UTC calendar days using textual counts and accessible proportional bars.
- Manual refresh always re-reads database values; no decorative values, fake forecasts or cached simulated figures.
- Missing severity/status buckets are zero-filled; average risk is null when no incidents exist.
- Audit/status/response source records are not mutated by dashboard reads. SQL errors are sanitized and the read transaction is rolled back.
- Task 24 adds no migration; preserve the applied append-only checksum chain 001–014.
- Focused unit tests, PostgreSQL verifier and browser regression are implemented.
- Windows/PostgreSQL `verify:dashboard` acceptance passed on 2026-09-30.
- Reported result: `Live dashboard totals, severity/status distributions, threat and UTC trends, recorded response outcomes, Viewer access, refresh accuracy and read-only rollback verified. Synthetic changes cleaned up.`
- Task 25 Search and Filtering remains Not Started. No external API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
