# Task 41 live acceptance register — 2 October 2026

**Task 41 remains OPEN.** User approved deferring purchase of a verified outbound-email domain; non-owner recipient delivery and genuine multi-company end-to-end acceptance remain pending. Disposable CI checks are not production acceptance. Code implementation, service deployment, and the UI logo are not interchangeable with completed business onboarding, other-address email delivery and company isolation acceptance. This register contains no passwords, OTPs, database credentials or signing material.

## Confirmed evidence

| Gate | Outcome | Evidence / boundary |
|---|---|---|
| User-approved 3D-style shield | CONFIRMED by user | Adapted static SVG/CSS logo and reduced-motion behaviour; user confirmed live appearance on 2026-10-02. This is not the original Lovable WebGL runtime. |
| Two tenant runtimes and separate onboarding/provisioner services | LIVE deployments | Render service inventory shows sentinelx-iphyn-network, sentinelx-nl6f, sentinelx-onboarding and sentinelx-provisioner, auto-deploy main. |
| Common logo release | DEPLOYED | Render four services status LIVE on main 22887ceb at approximately 06:06 UTC. |
| Iphyn severity normalization | DEPLOYED | Render previously deployed 13fe863 before Iphyn PR #27 merge; present in successor releases. |
| Iphyn PR #27 (privileged-access denial) | MERGED with Vercel success contexts | Merge 08831105f at 00:27:59 UTC; both Vercel contexts succeeded. Real post-merge privileged denial and resulting event severity not yet recorded here. |
| Unauthorized access mapping follow-on | BOTH CODEPATHS DEPLOYED; LIVE DETECTION PENDING | SentinelX 64556c3 is present in LIVE successor 4407432; Iphyn PR #28 merged 2026-10-02 07:18:57 UTC (4b71268), with Vercel production deployment confirmed by the user. Fixed PR branch c990b13 passed Recovery CI (45/45, TypeScript, build). A real attributed denial and threshold alert remain unverified. |
| Shared company sign-in gateway | USER-CONFIRMED LIVE | Commit c26d1ae introduced ACTIVE-company finder; later 9200df5 configured original tenant's optional /access bookmark gateway and 404e94e documented it. Render deployed all three relevant services LIVE at approximately 07:50 UTC. User confirmed original SentinelX URL correctly routes Iphyn Network to its dedicated company login. This proves navigation/routing, not global password authentication, invited-employee activation or cross-tenant isolation. |
| Company finder and signup visual signoff | USER-CONFIRMED | Company landing, signup presentation and approved shared seven-layer logo were confirmed acceptable by the user; frontend-only changes keep signup and routing contracts intact. |
| Full source/deployment CI | PASS (DISPOSABLE) | GitHub Task 41 regression run [36983578509](https://github.com/Mutethia-glitch/sentinelx/actions/runs/36983578509) passed at 84a2bfc: npm run quality (251/251), npm run verify:deployment and four sequential PostgreSQL-backed isolated integration tests. No production credentials or databases. |
| Role/revocation/last-admin, controlled DB gate | PASS (DISPOSABLE) | PostgreSQL-backed access.test.js and tenant-authentication.test.js passed: three-role enforcement, simultaneous admin demotion guard, revoked sessions, invitation/activation and disablement using a fake mailer. Not live-user acceptance. |
| Genuine database-per-company negative test | PASS (DISPOSABLE) | tests/integration/two-tenant-database.test.js migrated two separate ephemeral PostgreSQL databases; the same synthetic email had independent passwords/2FA, sessions, tenant profile, allowed roles and user lists; cross-tenant cookies/forged role headers were rejected. Live two-company isolation remains independently pending. |
| Platform registration credential cleanup | PASS (DISPOSABLE) | tests/integration/platform-signup.test.js verified ACTIVE registration and erasure of temporary onboarding password hash and OTP digest in a separate disposable platform database. Not independent real-provider email delivery. |
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
| Verification scripts on current revision | CORE + DISPOSABLE DB PASS; LIVE HTTP SMOKE PENDING | CI 36983578509 on 84a2bfc passed 251 core tests, deployment verifier, isolated PostgreSQL RBAC/2FA and dual-database negative controls, and independent platform signup. Read-only HTTPS/HSTS/health smoke against currently deployed Render URLs is still pending. |
| Secret rotation / logging privacy | PENDING independent operator review | Confirm earlier exposed database credential was rotated where applicable, bootstrap/OTP variables cleaned up, code and event audit contain no secrets. Review settings privately, not in chat. |
| Vercel production changes | USER-MANAGED | User explicitly handles all Vercel configuration/deployment manually. No Vercel change or connector authorization is required for this SentinelX Task 41 continuation. |

## Evidence collection protocol

Run tenant A and B checks using consenting, disposable, separate email addresses and accounts. Record timestamp (UTC), service URL, source version, sanitized event/alert/incident IDs, observed backend response, relevant audit action and cleanup confirmation. Avoid printing OTPs, bearer tokens, cookies, connection strings or email secrets. Distinguish a capability proven in controlled tests from a successful operation on the public deployment. No synthetic security events or category rule changes should be left enabled unintentionally.

## Completion rule

Mark Task 41 Complete only after the provider-domain gate, distinct-user activation, three-role API matrix, disablement/last-admin safety, negative cross-tenant tests, full signup-to-first-login, secure deployment smoke and regression tests, and documentation are all recorded with evidence. Task 42 and later remain separately out of scope until Task 41 actually passes.

Related threat register: docs/LIVE_THREAT_COVERAGE.md.
