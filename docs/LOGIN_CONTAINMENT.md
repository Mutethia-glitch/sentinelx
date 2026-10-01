# Iphyn login containment — opt-in, bounded policy

This first control restricts password-login requests for the same verified IP
and pseudonymous account for five minutes after five failed logins received in
five minutes. It does not block the entire IP/company, disable accounts, revoke
sessions, alter company databases, contain other attack categories or imply an
account was compromised. The rule threshold and control policy are separate:
this policy is fixed at five/300/300, independently of detection-rule edits.

## Deployment

1. Update SentinelX and apply tenant migration 018 to the existing Iphyn Neon
   database. On Windows normalize local migration SQL CRLF to LF before running
   migrations against this Linux-provisioned tenant. Do not rewrite ledger hashes.
2. Deploy the new tenant server. Set `CONNECTOR_LOGIN_CONTAINMENT=1` only after
   migration 018 is applied. It is off by default. The existing company connector
   credentials/source/host scope remain required. Startup checks the control table
   when enabled.
3. Merge/deploy Iphyn's control-aware login code, then set Vercel Production
   `SENTINELX_LOGIN_CONTAINMENT=1` and redeploy. Existing connector credentials
   and Vercel system environment variables remain required. No browser secrets.

To disable enforcement, set Vercel `SENTINELX_LOGIN_CONTAINMENT=0` and redeploy.
Disable policy preparation using Render `CONNECTOR_LOGIN_CONTAINMENT=0`.
Existing blocks expire automatically and remain as evidence; additional failures
and blocked attempts do not extend an active deadline. No permanent block is made.

## State and evidence

The tenant database stores scope/deadline/trigger event in `connector_login_blocks`.
The fifth failure prepares the restriction under a transaction advisory lock
before detector evaluation and notification creation. The preparation audit says
AWAITING_APPLICATION_CONFIRMATION, not successful enforcement.

Iphyn checks POST `/api/connectors/login-check` before credential lookup for each
attributed password login. The scoped connector credential is required; browsers,
cross-company/source parameters and unknown/malformed IPs are rejected. Positive
decisions are capped at 300 seconds. Iphyn returns TOO_MANY_REQUESTS (429) and a
Retry-After header without looking up credentials or creating a session, and
reports `login_containment_blocked` with the matching decision ID. SentinelX
records `authentication / login_throttled / blocked` and
LOGIN_CONTAINMENT_ENFORCED only after checking its stored scope/decision/deadline.
This is application-confirmed rejection of a login request, not proof an entire
attack stopped. It does not automatically mark an incident CONTAINED or RESOLVED.

If preparation fails, a database savepoint rolls back the control action, logs
LOGIN_CONTAINMENT_FAILED and preserves normal event detection/alert delivery.
An unverified enforcement report is rejected instead of being treated as success.

Control-plane outages fail open with a generic Iphyn server warning; ordinary
authentication remains intact. There is no durable event retry queue yet, so
Render sleep/network failures can prevent preparation/checks/confirmation delivery.
Unknown IPs do not activate this policy. This is bounded defense in depth, not a
guaranteed always-on firewall. No coverage outside password-login requests is claimed.

## Live acceptance — pending

After rollout, use one test email and connection. Four failures must not restrict;
the fifth prepares policy and generates the configured alert. The next attempt
must return 429 and display retry time, with a login_throttled/blocked event and
enforcement audit. A different test email remains outside that scope. After five
minutes the original pair must be allowed through normal password validation.
Verify deadline does not extend on blocked attempts and scope/decision confirmation
is correct in PostgreSQL. Local mocks do not prove database concurrency/expiry.

Inspect evidence read-only in the Iphyn tenant SQL Editor:

```sql
SELECT source, source_ip, blocked_until, trigger_event_id,
       last_enforced_event_id,
       blocked_until > now() AS currently_active
FROM connector_login_blocks
ORDER BY created_at DESC;
```

Analysts can inspect Events/Audit and the alert/linked incident, investigate and
record subsequent actions using the existing authorized response workflow. Keep
manual attestations distinct from application-confirmed enforcement. Domain-backed
email to other analysts and full Task 41 live RBAC acceptance remain pending.
