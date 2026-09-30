# Task 18: Incident Management

## Status
Verification Pending

## Objective
Implement the incident lifecycle from creation through closure.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement the incident lifecycle from creation through closure.

## Explicitly Out of Scope
Do not skip the incident layer.

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
Incidents support the authoritative baseline states NEW, INVESTIGATING, CONTAINED, RESOLVED, and DISMISSED, assignment, and terminal resolution/dismissal notes.

The earlier Open/Closed wording is superseded by Task 02 FR-013 and the approved architecture, which explicitly prohibit adding a separate CLOSED state. Direct CONTAINED mutation is reserved for the successful controlled-response workflow required by FR-017/Task 22.

## Required Deliverables
Incident module.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Incident creation from existing alerts, linked-alert inspection, assignment and lifecycle management are implemented.
- New incidents begin in NEW and inherit the highest linked-alert severity as the deterministic creation default.
- OPEN and CLOSED are rejected; the implementation follows the authoritative Task 02 incident lifecycle.
- INVESTIGATING is analyst-controlled; RESOLVED and DISMISSED require terminal notes.
- CONTAINED is recognized but cannot be set directly before Task 22 records a successful approved containment action.
- Creation, assignment and status changes are audited transactionally with live RBAC rechecks.
- Focused Task 18 local tests passed 10/10 before repository update.
- Migration 011 and Windows/PostgreSQL `verify:incidents` remain required before completion.
- Task 19 remains Not Started.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
