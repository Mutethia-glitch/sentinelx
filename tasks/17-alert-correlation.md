# Task 17: Alert Correlation

## Status
Verification Pending

## Objective
Implement explainable correlation and deduplication using approved relationships such as user, source IP, host, category, and time window.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement explainable correlation and deduplication using approved relationships such as user, source IP, host, category, and time window.

## Explicitly Out of Scope
Do not create opaque or untestable correlation logic.

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
Related alerts group according to documented rules and tests.

## Required Deliverables
Correlation engine.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Deterministic 900-second correlation is implemented using user, source IP, host, category and time relationships.
- A pair requires at least two matching signals and at least one entity match; category-only grouping is rejected.
- Cross-category alerts may correlate when two entity relationships match.
- Correlation evidence stores matched fields, elapsed seconds and window length.
- Migration 010 persists canonical, unique alert pairs; reverse/duplicate pair storage is structurally rejected.
- Connected components provide alert groups without creating incidents.
- Newly generated production alerts invoke correlation in the existing ingestion transaction.
- Focused Task 13/17 local tests passed 14/14 before repository update.
- Windows/PostgreSQL migration plus `verify:correlation` remains required before completion.
- Task 18 incident management remains Not Started.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
