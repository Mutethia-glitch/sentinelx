-- Task 17: persist explainable alert-to-alert correlation relationships.
CREATE TABLE alert_correlations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE RESTRICT,
  related_alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE RESTRICT,
  relationship jsonb NOT NULL CHECK (jsonb_typeof(relationship) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (alert_id::text < related_alert_id::text),
  UNIQUE (alert_id, related_alert_id)
);
CREATE INDEX alert_correlations_alert_idx ON alert_correlations(alert_id);
CREATE INDEX alert_correlations_related_idx ON alert_correlations(related_alert_id);
CREATE INDEX alert_correlations_time_idx ON alert_correlations(created_at DESC);
