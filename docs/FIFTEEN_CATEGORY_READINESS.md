# Task 41 — Fifteen-category source readiness, not automatic live coverage

Every newly provisioned company's own tenant service exposes
`GET /api/access/integrations` to its Administrator. The Access screen shows
all 15 canonical categories with the corresponding accepted issuer, counts of
eligible configured sources, number of tenant-local source-contract events
already observed, and explicit evidence state. The endpoint requires the live
backend `users.manage` grant; credentials and feed names are never returned.
The query stays inside that company's existing isolated PostgreSQL database.

Three values are intentionally distinct:

- **Trusted source required:** no compatible registered website / configured
  provider feed / applicable opt-in SentinelX self-monitor is available.
- **Eligible feed configured; category not observed:** an eligible source exists
  but has not produced category-specific qualifying evidence. An application
  website might report only reconnaissance, not every application category.
- **Source-attested evidence recorded; live acceptance pending:** one or more
  supported contract records exist for the company's tenant and category.
  This is not confirmation that a rule is enabled, an alert fired, the source
  covers the full attack surface, or a genuine intrusion was prevented.

Counts include only `security-evidence-v1` and `sentinelx-self-v1` telemetry
with the matching tenant ID, an approved taxonomy category, and an expected
site/evidence/internal source label. They do not count fabricated category
claims in general imports. The original separate Iphyn app collector has its
own event contract and is not silently counted as proof of all provider
categories. Reporting dates derive from occurrence time. This page is a
**read-only planning aid**; no migration, rule enablement, tokens, WAF connection,
external provider calls or auto-scanning happens by opening it.

## Required rollout sequence for any new company

1. Verify the custom sender domain with the mail provider. On the independent
   **Onboarding Platform**, **Provisioner**, and existing tenant services set
   `EMAIL_FROM` to an approved sender under that domain. Retain each service's
   private `EMAIL_DELIVERY_URL` and `EMAIL_DELIVERY_TOKEN`. The provisioner
   copies its own configured delivery URL/token/from into newly created tenant
   service environments; modifying the onboarding platform's sender alone
   does **not** update the provisioner or existing companies.
2. Test sign-up/verification and initial admin sign-in using an independently
   controlled recipient, including six-digit codes, expiry and attempt limits.
   Confirm ACTIVE company, a unique tenant Render origin/database, and
   company-finder routing. Confirm unrelated companies' users, sessions and
   connector events remain invisible.
3. Register the optional website in Access. Copy the displayed **company-specific**
   `/api/connectors/site-events` URL and one-time key into website server-only
   settings, and install actual emitting backend code. The website remains
   ISSUED until it delivers accepted application evidence; key alone does not
   establish source coverage.
4. For additional categories, select the authoritative provider for that
   company (identity, network/edge, mail-security, endpoint, storage, reviewed
   analyst findings or CI). The current trusted feed implementation uses
   tenant-specific private `SECURITY_EVIDENCE_FEEDS_JSON`, server-only source
   credentials and `/api/connectors/evidence`. New tenants do **not** inherit
   Iphyn's keys or external-provider feeds. Native self-service source
   enrollment and vetted vendor adapters are subsequent product work, not
   consequences of setting up Resend or registering a website.
5. For each category independently, verify one approved genuine positive,
   one comparable benign negative, provenance, normalized severity, source
   scope, replay handling, rule/alert/incident/audit behaviour, and cross-tenant
   rejection. Keep unrelated rules disabled. Distinguish event severity from
   independent rule-derived alert severity. Avoid creating unsafe production
   attack traffic or claiming that a generic 429 proves DoS.

## Current contract mapping

`src/integrations/evidence-catalog.js` defines the 19 issuer-locked signals
across 15 categories. The readiness manifest is generated from that source,
rather than maintaining a second manually edited taxonomy. The issuer types
include: application, identity, network, mail, endpoint, storage, analyst and
CI. Different companies may have different vendor integrations depending on
their infrastructure; installing all categories' normalizers without
authoritative emitters cannot make all 15 actually detectable.

Resend is a delivery provider for sign-up, login and invitation verification,
**not** a phishing security feed merely because it delivers OTP messages.
A custom sender DNS domain does not establish third-party provider connectivity
or automatically integrate websites.
