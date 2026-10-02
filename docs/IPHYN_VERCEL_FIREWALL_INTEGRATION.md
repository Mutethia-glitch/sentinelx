# Iphyn web-application threat monitoring — Vercel signed firewall feed

**State, 2026-10-02:** code implemented, feature OFF until the operator configures
a trusted external source. No Vercel setting, Render secret, persisted tenant rule
or live security event was modified by implementing this adapter. This milestone
does not mean that SQL injection/XSS/traversal is already monitored in Iphyn
production. Task 41's email-domain/user-acceptance gates remain separately open.

## Supported authoritative source and limits

Vercel's Log Drains support an HTTPS custom endpoint receiving JSON arrays.
The documented `firewall` log source carries denied firewall activity; the
documented proxy attributes include `wafAction` and `wafRuleId`.
Vercel signs the **exact raw request body** with the configured Drain signing
secret in `x-vercel-signature`, using HMAC-SHA1. The receiver uses a fixed-time
comparison before decoding the body. Drains currently require **Pro or Enterprise**;
if Iphyn does not have Drains, do not claim this integration is connected or
upgrade/change the Vercel plan without the account owner's decision.

References (Vercel, consult current provider documentation when configuring):
- https://vercel.com/docs/drains/reference/logs
- https://vercel.com/docs/drains/security
- https://vercel.com/docs/drains/using-drains

Only the Iphyn Render tenant accepts
`POST https://sentinelx-iphyn-network.onrender.com/api/connectors/vercel-firewall`
when its dedicated config is complete. The URL alone does not authorize event
submission. Browser Origin and wrong media type are refused. A signed, bounded
JSON **array** (max 50 records and 1 MiB) is validated before any writes.
Signed unsupported records are ignored; malformed classified records fail the
batch before writing. Retry delivery is idempotent via existing
`connector_receipts` with `(source,projectId:logId)` and detection runs in
the existing event transaction.

An accepted record must meet **every** criterion:
1. Its Drain signature is correct; `log.projectId` matches the configured
   immutable Iphyn project ID and `proxy.host` exactly matches the expected
   visitor-facing production host (`iphyn.vercel.app`). The top-level `log.host`
   is validated as a hostname, but may be the distinct Vercel deployment
   hostname rather than the public production hostname.
2. `log.source=firewall`, `proxy.wafAction=deny`, and any present status code
   is `403`. A present environment must be `production`.
3. `proxy.wafRuleId` is an exact rule ID approved by the operator in the
   source-specific allowlist. That rule must **actually represent** its mapped
   attack class, rather than a generic challenge, rate limit or arbitrary
   request substring.
4. The log ID, deployment ID and millisecond timestamp are valid, within
   fifteen minutes of receipt. Unknown rule IDs, benign web access, general
   429/rate-limit events, and other Vercel projects do not become web attacks.

The mapping admits only `sql_injection`, `xss`, `path_traversal`, or
`command_injection` as classifications. It deliberately retains **no**
`message`, `proxy.path`, URL/query, request body, cookies, browser user agent,
referer, raw headers, account identity, or `proxy.clientIp`. Both IP fields
and user are NULL; they must not be assumed to identify an attacker. Retained
evidence is limited to provider, project/deployment/log IDs, exact WAF rule ID,
the verified `deny` decision and normalized tenant/source contract.
A WAF deny does **not** establish a successful exploitation.

Individual accepted events receive MEDIUM severity. The separate rule
fixture `fixtures/rules/iphyn-vercel-waf-web-attacks.json` proposes HIGH for
an accepted source/host/action/status match; it is initially **disabled**.
No automatic containment or CRITICAL classification is added.

## Operator-only setup after plan and source verification

All Vercel actions are performed **manually by the user**. None were attempted:

1. In Iphyn's Vercel project, inspect **Firewall** and confirm that relevant
   rules have precise provider-generated WAF IDs and genuinely indicate the
   specific category proposed for each mapping. Do not label a generic 403 or
   general rate-limit rule as SQLi/XSS.
2. Check that your Vercel plan supports Drains. Navigate to Team Settings →
   Drains → Add Drain. Choose **Logs**, **JSON** (not NDJSON), **production**
   environment and the **firewall** source; ensure the sampling policy
   covers the desired test observations. Set the HTTPS destination to the
   endpoint above. Vercel may test the destination during setup.
3. Retrieve the signing secret from the Vercel Drain configuration privately.
   On the **Iphyn tenant's Render environment only**, supply the following
   four variables together (never paste the real values into chat or GitHub):
   `VERCEL_FIREWALL_DRAIN_SECRET` = the Drain signature secret;
   `VERCEL_FIREWALL_PROJECT_ID` = the exact Vercel project ID;
   `VERCEL_FIREWALL_HOST` = `iphyn.vercel.app` if this is the exact hostname
   used in real production firewall log records;
   `VERCEL_FIREWALL_RULE_MAP` = a JSON object of exact verified WAF rule IDs
   to one of the four allowed attack labels, e.g. the **placeholder only**
   `{"rule_PLACEHOLDER_REPLACE":"sql_injection"}`.
   Leaving **all four unset/empty** keeps the receiver disabled; setting
   only some is a startup configuration error by design.
4. Do not configure an origin or IP allowlist using random client-supplied
   header values. Authentication relies on the raw-body HMAC plus project,
   host, decision and approved rule ID. Keep secrets outside request/audit logs.
   Restrict the Drain to this project/production if your plan supports it.

If the provider's actual JSON shape differs from this documented
`log.proxy.wafAction/wafRuleId` contract, **stop** and review a sanitized
sample; do not relax verification, infer an attack from a message string, or
secretly accept unknown project/host values.

## Acceptance before enabling the HIGH alert rule

Use authorized disposable/staging evidence, a reviewed WAF rule, and no
malicious payload testing against live Iphyn:

- Verify an authentic signed record reaches Events once, with event
  `web_application`, `blocked`, approved action and MEDIUM severity.
  Confirm no raw request/URL/IP is retained. Re-deliver same log ID;
  existing receipt must prevent duplicate event/alert.
- A harmless request, generic 429, unrelated rule, other project, preview,
  incorrect host, bad signature or altered body must not generate an attack
  event. A blocked event on an overly broad WAF rule is a potential false
  positive: refine the source rule, do not weaken classification guards.
- Tenant Administrator reviews the disabled fixture via existing
  `/api/rules/validate` and creates it in the **Iphyn tenant only**, initially
  still disabled. With separately approved control, enable it and confirm
  exactly a genuine matching source event creates the intended HIGH alert,
  evidence chain/incident/audit/reporting work and no unrelated company can
  read or mutate Iphyn's data. Record rule version and disable it again if
  only needed for acceptance. No rule is silently enabled on deployment.
- No source events mean **NOT LIVE-ACCEPTED**, even if all automated tests pass.
