# Task 25: Search and Filtering

## Status
Complete

## Objective
Implement consistent filters across events, alerts, and incidents.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement consistent filters across events, alerts, and incidents.

## Explicitly Out of Scope
Do not create incompatible filtering conventions.

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
Relevant date, severity, status, category, IP, user, host, rule, and MITRE filters work.

The existing event/alert/incident list APIs share parameter names, input validation,
parameterized SQL, and evidence-chain semantics. Existing domain-specific fields
remain available. Reader roles can filter their authorized records; malformed
filters return 400; linked evidence is matched without duplicate list rows.

## Required Deliverables
Search/filter layer.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Shared search parser validates common date, severity, status, category, source, IP, user, host, rule, MITRE, text and pagination parameters.
- Event/alert/incident list repositories use parameterized EXISTS evidence joins; combinations match a consistent linked alert/event chain without row multiplication.
- Existing event type/action, alert status, incident assignee and supported per-domain severities remain compatible.
- Event category/rule/MITRE fields trace linked alert evidence; alert entity fields trace linked events; incident evidence fields trace linked alert/event chains.
- The three existing console filter forms expose applicable fields.
- Focused unit tests, PostgreSQL verifier and optional browser regression are implemented.
- No migration needed; preserve 001–014.
- The Windows/PostgreSQL `verify:search` acceptance verifier passed on 2026-09-30.
- Reported result: `Consistent event/alert/incident date, severity, status, category, IP, user, host, rule and MITRE filters, evidence-chain matching, RBAC and safe pagination verified. Synthetic changes cleaned up.`.
- Synthetic changes were cleaned up. No migration was added; preserve applied migrations 001–014.
- Task 26 Reporting remains Not Started.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
