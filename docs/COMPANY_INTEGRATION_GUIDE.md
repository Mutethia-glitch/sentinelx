# Connecting a newly signed-up company's website to SentinelX

## What the Administrator receives

After signup and account verification, open the company's own **Access → Company
website connections** panel. The persistent, company-specific receiver URL is:

`https://<this-company-sentinelx-host>/api/connectors/site-events`

It is **not** `/api/company-signup`, the company locator URL, the company's public
website URL, or another tenant's collector. The Administrator enters the website
HTTPS origin and issues a private website key. The 256-bit key is shown **once**;
only its SHA-256 hash is retained by SentinelX. The URL can be redisplayed after
refresh; the key cannot. If lost, revoke and reissue, then update/redeploy the
website backend.

On the customer's WEBSITE BACKEND, set private, non-public variables:

```env
SENTINELX_SITE_CONNECTOR_URL=https://<this-company-sentinelx-host>/api/connectors/site-events
SENTINELX_SITE_CONNECTOR_KEY=<one-time-private-key>
```

Variable names are conventional: the customer integration must explicitly read
them. For Vercel, put them in Production server environment and redeploy; never
prefix keys `VITE_` or `NEXT_PUBLIC_`. Other hosting stacks configure equivalent
server-side secret storage. HTTPS and the bearer header authenticate transport;
the key **alone does not deploy code, subscribe to edge/WAF/endpoint logs, fetch
the website, validate domain ownership, or turn on a rule**.

The website's genuine server-side security decision sends a JSON POST (without
browser Origin) to that URL. It must include `eventId` (unique UUID),
`timestamp` (ISO 8601 within 10 minutes), `signal`, and safe opaque
`evidenceRef`. Some signals require a trustworthy source IP derived from the
verified hosting proxy. Example application-only *shape*, not a suggestion
to manufacture an alert:

```js
// Run on the WEBSITE BACKEND ONLY, after an actual server-side security verdict.
const result = await fetch(process.env.SENTINELX_SITE_CONNECTOR_URL, {
  method: 'POST',
  redirect: 'error',
  signal: AbortSignal.timeout(1500),
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + process.env.SENTINELX_SITE_CONNECTOR_KEY
  },
  body: JSON.stringify({
    eventId: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    signal: 'app_route_probe', // only for a verified application-route verdict
    evidenceRef: 'internal-safe-verdict-identifier',
    sourceIp: verifiedHostingClientIp
  })
});
```

Never send passwords, email addresses, raw requests, auth headers, URL/path/query
parameters, login cookies or user agent. Do not trust spoofable user-supplied
forwarding headers as a client IP. Authentication-only events with absent
attribution have their own semantics. A supported application signal is one of:
`app_login_failed`, `app_access_denied`, `app_route_probe`,
`app_sqli_blocked`, `app_xss_blocked`, `app_traversal_blocked`, or
`app_command_injection_blocked`. SQLi/XSS/traversal/command-injection reports
require genuine application security-rule decisions, not guessing from keywords,
a generic 400/403, or a blocked request without a confirmed class.

After the first authenticated event, Access displays `REPORTING`. Until then,
the site is `ISSUED`; `REVOKED` rejects the old key. Site ownership and
complete traffic visibility are not independently established.

## All 15 categories: receiver available versus actual source integration

SentinelX has fifteen taxonomy codes and issuer-scoped normalizers in
`src/integrations/evidence-catalog.js`. Each company needs relevant,
authoritative feeds; there is no universal website key with unbounded
permission to claim findings from other systems.

| Threat category | Evidence needed and integration surface |
|---|---|
| BRUTE_FORCE | Actual application/password-login failures, scoped pattern rule; SentinelX tenant also has optional first-party HTTP observation |
| CREDENTIAL_ATTACK | Identity provider's actual spray/stuffing verdict via approved `identity` feed |
| PRIVILEGE_ESCALATION | Identity/role audit proving unauthorized or unapproved elevation; a denied admin request does not prove success |
| SUSPICIOUS_ACCOUNT_ACTIVITY | Identity/session provider's explicit anomalous account finding |
| UNAUTHORIZED_ACCESS | Actual backend authorization denial, distinct from public 401 or normal form error |
| RECONNAISSANCE | Verified application-route probe verdict and attribution; edge/proxy sources needed for traffic never reaching the app |
| SUSPICIOUS_NETWORK_ACTIVITY | Firewall/network flow or egress-proxy anomaly verdict |
| PHISHING_SOCIAL_ENGINEERING | Mail gateway/provider security verdict or separately reviewed analyst report |
| MALWARE | Endpoint agent/EDR malware verdict |
| RANSOMWARE | Endpoint/filesystem ransomware-specific verdict |
| DENIAL_OF_SERVICE | Aggregate edge/network rate and availability finding, not just one HTTP 429 |
| DATA_EXFILTRATION | Authoritative storage/export/egress policy evidence |
| WEB_APPLICATION_ATTACK | Application security rule or signed mapped WAF SQLi/XSS/traversal/command-injection block verdict |
| INSIDER_THREAT | Reviewed, attributable analyst finding supported by authorized audit evidence |
| SUPPLY_CHAIN_COMPROMISE | Verified dependency/build/CI artifact integrity verdict |

For external feeds, an operator **separately** configures per-provider
`SECURITY_EVIDENCE_FEEDS_JSON` privately in the correct tenant service; each
provider is bound to an issuer, source, host, and unique token. Those providers
use that company's `/api/connectors/evidence` endpoint. Their issuer-specific
signal names and required fields are documented in
`docs/SECURITY_EVIDENCE_FEEDS.md`. An ordinary website connector is restricted
to application decisions and must never be given endpoint, identity, mail,
storage, network, analyst or CI authority.

Other supported integrations include the original opt-in Iphyn application
collector and independently configured, signed Vercel Firewall Log Drain.
They have separate credentials, sources, and acceptance requirements.
Do not overwrite an existing `SENTINELX_COLLECTOR_URL/TOKEN` with the newer
`SENTINELX_SITE_CONNECTOR_URL/KEY`.

## Go-live requirement per category

Before claiming a category is detected in production, document the configured
provider and source permissions, a genuine positive and a comparable benign
negative, sanitized normalized evidence and IP/subject attribution, the
tenant-scoped rule's severity and threshold, deduplication, an authorized
alert/incident response if enabled, source failure behaviour, and a cross-tenant
isolation check. All generic initial rules remain disabled by default.

SentinelX is a receiver and correlation system, not an automatically installed
EDR, mail security gateway, network tap, reverse proxy, cloud audit collector
or self-running scanner. Feature availability without an authentic emitting
source is not live detection.
