# Task 41 — self-service, issuer-scoped company evidence feeds (staged)

**Not yet production enabled.** Schema migration `021_managed_evidence_feeds.sql`
must pass disposable CI and be applied to the **correct isolated original and
Iphyn company databases** before the runtime feature is enabled. No onboarding
platform migration is involved. Do not share provider keys, DB URLs or OTPs.

## How it works

An authenticated Administrator signs into **their company's own** SentinelX
Access page and issues an additional evidence feed by choosing an issuer
(application, identity, network, mail, endpoint, storage, analyst, or CI), a
unique lowercase source name and the actual provider hostname. The company
returns its own `https://<tenant-origin>/api/connectors/evidence` endpoint and
a 256-bit random hex key *once*. Only SHA-256 of the key resides in the
company's PostgreSQL. `GET /api/access/evidence-feeds` lists non-secret
metadata and ISSUED/REPORTING/REVOKED state. The key never enters a browser
bundle, URL, analytics or persistence. A security provider's backend sends
sanitized, issuer-specific verdicts with `Authorization: Bearer <key>`.

Receiving a valid feed switches ISSUED to REPORTING and updates the timestamp
within the SAME transaction that persists its event and receipt and runs the
detector. Revoking the feed immediately denies new use with HTTP 401, including
an ingestion race that loses to the revocation row lock; if an old event had
already committed, its historical evidence is preserved. Reissue requires a
new name. At most twelve active managed feeds per company; legacy
`SECURITY_EVIDENCE_FEEDS_JSON` sources are still accepted independently and
existing source names are reserved to prevent source collisions.

**Critical trust boundary:** Choosing `endpoint` or `identity` in the UI
does *not* authenticate a real EDR/IdP vendor or verify its domain. This is
Administrator-declared, source-attested integration. A company's ordinary
website key remains restricted to application evidence. No rule is enabled by
issuing any key. Full external-vendor provenance and native vendor adapters
need subsequent explicit review, signature/identity verification and positive
plus benign checks before a category may be marked live-accepted.

## Deployment order — intentionally gated

1. Review PR and the additive `021` SQL in disposable CI. No production
   records, keys, categories, rules or triggers are changed by this migration.
2. Confirm original and Iphyn environments have correct private database
   destinations; apply `npm run db:migrate` against EACH tenant separately,
   using its own credentials. Use prior Linux LF/CRLF ledger compatibility
   process; never modify historical migration bytes/checksums or run this on
   the separate onboarding platform database.
3. Read-only confirm each tenant's ledger has `021` and the table
   `managed_evidence_feeds` exists, initially empty. No company keys are
   created by SQL.
4. Approve merging the runtime PR only after this gate. The feature remains
   OFF on existing tenants until **that specific tenant Render service** has
   `MANAGED_EVIDENCE_FEEDS=1` set and its redeployment is LIVE. Invalid flag
   values fail configuration. With flag off, old provider feeds, website
   connector, self-monitor, auth, and tenant readiness keep working unchanged.
5. The provisioner sets `MANAGED_EVIDENCE_FEEDS=1` for NEW tenants because
   it runs all tenant migrations (including 021) before creating their service.
   Never automatically copy Iphyn credentials or sources to another company.
6. Use one disposable, Administrator-issued provider feed in one tenant.
   Verify one genuine issuer-specific positive, below-threshold benign
   negative, unauthorized Viewer denial, non-secret GET output, wrong-issuer
   rejection (400), duplicate delivery (single receipt), revocation (401),
   audit attribution and another tenant's credential denial. Clean up the
   disposable feed; do not revoke Iphyn's working website connector.

## Tenant API

- GET `/api/access/evidence-feeds` — Administrator only; list safe metadata
- POST `/api/access/evidence-feeds` — Administrator only; exact JSON
  `{"name":"approved-idp","host":"identity.company.com","issuer":"identity"}`;
  response includes one-time key and endpoint, is no-store
- POST `/api/access/evidence-feeds/{id}/revoke` — Administrator only; exact
  JSON `{"reason":"source retired"}`
- POST `/api/connectors/evidence` — provider server-to-server endpoint,
  no browser Origin. Accepted signals and privacy rules remain defined in
  `docs/SECURITY_EVIDENCE_FEEDS.md`.

Source contracts for all fifteen threat categories are already defined, but
this feature is source enrollment, **not automatic connection** to a vendor.
Identity, mail, endpoint, network, storage and CI vendors must actually emit
their own authenticated, sufficiently attributable security decisions.
