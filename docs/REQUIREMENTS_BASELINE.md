# SentinelX Requirements Baseline

## 1. Purpose and Authority

This document is the Task 02 requirements baseline for **IPHYN's Intelligent Cybersecurity Incident Detection and Response System (SentinelX)**.

It converts the approved SentinelX project specification and agreed project scope into explicit, numbered, traceable, and testable requirements. Later implementation tasks must conform to this baseline. Where older repository wording conflicts with the approved project decisions captured in this baseline, the baseline governs until an explicit approved revision is made.

Working academic assumption: **one-semester project**. The complete core system takes priority over advanced extensions.

## 2. System Boundary

SentinelX is a centralized cybersecurity incident detection and response system. The web frontend is a management and visualization layer; it does not define the security architecture.

SentinelX is not an antivirus, penetration-testing framework, vulnerability scanner, firewall, malware sandbox, offensive-security platform, or full enterprise SIEM/SOAR replacement.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

Important security and administrative actions are additionally recorded in the audit trail.

## 3. Functional Requirements

| ID | Requirement | Verification | Primary Task(s) |
|---|---|---|---|
| FR-001 | SentinelX shall accept security events only through approved ingestion interfaces. | Integration test with valid and invalid ingestion requests. | 07–08 |
| FR-002 | SentinelX shall validate incoming security-event data before processing it. | Validation tests reject malformed/invalid events. | 08 |
| FR-003 | SentinelX shall normalize accepted security events into the SentinelX event representation while retaining necessary source evidence. | Unit/integration test compares raw input and normalized output. | 07–09 |
| FR-004 | SentinelX shall persist accepted security events for authorized retrieval and analysis. | Persistence and retrieval integration test. | 04, 07–10 |
| FR-005 | SentinelX shall provide deterministic, explainable rule-based detection as the core detection mechanism. | Rule tests demonstrate repeatable matches/non-matches and recorded reasons. | 12–14 |
| FR-006 | Authorized users shall be able to manage supported detection-rule configuration, including enabling and disabling rules. | Authorization and rule-management tests. | 12–14 |
| FR-007 | A detection that satisfies alert criteria shall create an alert linked to the relevant event evidence and detection rule. | Event-to-alert integration test. | 13, 15–16 |
| FR-008 | SentinelX shall support authorized retrieval, filtering, and management of alerts. | API/UI tests for permitted alert operations. | 15–16, 25 |
| FR-009 | SentinelX shall correlate related alerts/events according to defined correlation criteria without merging the underlying event, alert, and incident concepts. | Correlation tests with related and unrelated inputs. | 17 |
| FR-010 | SentinelX shall create or associate an incident when defined incident criteria are met. | Alert/correlation-to-incident integration test. | 17–19 |
| FR-011 | SentinelX shall assign and retain a threat level of LOW, MEDIUM, HIGH, or CRITICAL according to defined criteria. | Tests cover all four allowed threat levels and reject unsupported values. | 11, 19–20 |
| FR-012 | SentinelX shall track incident status independently from threat level. | State-transition tests verify status changes do not overwrite threat level. | 18–20 |
| FR-013 | Supported incident statuses shall be NEW, CONTAINED, INVESTIGATING, RESOLVED, and DISMISSED. | Model/API tests accept only the approved statuses. | 18 |
| FR-014 | A newly created incident shall begin in NEW unless a later task defines an explicitly approved creation rule consistent with this baseline. | Incident-creation test. | 18 |
| FR-015 | SentinelX shall not automatically contain every detected alert or incident; the core response model requires an authorized security-team decision. | End-to-end test verifies detection alone does not execute containment. | 18, 22, 35 |
| FR-016 | SentinelX shall permit an authorized user to record or initiate an approved containment action when appropriate. | Authorization and controlled-response test. | 22 |
| FR-017 | An incident shall become CONTAINED only when an approved containment action has been successfully performed and recorded. | Response/state-transition test including failed containment. | 18, 22 |
| FR-018 | CONTAINED shall not mean RESOLVED; containment shall not automatically resolve an incident. | State-transition test. | 18, 22 |
| FR-019 | SentinelX shall support investigation of an incident, including approved evidence/notes and investigation history. | Investigation workspace/API tests. | 21 |
| FR-020 | SentinelX shall support moving an incident to INVESTIGATING while authorized personnel determine cause, scope, evidence, or remediation. | Authorized transition test. | 18, 21 |
| FR-021 | SentinelX shall permit RESOLVED only after the underlying issue has been handled and the authorized workflow records the resolution. | Resolution workflow test. | 18, 22 |
| FR-022 | SentinelX shall permit DISMISSED for incidents determined through the authorized workflow not to require further incident handling, including verified false positives. | Dismissal authorization/state test. | 18, 22 |
| FR-023 | Changing an incident status, including to RESOLVED or DISMISSED, shall not automatically erase or downgrade its recorded threat level. | Persistence/state-transition test. | 18–20 |
| FR-024 | SentinelX shall record important security, administrative, incident-status, and response actions in an audit trail. | Audit integration tests verify actor/action/time/context records. | 27 |
| FR-025 | Response records shall identify the selected action, responsible user/actor, time, reason where required, and result. | Response/audit record test. | 22, 27 |
| FR-026 | SentinelX shall provide authentication for protected user-facing system functions. | Authentication tests for protected resources. | 05 |
| FR-027 | SentinelX shall enforce role-based authorization on the backend for protected operations. | Positive/negative authorization tests. | 06, 35 |
| FR-028 | SentinelX shall support organization/user management needed by the approved case-study environment. | Authorized management tests. | 05–06 |
| FR-029 | SentinelX shall support registration and identity of authorized endpoints/agents used by the controlled environment. | Enrollment/identity tests. | 07–08 and applicable endpoint/agent tasks |
| FR-030 | Authorized SentinelX agents shall be able to deliver configured security telemetry securely to the Sentinel Server. | Controlled agent-to-server integration test. | Applicable event-ingestion/agent implementation tasks |
| FR-031 | SentinelX shall provide authorized search and filtering over supported security records. | Search/filter tests including authorization boundaries. | 25 |
| FR-032 | SentinelX shall provide security dashboard information derived from implemented backend capabilities and persisted data. | Dashboard/API integration tests. | 24, 36 |
| FR-033 | SentinelX shall produce supported incident/security reports from persisted system data. | Reporting tests against known test data. | 26 |
| FR-034 | SentinelX shall support notifications defined by the approved notification task without making notification delivery a substitute for incident handling. | Notification behavior tests. | 23 |
| FR-035 | SentinelX shall support MITRE ATT&CK mapping as contextual information for supported detections where implemented. | Mapping association/retrieval tests. | 28 |
| FR-036 | The final demonstrable system shall support the end-to-end core path from event ingestion through reporting, with important actions represented in the audit trail. | Controlled end-to-end scenario. | 39, 42 |

## 4. Non-Functional and Security Requirements

| ID | Requirement | Verification | Primary Task(s) |
|---|---|---|---|
| NFR-001 | PostgreSQL shall be the SentinelX database. Supabase shall not be introduced. | Configuration/dependency review. | 04 |
| NFR-002 | Secrets and credentials shall be supplied through environment/configuration mechanisms and shall not be committed to source control. | Repository/secret scan and configuration review. | 01, 35, 40 |
| NFR-003 | Protected API operations shall authenticate and authorize requests on the backend rather than trusting frontend state. | API security tests. | 05–06, 35 |
| NFR-004 | API inputs shall be validated before use. | Negative validation tests. | 08, 35 |
| NFR-005 | Protected responses shall not expose passwords, authentication tokens, secrets, stack traces, or records the requester is not authorized to access. | Security tests. | 35–36, 38 |
| NFR-006 | Detection logic shall be independently testable and deterministic for identical rule/input conditions. | Repeatable unit tests. | 13–14, 37 |
| NFR-007 | Important security behavior shall have automated or documented verification; rendering alone shall not constitute completion. | Test-suite and completion-gate review. | 37–39, 42 |
| NFR-008 | Security testing shall use synthetic data or explicitly authorized systems/environments. | Test-plan review and controlled test evidence. | 38–39 |
| NFR-009 | SentinelX shall not include offensive-security tooling or destructive response actions in the core project. | Scope/code review. | 22, 38, 42 |
| NFR-010 | Response actions shall be controlled, authorized, and auditable. | Authorization, response, and audit tests. | 22, 27, 35 |
| NFR-011 | The frontend shall represent implemented backend capabilities and shall not define or fabricate security capabilities. | Architecture/API/UI traceability review. | 03, 24–28, 36 |
| NFR-012 | The core system shall remain usable without machine-learning features. | Core end-to-end test with ML disabled/absent. | 29–33, 39 |
| NFR-013 | Any ML capability shall support rather than replace deterministic detection. | Architecture and integration tests/review. | 29–33 |
| NFR-014 | External SIEM/log integrations shall remain optional and isolated from the standalone SentinelX core. | Architecture/integration-boundary review. | 34 |
| NFR-015 | Database access shall remain behind the application's data-access boundary rather than being driven directly by the frontend. | Architecture/code review. | 03–04, 35–36 |
| NFR-016 | The implementation shall prioritize a complete core workflow within the working one-semester scope before advanced capabilities. | Roadmap/scope review. | 01–43 |
| NFR-017 | The operational security console shall prioritize practical security information and workflows; optional 3D presentation shall not control the security architecture. | UI/architecture review. | 24–28, 36 |
| NFR-018 | The system shall preserve separation between SecurityEvent, Alert, Incident, threat level/risk, investigation history, response history, and audit records. | Architecture/data-model review and integration tests. | 03–04, 07, 15, 18–22, 27 |

## 5. Lifecycle Invariants

These rules are mandatory across later data-model, API, frontend, and test implementations:

1. **Incident status and threat level are separate dimensions.**
2. Approved threat levels are **LOW, MEDIUM, HIGH, CRITICAL**.
3. Approved incident statuses are **NEW, CONTAINED, INVESTIGATING, RESOLVED, DISMISSED**.
4. **CONTAINED does not mean RESOLVED.**
5. Containment does not automatically change the recorded threat level.
6. Resolution does not automatically downgrade or erase the recorded threat level.
7. Detection does not automatically authorize containment.
8. Response actions require the authorization defined by later RBAC/response tasks and must be auditable.
9. Events, alerts, and incidents remain distinct records/concepts even when linked.
10. Important status changes and response actions must be attributable through the audit trail.

## 6. Core vs Advanced Scope

### Core
The core includes PostgreSQL-backed server functionality, authentication/RBAC, authorized endpoint/event handling, validation and normalization, deterministic rule detection, alerts, correlation, incidents, threat/risk assessment, investigation, controlled response, audit logging, reporting, the SOC interface, testing, and deployment required for the approved end-to-end demonstration.

### Advanced / Optional
The following remain extensions and must not block completion of the core:
- machine-learning anomaly detection;
- advanced behavioral analytics;
- threat-intelligence integration;
- external SIEM integrations;
- SOAR-style automation;
- expanded endpoint telemetry;
- additional enterprise integrations.

## 7. Change Control

Requirements shall not be silently changed by later implementation work. A material requirement change must:
1. be explicitly approved;
2. update this baseline;
3. update `docs/REQUIREMENTS_TRACEABILITY.md`;
4. update affected task contracts/documentation where necessary; and
5. preserve the project scope guardrails unless an explicit scope revision is approved.

## 8. Task 02 Acceptance Check

- [x] Functional requirements are explicitly numbered.
- [x] Non-functional/security requirements are explicitly numbered.
- [x] Requirements include a verification method and implementation-task trace.
- [x] Requirements preserve the approved SentinelX workflow and terminology.
- [x] PostgreSQL is retained and Supabase is excluded.
- [x] Deterministic detection remains the core detection foundation.
- [x] Human-authorized response remains the default core response model.
- [x] Incident status and threat level are independent.
- [x] Containment and resolution remain distinct.
- [x] Core and advanced/optional scope are separated.
- [x] No database schema or later-task implementation has been introduced by Task 02.
