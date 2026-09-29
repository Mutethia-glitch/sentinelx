# Task 05: Authentication

## Status
Complete

## Objective
Implement secure user authentication and session/token handling.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement secure user authentication and session/token handling.

## Explicitly Out of Scope
Do not add social authentication or unrelated identity providers.

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
Secure login/logout, safe failures, environment-based secrets, and authentication tests work.

### Verification
- [x] Authentication module, protected current-user API, login and logout implemented.
- [x] Salted password hashing, bounded derivation work and hashed opaque sessions implemented.
- [x] Session expiry, revocation, deactivation and password-change behavior verified on PostgreSQL 16.
- [x] Generic failures, origin checks, safe cookies, input limits and login throttling tested.
- [x] Environment-based credentials; no `.env` secrets read or committed.
- [x] Transactional authentication auditing tested, including rollback on audit failure.
- [x] Unit/HTTP tests and PostgreSQL integration tests pass; Task 04 regression tests pass.
- [x] API, architecture, schema and Windows setup documentation updated.
- [x] Migration 002, local user provisioning and login/logout verified on Windows with PostgreSQL 18.6.

Automated tests passed in a disposable PostgreSQL 16 environment. On 2026-09-29,
the user also confirmed migration application, user provisioning, API startup,
successful login and authenticated retrieval, successful logout, and rejection of
subsequent authenticated retrieval on Windows/PostgreSQL 18.6. No credentials,
account identifiers or session tokens are included in this verification record.

## Required Deliverables
Authentication module.

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
