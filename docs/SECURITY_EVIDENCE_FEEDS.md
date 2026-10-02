# SentinelX 15-category, issuer-bound evidence contracts

Status (2026-10-02): deterministic normalized ingestion support implemented; this
is **not** confirmation that all fifteen live threat sources are connected,
monitored or issuing alerts. Every tenant must explicitly authorize a trusted
server-side feed, source-specific rule and operational acceptance before calling
one category LIVE. No scanner, client browser key or autonomous containment is
introduced.

## Trust and transport

A tenant operator may privately set `SECURITY_EVIDENCE_FEEDS_JSON` to a JSON
array of up to twelve disjoint sources, each with fields exactly
`name`, `host`, `issuer`, `token`. Example below contains **only
placeholders**, not working keys:
```text
SECURITY_EVIDENCE_FEEDS_JSON=[{"name":"approved-idp","host":"identity.company.com","issuer":"identity","token":"REPLACE_WITH_64_LOWERCASE_HEX_RANDOM_SERVER_SECRET"}]
```
All tenant feeds are disabled when the variable is absent or `[]`; partial
or invalid configuration prevents startup. Tokens are server-only,
independently generated 256-bit random values. Each name and token is unique
within the tenant. Never set a browser/public env variable, expose a feed
token to the company finder, or share one tenant key with another company.

The configured feed sends a POST to that company's
`/api/connectors/evidence` using `Authorization: Bearer <private token>`
and `Content-Type: application/json` (no browser Origin). The body permits
**only** `eventId` (UUID), `timestamp` (ISO 8601 within ten minutes),
`signal` (one of the below), `evidenceRef` (bounded provider decision ID),
and optionally `sourceIp`, `destinationIp`, `subject` (64 hex
pseudonymous identifier). Certain signals require attribution, such as
a real source IP for reconnaissance and a destination IP for network verdicts.
Caller-supplied event severity, tenant, source, host, URL, raw payload,
request body, email, account name or unapproved category is rejected.

The backend **pins issuer, source, host and tenant** from operator-verified
configuration, never from the event body. Each signal has one allowed issuer.
The tenant's receipt ledger deduplicates per source + event UUID, and
event, alert and audit writes share the existing database transaction.
A source-authenticated assertion is labelled
`source-attested-not-independently-verified`, not a proof of successful
attacker action. The named provider's own evidence must be independently
reviewed before enabling high-impact detection. No source token alone can
legitimately claim evidence it cannot observe.

## All fifteen supported normalized shapes

| Category | Source issuer | Accepted explicit signal(s) | Basis |
|---|---|---|---|
| BRUTE_FORCE | application | app_login_failed | Actual sign-in failures; separate five-failure rule |
| CREDENTIAL_ATTACK | identity | identity_password_spray, identity_credential_stuffing | IdP-classified spray/stuff evidence |
| PRIVILEGE_ESCALATION | identity | identity_unapproved_elevation | Authoritative unapproved elevation audit, not a denied admin request |
| SUSPICIOUS_ACCOUNT_ACTIVITY | identity | identity_account_anomaly | Explicit identity/session verdict |
| UNAUTHORIZED_ACCESS | application | app_access_denied | Genuine backend authorization denial |
| RECONNAISSANCE | application | app_route_probe | Verified application-route discovery probe with source IP |
| SUSPICIOUS_NETWORK_ACTIVITY | network | network_anomaly_verdict | Approved flow/proxy verdict with destination |
| PHISHING_SOCIAL_ENGINEERING | mail | mail_phishing_verdict | Email-provider or reviewed report evidence |
| MALWARE | endpoint | endpoint_malware_verdict | Endpoint-protection verdict |
| RANSOMWARE | endpoint | endpoint_ransomware_verdict | Ransomware-specific endpoint verdict |
| DENIAL_OF_SERVICE | network | network_dos_verdict | Genuine network/availability finding, not one 429 |
| DATA_EXFILTRATION | storage | storage_exfiltration_verdict | Approved data-transfer/exfiltration finding |
| WEB_APPLICATION_ATTACK | application | app_sqli_blocked, app_xss_blocked, app_traversal_blocked, app_command_injection_blocked | Actual matching server security controls, not keyword classification |
| INSIDER_THREAT | analyst | analyst_insider_finding | Attributed, reviewed analyst finding; no automated inference of intent |
| SUPPLY_CHAIN_COMPROMISE | ci | ci_supply_chain_verdict | Trusted build/dependency/integrity verdict |

An installed company website's separately issued source credential
(`/api/connectors/site-events`, staged in Task 41 website PR) has
**issuer=application only**. It cannot upload an endpoint malware, phishing,
network, exfiltration or CI verdict. Non-website feeds are separately configured
within each isolated tenant, per provider, after confirming the provider's
genuine ability to substantiate the chosen signal. A company entering a website
URL during registration does not grant security-source trust.

## Reconnaissance / Iphyn limitations

Iphyn draft PR #29 proposes forwarding only unknown well-formed server-side
tRPC procedure requests with a trustworthy Vercel-provided client IP as
`reconnaissance_probe`. SentinelX stores the individual event LOW. A separate
Iphyn-specific source/host-scoped fixture requires three such probes from
one verified IP in 120 seconds for a possible MEDIUM alert; it is disabled.
Common static/edge requests (e.g. a request to an unrelated public page)
never reach that application's reporter on Vercel Hobby. Thus a general scan
can remain invisible without separately integrated edge/proxy telemetry.
Never increase a scan's scope or intensity merely to manufacture an alert.
The existing production Iphyn connector remains unchanged until the user
reviews, merges and manually deploys PR #29.

## Operational acceptance

For each category document one genuine positive event and one benign negative,
the authoritative provider and rule version, deduplication, event severity
versus separate rule severity, resulting alert/incident/audit if enabled,
cross-tenant rejection and source outage behaviour. Keep all unrelated core
rules disabled. Disabled WAF-drain code stays optional; Vercel Pro is not
required for application-level signals. A passive receiver cannot guarantee
it observes every attack or prevent attacks on a customer's site.
