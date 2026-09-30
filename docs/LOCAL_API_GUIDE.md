# Local SentinelX API guide

These endpoints are part of the SentinelX repository. Run `npm start` in the
PowerShell window with your PostgreSQL connection environment. The default local
base URL is `http://localhost:3000`. No external API registration or API key is
required. `git pull origin main` keeps the code and this guide on your computer.

| Method | Path | Required access |
|---|---|---|
| POST | /api/auth/login | Application email/passphrase; creates an HttpOnly session cookie. |
| GET | /api/auth/me | Valid session. |
| POST | /api/auth/logout | Valid session; revokes it. |
| GET | /api/access/me | Valid session; own identity/roles/permissions. |
| GET | /api/access/users | Administrator. |
| GET | /api/access/roles | Administrator. |
| PUT | /api/access/users/{uuid}/roles | Administrator, approved roles plus reason. |
| POST | /api/events | Administrator or Security Analyst; approved source and canonical event. |
| POST | /api/events/raw | Administrator or Security Analyst; approved source and supported raw format. |
| GET | /api/events | Approved role with events.read; bounded event filters. |
| GET | /api/events/{uuid} | Approved role with events.read; event inspection. |
| GET | /api/threat-categories | Approved role with categories.read; selectable=true returns enabled choices. |
| PATCH | /api/threat-categories/{CODE} | Administrator; catalog configuration plus reason. |
| GET / POST | /api/rules | Administrator/Analyst; list/create rule configurations. |
| GET / PUT | /api/rules/{uuid} | Administrator/Analyst; inspect/version-protected edit, including enabled state. |
| GET | /api/rules/mitre-mappings | Administrator/Analyst; local technique reference catalog. |
| GET | /api/alerts | Approved role with alerts.read; bounded filters and pagination. |
| GET | /api/alerts/{uuid} | Approved role with alerts.read; details and linked source events. |
| PATCH | /api/alerts/{uuid}/status | Administrator/Analyst; NEW or ACKNOWLEDGED plus reason. |
| POST | /api/rules/validate | Administrator/Analyst; structural/reference validation without execution. |

Mutation requests need exact `Origin: http://localhost:3000` (or your configured
APP_ORIGIN) and application/json. Authentication uses a session cookie, not a
bearer token or API key. A PowerShell caller should log in with `-SessionVariable`
and reuse `-WebSession`; the repository ingestion verifier demonstrates this
without printing your credentials.

User pages: `/access` for access management, `/events` for event viewing and `/alerts` for alert management.
Detailed payloads, limits and examples are in [AUTHENTICATION.md](AUTHENTICATION.md),
[ACCESS_CONTROL.md](ACCESS_CONTROL.md), [EVENT_INGESTION.md](EVENT_INGESTION.md),
[LOG_NORMALIZATION.md](LOG_NORMALIZATION.md) and [EVENT_MANAGEMENT.md](EVENT_MANAGEMENT.md).
Future external integrations are separate tasks; no external keys are needed for
the current implementation.

Threat catalog details: [THREAT_CATEGORIES.md](THREAT_CATEGORIES.md). Category availability does not imply implemented detection coverage.

Rule configuration details: [DETECTION_RULES.md](DETECTION_RULES.md). Runtime deterministic execution is documented in [DETECTION_ENGINE.md](DETECTION_ENGINE.md). These local endpoints and Task 13 detection require no external API key.

Alert workflow and Windows verification: [ALERT_MANAGEMENT.md](ALERT_MANAGEMENT.md).
