-- Task 15: persist the alert model as a distinct security signal.
ALTER TABLE alerts ADD COLUMN trigger_event_id uuid REFERENCES security_events(id) ON DELETE RESTRICT;
ALTER TABLE alerts ADD COLUMN category_code text REFERENCES threat_categories(code) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE alerts ADD COLUMN source text;
ALTER TABLE alerts ADD COLUMN affected_entities jsonb;
ALTER TABLE alerts ADD COLUMN status text NOT NULL DEFAULT 'NEW';
ALTER TABLE alerts ADD COLUMN confidence numeric(5,4);

ALTER TABLE alerts ADD CONSTRAINT alerts_source_check CHECK (source IS NULL OR (btrim(source) <> '' AND length(source) <= 500));
ALTER TABLE alerts ADD CONSTRAINT alerts_affected_entities_check CHECK (affected_entities IS NULL OR jsonb_typeof(affected_entities) = 'object');
ALTER TABLE alerts ADD CONSTRAINT alerts_status_task15_check CHECK (status = 'NEW');
ALTER TABLE alerts ADD CONSTRAINT alerts_confidence_check CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1));

UPDATE alerts a
SET trigger_event_id = candidate.event_id
FROM (
  SELECT DISTINCT ON (ae.alert_id) ae.alert_id, ae.event_id
  FROM alert_events ae
  JOIN alerts existing ON existing.id = ae.alert_id
  JOIN security_events event ON event.id = ae.event_id
  ORDER BY ae.alert_id,
    CASE WHEN ae.event_id::text = existing.match_evidence->>'triggerEventId' THEN 0 ELSE 1 END,
    event.occurred_at DESC, event.id DESC
) candidate
WHERE a.id = candidate.alert_id AND a.trigger_event_id IS NULL;

UPDATE alerts a
SET category_code = category.code
FROM threat_categories category
WHERE a.category_code IS NULL AND a.match_evidence->>'categoryCode' = category.code;

UPDATE alerts a
SET category_code = rule.category_code
FROM detection_rules rule
WHERE a.category_code IS NULL AND a.rule_id = rule.id AND rule.category_code IS NOT NULL;

UPDATE alerts a
SET source = event.source,
    affected_entities = jsonb_strip_nulls(jsonb_build_object(
      'sourceIp', event.normalized_data->'sourceIp',
      'destinationIp', event.normalized_data->'destinationIp',
      'user', event.normalized_data->'user',
      'host', event.normalized_data->'host'
    ))
FROM security_events event
WHERE a.trigger_event_id = event.id;

DO $alert_model$
BEGIN
  IF EXISTS (
    SELECT 1 FROM alerts
    WHERE trigger_event_id IS NULL OR category_code IS NULL OR source IS NULL OR affected_entities IS NULL
  ) THEN
    RAISE EXCEPTION 'Existing alert cannot be upgraded to Task 15 model';
  END IF;
END;
$alert_model$;

ALTER TABLE alerts ALTER COLUMN trigger_event_id SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN category_code SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN source SET NOT NULL;
ALTER TABLE alerts ALTER COLUMN affected_entities SET NOT NULL;

CREATE INDEX alerts_trigger_event_idx ON alerts(trigger_event_id);
CREATE INDEX alerts_category_idx ON alerts(category_code);
