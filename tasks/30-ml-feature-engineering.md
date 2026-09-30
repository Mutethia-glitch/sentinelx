# Task 30: ML Feature Engineering

## Status
Complete

## Objective
Extract behavioral features such as login frequency, failed-login frequency, source frequency, timing, and event frequency.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Extract behavioral features such as login frequency, failed-login frequency, source frequency, timing, and event frequency.

## Explicitly Out of Scope
Do not replace the normalized event model with ML features.

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
Feature generation is reproducible and tested.

## Required Deliverables
ML feature pipeline.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State

- Pure versioned feature pipeline implemented in `src/ml/features.js`.
- Prior-only rolling login, failed-login, source-IP, host and overall event counts,
  plus UTC timing fields. Equal timestamps do not count one another.
- Deterministic sorting, explicit null handling, input validation and immutable inputs.
- Research labels, scenarios, severity and identities excluded from numeric predictors.
- Behavior, assumptions and PowerShell acceptance commands documented in
  `docs/ML_FEATURE_ENGINEERING.md`.
- Automated validation: full quality suite 149/149 passed, dataset and feature
  verifiers passed, and simulated Windows CRLF fixture verification passed.
  User-reported Windows dataset and feature verifiers passed on 2026-09-30.
- No model training, production integration, schema change or external API.
- Task 31 remains Not Started; do not start it without instruction.


## Local acceptance — 2026-09-30

The user supplied successful Windows output from `verify:dataset` and
`verify:features`, including:

`Reproducible behavioral features, prior-only windows, numeric schema and synthetic dataset compatibility verified.`

Combined with the recorded 149/149 automated quality checks, this satisfies the
Task 30 acceptance gate. No separate Windows quality-suite output was supplied
in this acceptance message.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
