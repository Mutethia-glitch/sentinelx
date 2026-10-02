-- Isolated tenant website source registry. A REPORTING status proves key use, not DNS ownership.
CREATE TABLE website_connectors (
 id uuid PRIMARY KEY,
 origin text NOT NULL UNIQUE CHECK (origin ~ '^https://[a-z0-9.-]+$' AND length(origin)<=300),
 host text NOT NULL UNIQUE CHECK (host ~ '^[a-z0-9.-]+$' AND length(host)<=253),
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 status text NOT NULL CHECK (status IN ('ISSUED','REPORTING','REVOKED')),
 created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_event_at timestamptz,
 revoked_at timestamptz
);
CREATE INDEX website_connectors_status_time_idx ON website_connectors(status,created_at DESC);
