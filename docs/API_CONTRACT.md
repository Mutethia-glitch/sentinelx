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
GET/POST /api/rules, GET/PUT /api/rules/{uuid}, GET /api/rules/mitre-mappings and POST /api/rules/validate provide bounded rule configuration, version-protected updates and structural/reference validation. Admin/Analyst grants are required; Viewer cannot access rule definitions. See [DETECTION_RULES.md](DETECTION_RULES.md). Runtime evaluation remains Task 13.
