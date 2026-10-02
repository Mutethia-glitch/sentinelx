# Iphyn unauthorized-access live acceptance — controlled test

Status: **READY TO EXECUTE, NOT YET LIVE-ACCEPTED**. The SentinelX normalization fix (64556c3, included in live 4407432) and Iphyn PR #28 (merged to Iphyn main as 4b71268; deployment confirmed by user) are available. All actions involving Vercel remain manual and user-controlled. The fixture is intentionally disabled.

## Preconditions (do not skip)
- Obtain authorization for a **disposable non-admin Iphyn test account** and a separate authorized SentinelX Administrator/Security Analyst session at https://sentinelx-iphyn-network.onrender.com.
- Use an existing safe application permission boundary, such as the non-instructor test account requesting the protected `instructor.courses` procedure; never expose or modify another user's course/data. No scanners, high-rate traffic, credentials guessing or destructive payloads.
- Confirm current rules via authenticated `GET /api/rules?page=1`. Record existing rule IDs and status. Do not turn on global `SX-CORE-005` without reviewing its source/host conditions. Do not change the established brute-force rule.
- If Iphyn client-IP attribution is null or inconsistent, **stop** the threshold test. The scoped rule requires non-null sourceIp and user; do not remove these guards simply to make a test pass.
- Production detector state is not a sandbox. Create or enable a rule only with approval by that tenant's authorized rule manager, and restore it to the approved final state afterward.

## Read-only baseline: one real denied operation
1. With the authorized Iphyn test account signed in, make one ordinary application request to an operation that account is not allowed to access (e.g. `instructor.courses`). Verify the application really returns `FORBIDDEN` and does not expose data.
2. In the tenant Events page, inspect the newly delivered event. Expected: source=`iphyn-app`, host=`iphyn.vercel.app`, type=`access`, action=`access_denied`, status=`denied`, event severity=`MEDIUM`, valid source IP, user=64-character HMAC pseudonym. No raw email, password, request body or bearer token may appear.
3. If no event arrived, investigate the generic connector-delivery warning and source/hosting availability; do not invent a missing event. The Iphyn reporter has a 1.5s timeout and no durable retry queue. Record sanitized event ID and UTC timestamp if it arrived.
4. Verify a signed-out/anonymous rejected request has no user subject and cannot match the first authenticated-only rule. This is a negative control, not a request to bypass authorization.

## Controlled threshold and benign controls
1. Use `fixtures/rules/iphyn-repeated-access-denial.json`. Authorize and validate the candidate via `POST /api/rules/validate` before creating it through `POST /api/rules`; both endpoints require an authorized tenant session and the exact public Origin. The fixture has `enabled:false` so creating it must not immediately detect. Capture the created rule ID/version without storing a session cookie.
2. After verifying source/IP/user from the baseline event, enable the specifically scoped rule with `PUT /api/rules/{uuid}` and its actual persisted version (optimistic concurrency). Do not enable unrestricted category-wide rules or modify the pre-existing brute-force rule.
3. Let any earlier matching events age beyond the 300-second window before the negative/positive sequence. From the *same approved test IP and pseudonymous account*, generate exactly **one or two** normal forbidden operations within the window. Expected: MEDIUM events but **no HIGH unauthorized-access alert**.
4. Perform the third comparable forbidden operation in the same 300 seconds. Expected: one scoped `UNAUTHORIZED_ACCESS` alert with HIGH rule-derived severity, three actual source evidence IDs, correct IP/user grouping, appropriate correlation, and no unrelated alert. The user account remains unauthorized throughout. Stop if the normal application behaves differently.
5. Inspect event/alert context, record exact UTC times, then use the accepted UI alert-to-incident action on a disposable test case, assign an authorized analyst, add an honest finding and resolution, and inspect audit/report evidence. Do **not** claim a manual response is a firewall block; unauthorized-access has no new automated containment in this rollout.
6. Restore the rule to disabled when its purpose is only acceptance testing, unless the company Administrator separately approves it as ongoing policy; record the change/audit reason. Preserve all legitimate pre-existing security data.

## Required evidence and verdict
| Gate | Acceptance evidence |
|---|---|
| Code | SentinelX deployed SHA and Iphyn production SHA (no secret values). |
| Positive source | Signed-in forbidden result, accepted MEDIUM event ID with verified non-null IP/user pseudonym. |
| Benign negative | One/two matching denials do not trigger a HIGH alert; anonymous/unattributed denial excluded. |
| Threshold | Exactly the scoped third denial triggers expected HIGH alert within 300 seconds. |
| Workflow | Alert evidence IDs, tenant, incident assignment, investigation, recorded response vs actual enforcement, resolution, audit. |
| Isolation | A separate company's session/token cannot inspect these records; perform only with approved disposable accounts and no secrets shared. |
| Cleanup | Explicit final rule enabled state and all disposable accounts/incidents disposition logged. |

Do not mark `UNAUTHORIZED_ACCESS` LIVE COMPLETE in `docs/LIVE_THREAT_COVERAGE.md` before these checks are actually recorded. Task 41 remains independently OPEN on verified-domain email, other-user invites, three-role backend checks, disabling/revocation and two-company isolation.
