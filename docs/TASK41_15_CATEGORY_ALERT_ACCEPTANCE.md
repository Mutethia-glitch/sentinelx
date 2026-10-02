# Task 41 — all fifteen categories must generate alerts, not merely events

## Distinct gates
- **CI evidence-pipeline acceptance:** disposable PostgreSQL executes all migrations and temporarily enables the 15 core rules. For EACH authoritative issuer/category signal it persists a benign negative, tests the configured threshold, expects exactly one new persisted alert, checks alert category/severity/evidence-chain and verifies same-trigger deduplication. A normal event cannot pass. All 15 rules are restored disabled before CI completes.
- **Real-source production acceptance:** never assume passing synthetic CI proves a deployed third-party IdP, mail gateway, EDR, WAF, firewall, storage monitor, reviewed analyst input or CI integrity provider exists. Each company must register a genuine source, receive meaningful observed evidence, approve its specific rule, document positive/benign negative and outage behavior, and independently verify its alert in Alerts.

## Auth attribution / source contracts
Render's unverified proxy socket can yield `sourceIp=null`. Do NOT configure an unverified `TRUSTED_PROXY_IPS` range or treat arbitrary `X-Forwarded-For` as a client IP. The authentication handler now HMAC-hashes the normalized submitted account name with the tenant-specific OTP secret, using a purpose-separated prefix. Failed-logon evidence receives only the 64-char pseudonym; no raw email, password, login body, OTP or header enters its event. If no trusted secret is available in development, the account pseudonym remains null. The self-monitor sampling bucket uses the pseudonym when the client IP is unverified, instead of combining all unknown clients.

A multi-event detector skips a rule when ANY of its configured group fields is null/unknown. Existing earlier anonymous failures are NOT retrospectively upgraded or attributed.

Migration `022_task41_alert_grouping.sql` revises only three DISABLED, unmodified version-1 core rule definitions, with a hard precondition and version increments:
- `SX-CORE-001` brute force: five failed logins within 300 s against one non-null pseudonymous target (`groupBy: user`); event severity stays LOW, alert threat level HIGH
- `SX-CORE-005` unauthorized access: three denied accesses within 300 s from one non-null source IP (`groupBy: sourceIp`); approved application source must provide attributable `sourceIp`
- `SX-CORE-006` reconnaissance: three probes within 120 s from one non-null source IP against one pinned issuer host (`groupBy: sourceIp,host`); application source requires IP

The other twelve core rule definitions/severities are unchanged, and all fifteen remain DISABLED by default. Any pre-existing customized or enabled row among those three causes migration to FAIL rather than silently rewrite company policy. Iphyn's separate customized rule is not altered.

## Release order
1. CI: core quality, migration 022 and disposable full 15-category persisted-alert integration must pass; review privacy, null grouping and migration fail-closed logic
2. Confirm preconditions independently in Original and Iphyn tenant databases. Apply migration 022 separately to their correct isolated tenant DBs via guarded runner, never to Onboarding Platform; verify ledger/checksum and disabled status
3. Obtain explicit merge approval; merge and verify same commit LIVE on each Render service, including existing tenant auth/website/feed regressions. Do not enable all rules as part of deployment
4. In Original SentinelX, activate CORE-001 only through audited rule-management approval after verified HMAC evidence and grouped threshold regression; no production brute-force traffic should be generated for testing. Preserve Iphyn's separate working rule
5. Progress through the other fourteen genuine-source acceptance gates tenant-by-tenant and rule-by-rule. Do not mark Task 41 complete or assert all fifteen live attacks are detected until each actual evidence source has been tested

## Current production findings (pre-release)
Original recorded seven recent LOW `sentinelx-internal` failed-login events with `sourceIp=null`, `user=null`, and its CORE-001 was disabled; therefore no alert was expected. This patch does not rewrite historical evidence, enable detection rules, fabricate an IP, create synthetic production events or modify tenant secrets.
