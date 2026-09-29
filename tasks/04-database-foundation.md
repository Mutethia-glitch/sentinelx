# Task 04: Database Foundation

## Status
Complete

## Objective
Design and implement the PostgreSQL schema for users, roles, events, alerts, incidents, rules, investigations, responses, notifications, audit logs, and MITRE mappings.

## Project Context
SentinelX is **IPHYN's Intelligent Cybersecurity Incident Detection and Response System**. IPHYN is the case-study organization; SentinelX is the system name.

The core workflow is:

**Security Event → Normalization → Detection → Alert → Correlation → Incident → Investigation → Response → Resolution → Reporting**

## Scope
Design and implement the PostgreSQL schema for users, roles, events, alerts, incidents, rules, investigations, responses, notifications, audit logs, and MITRE mappings.

## Explicitly Out of Scope
Do not use Supabase or speculative unrelated tables.

## Dependencies
Complete the preceding tasks required by the sequence before implementing this task. Do not bypass dependencies merely to make the interface appear complete.

## Non-Negotiable Implementation Rules
1. Preserve SentinelX terminology and the existing architecture.
2. Do not introduce Supabase.
3. Do not invent requirements that are not in this repository.
4. Do not add unrelated commercial-SIEM features.
5. Do not replace deterministic detection with machine learning unless this task explicitly requires ML.
6. Do not add offensive security tooling or destructive response actions.
7. Keep secrets in environment variables and never commit credentials.
8. Validate API inputs.
9. Enforce authorization on the backend.
10. Add tests for important behavior.
11. Update documentation when an architectural/API behavior changes.
12. If something is ambiguous, choose the smallest solution consistent with the existing SentinelX architecture and document the decision.

## Acceptance Criteria
Migrations run successfully; relationships and indexes are documented.

### Verification
- [x] `db/migrations/001_core.sql` implements all Task 04 entity groups and evidence association tables.
- [x] PostgreSQL 16 fresh application and unchanged migration replay pass.
- [x] Failure injection confirms transactional rollback; applied checksum mismatch is rejected.
- [x] Synthetic integrity tests pass for relationships, duplicate links, JSON shape, attribution and enums.
- [x] Incident status/threat independence and lack of automatic containment are verified at schema level.
- [x] Relationships, keys, indexes and later application enforcement boundaries are documented.
- [x] `npm run quality` and `git diff --check` pass.
- [x] `.env` remains excluded; credentials are not read, printed or committed.
- [x] Hosting/provisioning is external; migrations can be run later on the selected host.
- [x] No later-task application behavior, ML tables or Supabase introduced.

## Required Deliverables
Database schema and migrations.

## Completion Gate
Do not mark this task complete until:
- The implementation exists in the repository.
- Every acceptance criterion has been checked.
- Relevant automated tests pass.
- Existing functionality is not knowingly broken.
- Required documentation is updated.
- No out-of-scope feature was introduced.

## AI Guardrail
**Implement this task only. Do not proceed into later tasks. Do not redesign SentinelX. Do not substitute a different architecture because another product uses it. Do not add speculative features.**
