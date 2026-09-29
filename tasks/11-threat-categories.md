# Task 11: Threat Categories

## Status
In Progress

## Objective
Implement the approved configurable threat categories used by SentinelX detections and incidents.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement the approved configurable threat categories used by SentinelX detections and incidents.

## Explicitly Out of Scope
Do not claim detection for threats without an implemented rule.

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
Categories are consistent and selectable by rules/incidents.

### Verification
- [x] Fifteen stable categories include seven Task 14 families and eight user-approved business threat classifications.
- [x] Names, descriptions and selection availability are configurable.
- [x] Rules/incidents share validated catalog references; disabled choices reject new selections.
- [x] Historical classifications and independent status/threat levels are preserved.
- [x] Protected catalog reads and Administrator configuration are backend enforced and audited.
- [x] Unit/API, PostgreSQL and existing regression checks pass.
- [x] Append-only migrations, taxonomy/API documentation and rollback-only Windows verifier provided.
- [ ] Windows migration 005, fifteen-category selection verification and catalog access confirmed.

Initial seven-category Windows verification passed on 2026-09-30. The user then requested expansion to fifteen; the updated local gate remains pending.

## Required Deliverables
Threat taxonomy.

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
