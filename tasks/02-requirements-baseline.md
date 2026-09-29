# Task 02: Requirements Baseline

## Status
Complete

## Objective
Convert the approved SentinelX specification into explicit functional and non-functional requirements that implementation tasks must follow.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Convert the approved SentinelX specification into explicit functional and non-functional requirements that implementation tasks must follow.

## Explicitly Out of Scope
Do not invent commercial-SIEM features or expand the academic scope.

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
Requirements are numbered, traceable, testable, and consistent with SentinelX.

### Verification
- [x] 36 functional requirements are numbered `FR-001` through `FR-036`.
- [x] 18 non-functional/security requirements are numbered `NFR-001` through `NFR-018`.
- [x] Each requirement states a verification method and primary implementation task(s).
- [x] Every requirement ID appears in `docs/REQUIREMENTS_TRACEABILITY.md`.
- [x] Lifecycle invariants preserve the approved incident-status/threat-level separation.
- [x] Core and advanced/optional scope are explicitly separated.
- [x] No later-task application or database implementation was introduced.

## Required Deliverables
Requirements baseline.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
