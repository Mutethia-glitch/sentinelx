-- Task 20: deterministic incident risk score from severity and distinct evidence-event frequency.
ALTER TABLE incidents ADD COLUMN risk_event_count integer NOT NULL DEFAULT 0 CHECK (risk_event_count >= 0);
ALTER TABLE incidents ADD COLUMN risk_score smallint NOT NULL DEFAULT 0 CHECK (risk_score BETWEEN 0 AND 100);
ALTER TABLE incidents ADD COLUMN risk_formula_version smallint NOT NULL DEFAULT 1 CHECK (risk_formula_version = 1);
ALTER TABLE incidents ADD COLUMN risk_calculated_at timestamptz NOT NULL DEFAULT now();

CREATE FUNCTION calculate_incident_risk() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  severity_points integer;
  frequency_points integer;
BEGIN
  severity_points := CASE NEW.threat_level
    WHEN 'LOW' THEN 20
    WHEN 'MEDIUM' THEN 40
    WHEN 'HIGH' THEN 60
    WHEN 'CRITICAL' THEN 80
  END;
  frequency_points := LEAST(20, GREATEST(0, NEW.risk_event_count - 1) * 2);
  NEW.risk_score := LEAST(100, severity_points + frequency_points);
  NEW.risk_formula_version := 1;
  NEW.risk_calculated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

CREATE TRIGGER incidents_risk_calculation
BEFORE INSERT OR UPDATE OF threat_level, risk_event_count ON incidents
FOR EACH ROW EXECUTE FUNCTION calculate_incident_risk();

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
