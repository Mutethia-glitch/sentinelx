# Task 36: Frontend Security and UX

## Status
Implemented — awaiting local acceptance

## Objective
Harden the frontend for safe rendering, authorization-aware navigation, data protection, loading/error states, and analyst usability.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Harden the frontend for safe rendering, authorization-aware navigation, data protection, loading/error states, and analyst usability.

## Explicitly Out of Scope
Do not prioritize visual effects over security correctness.

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
Protected routes and important UI states work consistently.

## Required Deliverables
Frontend quality.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Implementation Note — 2026-09-30
Implemented a shared frontend helper and consistent permission-aware navigation across the seven existing operational consoles. Permissioned links start hidden and are revealed only from live `/api/access/me` grants; authentication reset/sign-out hides them again. Primary loads now expose explicit loading states, the audit console now preserves an authenticated identity/permission-denied state rather than falling back to a misleading login view, and all login password fields use current-password autocomplete and are cleared after attempts.

Frontend rendering remains DOM/text-node based. Regression checks forbid unsafe HTML/script sinks and browser credential/data storage APIs. The existing restrictive page CSP remains in place; the shared helper asset is GET-only, no-store, no-sniff, no-referrer and same-origin-resource-policy protected. No backend authorization was moved client-side, no migration/new runtime dependency/visual-effects redesign was introduced, and Task 37 was not started. Local Windows quality, verifier and browser acceptance remain pending. See `docs/FRONTEND_SECURITY_UX.md`.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
