# SentinelX Data Model

## Core Entities
- User
- Role
- SecurityEvent
- DetectionRule
- Alert
- Incident
- InvestigationNote
- ResponseAction
- Notification
- AuditLog
- MITREMapping
- RiskAssessment
- MLAnomalyResult

## Relationship Principles
- Security events can produce alerts.
- Alerts reference the rules that generated them.
- Related alerts can contribute to an incident.
- Incidents contain investigation and response history.
- Users perform authorized actions.
- Security-sensitive actions produce audit records.
- Detection rules may reference threat categories and MITRE mappings.
- ML results are supporting evidence and must not replace the core alert/incident model.

Exact fields, keys, constraints, indexes, and migrations are finalized in Task 04.
