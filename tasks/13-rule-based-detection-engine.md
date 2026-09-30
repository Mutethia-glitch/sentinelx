# Task 13: Rule-Based Detection Engine

## Status
Complete

## Objective
Implement deterministic detection against normalized events and generate alerts when rules match.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement deterministic detection against normalized events and generate alerts when rules match.

## Explicitly Out of Scope
Do not replace the required foundation with ML or destructive automation.

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
Matching events generate correct alerts; non-matches do not; thresholds and windows work.

## Required Deliverables
Detection engine.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Completion Evidence
- Deterministic matching/non-matching, threshold, grouping and event-time-window behavior is covered by Task 13 automated tests.
- Duplicate processing of the same rule/trigger is suppressed deterministically.
- Alert persistence and event-link evidence use the existing PostgreSQL schema.
- Detection failure rolls back the enclosing event-ingestion transaction.
- Windows/PostgreSQL local acceptance verification passed on 2026-09-30:
  `Deterministic matching, non-match rejection, thresholds, grouping, windows, duplicate suppression and atomic rollback verified.`
- Task 13 requires no external API key and introduced no new migration.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
