# Task 21: Investigation Workspace

## Status
Complete

## Objective
Build the incident investigation view with evidence, timeline, related events/alerts, affected entities, and analyst notes.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Build the incident investigation view with evidence, timeline, related events/alerts, affected entities, and analyst notes.

## Explicitly Out of Scope
Do not add offensive security tooling.

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
Analysts can reconstruct a timeline and record findings.

The workspace exposes linked alerts/events, affected entities, incident history, and append-only analyst findings. Viewer/Management is read-only; Administrator/Security Analyst users may record findings.

## Required Deliverables
Investigation module.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Dedicated investigation API/service/repository are implemented using the existing core `investigation_notes` table.
- Incident inspection displays related alerts/events, affected users/hosts/IPs, chronological history, and analyst findings.
- Findings may cite only alerts/events actually linked to the incident.
- Findings are append-only and write an `INVESTIGATION_NOTE_ADDED` audit record atomically.
- Viewer/Management can read investigations but cannot record findings.
- Task 21 introduces no new migration; migrations 001–013 remain unchanged.
- PostgreSQL and browser verifiers are implemented.
- Windows/PostgreSQL `verify:investigations` passed on 2026-09-30.
- Migration replay/checksum check passed: `PostgreSQL migrations verified/applied.`
- Verified result: `Investigation evidence, affected entities, chronological timeline, analyst findings, RBAC, evidence validation, auditing and rollback verified. Synthetic changes cleaned up.`
- Task 22 Response Workflow remains Not Started.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
