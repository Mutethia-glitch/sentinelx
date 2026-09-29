# Task 10: Event Management UI

## Status
In Progress

## Objective
Build event viewing, searching, filtering, and inspection.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Build event viewing, searching, filtering, and inspection.

## Explicitly Out of Scope
Do not merge event management into incident management.

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
Analysts can inspect events and filter relevant fields without unauthorized exposure.

### Verification
- [x] Protected event list and inspection APIs support the event page.
- [x] Relevant event fields can be searched/filtered with bounded pagination.
- [x] Analysts and approved read-only roles can inspect normalized data and raw evidence.
- [x] Missing/unapproved identity is rejected on the backend; list summaries omit raw evidence.
- [x] Data is rendered as text and cleared on sign-out or access loss.
- [x] Unit/API, PostgreSQL/browser and existing regression checks pass.
- [x] Local API inventory and Windows verification documented.
- [ ] Windows list/filter/inspection/access checks succeed.

## Required Deliverables
Event UI.

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
