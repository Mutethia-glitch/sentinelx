# SentinelX Multi-Company Isolation and Email Verification

## Isolation decision

SentinelX uses an **isolated deployment per company**, not one shared operational
database with tenant predicates.

This intentionally extends the earlier single-IPHYN database architecture:
the previous database becomes the template for one tenant. The security-domain
schema remains simple and every operational query continues to operate only on
the database connected to that company runtime.

The public onboarding/control plane is a separate trust zone and database. It
cannot query tenant security-domain tables.

## Identity hierarchy

```text
SentinelX platform
  |
  +-- Company A tenant UUID
  |     +-- Administrator
  |     +-- Security Analyst(s)
  |     +-- Viewer/Management user(s)
  |
  +-- Company B tenant UUID
        +-- Administrator
        +-- Security Analyst(s)
        +-- Viewer/Management user(s)
```

A company Administrator is not a global SentinelX platform administrator.

## Tenant identity

A tenant has an immutable random UUID and a human-readable company name/slug.
The slug is routing/display metadata, not an authorization decision.

Production startup requires the environment tenant identity to exactly equal the
singleton `tenant_profile` stored in that database. A wrong database/tenant
pair therefore fails startup rather than serving the wrong company's data.

## Authentication states

Company registration code verifies ownership of the initial Administrator email.
It is not a substitute for later login 2FA.

Every production login separately follows:

`password accepted → EMAIL_2FA_PENDING → code verified → authenticated session`.

Invited company users separately follow:

`Administrator invitation → six-digit activation code → password set → user ACTIVE`.

Thereafter those users also use password + email 2FA on each new login.

## Data that never crosses tenant databases

Security events, raw evidence, alerts, correlations, incidents, investigation
notes, response actions, notifications, audit records, rules/configuration and
tenant users/roles remain inside the company's tenant database.

The canonical fifteen-category taxonomy is installed by the same migration chain
in every tenant. Task 28 ATT&CK associations remain partial by design.

## Session isolation

HTTPS tenant cookies use `__Host-` cookie names: Secure, Path=/ and no Domain
attribute. Browsers therefore do not share a Company A session cookie with
Company B's subdomain.

Backend authorization still reads current roles from the connected tenant
PostgreSQL database on protected operations. Client role headers/UI state are
never authoritative.

## Central company finder

The company locator stores no tenant-user credentials. Company name/sign-in
code resolves only to a registered ACTIVE tenant HTTPS origin (plus optional
operator-verified pre-onboarding route metadata). It does not authenticate
an email address, infer which companies an email belongs to, or issue sessions.
Multiple companies may invite the same email address; selecting the company
first is intentional. Every user, including an invited employee, completes
password and emailed six-digit 2FA on that one company's own origin.
