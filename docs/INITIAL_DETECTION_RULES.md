# Initial detection rules — Task 14

Task 14 installs a deterministic starter rule for every one of SentinelX's fifteen approved threat categories. The rules use only the normalized fields and operators implemented by Tasks 12–13. They do not use raw-evidence selectors, regex, scripts, machine learning, external services, or destructive actions.

All fifteen rules are seeded **disabled**. This keeps installation from silently activating new detection policy. An Administrator or Security Analyst can review and enable a rule through the existing protected Task 12 rule-management workflow.

## Coverage and rule logic

| Category | Severity | Logic | Threshold / window | Grouping |
|---|---|---|---|---|
| BRUTE_FORCE | HIGH | authentication + login + failed | 5 / 300s | sourceIp, user |
| CREDENTIAL_ATTACK | HIGH | authentication + password_spray or credential_stuffing + failed | 3 / 300s | sourceIp |
| PRIVILEGE_ESCALATION | CRITICAL | authorization + privilege_escalation/role_elevation/admin_grant + success/allowed | 1 / 60s | user, host |
| SUSPICIOUS_ACCOUNT_ACTIVITY | HIGH | account event explicitly marked suspicious | 1 / 300s | user |
| UNAUTHORIZED_ACCESS | HIGH | denied access events | 3 / 300s | sourceIp, user |
| RECONNAISSANCE | MEDIUM | reconnaissance + scan/probe/discovery | 3 / 120s | sourceIp, destinationIp |
| SUSPICIOUS_NETWORK_ACTIVITY | HIGH | network event explicitly marked suspicious | 1 / 60s | sourceIp, destinationIp |
| PHISHING_SOCIAL_ENGINEERING | HIGH | phishing event marked detected/reported | 1 / 300s | user |
| MALWARE | HIGH | malware event marked detected/blocked/executed | 1 / 60s | host |
| RANSOMWARE | CRITICAL | ransomware event marked detected/blocked/executed | 1 / 60s | host |
| DENIAL_OF_SERVICE | CRITICAL | network + dos/ddos + detected/active/blocked | 3 / 60s | destinationIp, host |
| DATA_EXFILTRATION | CRITICAL | data_transfer + exfiltration + detected/blocked/success | 1 / 300s | user, host |
| WEB_APPLICATION_ATTACK | HIGH | web_application + SQL injection/XSS/path traversal/command injection | 1 / 60s | sourceIp, destinationIp |
| INSIDER_THREAT | HIGH | event explicitly classified insider_threat + suspected/detected | 1 / 300s | user, host |
| SUPPLY_CHAIN_COMPROMISE | CRITICAL | event explicitly classified supply_chain_compromise + detected/confirmed | 1 / 300s | host |

The exact version-controlled definitions are in `src/rules/initial-rules.js` and are seeded by append-only migration `007_initial_detection_rules.sql`.

## Detection-claim boundary

Some categories can be expressed behaviorally with the current canonical model, such as repeated failed logins or repeated denied access. Other categories require upstream evidence to classify the event first. For example, the malware rule matches an event whose normalized `type` is `malware`; SentinelX does not infer malware from arbitrary process telemetry in Task 14. The insider-threat rule likewise requires explicit upstream classification and does not infer a person's intent.

This distinction is deliberate. A Task 14 rule claims only the logic its conditions and tests demonstrate.

## Test data and expected output

`fixtures/events/initial-rule-scenarios.json` contains one positive and one negative scenario for every category. For each rule, automated tests verify:

- the positive event satisfies the documented conditions;
- enough matching evidence to reach the configured threshold yields exactly one expected alert;
- one fewer event than the threshold yields zero alerts;
- the negative event yields zero alerts and does not request threshold evidence.

`tests/rules/initial-rules.test.js` covers all fifteen definitions and asserts exact taxonomy coverage. `tests/integration/initial-rules.test.js` verifies the persisted PostgreSQL seed in a disposable database.

## MITRE annotations

Only rules with a directly supported local reference are annotated. The brute-force and credential-attack rules use the existing Task 12 `T1110` Brute Force reference. The remaining rules have no Task 14 MITRE annotation rather than guessing mappings. Broader MITRE catalog work remains Task 28.

No external MITRE API or API key is required.

## PostgreSQL verification

After pulling Task 14 and applying migrations on Windows:

```powershell
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:initial-rules
```

Expected final verifier output:

`15 initial detection rules, all taxonomy categories, severities, logic, thresholds and expected outputs verified.`

The verifier is read-only. It compares the persisted core-rule definitions with the version-controlled catalog and runs the positive/below-threshold/negative scenarios in memory. It does not enable rules, create alerts, modify categories, or print database credentials.


## Completion

Task 14 is Complete. Local Task 14 automated checks passed 16/16, and the
Windows/PostgreSQL acceptance verifier passed on 2026-09-30 with:

`15 initial detection rules, all taxonomy categories, severities, logic, thresholds and expected outputs verified.`

No external API or API key is required.
