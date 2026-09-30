# SentinelX continuation checkpoint

Tasks 01–13 are Complete. Task 14 (Initial Detection Rules) is implemented and is
Verification Pending. Do not begin Task 15 until Task 14's Windows/PostgreSQL gate
passes and Task 14 is explicitly marked Complete.

Task 14 now covers all fifteen approved Task 11 threat categories, including the
eight taxonomy additions requested on 2026-09-30:

- BRUTE_FORCE
- CREDENTIAL_ATTACK
- PRIVILEGE_ESCALATION
- SUSPICIOUS_ACCOUNT_ACTIVITY
- UNAUTHORIZED_ACCESS
- RECONNAISSANCE
- SUSPICIOUS_NETWORK_ACTIVITY
- PHISHING_SOCIAL_ENGINEERING
- MALWARE
- RANSOMWARE
- DENIAL_OF_SERVICE
- DATA_EXFILTRATION
- WEB_APPLICATION_ATTACK
- INSIDER_THREAT
- SUPPLY_CHAIN_COMPROMISE

The version-controlled catalog is `src/rules/initial-rules.js`. Append-only
migration `007_initial_detection_rules.sql` installs one rule per category.
All fifteen rules are seeded disabled so the migration does not silently activate
new production detection policy. Administrators/Security Analysts can enable them
through the existing Task 12 protected rule-management workflow.

The rules use only Task 12/13 schema-v1 fields/operators. Some rules express
behavior directly (for example repeated failed logins); others require explicit
normalized upstream classification (for example `type=malware`,
`type=ransomware`, `type=insider_threat` or
`type=supply_chain_compromise`). Do not broaden those claims beyond the exact
conditions documented in `docs/INITIAL_DETECTION_RULES.md`.

Task 14 test data is in `fixtures/events/initial-rule-scenarios.json`.
`tests/rules/initial-rules.test.js` checks positive, below-threshold and non-match
outputs for every category. Local Task 14 automated checks passed 16/16 before
repository update. `tests/integration/initial-rules.test.js` covers the seed in a
disposable PostgreSQL database.

The local Windows/PostgreSQL acceptance gate is:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:initial-rules
```

Expected final verifier output:

`15 initial detection rules, all taxonomy categories, severities, logic, thresholds and expected outputs verified.`

The verifier is read-only and does not enable rules, create alerts, change category
configuration or print credentials. Task 14 requires no external API or API key.

PostgreSQL remains hosted on the user's Windows computer. Keep actual credentials
private and never expose or commit `.env`. The application reads environment
variables and does not automatically load `.env`.

Migration files remain append-only and checksum tracked. Do not edit applied
migrations 004/005/006/007 or bypass migration checksums after 007 is successfully
applied.

After the Task 14 Windows/PostgreSQL gate passes, update this file,
`DEVELOPMENT_STATUS.md`, and `tasks/14-initial-detection-rules.md` to Complete.
Then proceed only when the user requests Task 15.
