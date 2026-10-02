# Task 41: Deployment

## Status
Implemented — awaiting local and live deployment acceptance

## Objective
Deploy the stable application with secure environment variables, migrations, HTTPS, and documented configuration.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Deploy the stable application with secure environment variables, migrations, HTTPS, and documented configuration.

## Explicitly Out of Scope
Do not commit secrets or depend on developer-local files.

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
Clean deployment setup works and smoke tests pass.

## Required Deliverables
Deployment.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## User-authorized production expansion — 2026-10-01

The user explicitly approved implementing Task 41 as an online multi-company
SentinelX deployment rather than a developer-local server.

The accepted production design uses one isolated SentinelX runtime and one
PostgreSQL database per company. A separate onboarding/control plane accepts
company name, initial Administrator email/name and password; verifies that email
with a six-digit code; and hands the verified tenant to an authenticated HTTPS
infrastructure provisioner.

Production tenant login is password plus a fresh six-digit email code before a
session is issued. Company Administrators can invite users, assign one of the
existing Administrator / Security Analyst / Viewer/Management roles, and
disable/re-enable tenant users. Tenant data and tenant user/RBAC records are
isolated from every other company by the database/runtime boundary.

Task 41 adds append-only tenant migration 016, a separate platform migration
ledger, provider-independent email/provisioner adapters, trusted reverse-proxy
configuration, health endpoints, container/reference reverse-proxy artifacts,
deployment verification and online smoke checks. Migrations 001–015 remain
unchanged, and every provisioned tenant receives the same fifteen-category
taxonomy.

See `docs/DEPLOYMENT.md` and `docs/MULTI_COMPANY_TENANCY.md`.

Real isolated Render tenant, onboarding and provisioner deployments now exist, and
live read-only HTTPS, HSTS, health and public-page smoke checks passed on
2 October 2026. GitHub CI also passed 253 core tests and four disposable,
PostgreSQL-backed integration gates, including two independent tenant databases.
Task 41 must still remain OPEN: sending to independently owned external employee
addresses is waiting for a user-purchased and verified sender domain; genuine
other-address invitation/activation, complete live two-company user isolation,
user/session revocation and the signup-to-first-login acceptance flow remain
unverified. Do not mistake disposable CI or healthy URLs for those live gates.
Task 42 must not start before Task 41 is accepted.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
