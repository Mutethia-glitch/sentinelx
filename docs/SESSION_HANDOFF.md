# SentinelX continuation checkpoint

Tasks 01–14 are Complete. Task 14 (Initial Detection Rules) passed its
Windows/PostgreSQL acceptance gate on 2026-09-30. Task 15 (Alert Model) remains
Not Started and must not begin until the user requests it.

Task 14 covers all fifteen approved Task 11 threat categories:

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
All fifteen rules are seeded disabled so installation does not silently activate
new production detection policy. Administrators/Security Analysts can review and
enable them through the existing Task 12 protected rule-management workflow.

The rules use only Task 12/13 schema-v1 fields/operators. Some rules express
behavior directly (for example repeated failed logins); others require explicit
normalized upstream classification (for example `type=malware`,
`type=ransomware`, `type=insider_threat` or
`type=supply_chain_compromise`). Do not broaden those claims beyond the exact
conditions documented in `docs/INITIAL_DETECTION_RULES.md`.

Task 14 test data is in `fixtures/events/initial-rule-scenarios.json`.
`tests/rules/initial-rules.test.js` checks positive, below-threshold and non-match
outputs for every category. Local Task 14 automated checks passed 16/16.
`tests/integration/initial-rules.test.js` covers the seed in a disposable
PostgreSQL database.

Windows/PostgreSQL acceptance verification passed on 2026-09-30 with:

`15 initial detection rules, all taxonomy categories, severities, logic, thresholds and expected outputs verified.`

The verifier is read-only and does not enable rules, create alerts, change category
configuration or print credentials. Task 14 requires no external API or API key.

PostgreSQL remains hosted on the user's Windows computer. Keep actual credentials
private and never expose or commit `.env`. The application reads environment
variables and does not automatically load `.env`.

Migration files remain append-only and checksum tracked. Do not edit applied
migrations 004/005/006/007 or bypass migration checksums.

When work resumes, read repository instructions, this handoff,
`docs/DEVELOPMENT_STATUS.md`, and `tasks/15-alert-model.md` before beginning.
Proceed numerically from Task 15 only when requested.
