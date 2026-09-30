# Task 29: Advanced Detection Dataset

## Status
Complete

## Objective
Prepare a controlled, documented dataset for anomaly-detection research.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Prepare a controlled, documented dataset for anomaly-detection research.

## Explicitly Out of Scope
Do not use private personal data or claim real-world accuracy from synthetic data without limitations.

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
Dataset schema, features, assumptions, and provenance are documented.

## Required Deliverables
ML dataset.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Deterministic synthetic JSONL dataset and manifest are implemented.
- Dataset contains artificial normalized-style fields and research labels only.
- No production/personal data, emails, credentials, raw payloads or connected-app records are used.
- Documentation address ranges and artificial user/host identifiers are enforced by verification.
- Class balance and labels are explicitly synthetic and not claimed to represent real-world prevalence or model accuracy.
- No Task 30 feature engineering is included.
- Task 30 remains Not Started.

- Initial Windows acceptance attempt on 2026-09-30 failed when comparing checkout-dependent JSONL line endings. Verification now compares canonical LF content after CRLF normalization.
- The checked-in fixture comparison also runs in normal `quality`; a simulated Windows CRLF copy passed the isolated check. The user reran `npm.cmd run verify:dataset` after the fix and reported the successful acceptance output below.

## Acceptance — 2026-09-30

Windows verifier passed:

`Controlled synthetic dataset schema, provenance, labels, privacy constraints and deterministic reproduction verified.`

The 80-record synthetic fixture and manifest were validated, including schema,
provenance, artificial identifiers, documentation-only network ranges, labels and
cross-platform reproducibility. Task 30 remains Not Started.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
