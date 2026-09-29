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
