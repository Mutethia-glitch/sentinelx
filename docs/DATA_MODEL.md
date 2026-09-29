# SentinelX Data Model — Task 04

PostgreSQL 16+ is the tested database baseline. The executable schema is
`db/migrations/001_core.sql`; `scripts/migrate.js` applies ordered migrations
transactionally and records SHA-256 checksums in `schema_migrations`.

## Tables and relationships

| Table | Purpose and relationships |
|---|---|
| roles | Unique role names; no roles or permissions seeded before Task 06. |
| users | Case-insensitive unique email, password hash, active flag; no plaintext password. |
| user_roles | Many-to-many user/role assignments, unique per pair. |
| security_events | Source/type, occurrence and receipt times, raw JSON object, optional normalized JSON/time pair. |
| detection_rules | Disabled by default; deterministic definition JSON and threat level; optional creator. |
| alerts | Rule reference, persisted threat level and explainable match reason/evidence. |
| alert_events | Many-to-many alert/event evidence, unique per pair. |
| incidents | Title, description, independent status/threat level, optional assignee. |
| incident_alerts | Many-to-many incident/alert correlation evidence, unique per pair. |
| investigation_notes | Incident, author, note and evidence JSON with creation time. |
| response_actions | Incident, authorizing user, action, reason, result, success flag and performance time. |
| notifications | Recipient, optional incident/alert context, message and read time. |
| audit_logs | Optional user plus mandatory actor context, action, target and contextual JSON/time. |
| mitre_mappings | Unique technique/sub-technique identifier and name. |
| rule_mitre_mappings | Many-to-many rule/technique links, unique per pair. |
| schema_migrations | Applied filename, checksum and application time. |

## Keys and integrity

Entity primary keys are UUIDs generated with PostgreSQL `gen_random_uuid()`;
association tables use composite primary keys. Timestamps use `timestamptz`.
Every foreign key uses `ON DELETE RESTRICT`: deleting a parent cannot silently
remove evidence, response history or attribution. Deactivate users instead of
deleting attributed accounts. Retention/deletion policy is not implemented here.

Incident status permits only `NEW`, `CONTAINED`, `INVESTIGATING`, `RESOLVED`,
`DISMISSED` and defaults to `NEW`. Threat level independently permits only
`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`. No database trigger changes one because the
other changes. There is no `CLOSED` status and no automatic containment.

Required source/type/text fields and evidence JSON shapes have checks. Raw
records can precede normalization; normalized data and normalization time must
be populated together. JSON object containers leave exact telemetry and rule
formats to Tasks 07, 09 and 12 instead of inventing those contracts now.

## Indexes

Primary keys and unique constraints supply identity and duplicate-link indexes.
The email expression index enforces case-insensitive uniqueness. Explicit indexes
cover every referencing foreign-key access path not already covered by the
leading column of a composite key.

Query indexes cover event time and source/type/time; alert threat/time;
incident status/time, threat/time and assignee; investigation and response
incident/time; recipient notification/time; audit actor/time, target/time and
chronological audit queries. No speculative JSON GIN indexes are added before
actual search patterns are implemented.

## Scope and enforcement boundaries

This is a schema foundation, not authentication, detection or response execution.
Backend authorization, valid lifecycle transitions, successful approved
containment, mandatory transactional auditing, supported action allowlists and
safe audit querying remain the responsibility of their numbered implementation
tasks. An `authorized_by` foreign key identifies a user; it does not establish
that user's permission. Audit tables are not yet tamper-proof; runtime grants and
audit recording controls must be implemented before operational deployment.

An alert can link multiple events and an incident can link multiple alerts.
Application services must require the appropriate evidence links in their
creation transaction. The schema alone does not enforce minimum child counts.
Audit target IDs are polymorphic references, so target validity is enforced by
the later audit service; actor user references are enforced by PostgreSQL.

No production data, users, credentials, roles, rules or MITRE dataset are seeded.
Risk-assessment history, ML results and endpoint/agent enrollment tables are
left to their own tasks; threat levels are already persisted in the core schema.
The single IPHYN case-study database does not introduce speculative tenancy.

## Migration policy

Run migrations on a dedicated SentinelX database using a migration owner.
The runner obtains a transaction-level advisory lock, applies all pending files
in one transaction, and rejects changed checksums of already applied files.
An SQL error rolls the transaction back. Repeating an unchanged migration is a
no-op. Do not edit applied files; add a numbered migration instead. Back up a
populated database before changes. No destructive automatic down migration is
provided. Database provisioning and hosting remain external to this repository.

## Verification

Tested on PostgreSQL 16 using a disposable local database: fresh application,
repeat application, all core entity inserts, evidence/correlation links,
case-insensitive user uniqueness, duplicate-link rejection, invalid JSON and
orphan reference rejection, enum rejection, all supported incident statuses and
threat levels, status/threat independence, no automatic response transition and
restricted deletion. Failure injection verifies full migration rollback, and
changed applied checksums are rejected. Synthetic test rows are rolled back.

## Task 05 addition

`002_auth_sessions.sql` adds `auth_sessions`: UUID primary key, restricted user
foreign key, unique SHA-256 token digest, creation/activity/expiry/revocation times
and timestamp-order checks. User and expiry indexes support attribution and
session maintenance. User deactivation or password-hash updates revoke sessions
through `users_revoke_auth_sessions`. Login/logout and authentication auditing are
implemented through the data-access layer; other audit workflows remain later tasks.
The original applied migration is unchanged.

## Task 06 addition

`003_rbac_roles.sql` seeds the three approved role names without adding tables or
assigning users. Existing `roles` and `user_roles` remain the source of assignments;
policy grants live in versioned application code. Role changes, affected session
revocation and attributable audit context commit together. An advisory lock
serializes API role updates and first-Administrator setup. The previous applied
migrations remain unchanged.
