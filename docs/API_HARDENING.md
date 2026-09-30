# Task 35 — API hardening

Task 35 adds a shared security boundary in front of every SentinelX `/api` route while preserving the existing route-specific validation, authentication, authorization, origin checks, safe errors, and audit behavior.

## Shared request boundary

`src/api/security.js` runs before API routing and:

- applies `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, and `Cross-Origin-Resource-Policy: same-origin`;
- accepts only origin-form API request targets and rejects fragments, backslashes, and targets larger than 4096 bytes;
- rejects request bodies on GET/HEAD, including transfer-encoded bodies;
- rate-limits all API traffic by the actual socket peer address;
- applies a tighter mutation bucket to POST/PUT/PATCH/DELETE;
- returns bounded JSON errors without stack traces, credentials, tokens, SQL, or backend error details.

The default in-process limits are 600 API requests per minute and 120 mutations per minute per socket peer, with at most 10,000 live rate-limit keys. The existing login-specific limiter remains stricter at 20 attempts per socket IP and 10 per normalized account in 15 minutes.

SentinelX does not trust `X-Forwarded-For` or other caller-supplied forwarding headers for rate-limit identity. With the current loopback server, a reverse proxy therefore appears as one peer unless deployment supplies complementary edge controls. Task 35 does not invent a trusted-proxy configuration or deployment topology.

## Existing route security retained

Task 35 does not replace the domain handlers or service authorization model. Protected APIs continue to use live PostgreSQL-backed session/RBAC checks, exact-origin checks for mutations, bounded JSON input, parameterized repositories, and sanitized domain-specific errors.

Unknown or missing roles continue to grant no permission. Client-provided role headers or frontend state remain non-authoritative. Response actions remain human-controlled and auditable; Task 35 adds no automated/destructive action path.

## Failure behavior

The shared limiter and request-shape guard fail closed with 4xx responses. Unexpected shared-boundary parsing errors return a generic 400. Existing handler/service/database failures continue to return sanitized 503 responses. No stack traces or private driver details are returned.

Rate limiting is intentionally in-memory for the current single-process core and resets on restart. Durable/distributed rate limiting and deployment-edge enforcement are not introduced here.

## Verification

Run:

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }

npm.cmd run verify:api-hardening
if ($LASTEXITCODE -ne 0) { throw 'Task 35 API hardening verification failed' }
```

The Task 35 verifier requires no PostgreSQL credentials and uses only synthetic/stubbed request state.
