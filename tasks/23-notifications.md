# Task 23: Notifications

## Status
Complete

## Objective
Implement in-app notifications with severity-aware behavior and optional approved email support.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement in-app notifications with severity-aware behavior and optional approved email support.

## Explicitly Out of Scope
Do not spam users or expose unnecessary sensitive information.

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
Notification state, delivery, and failures are handled safely.

Explicit authorized in-app dispatch creates a committed recipient-only notification.
Severity is derived from the selected incident/alert, snapshotted, and used to
prioritize the unread inbox. At most one unread item per recipient and source is
delivered. Recipient-only read updates, live RBAC, audit atomicity and rollback
are tested. Optional email is excluded because no approved SMTP integration or
credentials exist; do not pretend external delivery succeeded.

## Required Deliverables
Notification module.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- In-app notification service, private inbox, validated explicit dispatch and mark-read API implemented.
- Added Administrator/Security Analyst `notifications.send`; all three roles have `notifications.read` but each user sees only their own inbox.
- Migration 014 adds an optional severity snapshot and recipient/state/severity index without altering migrations 001–013.
- Severity-aware messages use LOW/MEDIUM/HIGH/CRITICAL; urgent unread HIGH/CRITICAL items display first.
- Duplicate unread recipient/source dispatch returns the existing record rather than spamming. Delivery occurs only after transactional persistence.
- `NOTIFICATION_DELIVERED` and `NOTIFICATION_READ` are audited atomically; failures roll back and return no success claim.
- Generic server-generated messages omit raw evidence and credentials. No email or background delivery is claimed.
- Unit, PostgreSQL and browser verification entry points are implemented.
- The Windows/PostgreSQL `verify:notifications` acceptance verifier passed on 2026-09-30.
- Reported verification result: `Severity-aware in-app delivery, recipient isolation, duplicate suppression, read state, RBAC, auditing and atomic failure rollback verified. Synthetic changes cleaned up.`
- Migration 014 is now part of the verified local schema; do not edit applied migrations 001–014.
- Task 24 Dashboard remains Not Started.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
