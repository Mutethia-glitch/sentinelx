-- Task 20: deterministic incident risk score from severity and distinct evidence-event frequency.
ALTER TABLE incidents ADD COLUMN risk_event_count integer NOT NULL DEFAULT 0 CHECK (risk_event_count >= 0);
ALTER TABLE incidents ADD COLUMN risk_formula_version smallint NOT NULL DEFAULT 1 CHECK (risk_formula_version = 1);
ALTER TABLE incidents ADD COLUMN risk_calculated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE incidents ADD COLUMN risk_score smallint GENERATED ALWAYS AS (
  LEAST(
    100,
    CASE threat_level
      WHEN 'LOW' THEN 20
      WHEN 'MEDIUM' THEN 40
      WHEN 'HIGH' THEN 60
      WHEN 'CRITICAL' THEN 80
    END
    + LEAST(20, GREATEST(0, risk_event_count - 1) * 2)
  )
) STORED;

CREATE FUNCTION mark_incident_risk_calculated() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.risk_formula_version := 1;
  NEW.risk_calculated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER incidents_risk_calculation_metadata
BEFORE UPDATE OF threat_level, risk_event_count ON incidents
FOR EACH ROW EXECUTE FUNCTION mark_incident_risk_calculated();

WITH evidence AS (
  SELECT i.id, count(DISTINCT ae.event_id)::integer AS event_count
  FROM incidents i
  LEFT JOIN incident_alerts ia ON ia.incident_id=i.id
  LEFT JOIN alert_events ae ON ae.alert_id=ia.alert_id
  GROUP BY i.id
)
UPDATE incidents i
SET risk_event_count=e.event_count
FROM evidence e
WHERE e.id=i.id;

CREATE INDEX incidents_risk_score_idx ON incidents(risk_score DESC);
