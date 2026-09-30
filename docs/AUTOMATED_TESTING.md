# Task 38 — Automated testing

Task 38 strengthens automated verification of SentinelX core services and the complete **event-to-incident** pipeline without changing production behavior.

## Coverage model

The existing quality suite remains the broad unit/API regression baseline across authentication, RBAC, events, threats, rules, alerts, correlation, incidents, risk, investigations, responses, notifications, dashboard, search, reports, audit, MITRE mapping, ML, integrations, security and frontend behavior.

Task 38 adds:

- `tests/automated/coverage.test.js` — protects the core automated-test inventory and the dedicated pipeline contract.
- `tests/integration/full-pipeline.test.js` — a real PostgreSQL integration test using production authentication, RBAC, repositories and services.

The pipeline integration verifies:

**Raw synthetic event → normalization → persisted event → deterministic detection → alerts → correlation → incident creation**

It uses two synthetic deterministic rules so correlation is proven rather than inferred. The incident is created from the two correlated alerts and is checked for severity, category, assignment, risk event count, linked evidence and audit history.

## Isolation and safety

The pipeline test requires `SENTINELX_TEST_DATABASE=1` and must be run only against a disposable PostgreSQL database.

All generated users, sessions, rules, events, alerts, correlations, incident links, incident records and audit rows are removed in test cleanup. Test input uses reserved documentation IP ranges and synthetic identities only.

No production database, external target, commercial SIEM, destructive response action, migration, API behavior or detection logic is changed by Task 38.

## Boundary with later tasks

Task 38 is automated service/integration coverage. It does **not** implement Task 40 controlled end-to-end detection scenarios or deployment validation.

## Windows acceptance

Run:

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw "Task 38 quality gate failed" }

npm.cmd run verify:automated-testing
if ($LASTEXITCODE -ne 0) { throw "Task 38 automated-testing verifier failed" }

$env:SENTINELX_TEST_DATABASE = "1"
npm.cmd run test:automated:pipeline
if ($LASTEXITCODE -ne 0) { throw "Task 38 PostgreSQL pipeline test failed" }
```

Use the same disposable PostgreSQL test database configuration established for prior SentinelX integration tests. Never point this gate at production.
