# Task 35: API Hardening

## Status
Implemented — awaiting local acceptance

## Objective
Apply validation, authorization, safe errors, and appropriate rate limiting across APIs.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Apply validation, authorization, safe errors, and appropriate rate limiting across APIs.

## Explicitly Out of Scope
Do not expose stack traces, secrets, credentials, or unauthorized records.

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
Security tests show protected endpoints reject invalid/unauthorized requests.

## Required Deliverables
API security.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Implementation Note — 2026-09-30
Implemented a shared API security boundary ahead of all `/api` routing. It applies bounded per-socket-IP request and mutation rate limits, rejects oversized/ambiguous API request targets and body-bearing GET/HEAD requests, and sets uniform no-store/no-sniff/referrer/resource-policy headers. Existing route-level JSON validation, exact-origin mutation checks, live session/RBAC authorization, parameterized persistence, safe errors, and human-controlled response auditing remain authoritative.

The existing login limiter remains stricter. Caller-supplied forwarding headers are not trusted for identity. No migration, external security service, new runtime dependency, frontend change, trusted-proxy model, or automated response path was introduced. Focused reconstruction checks passed 5/5 before publication. Windows local quality and Task 35 verifier acceptance remain pending. See `docs/API_HARDENING.md`.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
