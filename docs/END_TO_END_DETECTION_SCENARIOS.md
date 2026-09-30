# Task 40 — End-to-End Detection Scenarios

Task 40 validates SentinelX with controlled synthetic data only. No real external target, destructive action or offensive scanning is used.

## Fifteen-category system contract

The canonical SentinelX threat taxonomy remains exactly:

1. BRUTE_FORCE
2. CREDENTIAL_ATTACK
3. PRIVILEGE_ESCALATION
4. SUSPICIOUS_ACCOUNT_ACTIVITY
5. UNAUTHORIZED_ACCESS
6. RECONNAISSANCE
7. SUSPICIOUS_NETWORK_ACTIVITY
8. PHISHING_SOCIAL_ENGINEERING
9. MALWARE
10. RANSOMWARE
11. DENIAL_OF_SERVICE
12. DATA_EXFILTRATION
13. WEB_APPLICATION_ATTACK
14. INSIDER_THREAT
15. SUPPLY_CHAIN_COMPROMISE

Task 40 verifies that every code propagates through the category-aware system layers: taxonomy catalog, core-rule definition, normalized evidence, deterministic detection, alert snapshot, incident classification, investigation context, audit context, category-aware event/alert/incident search, dashboard threat aggregation and reporting.

Notifications intentionally remain link/severity based rather than duplicating category state. MITRE ATT&CK remains the documented partial mapping from Task 28; Task 40 does not invent unsupported technique mappings merely to make all fifteen categories appear mapped.

## Controlled scenario matrix

| Category | Controlled input | Expected detection / incident | Recorded response | Expected result |
|---|---|---|---|---|
| BRUTE_FORCE | Five failed login events from one source/user, plus one extra matching event | HIGH alert at threshold; second alert correlates; HIGH incident | Successful manual CONTAINMENT attestation | RESOLVED with retained two-alert correlation evidence |
| CREDENTIAL_ATTACK | Three failed password-spray authentication events from one source | HIGH credential-attack alert and incident | Successful manual ESCALATION | RESOLVED |
| PRIVILEGE_ESCALATION | Successful explicit privilege-escalation authorization event | CRITICAL alert and incident | Successful manual CONTAINMENT attestation | RESOLVED |
| SUSPICIOUS_ACCOUNT_ACTIVITY | Account event explicitly marked suspicious | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| UNAUTHORIZED_ACCESS | Three denied access events from one source/user | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| RECONNAISSANCE | Three reconnaissance scan events from one source to one destination | MEDIUM alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| SUSPICIOUS_NETWORK_ACTIVITY | Network event explicitly marked suspicious | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| PHISHING_SOCIAL_ENGINEERING | Phishing event explicitly reported | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| MALWARE | Malware event explicitly detected | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| RANSOMWARE | Ransomware event explicitly detected | CRITICAL alert and incident | Successful manual CONTAINMENT attestation | RESOLVED |
| DENIAL_OF_SERVICE | Three active DDoS events toward one destination/host | CRITICAL alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| DATA_EXFILTRATION | Explicit data-transfer/exfiltration event | CRITICAL alert and incident; represents the outbound-data scenario | Successful manual CONTAINMENT attestation | RESOLVED |
| WEB_APPLICATION_ATTACK | Explicit SQL-injection attempt | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| INSIDER_THREAT | Explicit suspected insider-threat event | HIGH alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |
| SUPPLY_CHAIN_COMPROMISE | Explicit confirmed supply-chain-compromise event | CRITICAL alert and incident | Successful FOLLOW_UP_TASK record | RESOLVED |

Every incident also receives one synthetic analyst finding and an incident report assertion.

## Required Task 40 scenarios

The task-contract scenarios are represented as follows:

- **Brute force:** BRUTE_FORCE.
- **Suspicious authentication:** CREDENTIAL_ATTACK plus SUSPICIOUS_ACCOUNT_ACTIVITY coverage.
- **Privilege escalation:** PRIVILEGE_ESCALATION.
- **Reconnaissance:** RECONNAISSANCE.
- **Suspicious outbound activity:** SUSPICIOUS_NETWORK_ACTIVITY plus DATA_EXFILTRATION.
- **Correlation:** an extra BRUTE_FORCE trigger creates a second related alert; one canonical correlation pair must be persisted.
- **False positive control:** a benign successful login is ingested while all fifteen temporary scenario rules are active; it must create zero alerts.

## Isolation and cleanup

The verifier requires `SENTINELX_TEST_DATABASE=1`. It creates one synthetic Security Analyst and fifteen temporary enabled detection rules cloned from the accepted core-rule definitions. Existing rule enabled/disabled policy is not changed.

All fifteen threat categories are temporarily made selectable only for the controlled run so incident creation can retain the detected classification. Their original `enabled` and `updated_at` values are restored during cleanup.

Synthetic incidents, investigation notes, response actions, alert/event links, correlations, alerts, events, rules, sessions, roles, audit records and the synthetic user are removed. No migration is added.

## Category visibility changes

Before Task 40, Dashboard threat distributions were limited to ten category rows and the security-summary report limited incident categories to fifteen rows. Those bounds could hide a valid taxonomy category when all fifteen categories plus UNCLASSIFIED were represented.

Task 40 removes those category truncation limits. Dashboard and reporting now return all persisted category buckets. Event, Alert and Incident filter screens expose the same fifteen canonical codes as datalist suggestions; backend validation remains authoritative.

## Acceptance

Run on Windows with the same controlled PostgreSQL environment used for Tasks 38–39:

```powershell
git pull --ff-only origin main

npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw "Task 40 quality gate failed" }

npm.cmd run test:taxonomy:ui
if ($LASTEXITCODE -ne 0) { throw "Task 40 taxonomy UI gate failed" }

$env:SENTINELX_TEST_DATABASE = "1"
npm.cmd run db:migrate
if ($LASTEXITCODE -ne 0) { throw "Task 40 migration replay failed" }

npm.cmd run verify:end-to-end
if ($LASTEXITCODE -ne 0) { throw "Task 40 end-to-end verifier failed" }
```

Expected verifier output:

`15 threat categories propagated through detection, alert, incident, investigation, response, resolution, search, dashboard and reporting; required Task 40 scenarios and false-positive control verified. Synthetic changes cleaned up.`

The equivalent Node integration regression is available as `npm.cmd run test:end-to-end:integration`.


## Acceptance — 2026-10-01

Windows/local controlled verification passed with the expected result:

`15 threat categories propagated through detection, alert, incident, investigation, response, resolution, search, dashboard and reporting; required Task 40 scenarios and false-positive control verified. Synthetic changes cleaned up.`

Task 40 is Complete. The accepted result confirms the fifteen-category propagation contract, required scenario set, persisted correlation case, benign zero-alert control and cleanup behavior. Task 41 remains Not Started.
