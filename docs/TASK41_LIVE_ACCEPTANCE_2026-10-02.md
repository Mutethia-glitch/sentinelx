# Task 41 live acceptance register — 2 October 2026

**Task 41 remains OPEN.** Code implementation, service deployment, and the UI logo are not interchangeable with completed business onboarding, other-address email delivery and company isolation acceptance. This register contains no passwords, OTPs, database credentials or signing material.

## Confirmed evidence

| Gate | Outcome | Evidence / boundary |
|---|---|---|
| User-approved 3D-style shield | CONFIRMED by user | Adapted static SVG/CSS logo and reduced-motion behaviour; user confirmed live appearance on 2026-10-02. This is not the original Lovable WebGL runtime. |
| Two tenant runtimes and separate onboarding/provisioner services | LIVE deployments | Render service inventory shows sentinelx-iphyn-network, sentinelx-nl6f, sentinelx-onboarding and sentinelx-provisioner, auto-deploy main. |
| Common logo release | DEPLOYED | Render four services status LIVE on main 22887ceb at approximately 06:06 UTC. |
| Iphyn severity normalization | DEPLOYED | Render previously deployed 13fe863 before Iphyn PR #27 merge; present in successor releases. |
| Iphyn PR #27 (privileged-access denial) | MERGED with Vercel success contexts | Merge 08831105f at 00:27:59 UTC; both Vercel contexts succeeded. Real post-merge privileged denial and resulting event severity not yet recorded here. |
| Unauthorized access mapping follow-on | BOTH CODEPATHS DEPLOYED; LIVE DETECTION PENDING | SentinelX 64556c3 is present in LIVE successor 4407432; Iphyn PR #28 merged 2026-10-02 07:18:57 UTC (4b71268), with Vercel production deployment confirmed by the user. Fixed PR branch c990b13 passed Recovery CI (45/45, TypeScript, build). A real attributed denial and threshold alert remain unverified. |
| Brute-force login rejection | PARTIAL LIVE | User confirmed ingestion, repeated-login HIGH alert and actual temporary rejection with countdown. Full expiry/scope/audit acceptance below. |

## Mandatory acceptance still to record

| Required gate | Status | Safe observation to record |
|---|---|---|
| Resend verified sending domain / EMAIL_FROM | BLOCKED / NOT VERIFIED | Verify domain ownership in the provider account, configure sender for tenant and control plane, confirm email to TWO independently owned non-owner addresses. onboarding@resend.dev is account-owner limited; never paste API credentials. |
| Invited employee lifecycle | PENDING domain gate | Administrator sends distinct-address invitation; invited user activates with six-digit code and own password; code expiry, resend, invalid-code limit and no cross-user activation observed. |
| RBAC (three roles) | PENDING live acceptance | Check allowed and denied backend API operations for Administrator, Security Analyst and Viewer; UI hiding alone is not authorization. Record which endpoints and response codes. |
| User disablement / last administrator | PENDING live acceptance | Disabled user's existing session ceases access; role change also revokes sessions; attempt to disable/demote final Administrator must be rejected. Use disposable additional user, not sole live administrator. |
| Two-company user and database isolation | PENDING live acceptance | In tenant A and tenant B, use separate test accounts to verify A session/cookie, identity, connector credential and data cannot read or mutate B; each environment remains reachable independently. Separate login pages alone do not pass. |
| HTTPS first-company signup to provisioned sign-in | PENDING other-address delivery | Company signup -> six-digit email verification -> ACTIVE/idempotent provisioner -> unique HTTPS company origin -> initial Administrator password and fresh email OTP -> session. Record tenant ID and resource IDs without temporary credentials; ensure no duplicated provisioned resources. |
| Login containment boundaries | PENDING live evidence | Controlled test: five failures -> prepared policy -> one actual rejected attempt -> matching enforcement audit; block expires once, unrelated IP/account unaffected, past attempts do not extend active expiry. |
| Severity live samples | PENDING event inspection | Verify login_failed LOW, access_denied MEDIUM, rate_limit_blocked MEDIUM only when actually rejected, privileged_access_denied HIGH only for signed-in admin denial, containment-blocked HIGH only after confirmed restriction; UNKNOWN is not benign and no CRITICAL claim without actual high-confidence source. |
| Verification scripts on deployed version | PENDING this continuation | Run npm run quality and npm run verify:deployment on the exact revision with disposable DB prerequisites; run npm run smoke:online with safe configured test scope. Earlier 235 tests passed for the logo release, not a fresh pass for new commit 64556c3. |
| Secret rotation / logging privacy | PENDING independent operator review | Confirm earlier exposed database credential was rotated where applicable, bootstrap/OTP variables cleaned up, code and event audit contain no secrets. Review settings privately, not in chat. |
| Vercel team-level direct inspection | BLOCKED tool authorization | Connected Vercel account reports zero accessible teams and 403 for team scope mutethia-glitchs-projects. GitHub commit statuses can still be read; connect/authorize Vercel under the correct team to inspect runtime/deploys. |

## Evidence collection protocol

Run tenant A and B checks using consenting, disposable, separate email addresses and accounts. Record timestamp (UTC), service URL, source version, sanitized event/alert/incident IDs, observed backend response, relevant audit action and cleanup confirmation. Avoid printing OTPs, bearer tokens, cookies, connection strings or email secrets. Distinguish a capability proven in controlled tests from a successful operation on the public deployment. No synthetic security events or category rule changes should be left enabled unintentionally.

## Completion rule

Mark Task 41 Complete only after the provider-domain gate, distinct-user activation, three-role API matrix, disablement/last-admin safety, negative cross-tenant tests, full signup-to-first-login, secure deployment smoke and regression tests, and documentation are all recorded with evidence. Task 42 and later remain separately out of scope until Task 41 actually passes.

Related threat register: docs/LIVE_THREAT_COVERAGE.md.
