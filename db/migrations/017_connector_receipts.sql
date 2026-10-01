CREATE TABLE connector_receipts (
  source text NOT NULL,
  external_id uuid NOT NULL,
  event_id uuid NOT NULL REFERENCES security_events(id) ON DELETE RESTRICT,
  PRIMARY KEY (source, external_id)
);
