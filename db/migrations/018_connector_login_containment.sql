CREATE TABLE connector_login_blocks (
 source text NOT NULL,
 source_ip inet NOT NULL,
 subject text NOT NULL CHECK (subject ~ '^[0-9a-f]{64}$'),
 trigger_event_id uuid NOT NULL REFERENCES security_events(id) ON DELETE RESTRICT,
 blocked_until timestamptz NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_enforced_event_id uuid REFERENCES security_events(id) ON DELETE RESTRICT,
 PRIMARY KEY (source, source_ip, subject)
);
CREATE INDEX security_events_connector_received_idx ON security_events(source, received_at);
