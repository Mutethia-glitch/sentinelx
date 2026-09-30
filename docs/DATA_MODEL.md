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
| alert_correlations | Explainable undirected alert-to-alert relationship edges, one canonical row per pair. |
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

## Task 07 event representation
Canonical event fields and persistence use the existing security_events table; no new migration is required. See [SECURITY_EVENTS.md](SECURITY_EVENTS.md) for validation, raw evidence handling and repository methods.

## Task 11 threat taxonomy
Migration 004 adds threat_categories (18 application/migration tables in total) and optional catalog foreign keys on detection_rules and incidents. Stable approved codes, configurable labels/availability, historical reference preservation and disabled-choice selection checks are documented in [THREAT_CATEGORIES.md](THREAT_CATEGORIES.md). Severity/status stay independent.

Migration 005 expands the approved threat catalog from seven to fifteen with eight user-authorized business categories. It preserves prior category configuration and references, and does not change migration 004 or imply detection coverage.

## Task 12 rule configuration
Migration 006 adds updated_at/version to detection_rules and seeds three known MITRE references without replacing existing rows. Declarative schemaVersion 1 definitions, category and MITRE references, version-protected edits and atomic audit are described in [DETECTION_RULES.md](DETECTION_RULES.md). Existing definitions are retained and must be explicitly validated for future execution. Table count remains 18.


## Task 15 alert model

Migration 008 extends `alerts` into the explicit Task 15 signal snapshot without changing applied migrations 001–007. Generated alerts now persist a direct trigger-event reference, threat/category snapshot, source, affected canonical entities, initial `NEW` status, and optional confidence alongside the existing rule reference, severity, reason/evidence, timestamp and `alert_events` evidence links.

Deterministic Task 15 rules leave confidence null because no calibrated probability model is implemented. The 0–1 database constraint applies only when confidence is present. Task 16 owns later alert-management states/workflows and must explicitly revise the Task 15 status constraint if additional states are approved.

See [ALERT_MODEL.md](ALERT_MODEL.md).


## Task 17 alert correlation

Migration 010 adds `alert_correlations`, bringing the application/migration table
count to 19. Each row references two existing alerts and stores explainable JSON
relationship evidence. Pairs are stored in canonical UUID order and are unique, so
the same relationship cannot be duplicated in reverse.

Correlation groups are connected components of these persisted alert-pair edges.
The table does not create or replace incidents; Task 18 remains responsible for
incident lifecycle behavior.

See [CORRELATION_ENGINE.md](CORRELATION_ENGINE.md).


## Task 18 incident management

Migration 011 extends the existing `incidents` table without changing the approved incident_status enum. It adds `updated_at`, assignment/status attribution timestamps and actors, plus terminal resolution/dismissal note metadata. Existing incidents receive `updated_at=created_at`; other new fields remain nullable until an authorized workflow populates them.

Incident creation links existing alerts through `incident_alerts`; initial severity is the highest linked-alert severity. Status changes do not alter threat level. OPEN and CLOSED remain unsupported. See [INCIDENT_MANAGEMENT.md](INCIDENT_MANAGEMENT.md).


## Task 19 incident classification and severity

Migration 012 adds `assessment_updated_at` and `assessment_updated_by` to incidents. The existing `category_code` and `threat_level` columns remain the authoritative classification and severity values. Classification accepts the approved taxonomy or null; severity remains the existing LOW/MEDIUM/HIGH/CRITICAL enum.

No separate priority column or risk score is added by Task 19. Task 20 owns risk scoring. Assessment attribution references users with ON DELETE RESTRICT, and material assessment changes are also preserved in the audit trail.

See [INCIDENT_CLASSIFICATION.md](INCIDENT_CLASSIFICATION.md).


## Task 20 incident risk scoring

Migration 013 adds `risk_event_count`, generated `risk_score`,
`risk_formula_version`, and `risk_calculated_at` to incidents.

The score is generated from the existing incident `threat_level` and stored
distinct linked evidence-event count. It is not independently writable. Existing
incidents are backfilled from `incident_alerts → alert_events`.

Formula version 1 does not add asset-impact, confidence, lifecycle, or taxonomy
multipliers. See [RISK_SCORING.md](RISK_SCORING.md).


## Task 21 investigation workspace

Task 21 activates the existing `investigation_notes` table created by migration 001; no new migration is required.

Each note belongs to one incident and one author, stores append-only content plus JSON evidence references, and retains its creation timestamp. The Task 21 repository accepts only alert/event references already linked to that incident.

The investigation workspace derives affected entities and timeline entries from existing incident/alert/event/audit relationships rather than adding duplicate evidence tables.

See [INVESTIGATION_WORKSPACE.md](INVESTIGATION_WORKSPACE.md).

## Task 22 response workflow

Task 22 reuses `response_actions` from migration 001, with incident FK, authorized-by user FK, action, reason, JSON result, success flag and performed_at (SentinelX recording time). No migration 014 is introduced.

Result JSON stores `summary`, `mode: "MANUAL_ATTESTATION"` and `containmentPerformed`. Response records are append-only through the API, and both response and controlled CONTAINED state changes are audited atomically. Incident status, severity, risk, assignment and resolution remain distinct fields. See [RESPONSE_WORKFLOW.md](RESPONSE_WORKFLOW.md).

## Task 23 notification snapshot and read state

Append-only migration `014_notifications.sql` adds nullable `notifications.severity` (`threat_level`) and a recipient/read-state/severity index to the existing Task 01
notifications table. Historical rows are best-effort backfilled. The nullable
choice preserves direct legacy inserts in the core schema tests.

Task 23 requires exactly one incident_id or alert_id through API validation.
Created_at is committed in-app delivery time, read_at is recipient acknowledgment
time; no speculative external delivery status exists. Concurrent sends are
serialized by locking the active recipient row, then deduplicating any unread
record for the same recipient and source. See [NOTIFICATIONS.md](NOTIFICATIONS.md).

## Task 24 aggregate query layer

Task 24 adds no schema migration. Its read-only Dashboard repository queries the
existing `security_events.received_at`, `alerts.created_at`,
`incidents.created_at`, severity/status/category snapshots, generated
`incidents.risk_score`, and `response_actions.performed_at` / success flag.

Metrics are recomputed from real persisted rows within a consistent PostgreSQL
snapshot; no rollup, cache or synthetic metric table is stored. Missing severity
and workflow status categories are returned as zero, while mean risk remains null
for an empty incident table. See [DASHBOARD.md](DASHBOARD.md).
