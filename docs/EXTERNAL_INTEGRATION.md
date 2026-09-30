# Task 34 — External integration boundary

Task 34 defines one optional, vendor-neutral outbound webhook boundary for forwarding a minimal normalized SentinelX security-event snapshot to an external log or SIEM receiver. SentinelX remains fully functional when the integration is disabled, misconfigured, unreachable, slow, or returns an error.

No Microsoft Sentinel, Splunk, or other commercial product is a dependency. No inbound external-system authentication scheme, retry queue, external response action, new database table, migration, frontend feature, or package dependency is introduced.

## Activation

The boundary is disabled by default. It is enabled only when all required configuration is valid:

- `SENTINELX_EXTERNAL_WEBHOOK_URL`: absolute HTTPS URL. URL-embedded username/password and fragments are rejected.
- `SENTINELX_EXTERNAL_WEBHOOK_TOKEN`: bearer token supplied only through environment configuration; 16–4096 characters.
- `SENTINELX_EXTERNAL_WEBHOOK_TIMEOUT_MS`: optional integer from 100–5000 ms; default 2000 ms.

If no URL is configured, adapter state is `disabled`. If configuration is present but invalid, adapter state is `unavailable`. Invalid optional integration configuration does not prevent SentinelX startup.

## Delivery contract

After an authorized event is validated, normalized, persisted, audited, and deterministic detection/correlation work inside the database transaction has completed successfully, SentinelX may send one best-effort HTTPS `POST` to the configured webhook.

Headers:

- `Content-Type: application/json; charset=utf-8`
- `Authorization: Bearer <environment token>`

Redirects are rejected so the bearer credential is not forwarded to another host.

Payload version 1:

```json
{
  "schemaVersion": 1,
  "eventType": "sentinelx.security_event",
  "emittedAt": "2026-09-30T20:00:02.000Z",
  "event": {
    "id": "uuid",
    "timestamp": "2026-09-30T20:00:00.000Z",
    "receivedAt": "2026-09-30T20:00:01.000Z",
    "normalizedAt": "2026-09-30T20:00:01.000Z",
    "source": "sentinelx-simulated",
    "type": "authentication",
    "severity": "HIGH",
    "sourceIp": "192.0.2.34",
    "destinationIp": null,
    "user": "synthetic-user",
    "host": "synthetic-host",
    "action": "login",
    "status": "failed"
  }
}
```

The external payload intentionally excludes raw event evidence and metadata. The standalone SentinelX database remains the authoritative record.

## Failure isolation

A successful 2xx response produces the adapter result `delivered`. Network errors, timeout, redirect, non-2xx responses, invalid adapter configuration, or unexpected adapter exceptions degrade to `unavailable`. The default produces `disabled`.

Webhook delivery runs only after the SentinelX event transaction has committed. Integration failure therefore does not roll back the event, generated alerts, correlation, ingestion audit, or other core state. The normal event-ingestion receipt is unchanged and does not expose webhook credentials or remote response details.

This is a best-effort optional boundary, not a durable message queue. Delivery retry/persistence and observability are not invented by Task 34.

## Verification

Run:

```powershell
npm.cmd run quality
if ($LASTEXITCODE -ne 0) { throw 'Quality checks failed' }

npm.cmd run verify:external-integration
if ($LASTEXITCODE -ne 0) { throw 'Task 34 external integration verification failed' }
```

The verifier uses synthetic data and a stubbed HTTPS receiver; it does not require PostgreSQL, an external SIEM, a real webhook URL, or credentials.
