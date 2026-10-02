# Company website connection after signup (Task 41 staged PR)

**Status:** This feature is staged on a draft PR pending platform migration 003
and isolated-tenant migrations 019 and 020. Do not merge into auto-deployed
Render main until migration acceptance is completed. Existing Iphyn connectivity,
website UI and live detector rules must remain unchanged.

## User journey

1. During company registration, enter an optional exact HTTPS website origin
   (e.g. `https://www.acme.com`). This is stored as **requested, unverified
   website metadata** in the onboarding database; no arbitrary URL is fetched,
   scanned, connected or treated as proof of ownership.
2. Verify the initial Administrator's six-digit code. During idempotent
   provisioning, the verified pending website origin is bound to the tenant
   identity and inserted into **that company's own PostgreSQL**
   `tenant_profile.requested_website_origin`. The provisioner rejects
   unexpected website changes. Existing tenants default to NULL.
3. The Administrator signs in with the usual password and emailed six-digit
   code, opens Access → Company website connections and reviews the pending URL.
4. Only an active Administrator can register/re-register a website. The tenant
   generates 256 random secret bits, persists only SHA-256 of the private key
   in `website_connectors`, and returns the original key **once** in a
   no-store, same-origin response. Neither onboarding nor another tenant
   receives this key. There are at most eight active site records per tenant.
5. The Administrator installs the key in the WEBSITE'S SERVER-ONLY environment
   (never public VITE_/NEXT_PUBLIC_ variables or HTML). The site's backend
   reports its own authoritative security decisions directly to its company's
   tenant endpoint, using `Authorization: Bearer <one-time-key>`.
6. Successfully authenticated app evidence changes ISSUED → REPORTING and
   updates the last received timestamp; this confirms a key was used, **not**
   independent ownership of the claimed host, site safety, full traffic
   visibility or successful attack prevention. Administrator revocation is
   audited and immediately denies later traffic with the old key.

## Site receiver contract

`POST https://<your-isolated-sentinelx-origin>/api/connectors/site-events`

Content-Type: `application/json`; no browser Origin and no redirects. A
server-origin JSON object uses exactly:
- `eventId`: independently generated UUID for idempotent delivery.
- `timestamp`: ISO timestamp within ten minutes.
- `signal`: an application-only allowed evidence signal.
- `evidenceRef`: non-sensitive server-side decision/audit ID, 8–128 bounded
  ASCII identifier characters.
- Optional `sourceIp`/ `destinationIp` (IP or NULL) and
  `subject` (a 64-character lowercase hex pseudonym). The originating
  application must derive IP from a verified hosting platform signal; do not
  trust arbitrary client-supplied forwarding headers. Reconnaissance requires
  a non-null trustworthy sourceIp. Never send email addresses, payloads,
  user-agent, cookies, passwords, authentication tokens or raw paths.

Application signals include `app_login_failed`, `app_access_denied`,
`app_route_probe`, `app_sqli_blocked`, `app_xss_blocked`,
`app_traversal_blocked` and `app_command_injection_blocked`. The four
web-attack signals require **actual application security rule decisions**,
not string matching on user input or ordinary HTTP 400/403 responses.
The site key cannot report endpoint, email, network, storage, identity,
CI or reviewed analyst verdicts. Each of those needs a separately approved,
issuer-bound `/api/connectors/evidence` feed.

The hostname in the resulting normalized event is pinned to the Administrator's
registered origin, not a request-supplied field. The event/receipt/alert/audit
operations use the existing transaction and deduplication contract. No
core detection rule is enabled simply because a site submits data.

## Security and practical limitations

- A website field by itself does not automatically install an agent or grant
  monitoring. Connecting a private key requires the website operator's action.
- There is **no independent DNS/domain-ownership attestation** in this initial
  hosted-subdomain-compatible flow. Treat origin as company-claimed metadata;
  sensitive customer data is not returned to the site on event ingestion.
- SentinelX is a passive receiver, not a scanner. Frontend/static and Vercel
  edge requests missed by application execution are not observable without
  a separate authoritative source. Free-plan applications and sleeping Render
  instances may lose best-effort reports; a future durable source queue can
  improve reliability.
- The optional corporate sender domain and independent-recipient invitation
  acceptance remain pending Task 41 gates.
- This PR is **not for immediate live activation**: operator verifies all
  migrations on platform/tenant databases in the right order, executes
  disposable CI and reviews Vercel Iphyn PR #29 independently. No production
  access roles, detection rules or secrets should be auto-changed.
