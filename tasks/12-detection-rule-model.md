# Task 12: Detection Rule Model

## Status
In Progress

## Objective
Implement configurable detection rules with conditions, thresholds, time windows, severity, category, MITRE mapping, and enabled state.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement configurable detection rules with conditions, thresholds, time windows, severity, category, MITRE mapping, and enabled state.

## Explicitly Out of Scope
Do not hard-code every rule into controllers or UI.

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
Rules can be created, edited, enabled/disabled, validated, and tested.

### Verification
- [x] Declarative conditions, thresholds, windows, grouping, severity and category validated.
- [x] Optional known MITRE references persist through relational mappings.
- [x] Rules can be created, edited, enabled/disabled and structurally validated through protected APIs.
- [x] Admin/Analyst management and Viewer read/write denial are backend enforced.
- [x] Version conflicts and audited transactional rollback are tested.
- [x] Unit/API, PostgreSQL lifecycle and existing regression checks pass.
- [x] API/schema documentation and Windows verification provided.
- [ ] Windows migration and rule lifecycle/Viewer checks pass.

Rule execution is Task 13. Pause after Task 12 completion for the user's requested break.

## Required Deliverables
Rule management.

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
