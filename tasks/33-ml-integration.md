# Task 33: ML Integration

## Status
Implemented — awaiting local acceptance

## Objective
Integrate anomaly scores as supporting evidence in alerts/incidents.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Integrate anomaly scores as supporting evidence in alerts/incidents.

## Explicitly Out of Scope
Do not redesign the incident pipeline around ML.

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
Scores are stored/displayed appropriately and do not bypass normal controls.

## Required Deliverables
ML integration.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Implementation Note — 2026-09-30
Implemented as an optional evidence-only layer after deterministic rule qualification. Existing alert `match_evidence` stores the trigger-event snapshot; no migration, external API, new dependency, severity/confidence/risk override, RBAC/audit bypass, duplicate-suppression change, or automated response path was introduced.

`SENTINELX_ML_MODE=synthetic-demo` is the only scoring mode and reuses Tasks 29–32. Default is disabled. Optional PostgreSQL history failures are isolated with a savepoint and local statement timeout. Alert/incident reads expose ready, disabled, unavailable, and historical states without rescoring historical records.

Tool-runtime targeted tests passed before publication. Windows/PostgreSQL/browser acceptance remains pending. See `docs/ML_INTEGRATION.md`.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
