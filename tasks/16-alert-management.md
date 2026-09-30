# Task 16: Alert Management

## Status
Verification Pending

## Objective
Build alert listing, details, filtering, status handling, and analyst workflows.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Build alert listing, details, filtering, status handling, and analyst workflows.

## Explicitly Out of Scope
Do not collapse alerts and incidents into one object.

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
Analysts can inspect alerts and trace their source events.

## Required Deliverables
Alert UI/API.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Alert listing, detail retrieval, filtering, source-event tracing, and the analyst console are implemented.
- Task 16 alert statuses are NEW and ACKNOWLEDGED only.
- Administrator/Security Analyst can acknowledge or reopen alerts with a reason; Viewer/Management is read-only.
- Status changes re-check live alerts.manage permission transactionally and write ALERT_STATUS_CHANGED audit records.
- Focused Task 15–16 regressions pass 7/7.
- Append-only migration 009 implements the alert-management state fields and constraints.
- Windows/PostgreSQL migration and `verify:alerts` acceptance gate remains required before this task may be marked Complete.
- Task 17 correlation remains Not Started.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
