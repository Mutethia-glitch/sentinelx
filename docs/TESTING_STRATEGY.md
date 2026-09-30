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
