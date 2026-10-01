# Company application connector — first implementation

This is an opt-in server-to-server security event collector. It does not grant
monitoring or blocking merely because a company supplied a URL. Task 41 email
acceptance remains pending; Tasks 42–44 are not marked complete by this work.

## Tenant service

Apply tenant migration 017 before enabling the connector. Set three private/server
settings on the intended tenant's Render service:

- `CONNECTOR_TOKEN`: a fresh 32-byte random value encoded as 64 lowercase hex characters.
- `CONNECTOR_SOURCE`: `iphyn-app` for the first connector.
- `CONNECTOR_HOST`: `iphyn.vercel.app` for the first connector.

The runtime's verified tenant identity fixes the target company database. There
is no caller-controlled tenant or source routing. All three settings absent means
disabled; partial/invalid settings prevent startup. Use a different token for
each company. Rotate by changing both sides. Do not reuse provider keys or OTP keys.

POST `/api/connectors/events` with JSON and `Authorization: Bearer <token>`.
The allowed fields are `eventId` (UUID), `timestamp` (ISO time within ten minutes),
`kind` (`login_failed`, `access_denied`, `rate_limit_blocked`), `sourceIp` (IP or
null), and optional `subject` (64-character hex pseudonym). Other fields fail
validation. Browser Origin requests are rejected; collector credentials must
never enter browser code. Existing request/body/rate limits apply.

Receipts keyed by source/external UUID prevent repeated detection and auditing
on retries. Event, receipt, audit entry and detector effects commit atomically;
an error rolls back all effects. A database advisory lock serializes simultaneous
retries. Successful responses contain an event ID, not company data. Accepted
events enter the existing detection/correlation pipeline. Existing rules remain
under Administrator control; this change does not automatically enable rules.

## Iphyn settings

Set Vercel server environment variables (never `VITE_` variables):

- `SENTINELX_COLLECTOR_URL`: `https://sentinelx-iphyn-network.onrender.com/api/connectors/events`
- `SENTINELX_CONNECTOR_TOKEN`: exactly the same private token as above.

Redeploy after configuring. Reporting is disabled when both settings are absent.
Local-password failures and tRPC permission denials are reported; rate-limit
rejections report the existing local enforcement outcome. Passwords, tokens,
cookies, request bodies, email addresses and query strings are not sent. Login
subjects are HMAC pseudonyms derived server-side. Reports await a bounded 1.5s
HTTPS request and fail with a generic warning without changing the original
application authentication result. The unchanged local rate limiter is not
shared across Vercel instances.

## Explicit limitations and next acceptance

This first version has no durable outbound queue. Network failures, including
Render free-instance wake-up delays, can lose reports. The collector supports
idempotent retries, but Iphyn does not yet persist/retry failed deliveries.
Client IP is deliberately null until the hosting proxy identity contract is
verified; reliable per-IP detection/containment is not claimed. Login failures
produce a dedicated event instead of a duplicate middleware denial event.
OAuth, static page traffic, requests rejected before application execution, and
Vercel edge/firewall events are outside this connector's current coverage.

No new automatic containment is implemented. `rate_limit_blocked` means the
application's existing limiter rejected a request, not that an attack was stopped.
Local validation passed: SentinelX quality 226/226 plus the added repository
rollback/idempotency test (four focused connector tests); Iphyn type check,
production build and 36/36 tests. The repository's frozen lockfile has a
pre-existing overrides mismatch; a temporary non-frozen local install was used
and its changed lockfile is not included. Live tenant migration, credential
configuration, controlled event delivery, duplicate/rollback PostgreSQL acceptance
and cross-tenant credential rejection remain pending. Add
durable delivery, trusted IP attribution and explicitly approved bounded control
actions before claiming dependable production detection/containment.
