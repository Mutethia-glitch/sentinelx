-- Task 41: tenant-local opt-in evidence feed registry.
-- Apply to each existing isolated tenant database before enabling
-- MANAGED_EVIDENCE_FEEDS=1 or merging a release that references this table.
-- No feed is created, no rule enabled, and no key is issued by migration.
CREATE TABLE managed_evidence_feeds (
 id uuid PRIMARY KEY,
 name text NOT NULL UNIQUE CHECK (name ~ '^[a-z][a-z0-9-]{2,49}$'),
 issuer text NOT NULL CHECK (issuer IN ('application','identity','network','mail','endpoint','storage','analyst','ci')),
 host text NOT NULL CHECK (host ~ '^[a-z0-9.-]+$' AND length(host)<=253),
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK (status IN ('ISSUED','REPORTING','REVOKED')),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_event_at timestamptz,
 revoked_at timestamptz
);
CREATE INDEX managed_evidence_feeds_status_time_idx
 ON managed_evidence_feeds(status,created_at DESC);
