# SentinelX System Architecture

## 1. Architectural Purpose

SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. It is a cybersecurity system whose frontend is a management and visualization layer over the security core.

This architecture is intentionally a **layered modular application**, not a collection of unnecessary microservices. The design supports the approved one-semester core while keeping later advanced capabilities isolated.

The canonical workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

Audit recording crosses the workflow wherever security-sensitive, administrative, status-change, or response activity occurs.

## 2. Logical Architecture

### 2.1 Presentation Layer
Responsibilities:
- SOC dashboard and operational views;
- events, alerts, incidents, investigation, response, reports, rules, endpoints, and audit views as later tasks implement them;
- presentation of data received through approved APIs.

Rules:
- the frontend does not access PostgreSQL directly;
- the frontend does not make authorization decisions authoritative;
- the frontend must not display invented backend capabilities;
- optional public/3D presentation remains outside the operational security logic.

### 2.2 API / Application Layer
Responsibilities:
- expose approved SentinelX interfaces;
- authenticate callers where required;
- enforce backend authorization;
- validate request shape and application-level commands;
- coordinate use cases across security services and persistence;
- return sanitized responses.

This layer is the entry boundary for user/API requests and approved agent/event ingestion interfaces.

### 2.3 Security Services Layer
The core domain/security services are logically separated so they can be tested independently:

**Event ingestion service**
- accepts events from approved sources;
- validates required input;
- passes accepted data into normalization/persistence.

**Normalization service**
- converts accepted source events into the canonical SentinelX event representation;
- preserves necessary source evidence.

**Detection service**
- evaluates normalized events against enabled deterministic rules;
- records explainable match evidence/reasons;
- does not depend on ML to function.

**Alert service**
- creates and manages alerts produced by qualifying detections;
- maintains links to event evidence and detection rules.

**Correlation service**
- evaluates related events/alerts using defined correlation criteria;
- preserves events, alerts, and incidents as separate concepts.

**Incident service**
- creates and manages incidents;
- enforces the approved incident lifecycle;
- keeps incident status independent from threat level.

**Risk/threat assessment service**
- assigns/maintains the approved threat level: LOW, MEDIUM, HIGH, or CRITICAL;
- does not use lifecycle status as a substitute for threat level.

**Investigation service**
- manages authorized investigation notes/evidence/history associated with incidents.

**Response service**
- accepts only authorized, supported response decisions;
- records response reason/result as required;
- does not automatically contain every detection;
- excludes destructive/offensive response actions from the core.

**Audit service**
- records important security, administrative, status-change, and response actions with attributable context.

**Reporting/query services**
- provide supported dashboard, search, filtering, reporting, and audit-query data from persisted SentinelX records.

### 2.4 Data-Access Layer
Responsibilities:
- isolate persistence operations from presentation and domain logic;
- provide repository/data-access interfaces for later PostgreSQL-backed implementation;
- maintain transactional consistency where later tasks require linked security records.

Exact tables, fields, constraints, indexes, migrations, ORM/query tooling, and transaction implementation belong to **Task 04**, not Task 03.

### 2.5 PostgreSQL
PostgreSQL is the approved persistent database. Supabase is not part of SentinelX.

The database will persist the approved domain records defined by later data-model tasks. The frontend never communicates with PostgreSQL directly.

### 2.6 Optional Integration Boundary
External SIEM/log or other approved integrations are isolated adapters. The standalone SentinelX core must function without them.

### 2.7 Optional ML Supporting Layer
Machine-learning anomaly detection is an advanced supporting capability only. It may contribute evidence/signals later but must not replace deterministic rule evaluation or the core alert/incident model.

## 3. Runtime Data Flow

### Stage 1 — Security Event
1. An authorized/configured source or Sentinel agent produces or collects a supported security event.
2. The event reaches an approved SentinelX ingestion interface.
3. The API/application boundary validates the request/source as required.
4. Invalid input is rejected; accepted input proceeds without trusting client-side validation.

### Stage 2 — Normalization
5. Necessary raw/source evidence is retained.
6. The normalization service maps the accepted event into the canonical SentinelX event form.
7. The event is persisted through the data-access layer.

### Stage 3 — Detection
8. The deterministic detection service evaluates the normalized event against enabled rules.
9. A rule match records the relevant rule/evidence/reason.
10. ML is not required for this evaluation.

### Stage 4 — Alert
11. When defined alert criteria are satisfied, an Alert is created and linked to its detection/event evidence.
12. Detection does **not** itself execute containment.

### Stage 5 — Correlation
13. Correlation evaluates whether related events/alerts represent a larger security issue.
14. Correlation links evidence while preserving the underlying records.

### Stage 6 — Incident
15. When defined incident criteria are satisfied, an Incident is created or associated with the correlated security evidence.
16. The incident receives/retains an approved threat level.
17. A new incident begins in NEW under the baseline lifecycle unless an explicitly approved later rule states otherwise.

### Stage 7 — Investigation
18. An authorized security-team user reviews the incident and available evidence.
19. Investigation notes/evidence/history are recorded through the application boundary.
20. The incident may move to INVESTIGATING as the team determines cause, scope, evidence, and remediation.

### Stage 8 — Response
21. The authorized security team decides what supported response is appropriate.
22. SentinelX validates authorization before executing/recording the supported action.
23. If approved containment is selected and succeeds, the incident may become CONTAINED.
24. A failed containment action must not falsely mark the incident CONTAINED.
25. Containment does not automatically resolve the incident.
26. The response and important state changes are audit-recorded.

### Stage 9 — Resolution / Dismissal
27. After the underlying issue is handled and the authorized workflow records completion, the incident may become RESOLVED.
28. A verified false positive or incident not requiring further handling may become DISMISSED through the authorized workflow.
29. Neither resolution nor dismissal automatically erases or downgrades the recorded threat level.

### Stage 10 — Reporting
30. Dashboard/query/reporting services consume persisted security records.
31. Supported reports summarize the incident/security history.
32. Important actions remain attributable through the audit trail.

## 4. Incident State and Threat-Level Invariants

Approved incident statuses:
- **NEW**
- **CONTAINED**
- **INVESTIGATING**
- **RESOLVED**
- **DISMISSED**

Approved threat levels:
- **LOW**
- **MEDIUM**
- **HIGH**
- **CRITICAL**

Architectural invariants:
1. status and threat level are independent;
2. CONTAINED is not RESOLVED;
3. containment does not automatically change threat level;
4. resolution does not automatically downgrade threat level;
5. detection does not automatically authorize containment;
6. important transitions and response actions are auditable.

A separate `CLOSED` incident status is **not** part of the approved baseline. Repository/API wording such as “resolve/close” is interpreted as completing the approved resolution/dismissal workflow, not as introducing an additional status.

## 5. Trust and Authorization Boundaries

### User ↔ SentinelX API
- protected operations require authentication;
- authorization is enforced server-side;
- input is validated;
- responses are sanitized and scoped to authorized records.

### Agent/Event Source ↔ Ingestion Boundary
- only approved/authorized sources are accepted as later enrollment/identity tasks define;
- event payloads are treated as untrusted input and validated;
- secure transport/credential details are finalized by their implementation tasks.

### Application ↔ PostgreSQL
- database access occurs through the data-access layer;
- database credentials remain server-side environment/configuration secrets;
- no direct browser-to-database architecture is permitted.

### SentinelX Core ↔ Optional Integrations
- adapters isolate external dependencies;
- an unavailable optional integration must not replace or redefine the standalone core.

## 6. Planned Code Structure

Task 03 defines architectural placement, not later feature implementation. As implementation tasks add code, they should converge on a structure equivalent to:

```text
src/
  api/                 # HTTP/API boundary, request validation and routing
  auth/                # authentication and authorization services
  events/              # event model/use cases and ingestion coordination
  normalization/       # canonical event normalization
  detection/           # deterministic rules and evaluation
  alerts/              # alert lifecycle/use cases
  correlation/         # event/alert correlation
  incidents/           # incident lifecycle and transitions
  risk/                # threat/risk assessment
  investigation/       # investigation notes/evidence workflows
  response/            # controlled authorized response workflows
  audit/               # audit recording/query behavior
  reporting/           # reports/dashboard query services
  data/                # persistence interfaces/repositories
  integrations/        # optional external adapters
  ml/                  # optional advanced supporting layer
frontend/              # SOC/public presentation as later tasks define
tests/                 # unit/integration/end-to-end tests
```

Exact framework-specific directories may vary when the implementation stack is introduced, but the logical boundaries above must remain recognizable. Task 03 does not create placeholder feature implementations merely to satisfy this diagram.

## 7. Dependency Direction

The intended dependency direction is:

```text
Presentation
     ↓
API / Application
     ↓
Domain & Security Services
     ↓
Data-Access Interfaces
     ↓
PostgreSQL
```

Optional integrations and ML connect through defined service/adaptor boundaries rather than becoming mandatory dependencies of the core.

Cross-cutting authentication/authorization, validation, configuration, and audit behavior apply at the appropriate application/service boundaries.

## 8. Architectural Decisions

- **Layered modular architecture:** appropriate to the one-semester scope and avoids unnecessary distributed-system complexity.
- **PostgreSQL persistence:** fixed project constraint; no Supabase.
- **Backend-controlled security:** clients cannot be trusted to enforce authorization or security state.
- **Deterministic detection first:** explainable rule evaluation is the core detection foundation.
- **Human-controlled response:** detection produces security signals; authorized personnel choose supported response actions.
- **Audit as cross-cutting security behavior:** important actions are attributable rather than merely reflected in current UI state.
- **Frontend follows backend:** operational UI is adapted to implemented APIs/workflows.
- **Advanced features are isolated:** ML and external integrations can be added later without redesigning the core.

## 9. Architecture-to-Requirement Trace

This architecture directly implements the constraints established by `docs/REQUIREMENTS_BASELINE.md`, particularly:
- event pipeline: FR-001–FR-010;
- incident/threat lifecycle: FR-011–FR-023;
- audit and response: FR-024–FR-025;
- authentication/authorization: FR-026–FR-030;
- query/reporting: FR-031–FR-036;
- database/security boundaries: NFR-001–NFR-010, NFR-015, NFR-018;
- frontend/core separation: NFR-011 and NFR-017;
- advanced-feature isolation: NFR-012–NFR-014;
- core-first project scope: NFR-016.

## 10. Task 03 Acceptance Check

- [x] The architecture documents the approved layered design.
- [x] The full Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting flow is represented.
- [x] Audit behavior is represented across security-sensitive actions.
- [x] Incident status and threat level are explicitly separated.
- [x] Human-controlled response is preserved.
- [x] PostgreSQL and the data-access boundary are preserved without implementing Task 04.
- [x] Frontend responsibilities do not drive the security architecture.
- [x] Optional ML/integration capabilities are isolated from the core.
- [x] The planned code/module structure maps directly to the documented architecture.
- [x] No unnecessary microservices or later-task feature implementations were introduced.

## Task 05 runtime mapping

The first runtime slice follows the approved boundaries: `src/api/server.js` and
`auth-handler.js` expose authentication routes; `src/auth/` owns validation,
password hashing, sessions and login throttling; `src/data/pool.js` and
`auth-repository.js` isolate parameterized PostgreSQL persistence and transactions.
The existing `src/data/postgres.js` remains the migration-client boundary. No
frontend, RBAC policy or later security pipeline behavior is introduced here.

## Task 06 runtime mapping

`src/access/` defines the permission policy and access use cases; the access API
handler enforces the authenticated cookie boundary and origin/JSON checks;
`src/data/access-repository.js` owns live role queries and transactional role
changes. `frontend/access/` is a minimal role-management view of these APIs.
The backend remains authoritative. Later security modules must use the policy
checks when their task introduces an operation; no later pipeline behavior is
implemented by the reserved permission vocabulary.

## Task 09 normalization boundary
The normalization service maps two explicit simulated formats into the canonical event model and retains raw evidence. The raw ingestion endpoint applies live session/RBAC and source approval, then persists the normalized event and audit transactionally. It does not invoke detection. See [LOG_NORMALIZATION.md](LOG_NORMALIZATION.md).

## Task 12 rule configuration boundary
The rules service validates a finite declarative schema and uses transactionally audited PostgreSQL repositories for creation, version-protected edits and optional MITRE associations. Protected rule management APIs do not execute event streams. The deterministic execution engine remains Task 13; no enabling action currently creates alerts or responses. See [DETECTION_RULES.md](DETECTION_RULES.md).


## Task 17 runtime mapping

The correlation service now runs after a new alert is persisted and before any
incident workflow. It evaluates the new alert against prior alerts within the
documented 900-second window, persists only explainable pairwise relationships,
and derives groups as connected components. Production ingestion passes the same
database transaction client through detection and correlation so correlation-stage
failure is not silently ignored.

Correlation preserves SecurityEvent, Alert and Incident as separate concepts and
does not create incidents in Task 17. See [CORRELATION_ENGINE.md](CORRELATION_ENGINE.md).


## Task 18 runtime mapping

The Incident service now sits after correlation as a distinct application/domain layer. Authorized incident managers create incidents from one or more existing alerts, preserving the alert records and links rather than merging them. Creation derives only an initial severity from linked alert severity; Task 19 owns later controlled classification/severity adjustment.

The service enforces the Task 02 baseline lifecycle: NEW, INVESTIGATING, CONTAINED, RESOLVED and DISMISSED. Direct CONTAINED mutation is intentionally unavailable until Task 22 can prove a successful approved response action. Creation, assignment and allowed status transitions are audit-recorded transactionally. See [INCIDENT_MANAGEMENT.md](INCIDENT_MANAGEMENT.md).


## Task 19 runtime mapping

Incident classification/severity remains inside the Incident service and uses the shared Task 11 taxonomy. The service exposes an authorized assessment operation that updates category/severity independently from lifecycle state and records old/new values in the audit trail. No independent priority taxonomy is introduced. The Risk service remains unimplemented until Task 20.


## Task 20 runtime mapping

The Risk service is now implemented as a deterministic formula over persisted
incident severity and distinct linked evidence-event count. PostgreSQL stores the
factor count and generates the 0–100 score, while `src/risk/engine.js` provides
the same versioned formula for application/tests.

Risk is read-only derived context; it does not replace incident severity,
classification, lifecycle, investigation, or response decisions. Unimplemented
confidence/asset-impact inputs are not fabricated.


## Task 21 runtime mapping

The Investigation service is now implemented between Incident and Response. It reads existing incident-alert-event evidence, aggregates affected entities, combines evidence and incident history into a deterministic timeline, and persists append-only analyst findings in the core `investigation_notes` table.

Investigation write authorization is independent from general incident viewing: Viewer/Management can read investigation context, while Administrator/Security Analyst users can record findings through `investigations.write`.

Task 21 does not execute containment or other response actions; that remains Task 22.

## Task 22 runtime mapping

Response stage is implemented as a separate service/repository/HTTP handler. It reuses approved response_actions and the incident status audit trail, with existing permission names responses.read and responses.execute. Response history is shown in the incident inspection UI and as incident-targeted history in the investigation timeline.

This stage records explicit human-reported actions only: containment, escalation, follow-up tasks and communication. A successful human-confirmed manual containment transaction may change NEW/INVESTIGATING to CONTAINED. It never automatically disables an account, deletes data, blocks a host, or delivers a notification. Task 23 owns notification delivery. See [RESPONSE_WORKFLOW.md](RESPONSE_WORKFLOW.md).

## Task 23 in-app notification boundary

A dedicated Notification service/repository/API supplies explicit severity-aware
dispatch, private recipient inbox, read acknowledgment and atomic delivery/read
audits. It operates on Task 01's notifications table extended by migration 014,
not on the manual response_actions table. Notification delivery commits in
PostgreSQL; no SMTP/email, background queues, speculative delivery status,
automatic containment or external endpoint action is claimed. Critical/high
unread messages appear first in the web inbox. See [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Task 24 read-only dashboard boundary

A dedicated Dashboard service/repository/API and `/dashboard` presentation are
implemented using the existing `dashboard.read` permission. One repeatable-read,
read-only PostgreSQL transaction collects event, alert, incident, threat/severity,
time-series and recorded response metrics from persisted data. No dashboard write
path, background ingestion, metric cache, external analytics service, or new table
is introduced.

The dashboard belongs to the presentation/report-query layer, not the detection
engine. It never substitutes for individual alert/incident evidence, Task 25
search/filtering, or Task 26 reports. See [DASHBOARD.md](DASHBOARD.md).

## Task 25 shared protected search layer

The event, alert and incident listing services retain their own live reader
permissions while delegating query parameter parsing to the shared
`src/search/filters.js` validator. Repository queries use bound parameters
and EXISTS relationships through the existing alert_events, incident_alerts,
rule_mitre_mappings and mitre_mappings tables. Multiple evidence constraints
match one relevant linked alert/event chain; there is no global unauthenticated
search route, denormalized copy, new migration or external indexing provider.

See [SEARCH_FILTERING.md](SEARCH_FILTERING.md). Task 26 remains responsible for
report generation and exports.

## Task 26 reporting boundary

Reporting is a read-only application layer over persisted SentinelX records.
Security summaries and incident reports share existing report-read authorization
and do not introduce a report cache, external analytics vendor, or mutation path.
See [REPORTING.md](REPORTING.md).

## Task 27 protected audit retrieval

Existing transactional audit writes remain distributed with the security-sensitive workflows that own them. Task 27 adds a centralized read-only Audit repository/service/API and console over `audit_logs`, authorized by `audit.read`. It does not duplicate or rewrite audit events.

## Task 28 ATT&CK contextual layer

ATT&CK remains contextual metadata attached to detection rules. Migration 015
adds tactic metadata and documented partial mappings for implemented core rules.
Incident views inherit this context only through linked alert/rule evidence; the
incident model is not replaced by ATT&CK. See [MITRE_MAPPING.md](MITRE_MAPPING.md).

## Task 29 research dataset boundary

Task 29 is an offline research fixture, not a production data path. A pure
deterministic generator creates normalized-style synthetic records plus explicit
research labels. It does not read PostgreSQL, ingest into SentinelX, or replace
the canonical event model. Task 30 owns later feature engineering.
