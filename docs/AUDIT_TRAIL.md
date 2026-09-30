# Task 27 — Audit trail

SentinelX already writes `audit_logs` transactionally from authentication/RBAC, rule management, alert management, incident lifecycle, investigation, response, and notification workflows. Task 27 adds the protected audit retrieval layer.

## Access

`GET /api/audit` requires `audit.read`. Administrator and Security Analyst have this permission; Viewer/Management does not.

Supported filters: `actorId`, `action`, `targetType`, `targetId`, inclusive `from`/`to`, and `page`. Results are newest first, 50 per page.

Each result contains actor identity/context, action, target resource type/id, stored JSON context, and timestamp.

There is deliberately no audit create/update/delete API. Ordinary users can retrieve only through the protected read path and cannot silently alter audit records through SentinelX.

## Verification

Run:

```powershell
npm.cmd run quality
node scripts/migrate.js
npm.cmd run verify:audit
```

Expected:

`Protected actor/action/resource/time/context audit retrieval, filtering, RBAC and read-only API behavior verified. Synthetic changes cleaned up.`

## Completion

Task is **Complete**. On 2026-09-30, the Windows quality suite passed 137/137 and the corresponding PostgreSQL acceptance verifier reported:

`Protected actor/action/resource/time/context audit retrieval, filtering, RBAC and read-only API behavior verified. Synthetic changes cleaned up.`
