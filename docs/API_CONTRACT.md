# SentinelX API Contract

This is the high-level contract. Exact endpoint paths and schemas are finalized during implementation and kept consistent thereafter.

## Event APIs
- Ingest security event
- Retrieve event
- Search/filter events

## Detection APIs
- List detection rules
- Create/update detection rule
- Enable/disable detection rule
- Review detection results where applicable

## Alert APIs
- List alerts
- Retrieve alert
- Filter alerts
- Update approved alert state

## Incident APIs
- List incidents
- Create/retrieve incident
- Assign incident
- Update incident state
- Add investigation evidence/notes
- Record controlled response action
- Resolve or dismiss incident through the approved lifecycle

## Reporting APIs
- Dashboard metrics
- Incident reports
- Security summaries
- Audit records

## Security Requirements
All protected endpoints enforce authentication and authorization server-side.

Responses must not expose passwords, authentication tokens, secrets, stack traces, or unauthorized records.

## Implemented authentication API (Task 05)

- `POST /api/auth/login`: exact JSON email/password, matching Origin; sets an HttpOnly session cookie and returns only safe user identity.
- `GET /api/auth/me`: authenticates the session cookie and returns only the current user's id, email and display name.
- `POST /api/auth/logout`: matching Origin, session cookie and empty JSON object; revokes the session and clears the cookie.

See `docs/AUTHENTICATION.md` for statuses, expiry, safeguards and Windows setup. Task 06 access routes and the permission matrix are documented in `docs/ACCESS_CONTROL.md`.

## Implemented access-control API (Task 06)

- `GET /api/access/me`: current authenticated identity, approved roles and policy grants.
- `GET /api/access/users`: Administrator-only safe user list, limited to 100.
- `GET /api/access/roles`: Administrator-only approved role catalog.
- `PUT /api/access/users/{uuid}/roles`: Administrator-only role replacement, approved unique roles and reason, exact Origin.

Role changes are audited and revoke the target's sessions. Removing the last
active Administrator returns 409. Browser controls at `/access` reflect these
backend checks. Reserved permissions do not imply later APIs already exist.

## Task 08 implemented event ingestion
POST /api/events accepts one canonical event from an approved source, with session authentication, events.ingest permission and exact Origin. HTTP 201 returns only the event receipt; validation/authorization/body boundaries reject invalid requests. See [EVENT_INGESTION.md](EVENT_INGESTION.md). Other event APIs remain future tasks.

## Task 09 implemented raw-event normalization
POST /api/events/raw accepts an explicit supported format/source/rawData envelope. The existing ingestion security boundaries apply; supported events normalize and persist with preserved raw evidence, and malformed/unsupported inputs return 400 without persistence. See [LOG_NORMALIZATION.md](LOG_NORMALIZATION.md).

## Task 10 implemented event viewing
GET /api/events provides validated event-specific filters and bounded 50-record pages. GET /api/events/{uuid} returns event inspection with normalized data and raw evidence. Both require a live events.read grant. See [EVENT_MANAGEMENT.md](EVENT_MANAGEMENT.md) and [LOCAL_API_GUIDE.md](LOCAL_API_GUIDE.md).

## Task 11 threat catalog
GET /api/threat-categories supports the validated selectable filter for approved readers. PATCH /api/threat-categories/{CODE} configures label/description/availability with Administrator authorization, exact Origin and transactional audit. See [THREAT_CATEGORIES.md](THREAT_CATEGORIES.md).

## Task 12 rule management
GET/POST /api/rules, GET/PUT /api/rules/{uuid}, GET /api/rules/mitre-mappings and POST /api/rules/validate provide bounded rule configuration, version-protected updates and structural/reference validation. Admin/Analyst grants are required; Viewer cannot access rule definitions. See [DETECTION_RULES.md](DETECTION_RULES.md).

## Task 13 deterministic detection
Successful canonical or raw event ingestion evaluates enabled schema-v1 rules against the normalized event. Matching rules use their configured event-time window, threshold and group fields and persist an alert plus alert-event evidence links. The ingestion receipt includes `alertsGenerated`. Event persistence, ingestion audit and generated alerts share one PostgreSQL transaction, so detection-stage failure returns a sanitized 503 and rolls the event back. Unsupported/legacy rule definitions are skipped rather than interpreted. See [DETECTION_ENGINE.md](DETECTION_ENGINE.md).


## Task 15 alert model

Task 15 defines and persists the alert object produced by qualifying detections. It does not add alert-management endpoints. Alert listing, retrieval, filtering and approved status workflows remain Task 16.

The persisted model contains the generating rule, trigger event, threat category, severity, event source, alert-generation timestamp, affected canonical entities, initial status, optional confidence, explainable match reason/evidence, and linked evidence events. Deterministic rule alerts currently use `status=NEW` and `confidence=null`. See [ALERT_MODEL.md](ALERT_MODEL.md).

## Task 16 alert management

GET /api/alerts and GET /api/alerts/{uuid} require alerts.read; PATCH /api/alerts/{uuid}/status requires alerts.manage, exact Origin and a status/reason body. NEW and ACKNOWLEDGED are separate alert states. Status changes and audit records commit atomically. The /alerts console traces source events through the existing events.read API. See [ALERT_MANAGEMENT.md](ALERT_MANAGEMENT.md).


## Task 17 alert correlation

Task 17 adds no public correlation endpoint. Newly generated alerts are correlated
internally after deterministic detection using the documented explainable
relationships and persisted `alert_correlations` edges. Alert management APIs
remain the Task 16 contract; Incident APIs remain future Task 18 work. See
[CORRELATION_ENGINE.md](CORRELATION_ENGINE.md).


## Task 18 incident management

Implemented endpoints:
- `GET /api/incidents`: authorized bounded incident listing/filtering.
- `POST /api/incidents`: Administrator/Security Analyst creation from 1–100 existing alert IDs.
- `GET /api/incidents/{uuid}`: incident inspection with linked alert summaries.
- `PATCH /api/incidents/{uuid}/assignment`: audited assignment/unassignment to active incident managers.
- `PATCH /api/incidents/{uuid}/status`: audited Task 18 lifecycle transition.

The authoritative incident states remain NEW, CONTAINED, INVESTIGATING, RESOLVED and DISMISSED. OPEN/CLOSED are unsupported. Direct CONTAINED mutation is not exposed in Task 18 because successful approved containment is reserved for Task 22. RESOLVED/DISMISSED require a terminal note. See [INCIDENT_MANAGEMENT.md](INCIDENT_MANAGEMENT.md).


## Task 19 incident classification and severity

`PATCH /api/incidents/{uuid}/assessment` is implemented for Administrator/Security Analyst users. The exact body is `{categoryCode, severity, reason}`, where categoryCode is one of the fifteen approved taxonomy codes or null and severity is LOW, MEDIUM, HIGH or CRITICAL.

A newly selected non-null category must currently be selectable. Assessment changes are audited transactionally and do not change incident status, assignment, alert links or terminal resolution metadata. Viewer/Management remains read-only.

Task 19 does not define a separate priority label/score; severity is the approved triage-priority dimension. Task 20 owns deterministic risk scoring. See [INCIDENT_CLASSIFICATION.md](INCIDENT_CLASSIFICATION.md).


## Task 20 risk scoring

Incident list/detail responses now include a read-only `risk` object with
`score`, `eventCount`, `formulaVersion`, and `calculatedAt`.

Risk formula version 1 is deterministic: severity contributes 20/40/60/80 points
for LOW/MEDIUM/HIGH/CRITICAL and distinct linked evidence events add 2 points per
event after the first, capped at 20; total score is capped at 100.

No risk mutation endpoint is provided. Task 19 severity adjustment changes the
underlying factor and PostgreSQL recalculates the generated score automatically.
Confidence and asset impact are not used until trustworthy implemented inputs exist.
See [RISK_SCORING.md](RISK_SCORING.md).
