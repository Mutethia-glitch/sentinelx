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
| 06 | RECONNAISSANCE | No trusted proxy/WAF/network scan or discovery feed | MEDIUM | SYNTHETIC ONLY | Onboard bounded source/destination/probe evidence; repeated source-scoped positive and normal crawler negative. |
| 07 | SUSPICIOUS_NETWORK_ACTIVITY | No verified network-flow or proxy suspicious classification | HIGH | SYNTHETIC ONLY | Require real connection/egress evidence and source verdict; exclude normal service-to-service traffic. |
| 08 | PHISHING_SOCIAL_ENGINEERING | No mail-security or approved analyst-report feed | HIGH | SYNTHETIC ONLY | Receive provider evidence or an attributed analyst report, with benign training-mail control. |
| 09 | MALWARE | No EDR/endpoint agent verdict feed | HIGH | SYNTHETIC ONLY | Trusted endpoint detection or block verdict; test sanitized vendor fixture and clean software negative. |
| 10 | RANSOMWARE | No endpoint/file-behaviour ransomware verdict feed | CRITICAL | SYNTHETIC ONLY | Verified ransomware-specific verdict/activity, benign batch-file change negative; no destructive live tests. |
| 11 | DENIAL_OF_SERVICE | Iphyn rate_limit_blocked exists but is MEDIUM rejection evidence, not DoS/DDoS proof | CRITICAL | SYNTHETIC ONLY | Add aggregate WAF/proxy request-rate and availability evidence; benign peak-traffic control; never equate one 429 with DoS. |
| 12 | DATA_EXFILTRATION | No trusted application/storage transfer/egress evidence | CRITICAL | SYNTHETIC ONLY | Approved export/egress policy or vendor verdict with user, target, volume and result; authorized export negative. |
| 13 | WEB_APPLICATION_ATTACK | No signed WAF/application security verdict for injection, XSS, traversal or command injection | HIGH | SYNTHETIC ONLY; NEXT SOURCE CONTRACT | Add a bounded server-side WAF/block decision, proof of sanitization and false-positive controls; never classify arbitrary request text as an attack. |
| 14 | INSIDER_THREAT | No evidence-led source verdict or attributable analyst finding | HIGH | SYNTHETIC ONLY | Require correlated approved account/data audit plus explicit analyst/source classification; routine staff work negative. |
| 15 | SUPPLY_CHAIN_COMPROMISE | No CI/dependency/build provenance or integrity incident feed | CRITICAL | SYNTHETIC ONLY | Integrate verified build/integrity advisory and affected artifact; routine dependency bump negative. |

All fifteen SX-CORE-001 through SX-CORE-015 definitions start disabled. The Iphyn-specific brute-force tenant rule has been enabled and its event/alert/temporary-block behaviour was confirmed by the user. No source automatically gains monitoring when a company supplies only a URL.

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

WEB_APPLICATION_ATTACK requires a trusted Iphyn or Vercel WAF/app-security verdict, not raw pattern matching on a user-supplied string. Define a minimal allowlist, signed source ownership, decision outcome and safe metadata first. Reconnaissance, DoS, network and data-exfiltration require separate telemetry. Malware/ransomware require endpoint findings; phishing requires mail or analyst evidence; privilege/account/insider need trustworthy identity/data audit; supply chain requires CI/integrity evidence. Add each source as a separate reviewed contract and test both false positives and cross-tenant rejection.

## Live evidence and limitations

- User confirmed: live brute-force alert, temporary login rejection and retry countdown; visual shield logo confirmed 2026-10-02.
- Render: Iphyn tenant commit 22887ceb and normalization commit 64556c3 both reached LIVE; deployment proof alone is not a live access-denial/alert test.
- Iphyn: PR #27 was merged 2026-10-02. PR #28 was merged at 07:18:57 UTC (4b712683); user confirmed manual production deployment. PR #28 Recovery CI passed on c990b13 (12 files/45 tests, TypeScript and Vercel build). This proves code delivery, not a live event/alert outcome.
- Render/Vercel request logs are not a substitute for tenant security-event, rule, alert, incident and audit rows. Direct Vercel team-scope runtime inspection returned a 403 on 2026-10-02; reauthorize the connected Vercel account for mutethia-glitchs-projects if direct inspection is desired.
- Full brute-force expiry, independent account, backend enforcement audit and two-company negative isolation still require recorded controlled tests.

See docs/TASK41_LIVE_ACCEPTANCE_2026-10-02.md for the cross-company and email-delivery gates.
