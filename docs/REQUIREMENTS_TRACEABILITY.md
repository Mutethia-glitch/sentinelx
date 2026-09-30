# SentinelX Requirements Traceability

This document maps the approved requirements baseline to the numbered implementation tasks. Requirement definitions and verification methods are maintained in `docs/REQUIREMENTS_BASELINE.md`.

## Detailed Requirement Traceability

| Requirement IDs | Requirement Area | Primary Tasks |
|---|---|---:|
| NFR-002 | Project foundation and secret handling | 01, 35, 41 |
| FR-026 | Authentication | 05 |
| FR-027, FR-028, NFR-003 | Role-based access control and protected operations | 05–06, 35 |
| FR-001–FR-004, FR-029–FR-030 | Security events, authorized sources, ingestion, normalization, persistence | 07–10 |
| FR-011 | Threat levels/categories | 11, 19–20 |
| FR-005–FR-007, NFR-006 | Detection rules and deterministic detection | 12–14 |
| FR-007–FR-008 | Alerts | 15–16 |
| FR-009–FR-010 | Alert/event correlation | 17 |
| FR-010, FR-012, FR-013, FR-014, FR-017, FR-018, FR-020, FR-021, FR-022, FR-023 | Incident lifecycle and status invariants | 18–19, 22 |
| FR-011–FR-012, FR-023 | Risk/threat assessment | 19–20 |
| FR-019–FR-020 | Investigation | 21 |
| FR-015–FR-018, FR-021–FR-025, NFR-009–NFR-010 | Controlled response | 22, 27, 35 |
| FR-034 | Notifications | 23 |
| FR-032 | Dashboard | 24, 36 |
| FR-008, FR-031 | Search and filtering | 25 |
| FR-033, FR-036 | Reporting | 26, 40, 43 |
| FR-024–FR-025, FR-036 | Audit trail | 27, 40, 43 |
| FR-035 | MITRE ATT&CK mapping | 28 |
| NFR-012–NFR-013 | Optional machine-learning supporting layer | 29–33 |
| NFR-014 | Optional external integration boundary | 34 |
| NFR-003, NFR-004, NFR-005, NFR-010 | API security | 35 |
| NFR-011, NFR-017 | Frontend security, truthful UX, and visual presentation | 24–28, 36–37 |
| NFR-007 | Automated verification | 38–40, 43 |
| NFR-008–NFR-009 | Authorized/synthetic security testing | 39–40 |
| FR-036 | End-to-end core workflow validation | 40, 43 |
| NFR-001, NFR-002 | Deployment/configuration constraints | 04, 41 |
| NFR-007 | Observability/recovery verification where defined | 42–43 |
| NFR-016 | One-semester core-first scope | 01–44 |
| NFR-015, NFR-018 | Data-access boundary and separation of security domain concepts | 03–04, 07, 15, 18–22, 27 |

## Task Area Index

| Requirement Area | Primary Tasks |
|---|---:|
| Project foundation | 01 |
| Requirements baseline | 02 |
| Architecture | 03 |
| Database | 04 |
| Authentication | 05 |
| Role-based access control | 06 |
| Security events | 07–10 |
| Threat categories | 11 |
| Detection rules | 12–14 |
| Alerts | 15–16 |
| Alert correlation | 17 |
| Incident management | 18–19 |
| Risk assessment | 20 |
| Investigation | 21 |
| Response | 22 |
| Notifications | 23 |
| Dashboard | 24 |
| Search and filtering | 25 |
| Reporting | 26 |
| Audit trail | 27 |
| MITRE ATT&CK | 28 |
| Machine-learning extension | 29–33 |
| External integration boundary | 34 |
| API security | 35 |
| Frontend security and UX | 36 |
| Frontend visual design and polish | 37 |
| Automated testing | 38 |
| Security testing | 39 |
| End-to-end validation | 40 |
| Deployment | 41 |
| Observability and recovery | 42 |
| Final validation | 43 |
| Technical handoff | 44 |

## Traceability Rule

Every approved requirement must be assigned to an implementation task before development begins. Changes to requirements must update both `docs/REQUIREMENTS_BASELINE.md`, the affected task/documentation, and this traceability document.
