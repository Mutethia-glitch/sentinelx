# Task 14: Initial Detection Rules

## Status
Verification Pending

## Objective
Implement approved core rules for brute force, credential attacks, privilege escalation, suspicious account activity, unauthorized access, reconnaissance, suspicious network activity, and selected scenarios.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement approved core rules for brute force, credential attacks, privilege escalation, suspicious account activity, unauthorized access, reconnaissance, suspicious network activity, and selected scenarios.

The user-approved Task 11 taxonomy expansion is included in Task 14's selected scenarios, so the implemented initial rule set covers all fifteen approved categories.

## Explicitly Out of Scope
Do not claim a rule detects behavior unless its logic and tests demonstrate it.

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
Every rule has documented logic, severity, test data, and expected output.

## Required Deliverables
Core rule set.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- One version-controlled core rule is implemented for each of the fifteen approved threat categories.
- Rules are seeded disabled by append-only migration 007 so installation does not silently activate detection policy.
- Positive, below-threshold and non-match test data exists for every rule.
- Task-specific local automated checks pass 16/16.
- Windows/PostgreSQL migration and `verify:initial-rules` acceptance gate remains required before this task may be marked Complete.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
