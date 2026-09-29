# Task 06: Role-Based Access Control

## Status
In Progress

## Objective
Implement Administrator, Security Analyst, and Viewer/Management permissions at API and UI levels.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement Administrator, Security Analyst, and Viewer/Management permissions at API and UI levels.

## Explicitly Out of Scope
UI hiding is not authorization. Do not invent arbitrary roles.

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
Unauthorized API actions are rejected and role permissions are tested.

### Verification
- [x] Only Administrator, Security Analyst and Viewer/Management grants are defined.
- [x] Unknown roles/permissions deny by default; live backend session/role checks precede protected operations.
- [x] Role assignment is validated, authorized, transactionally audited and revokes affected sessions.
- [x] First Administrator bootstrap and last-active-Administrator removal safeguards are concurrency-tested.
- [x] Policy/HTTP checks, PostgreSQL integration checks and real browser role-control checks pass.
- [x] Authentication and database foundation regression checks pass.
- [x] The minimal role-aware access page uses real protected APIs, with no future SOC feature implementations.
- [x] Permission matrix, API, architecture, data and Windows setup documentation updated.
- [ ] Verify migration 003, Administrator bootstrap, role-aware page and denied access on Windows.

The task remains In Progress until the user's local verification succeeds.

## Required Deliverables
RBAC.

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
