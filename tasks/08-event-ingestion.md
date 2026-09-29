# Task 08: Event Ingestion

## Status
In Progress

## Objective
Implement controlled ingestion of security events through an API and/or approved simulated datasets.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement controlled ingestion of security events through an API and/or approved simulated datasets.

## Explicitly Out of Scope
Do not make live enterprise network monitoring a prerequisite.

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
Valid events are accepted and stored; invalid payloads are rejected and tested.

### Verification
- [x] Valid approved-source events are accepted and stored through an authenticated API.
- [x] Administrator/Analyst ingestion permission and Viewer denial enforced on the backend.
- [x] Invalid payloads, origins, sources, methods and oversized bodies rejected and tested.
- [x] Event and attributed audit persist atomically; audit failure rolls both back.
- [x] PostgreSQL integration and existing identity/event regressions pass.
- [x] Approved synthetic fixture, API documentation and PowerShell verification supplied.
- [ ] Windows valid/invalid ingestion and Viewer rejection verified.

## Required Deliverables
Event ingestion.

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
