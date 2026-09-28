# SentinelX Architecture

## Logical Layers
1. Presentation layer
2. API/application layer
3. Detection and security-services layer
4. Data-access layer
5. PostgreSQL database
6. Optional integration boundary
7. Optional machine-learning supporting layer

## Core Processing Flow
1. Security event enters through an approved ingestion interface.
2. Input is validated.
3. Raw evidence is retained.
4. Event is normalized.
5. Enabled detection rules evaluate the normalized event.
6. A matching rule generates an alert.
7. Related alerts may be correlated.
8. An incident may be created.
9. Severity and risk are associated with the incident.
10. An analyst investigates.
11. Authorized response actions are recorded.
12. The incident is resolved and closed.
13. Dashboard and reports consume persisted data.
14. Security-sensitive actions are recorded in the audit trail.

## Architectural Rules
- Backend authorization is mandatory.
- Detection logic must be independently testable.
- ML supports, not replaces, deterministic detection.
- Database access remains behind the application's data-access layer.
- External integrations are optional and isolated.
- Secrets must never be committed.
- Events, alerts, and incidents remain separate concepts.
- Response actions must be controlled and auditable.
