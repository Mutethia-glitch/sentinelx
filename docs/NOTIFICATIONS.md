# Task 23 — In-app notifications

Task 23 delivers protected, severity-aware notifications through the existing
SentinelX web application and PostgreSQL database. It does not configure SMTP,
send email, or treat notification delivery as incident/response handling.

## Scope and delivery semantics

Dispatch is explicit: an Administrator or Security Analyst selects one existing
incident or alert and one active SentinelX recipient with notification-read access.
No notification is automatically generated for every detector event. That
prevents notification floods and avoids changing Tasks 15–22.

The in-app notification is **delivered only after the PostgreSQL transaction
commits**. The API returns HTTP 201 and `delivered=true` for a newly committed
record. If storage/auditing fails, the insert rolls back and the API returns a
generic unavailable error: it must never claim successful delivery.

Repeated dispatch to the same recipient and incident/alert while an unread
notification already exists returns HTTP 200 with `deduplicated=true` and the
existing notification. The recipient user row is locked to serialize concurrent
senders. The old item can be reissued after the recipient explicitly reads it.

Only the named recipient can list or mark their own notifications read—even an
Administrator cannot use the inbox API to inspect another recipient's messages.

## Severity-aware behavior

The stored notification snapshots the source record's authoritative
`LOW`, `MEDIUM`, `HIGH`, or `CRITICAL` severity at delivery time.

Unread items appear first, with CRITICAL and HIGH ahead of MEDIUM and LOW.
CRITICAL/HIGH receive an accessible visual urgency treatment in the web inbox.
Messages are deliberately generic, built by the server from the source type and
severity, with no incident title, user, IP address, raw evidence, arbitrary
operator-supplied message, tokens, or credentials.

Examples:
- `CRITICAL incident requires timely review.`
- `HIGH alert requires timely review.`
- `MEDIUM incident shared for review.`
- `LOW alert shared for review.`

A subsequent incident reassessment does not rewrite a historical severity
snapshot; it reflects severity when that notification was dispatched.

## Persistence

Task 01 already provided:
`notifications(id,recipient_id,incident_id,alert_id,message,created_at,read_at)`.

Append-only migration `014_notifications.sql` adds a nullable
`severity threat_level` snapshot and recipient/state/severity index.
Legacy rows are best-effort backfilled from their existing source reference.
The column remains nullable to preserve Task 01 direct core SQL compatibility.

The API accepts exactly one of `incidentId` or `alertId`; legacy rows with
both references are not retroactively rewritten.

Notification states are derived only from persisted timestamps:
- `UNREAD` = a committed delivered record with null `read_at`;
- `READ` = the recipient has marked it read.

There is no speculative email delivery or fake QUEUED/SENT state.

## Authorization and APIs

New approved permissions:
- `notifications.read`: Administrator, Security Analyst, Viewer/Management.
- `notifications.send`: Administrator and Security Analyst only.

`GET /api/notifications?status=ALL&page=1`

Returns **only** the authenticated recipient's paginated inbox (50 per page),
an unread count, and minimal source reference/severity/message/time fields.
Filters: ALL, UNREAD, READ.

`POST /api/notifications`

Exact body:

```json
{
  "recipientId": "active-recipient-uuid",
  "incidentId": "incident-uuid",
  "alertId": null,
  "reason": "This incident requires authorized analyst review."
}
```

Or set `incidentId` to null and use a valid alert UUID. Reason is required,
1–500 characters, stored in audit context only and never sent to the recipient.

`PATCH /api/notifications/{notificationId}/read`

Requires an empty JSON object `{}`, checks the current recipient inside the
transaction, and updates read_at once. Retrying a previously read item returns
`changed=false` without a second audit entry. Another recipient receives 404.

All mutations enforce exact same-origin browser requests, JSON input, active
users and live role checks inside PostgreSQL. Actor/recipient records are
locked appropriately. An inactive recipient is rejected.

## Auditing and safe failures

- `NOTIFICATION_DELIVERED`: sender, recipient, source ID, severity,
  IN_APP channel, reason. Written atomically with the notification.
- `NOTIFICATION_READ`: authenticated recipient and notification ID.
  Written atomically with the read-state change.
- Deduplicated sends and repeat mark-read operations produce no redundant audit.
- Audit failure rolls back delivery/read state.
- Failed deliveries never create ghost receipts or expose database details.

Notification delivery never moves an incident to CONTAINED/RESOLVED and does not
execute a response or email task. Task 22 COMMUNICATION records an external manual
report; it does not substitute for a real Task 23 in-app notification.

## Console

`/notifications` is a dedicated authenticated inbox with state filters,
unread count, severity-aware display and recipient mark-as-read controls.
The dispatch form is shown only to holders of `notifications.send` and
supports send-to-self without exposing a directory of unrelated users.

All stored notification text is assigned through `textContent`.
The page is served with SentinelX's existing restrictive CSP and no-store headers.

## Verification

Unit tests cover exact input validation, privacy/RBAC, approved severity/message
mapping, recipient-scoped querying, HTTP origins/methods, and generic DB errors.

On your local Windows/PostgreSQL instance run:

```powershell
git pull origin main
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:notifications
```

Expected final output:

`Severity-aware in-app delivery, recipient isolation, duplicate suppression, read state, RBAC, auditing and atomic failure rollback verified. Synthetic changes cleaned up.`

Optional integration and Chromium tests require a **disposable** database:

```powershell
$env:SENTINELX_TEST_DATABASE='1'
npm.cmd run test:notifications:integration
npm.cmd run test:notifications:ui
```

No external email service, SMTP configuration or API key is introduced.
Task 24 (Dashboard) remains Not Started until requested.
