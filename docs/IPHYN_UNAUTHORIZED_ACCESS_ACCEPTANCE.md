# Iphyn unauthorized-access acceptance — role-locked application

Status: **BACKEND HANDLER AND NORMALIZER IMPLEMENTED; LIVE CATEGORY NOT ACCEPTED**.
Confirmed by the user on 2026-10-02: Iphyn exposes only the actions available to each assigned role. Non-admin users do not have a normal product action for requesting administrator privileges or opening hidden administrator activities. Preserve this design.

SentinelX commit 64556c3 normalizes the allowlisted `access_denied` signal to `access/access_denied/denied` with MEDIUM event severity. Iphyn PR #28 merged as 4b71268 and its production deployment was confirmed by the user. Its middleware passes an HMAC-pseudonymizable account subject only *when an actual signed-in ordinary protected-operation denial occurs*; this does not mean a normal Iphyn user can generate such a denial from the role-limited interface. An admin-only rejected operation emits `privileged_access_denied`, not a privilege-escalation success and not an `access_denied` rule match.

## What we must NOT do

- Do not expose hidden admin/instructor activities, add a "request admin access" option, weaken role checks, grant temporary privilege or build a bypass in production to produce detection telemetry.
- Do not direct a real non-admin to request unavailable activities, or count an artificial API call as normal product behaviour.
- Do not enable `fixtures/rules/iphyn-repeated-access-denial.json` or unrestricted `SX-CORE-005` solely to manufacture an alert.
- Do not treat absence of routine `access_denied` events as a failure of Iphyn's access controls, or claim this live detection passed without actual signed source events.

## Correct verification split

1. **RBAC correctness (automated / isolated test context).** Existing Iphyn `server/sentinelx-hooks.test.ts` verifies that protected and admin operations reject inappropriate sessions and that the middleware distinguishes ordinary denial from `privileged_access_denied`. The corrected PR #28 passed Recovery CI (45/45 tests, TypeScript and build). Expand tests only in an authorized disposable staging/test harness, without changing the production interface or real user roles.
2. **Telemetry correctness (contract/unit level).** SentinelX `tests/integrations/collector.test.js` and `tests/rules/iphyn-unauthorized-access.test.js` exercise the allowlisted shape, event severity, rejection of fabricated attack labels, source/host/IP/user scoping, eight negative controls, benign below-threshold sequence and three-event positive. These establish deterministic capability only.
3. **Production observation (read-only).** Monitor naturally occurring, accepted connector events through the existing Events/Audit interface. If an application or hosting layer genuinely rejects an unauthorized request, verify its provenance and whether it was emitted as `access_denied`, `privileged_access_denied` or a different signal. Do not require a non-admin to generate one. An anonymous rejection has no HMAC account subject and cannot match the first signed-in-only rule.
4. **Real-world source before live alert acceptance.** If Iphyn's role-limited workflows produce no signed-in generic access denials, this particular scoped rule is *dormant by design*. To offer ongoing unauthorized-access coverage, first approve a separate trusted, non-UI source (e.g. existing backend authorization-denial audit or hosting/WAF decision telemetry), with a documented source contract and appropriate privacy/source-IP policy. Evaluate natural false-positive cases before enabling a source-specific rule. A WAF signal may need a different rule definition and should not be forced into an account-required fixture.
5. **Tenant acceptance separately.** Task 41's role and cross-company safeguards should be verified using isolated API/integration checks and approved disposable accounts, not by adding user-visible privileges. There are no Vercel setting changes in this document; the user operates Vercel manually.

## Conditional future rule rollout — NOT scheduled or approved

The disabled fixture `fixtures/rules/iphyn-repeated-access-denial.json` requires verified source `iphyn-app`, host `iphyn.vercel.app`, `access/access_denied/denied`, non-null source IP and pseudonymous signed-in user. Its threshold is three same-IP/account denials in 300 seconds; matching event severity remains MEDIUM and the potential alert would be HIGH. This template is appropriate **only if** actual trustworthy signed-in denial events exist; do not enable it otherwise.

When a representative verified telemetry source exists, get tenant Administrator approval and run positive/benign tests in an isolated environment first. Record event IDs, rule version, severity, zero-alert negative controls, one positive alert, audit attribution, incident workflow, tenant-isolation proof and the final enabled/disabled state. Do not claim technical containment where only a manual response was recorded.

**Current verdict: deployed capability; no live `UNAUTHORIZED_ACCESS` alert acceptance.** The role-locked interface stays unchanged.
