# Task 19: Incident Classification and Severity

## Status
Verification Pending

## Objective
Implement threat classification, severity, priority, and controlled analyst adjustment.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement threat classification, severity, priority, and controlled analyst adjustment.

## Explicitly Out of Scope
Do not invent undocumented scoring or labels.

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
Severity values are validated, stored, displayed, and tested. Incident taxonomy classification can be adjusted through an authorized, audited workflow.

No separate priority labels or score are introduced because the approved requirements define none; LOW/MEDIUM/HIGH/CRITICAL severity is the Task 19 triage-priority dimension. Task 20 owns deterministic risk scoring.

## Required Deliverables
Classification/severity.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Controlled incident taxonomy/severity adjustment is implemented through the incident assessment API and console.
- Classification supports the fifteen approved taxonomy codes or null/unclassified.
- Severity supports only LOW, MEDIUM, HIGH and CRITICAL.
- No P1/P2 labels, numeric priority, or undocumented score was introduced.
- Assessment changes do not alter incident lifecycle, assignment, alert links or terminal notes.
- Live RBAC, selectable-category checks and audit persistence are enforced transactionally.
- Migration 012 records assessment attribution.
- Focused Task 19 local tests passed 5/5 before repository update.
- Windows/PostgreSQL migration plus `verify:incident-classification` remains required before completion.
- Task 20 Risk Scoring remains Not Started.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
