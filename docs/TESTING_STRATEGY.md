# SentinelX Testing Strategy

## Unit Testing
Test event validation, normalization, rule evaluation, thresholds/time windows, severity, risk calculation, correlation, authorization decisions, and ML feature extraction.

## Integration Testing
Test database persistence, authentication, protected APIs, event ingestion, event-to-alert flow, alert-to-incident flow, response recording, and audit logging.

## End-to-End Testing
Controlled scenarios must verify:
Event → Detection → Alert → Incident → Investigation → Response → Resolution

## Security Testing
Cover authentication, authorization, input validation, protected endpoints, sensitive-data exposure, and relevant common web weaknesses.

## Test Data
Use synthetic or explicitly authorized data. Do not test against real third-party targets.

## Completion Rule
A feature is not complete merely because it renders. Relevant behavior requires automated or documented verification.


## Task 38 automated pipeline gate

Task 38 adds a dedicated disposable-PostgreSQL integration gate for the complete event-to-incident path:

**Raw synthetic event → normalization → persisted event → deterministic detection → alerts → correlation → incident creation**

The test uses production services/repositories and live RBAC rather than mock persistence. It is synthetic-only, requires `SENTINELX_TEST_DATABASE=1`, and cleans its generated records.

This gate complements the broad unit/API `npm test` suite. It does not replace the later Task 40 controlled end-to-end scenario validation.


## Task 39 controlled application-security validation

Task 39 adds a dedicated database-free security regression suite covering authentication/session transport, exact-origin mutation protection, backend RBAC, input validation, API access, rate limits, error sanitization, CSP/clickjacking protection, sensitive-path exposure and common frontend XSS/storage regressions.

The security-validation suite is intentionally synthetic and non-destructive. It complements, rather than replaces, the already accepted Task 35 API-hardening and Task 36 frontend-security tests.

Known deployment-boundary considerations such as distributed rate limiting, trusted reverse-proxy identity and production HTTPS/HSTS remain documented for the later deployment phase rather than being silently invented here.


## Task 40 controlled end-to-end and fifteen-category validation

Task 40 adds three complementary layers:
- `tests/system/taxonomy-propagation.test.js` runs in the normal quality suite and prevents taxonomy/rule/search/UI/category-aggregate drift below the canonical fifteen codes.
- `tests/integration/taxonomy-ui.test.js` is a database-free Playwright check proving that Events, Alerts and Incidents expose all fifteen category filter choices.
- `scripts/verify-end-to-end-scenarios.js` / `tests/integration/end-to-end-scenarios.test.js` use controlled synthetic PostgreSQL data to verify the full operational path for all fifteen categories, the required Task 40 scenario set, one persisted correlation case and a zero-alert benign control.

The verifier restores temporary taxonomy availability and deletes all generated evidence after execution. It does not test real external systems or alter existing detection-rule policy.
