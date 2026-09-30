# Task 28 — MITRE ATT&CK contextual mapping

Task 28 adds documented ATT&CK context to implemented SentinelX detection rules.
It does **not** claim complete ATT&CK coverage and does not infer adversary intent
from an event simply because a rule has a mapping.

## Persisted mapping model

Migration `015_mitre_tactics_and_core_mappings.sql` adds:
- `mitre_tactics(tactic_id,tactic_name)`;
- `mitre_mapping_tactics(mapping_id,tactic_id)`;
- additional technique catalog rows;
- durable rule→technique associations for selected core rules.

Existing `mitre_mappings` and `rule_mitre_mappings` remain authoritative for
technique and rule associations.

## Mapped core rules

| Core rule | Technique | Tactic |
|---|---|---|
| SX-CORE-001 Brute force authentication failures | T1110 Brute Force | TA0006 Credential Access |
| SX-CORE-002 Credential attack indicators | T1110 Brute Force | TA0006 Credential Access |
| SX-CORE-006 Reconnaissance activity | T1046 Network Service Discovery | TA0007 Discovery |
| SX-CORE-008 Phishing or social engineering report | T1566 Phishing | TA0001 Initial Access |
| SX-CORE-010 Ransomware event | T1486 Data Encrypted for Impact | TA0040 Impact |
| SX-CORE-011 Denial of service indicators | T1498 Network Denial of Service | TA0040 Impact |
| SX-CORE-015 Supply chain compromise classification | T1195 Supply Chain Compromise | TA0001 Initial Access |

These mappings are contextual labels for the implemented detector scenario.
They are not proof that every matching event represents the ATT&CK technique.

## Intentionally unmapped core rules

The following broad scenarios remain unmapped in Task 28 because their current
rule evidence does not identify one precise ATT&CK technique:

- SX-CORE-003 Privilege escalation action
- SX-CORE-004 Suspicious account activity flag
- SX-CORE-005 Repeated unauthorized access attempts
- SX-CORE-007 Suspicious network activity flag
- SX-CORE-009 Malware event
- SX-CORE-012 Data exfiltration event
- SX-CORE-013 Web application attack event — the current rule lacks enough deployment-context evidence for a precise technique association.
- SX-CORE-014 Insider threat classification

This is deliberate. Task 28 favors accurate partial coverage over artificial
complete coverage.

## Application exposure

Existing `GET /api/rules/mitre-mappings` now returns each technique with its
stored tactics. Rule list/detail views expose both `mitreTechniqueIds` and
structured `mitreMappings`.

Incident investigation and incident reports include the structured ATT&CK context
of each linked alert's detection rule. The incident itself does not acquire a new
independent ATT&CK classification; it references the mappings of its evidence.

## Verification

Run:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:mitre
```

Expected:

`Documented partial ATT&CK technique/tactic mappings, core-rule assignments, rule catalog and incident-context propagation verified. Synthetic changes cleaned up.`

After migration 015 is applied, preserve migrations 001–015 under the existing
append-only/checksum rule.
