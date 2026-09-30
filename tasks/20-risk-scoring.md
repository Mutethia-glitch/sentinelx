# Task 20: Risk Scoring

## Status
Complete

## Objective
Implement the documented risk-score calculation using approved factors such as severity, confidence, asset impact, and event frequency.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Implement the documented risk-score calculation using approved factors such as severity, confidence, asset impact, and event frequency.

## Explicitly Out of Scope
Do not present an unexplained AI prediction as risk.

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
Formula is documented; results are deterministic and boundary-tested.

Task 20 formula version 1 uses implemented evidence only: approved incident severity plus distinct linked evidence-event count. Calibrated confidence and asset impact are not included because SentinelX does not yet implement trustworthy values for those factors; no placeholder or invented factor is substituted.

## Required Deliverables
Risk engine.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## Verification State
- Deterministic risk engine version 1 is implemented on a 0–100 scale.
- Severity points are LOW=20, MEDIUM=40, HIGH=60, CRITICAL=80.
- Distinct linked evidence events contribute 2 points per event after the first, capped at 20.
- Total risk is capped at 100.
- Confidence is excluded because Task 15 confidence is intentionally uncalibrated/null; asset impact is excluded because no approved asset-impact model exists.
- Migration 013 persists evidence-event count/formula metadata and defines risk_score as a generated PostgreSQL column.
- Incident creation refreshes evidence-event count; Task 19 severity changes automatically recompute risk.
- Incident API/UI display the read-only score and formula metadata; no manual risk override was introduced.
- Focused pure Task 20 formula tests passed 4/4 before repository update.
- Windows/PostgreSQL migration plus `verify:risk` passed on 2026-09-30.
- Windows/PostgreSQL result: `Deterministic severity/event-frequency risk formula, database generation, boundaries, API display and severity recalculation verified. Synthetic changes cleaned up.`
- Task 21 Investigation Workspace remains Not Started.
- No external API or API key is required.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
