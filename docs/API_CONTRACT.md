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


## Task 21 investigation workspace

Implemented endpoints:
- `GET /api/investigations/{incidentId}`: authorized investigation workspace containing incident context, linked alerts, distinct linked events, affected entities, analyst findings, and chronological timeline.
- `POST /api/investigations/{incidentId}/notes`: Administrator/Security Analyst append-only finding creation with optional linked alert/event evidence references.

Finding references are validated against the incident before persistence. Viewer/Management is read-only. Successful findings write an `INVESTIGATION_NOTE_ADDED` incident audit entry atomically.

Task 21 does not execute response actions; Task 22 remains responsible for controlled response workflows. See [INVESTIGATION_WORKSPACE.md](INVESTIGATION_WORKSPACE.md).

## Task 22 manual response workflow

- `GET /api/responses/{incidentId}?page=1`: read-only response-action history, bounded pages of 50; requires `responses.read`.
- `POST /api/responses/{incidentId}/actions`: record approved manual action; requires `responses.execute`, same-origin authenticated JSON.

Exact write body: `{action, reason, details, succeeded, containmentPerformed}`.
Approved types: CONTAINMENT, ESCALATION, FOLLOW_UP_TASK, COMMUNICATION. Strict success/confirmation booleans and bounded text are required. A successful CONTAINMENT must expressly confirm that the authorized actor actually performed external manual containment; this is a human attestation, not an external execution API.

Only successful confirmed containment can move NEW/INVESTIGATING to CONTAINED; response record, status change and audits share one PostgreSQL transaction. Failed containment never changes status. Terminal incidents reject new response actions. Existing direct incident status endpoint continues to reject CONTAINED.

No actual notification is delivered here (Task 23). See [RESPONSE_WORKFLOW.md](RESPONSE_WORKFLOW.md).

## Task 23 in-app notifications

- `GET /api/notifications?status=ALL&page=1`: only authenticated recipient's
  private inbox, unread count and paginated results. Filters ALL/UNREAD/READ.
- `POST /api/notifications`: explicit authorized delivery, exact body
  `{recipientId,incidentId,alertId,reason}`. Exactly one source UUID is non-null,
  and the recipient must be active with notification-read permission.
- `PATCH /api/notifications/{notificationId}/read`: exact empty object body,
  recipient-only read-state update, idempotent on repeats.

Notifications derive a bounded server-generated message and snapshot the source's
LOW/MEDIUM/HIGH/CRITICAL severity. CRITICAL/HIGH unread items are prioritized.
A duplicate unread recipient/source returns HTTP 200/deduplicated=true, while a
new committed in-app delivery returns HTTP 201/delivered=true. All mutations
enforce exact Origin, JSON input, live roles and atomic audit; no other user's
inbox is accessible. No SMTP/email or Task 22 response execution is implemented.
See [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Task 24 security operations dashboard

`GET /api/dashboard` is implemented, requires `dashboard.read` and returns
`{dashboard:{asOf,period,totals,last24Hours,severity,status,threats,responses,trend}}`.
No query parameters or mutation methods are accepted in Task 24.

All aggregates derive from persisted security_events, alerts, incidents and
response_actions in one PostgreSQL REPEATABLE READ READ ONLY snapshot. Seven-day
trends use UTC calendar days (including current partial day), last24Hours uses a
rolling PostgreSQL transaction-time cutoff, and response success counts reflect
the manual Task 22 attestation flag, not independently measured endpoint actions.
Missing status/severity categories are zero-filled; mean incident risk is null
when there are no incidents. Query failures return sanitized 503.

See [DASHBOARD.md](DASHBOARD.md). General cross-record filtering remains Task 25.

## Task 25 consistent event/alert/incident filtering

Existing protected list endpoints `GET /api/events`, `GET /api/alerts`, and
`GET /api/incidents` now share the same bounded query keys and validation for:
`q`, `from`, `to`, `severity`, `status`, `categoryCode`, `source`,
`sourceIp`, `destinationIp`, `user`, `host`, `ruleId`,
`mitreTechniqueId`, and `page`.

Event-only `type`/`action`, incident-only `assignedTo`, and the approved
per-domain status/severity rules remain available. `categoryCode=UNCLASSIFIED`
is available only for null incident classification. Filter bounds are inclusive
and use event occurrence time or alert/incident creation time.

Linked rule/MITRE/entity searches are parameterized and use EXISTS, preserving
one list item per record rather than multiplying results when linked evidence
is present. Read RBAC, stable ordering and existing 50-row pages are unchanged.
Invalid, unknown or duplicated filters return 400. See
[SEARCH_FILTERING.md](SEARCH_FILTERING.md). Task 26 report filtering remains separate.
