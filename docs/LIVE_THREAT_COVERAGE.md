# SentinelX live threat coverage — 15-category evidence register

**Recorded 2026-10-02 (UTC). Scope:** Iphyn Network company runtime unless otherwise indicated. This is a complete 15-row *tracking matrix*, not a claim that all fifteen attacks are monitored in production. Tasks 11/14/40 provided taxonomy, disabled core rule definitions and controlled synthetic end-to-end tests; those do not substitute for a deployed source and a live positive/benign pair. Other companies require their own isolated source enablement and acceptance.

## Evidentiary status

- PARTIALLY LIVE: a specific user-observed production pathway, with named acceptance gaps.
- DEPLOYED NORMALIZER: source-to-event code runs in the tenant, but an enabled matching live alert and downstream outcome are not recorded.
- SYNTHETIC ONLY: controlled fixtures exercised the generic core pipeline, not a real signed-up company feed.
- Connector event severity is separate from core-rule alert severity. No current Iphyn connector signal supports CRITICAL; null means Unknown and is not harmless.

## Fifteen-category register

| # | Stable category | Actual source / required evidence | Core rule alert severity (when enabled) | Current live state | Next positive + benign acceptance / evidence gap |
|---:|---|---|---|---|---|
| 01 | BRUTE_FORCE | Iphyn login_failed: authentication/login/failed, bounded IP/account; connector severity LOW | HIGH | PARTIALLY LIVE — positive alert and five-minute block user-confirmed | Record benign single typo/no alert, block expiry, unrelated account, enforced-vs-prepared audit and tenant isolation. |
| 02 | CREDENTIAL_ATTACK | No trusted spray/stuffing classifier; ordinary login_failed is insufficient | HIGH | SYNTHETIC ONLY | Integrate identity-provider pattern evidence; validate spray/stuff positive and ordinary typo negative. |
| 03 | PRIVILEGE_ESCALATION | No successful role elevation/administrator grant evidence; privileged_access_denied is only a rejected action | CRITICAL | SYNTHETIC ONLY | Add authoritative identity/role-change audit with actor, target, before/after and outcome; include authorized admin-change negative. |
| 04 | SUSPICIOUS_ACCOUNT_ACTIVITY | No verified account/session anomaly feed | HIGH | SYNTHETIC ONLY | Integrate account/session evidence with explicit source decision and benign account maintenance control. |
| 05 | UNAUTHORIZED_ACCESS | Iphyn access_denied now normalized access/access_denied/denied in SentinelX commit 64556c3; MEDIUM event; merged PR #28 sends signed-in HMAC-pseudonymous subject (production deployment user-confirmed 2026-10-02) | HIGH | NORMALIZER AND CONDITIONAL MIDDLEWARE DEPLOYED; CATEGORY NOT LIVE-ACCEPTED | Iphyn's role-locked UI has no ordinary non-admin admin-activity request. Keep account-scoped fixture disabled unless naturally emitted authenticated denials are evidenced; otherwise approve a trusted non-UI source and test positive/benign outcomes before any live alert claim. |
| 06 | RECONNAISSANCE | Existing Iphyn token-bound connector accepts explicit application-level `reconnaissance_probe` (LOW event) from a verified source IP. Draft Iphyn PR #29 adds narrowly scoped unknown tRPC-procedure reporting; static/edge reconnaissance remains outside its reach. | MEDIUM (if approved fixture enabled) | RECEIVER DEPLOYED, IPHYN REPORTER DRAFT, LIVE RULE DISABLED | Iphyn owner approves/merges PR #29 and manually deploys, then records genuine low-volume backend positive and benign single-typo/edge-miss controls; only then consider enabling `iphyn-scoped-reconnaissance.json` (3 probes/120s, same IP/host). |
| 07 | SUSPICIOUS_NETWORK_ACTIVITY | No verified network-flow or proxy suspicious classification | HIGH | SYNTHETIC ONLY | Require real connection/egress evidence and source verdict; exclude normal service-to-service traffic. |
| 08 | PHISHING_SOCIAL_ENGINEERING | No mail-security or approved analyst-report feed | HIGH | SYNTHETIC ONLY | Receive provider evidence or an attributed analyst report, with benign training-mail control. |
| 09 | MALWARE | No EDR/endpoint agent verdict feed | HIGH | SYNTHETIC ONLY | Trusted endpoint detection or block verdict; test sanitized vendor fixture and clean software negative. |
| 10 | RANSOMWARE | No endpoint/file-behaviour ransomware verdict feed | CRITICAL | SYNTHETIC ONLY | Verified ransomware-specific verdict/activity, benign batch-file change negative; no destructive live tests. |
| 11 | DENIAL_OF_SERVICE | Iphyn rate_limit_blocked exists but is MEDIUM rejection evidence, not DoS/DDoS proof | CRITICAL | SYNTHETIC ONLY | Add aggregate WAF/proxy request-rate and availability evidence; benign peak-traffic control; never equate one 429 with DoS. |
| 12 | DATA_EXFILTRATION | No trusted application/storage transfer/egress evidence | CRITICAL | SYNTHETIC ONLY | Approved export/egress policy or vendor verdict with user, target, volume and result; authorized export negative. |
| 13 | WEB_APPLICATION_ATTACK | A dedicated optional signed Vercel JSON Log Drain adapter accepts only verified project/host firewall deny decisions whose exact WAF rule IDs have operator-approved SQLi/XSS/traversal/command-injection mappings. It never copies raw paths, query strings, messages or client IPs. | HIGH | RECEIVER + DISABLED RULE FIXTURE IMPLEMENTED; REAL DRAIN NOT CONFIGURED OR LIVE-ACCEPTED | Confirm Vercel Drains plan; manually configure JSON / production / firewall source, keep the project/host and source secret exact in tenant settings, review genuine WAF rule IDs and enable only after positive plus benign controls. An arbitrary blocked request is not an injection classification. |
| 14 | INSIDER_THREAT | No evidence-led source verdict or attributable analyst finding | HIGH | SYNTHETIC ONLY | Require correlated approved account/data audit plus explicit analyst/source classification; routine staff work negative. |
| 15 | SUPPLY_CHAIN_COMPROMISE | No CI/dependency/build provenance or integrity incident feed | CRITICAL | SYNTHETIC ONLY | Integrate verified build/integrity advisory and affected artifact; routine dependency bump negative. |

All fifteen SX-CORE-001 through SX-CORE-015 definitions start disabled. The Iphyn-specific brute-force tenant rule has been enabled and its event/alert/temporary-block behaviour was confirmed by the user. No source automatically gains monitoring when a company supplies only a URL.

## Signed Vercel firewall source — integration prepared, NOT live

The optional endpoint `POST /api/connectors/vercel-firewall` is absent unless all
four `VERCEL_FIREWALL_*` variables are deliberately configured on the Iphyn
tenant. The incoming raw JSON-array Log Drain body must have a constant-time
verified `x-vercel-signature` HMAC-SHA1 (Vercel's official Drain contract).
Only signed production `firewall` records from the configured project and verified visitor-facing `proxy.host`
with `proxy.wafAction=deny` and an explicitly mapped
`proxy.wafRuleId` are retained as sanitized MEDIUM web-application events.
No arbitrary URL, query, payload, client IP, or user agent is stored.

The operator-specific rule fixture
`fixtures/rules/iphyn-vercel-waf-web-attacks.json` is **disabled** and
cannot auto-create or auto-enable itself merely through deployment. It can
produce a HIGH `WEB_APPLICATION_ATTACK` alert only after a tenant
Administrator has reviewed the source and explicitly installed/enabled a
persisted rule. It groups by verified host + approved attack label, not a
shared null IP. No runtime traffic, actual WAF verdict or production
alert acceptance has been observed here. Full instructions and no-secret
manual Vercel steps: `docs/IPHYN_VERCEL_FIREWALL_INTEGRATION.md`.

## Fifteen normalized evidence contracts available, providers not yet connected

`src/integrations/evidence-catalog.js` now maps issuer-bound source signals
across all fifteen stable categories. `/api/connectors/evidence` is absent
until the tenant operator explicitly configures its per-provider server secrets.
The catalog and generic rule matching have passed controlled regression tests;
no extra Iphyn provider streams or new live alerts are implied. The only
currently proposed additional Iphyn direct source is a narrowly scoped
application-router reconnaissance reporter in **draft Iphyn PR #29**, and its
three-event fixture remains disabled. See `docs/SECURITY_EVIDENCE_FEEDS.md`.
Website self-service registration and one-time application keys are staged
separately in SentinelX **draft PR #1**, pending platform and tenant migrations.

## Required gate for EACH category (not interchangeable)

| Gate | Concrete acceptance record |
|---|---|
| 1. Source | Signed/secret-bound source, scope, supported event kind and provenance recorded; unknown origins rejected. |
| 2. Contract | Server-side normalization, allowed privacy-preserving fields, deduplication and timestamp boundary verified. |
| 3. Rule | Tenant Administrator explicitly enables a vetted source/host-scoped rule; correct threshold/window/grouping and evidence fields. |
| 4. Positive | Authorized disposable/staging scenario produces a genuine source event and expected normalized severity. |
| 5. Benign negative | Comparable non-attack operation does not make the rule alert; unknown/missing attribution does not silently aggregate distinct users. |
| 6. Detection/alert | Trigger event, independent rule-derived severity, correlation, correct recipient/read state and no duplicate alert verified. |
| 7. Incident/investigation | Controlled alert-to-incident handoff, ownership, chronological evidence, category and analyst notes verified. |
| 8. Response/closure | Record only a response actually supported by that source; distinguish manual recorded action, preparation and confirmed technical enforcement. |
| 9. Audit/report | Attributed immutable operations, alert and incident history, incident report and filtered audit download verified. |
| 10. Isolation | An unrelated company's credentials, connector token, event data, user session and incident must not cross the tenant database/runtime boundary. |

Never mark a category LIVE COMPLETE until all applicable gates have an evidence reference, tested timestamp, source version/commit, expected result and observed result. Where no real containment exists, record NOT SUPPORTED with a manual response option rather than inventing automation. No production payload attacks, arbitrary external scanning or destructive tests.

## First controlled rollout: repeated access denial

1. SentinelX 64556c3 maps allowed Iphyn access_denied to type=access, action=access_denied and status=denied. The individual event stays MEDIUM. login_failed, rate_limit_blocked and privileged_access_denied retain their own categories/severities; a failed admin-only request is not successful escalation.
2. Iphyn PR #28 was merged at 2026-10-02T07:18:57Z as commit 4b71268355985ae02ec2a4f5456c443d7a3c4031; the user confirmed the resulting Vercel production deployment. Signed-in generic denials pass an email into the existing HMAC reporter; anonymous denials preserve the two-argument/no-subject call. Neither branch sends credentials, request body, raw email or cookie. CI on the corrected PR branch passed 45/45 tests, TypeScript and build.
3. Iphyn's role-locked interface exposes only the activities assigned to a user. A normal non-admin cannot request admin privileges or access hidden admin activities. The API-ready fixture in fixtures/rules/iphyn-repeated-access-denial.json remains DISABLED. Its source/host/IP/account conditions are valid, but there may be no natural signed-in denial traffic matching them. Do not ask end users to access unavailable activities, change their roles, expose hidden buttons or enable the rule merely to manufacture alerts. An absent naturally generated event is not evidence of a failed authorization control.
4. Retain existing RBAC and telemetry regression tests in isolated harnesses. Observe production Events read-only and classify actual accepted signals, including any naturally rejected out-of-band requests. Only if a representative trusted source exists and the company approves detection enablement should staged positive/below-threshold/benign-isolation tests precede a separately authorized live acceptance. If no matching natural `access_denied` source exists, record the category as NOT LIVE-ACCEPTED rather than forcing a product workflow or guessing an attack.


See `docs/IPHYN_UNAUTHORIZED_ACCESS_ACCEPTANCE.md` for the corrected role-locked verification approach and conditional future evidence checklist.

## Integration priority after that rollout

WEB_APPLICATION_ATTACK now has an off-by-default, signed and source-bound Vercel firewall adapter, with CI-only verification. Live activation requires an operator-configured Pro/Enterprise Log Drain, actual WAF rule IDs and benign/positive acceptance; never elevate arbitrary request text or a generic WAF rate-limit rule to SQL injection. Reconnaissance, DoS, network and data-exfiltration require separate telemetry. Malware/ransomware require endpoint findings; phishing requires mail or analyst evidence; privilege/account/insider need trustworthy identity/data audit; supply chain requires CI/integrity evidence. Add each source as a separate reviewed contract and test both false positives and cross-tenant rejection.

## Live evidence and limitations

- User confirmed: live brute-force alert, temporary login rejection and retry countdown; visual shield logo confirmed 2026-10-02.
- Render: Iphyn tenant commit 22887ceb and normalization commit 64556c3 both reached LIVE; deployment proof alone is not a live access-denial/alert test.
- Iphyn: PR #27 was merged 2026-10-02. PR #28 was merged at 07:18:57 UTC (4b712683); user confirmed manual production deployment. PR #28 Recovery CI passed on c990b13 (12 files/45 tests, TypeScript and Vercel build). This proves code delivery, not a live event/alert outcome.
- Render/Vercel request logs are not a substitute for tenant security-event, rule, alert, incident and audit rows. Direct Vercel team-scope runtime inspection returned a 403 on 2026-10-02; reauthorize the connected Vercel account for mutethia-glitchs-projects if direct inspection is desired.
- Full brute-force expiry, independent account, backend enforcement audit and two-company negative isolation still require recorded controlled tests.

See docs/TASK41_LIVE_ACCEPTANCE_2026-10-02.md for the cross-company and email-delivery gates.
