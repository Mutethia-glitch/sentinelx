# Connector event severity

Policy: connector-v1. Applies to new events; existing evidence is not rewritten.

| Connector kind | Event severity | Evidence |
| --- | --- | --- |
| login_failed | LOW | One unsuccessful password sign-in |
| access_denied | MEDIUM | Access to an operation was rejected; may include an expired or absent session |
| rate_limit_blocked | MEDIUM | An actual rate-limit rejection, not proof of DoS |
| login_containment_blocked | HIGH | Actual login denial tied to a verified containment decision |
| privileged_access_denied | HIGH | A signed-in non-admin was rejected by an admin-only procedure |

The server assigns severity. Callers cannot submit severity or arbitrary attack labels. Event metadata includes severityPolicy and severityReason. The admin-only signal preserves the authorization rejection and hashes the email through the existing connector; no raw email, credentials, request body or route input is transmitted.

Individual events and correlated alerts retain separate severities. Five failed logins can still produce the configured HIGH brute-force alert. The new admin-access event does not automatically create an alert: a matching enabled detection rule is needed. No generic access denial is treated as successful privilege escalation.

No current Iphyn connector signal warrants CRITICAL or UNKNOWN. General event ingestion may represent absent severity as null (displayed Unknown). Critical classifications require additional evidence-producing integrations; adding a label alone is not detection.

## Deployment and acceptance

1. Deploy SentinelX first so it accepts the new event kind.
2. Merge/deploy the Iphyn connector change.
3. One failed password sign-in remains LOW. A real rate-limit or access denial becomes MEDIUM. A verified login-containment block becomes HIGH.
4. With an authorized non-admin test account, attempt an admin-only operation: access remains denied and exactly one privileged_access_denied event is HIGH. An anonymous attempt remains access_denied/MEDIUM.
5. Inspect normalized metadata for the policy version and reason. Verify old event severities remain unchanged.

No migrations or new environment variables. Other-user testing remains pending until email-domain setup permits account activation.

## Coverage expansion

Future integrations need evidence from a WAF for injection attempts, network/proxy logs for scans and DoS, endpoint telemetry for malware/ransomware, and storage/identity audit logs for data export or privilege changes. These are not implemented by this change. They require separate validated event contracts and enabled rules, with severity based on the observed outcome.
