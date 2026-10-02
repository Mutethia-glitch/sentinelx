# Task 41 — First-party SentinelX security evidence (opt-in)

**Purpose.** SentinelX needs to observe attacks targeting its *own* tenant application,
not only external company websites. This bounded first implementation observes
completed HTTP outcomes at the SentinelX tenant runtime. It does not route between
tenants and does not turn the onboarding/provisioner platform into a tenant feed.

## Deployment and safety

The feature defaults **OFF**. On each intended Render tenant service only,
set `SENTINELX_SELF_MONITOR=1` after reviewing the source and deployment CI.
Values other than `0`, `1` or absence fail configuration validation.
No database migration or additional secret is needed. Switching back to `0`
turns reporting off after redeploy; previously recorded events remain evidence.
Do not set this flag on onboarding or provisioner: those run different services
and do not have tenant event stores. Production retention and alerting remain
subject to each tenant's own data and rules.

### Observable security outcomes

- `POST /api/auth/login` with **actual 401 response** becomes a LOW,
  `BRUTE_FORCE`-categorized failed password-login observation. One incorrect
  password alone is not a confirmed attack; an Administrator must separately
  approve a tightly scoped threshold rule to generate a pattern alert.
- An **actual HTTP 429 response** on a tenant API becomes a LOW, **unclassified**
  request-throttled observation. A 429 is not proof of DoS, password spraying
  or other malicious activity.
- An actual **GET 404** of a narrow set of known exposure/discovery targets
  under /api (`.git`, `.env`, `wp-admin`, `phpmyadmin`, `adminer`) becomes a
  LOW `RECONNAISSANCE` observation. The route-miss pattern is a heuristic,
  not independent proof of malicious intent. Ordinary URL typos, a missing
  resource, invalid user input and generic 403s are **not** reclassified.

All events use source `sentinelx-internal`, the runtime's configured tenant ID
and its own APP_ORIGIN hostname. The reporter never trusts a caller-supplied
company/host/event classification. Source IP comes from the existing trusted
proxy/connection address resolution, otherwise null. Per IP/signal, at most ten
observations per minute are submitted from one process; the map is capped at
2,048 keys and memory-bounded. This is not a distributed or durable detector.

Event evidence contains only signal name, generated opaque evidenceRef,
observed action/status/severity and attribution. **No raw path, query string,
request body, headers, password, email, OTP, bearer token or cookie** is stored.
Writes and rule evaluation use the existing tenant-local event transaction. They
run best-effort on HTTP response finish and never alter the original status,
headers or availability. An unavailable database may lose such telemetry; a
durable queue is deferred.

The source is integrated into the existing Events, taxonomy filtering,
detection-rule evaluation and subsequent alert workflows. Merely turning on
self-observation does **not** install or enable threat rules. Before an alert
pilot, review a disabled source/host-scoped threshold rule, below-threshold
samples, unrelated-IP and ordinary-browsing negatives; preserve separation
between a LOW observation and any later independent rule-derived alert severity.

## Coverage boundary

Observed application outcomes cover narrow brute-force indicators, source
throttling and narrowly identified reconnaissance. Additional in-process
authorization failure auditing may be developed using explicit verified
RBAC decision hooks (not a blanket interpretation of 403). SQL injection,
XSS, traversal and command injection need explicit validated security-rule/WAF
decisions. Privilege changes require authoritative identity/role audit.
Malware/ransomware need endpoint telemetry; DoS/network activity needs trusted
edge/network evidence; phishing needs mail-security evidence; exfiltration needs
storage/egress evidence; and supply-chain findings need CI provenance.
Self-observation **cannot** see traffic stopped upstream of the application,
including some Render ingress/WAF events, nor does it protect the independent
platform service merely because tenant monitoring is enabled. Do not claim
automatic live coverage of all 15 taxonomy categories.

## Isolated verification

`npm run quality` exercises response classification, safe evidence fields,
known-route positive, ordinary 404/403 negatives, actual 429, bounded sampling
and persistence-failure independence. Existing Task 41 disposable PostgreSQL
tests verify the shared tenant event/detector boundaries. Confirm deployment
first, then perform a low-volume authorized positive/benign manual acceptance.
Never spray a production login or execute dangerous exploit payloads merely
to create telemetry.
