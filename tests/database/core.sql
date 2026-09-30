BEGIN;
DO $test$
DECLARE
  u uuid; r uuid; e uuid; a uuid; i uuid; m uuid; lvl threat_level;
BEGIN
  INSERT INTO users(email, password_hash, display_name) VALUES ('synthetic@example.invalid', 'synthetic-not-a-real-hash', 'Synthetic tester') RETURNING id INTO u;
  BEGIN
    INSERT INTO users(email, password_hash, display_name) VALUES ('SYNTHETIC@example.invalid', 'test', 'Duplicate');
    RAISE EXCEPTION 'Case-insensitive uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO roles(name) VALUES ('synthetic-test-role') RETURNING id INTO r;
  INSERT INTO user_roles VALUES (u, r);
  INSERT INTO security_events(source, event_type, occurred_at, raw_data) VALUES ('synthetic', 'test', now(), '{}') RETURNING id INTO e;
  BEGIN
    INSERT INTO security_events(source, event_type, occurred_at, raw_data) VALUES ('synthetic', 'test', now(), '[]');
    RAISE EXCEPTION 'Invalid event payload accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO detection_rules(name, definition, threat_level, category_code, created_by) VALUES ('synthetic rule', '{}', 'HIGH', 'BRUTE_FORCE', u) RETURNING id INTO r;
  INSERT INTO alerts(rule_id, trigger_event_id, category_code, threat_level, source, affected_entities, match_reason, match_evidence)
    VALUES (r, e, 'BRUTE_FORCE', 'HIGH', 'synthetic', '{}', 'synthetic match', '{}') RETURNING id INTO a;
  IF (SELECT status FROM alerts WHERE id = a) <> 'NEW' THEN RAISE EXCEPTION 'Invalid alert default status'; END IF;
  IF (SELECT confidence FROM alerts WHERE id = a) IS NOT NULL THEN RAISE EXCEPTION 'Unexpected alert confidence'; END IF;
  BEGIN
    UPDATE alerts SET confidence = 1.1 WHERE id = a;
    RAISE EXCEPTION 'Invalid alert confidence accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  UPDATE alerts SET status = 'ACKNOWLEDGED' WHERE id = a;
  IF (SELECT status FROM alerts WHERE id = a) <> 'ACKNOWLEDGED' THEN RAISE EXCEPTION 'Alert acknowledgement failed'; END IF;
  UPDATE alerts SET status = 'NEW' WHERE id = a;
  BEGIN
    UPDATE alerts SET status = 'RESOLVED' WHERE id = a;
    RAISE EXCEPTION 'Incident-only status accepted for alert';
  EXCEPTION WHEN check_violation THEN NULL; END;
  INSERT INTO alert_events VALUES (a, e);
  BEGIN
    INSERT INTO alert_events VALUES (a, gen_random_uuid());
    RAISE EXCEPTION 'Orphan event reference accepted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    INSERT INTO alert_events VALUES (a, e);
    RAISE EXCEPTION 'Duplicate evidence link accepted';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  INSERT INTO incidents(title, threat_level, assigned_to) VALUES ('Synthetic incident', 'CRITICAL', u) RETURNING id INTO i;
  IF (SELECT status FROM incidents WHERE id = i) <> 'NEW' THEN RAISE EXCEPTION 'Invalid default status'; END IF;
  INSERT INTO incident_alerts VALUES (i, a);
  INSERT INTO investigation_notes(incident_id, author_id, content) VALUES (i, u, 'Synthetic evidence');
  INSERT INTO response_actions(incident_id, authorized_by, action, reason, result, succeeded, performed_at) VALUES (i, u, 'synthetic recorded action', 'test only', '{}', false, now());
  IF (SELECT status FROM incidents WHERE id = i) <> 'NEW' THEN RAISE EXCEPTION 'Response changed status automatically'; END IF;
  UPDATE incidents SET status = 'CONTAINED' WHERE id = i;
  IF (SELECT status FROM incidents WHERE id = i) = 'RESOLVED' THEN RAISE EXCEPTION 'Containment resolved incident'; END IF;
  UPDATE incidents SET status = 'INVESTIGATING' WHERE id = i;
  UPDATE incidents SET status = 'RESOLVED' WHERE id = i;
  UPDATE incidents SET status = 'DISMISSED' WHERE id = i;
  IF (SELECT threat_level FROM incidents WHERE id = i) <> 'CRITICAL' THEN RAISE EXCEPTION 'Threat level lost'; END IF;
  BEGIN
    UPDATE incidents SET status = 'CLOSED' WHERE id = i;
    RAISE EXCEPTION 'Unsupported status accepted';
  EXCEPTION WHEN invalid_text_representation THEN NULL; END;
  BEGIN
    UPDATE incidents SET status = 'OPEN' WHERE id = i;
    RAISE EXCEPTION 'Unsupported status accepted';
  EXCEPTION WHEN invalid_text_representation THEN NULL; END;
  BEGIN
    UPDATE incidents SET resolution_note = 'incomplete metadata' WHERE id = i;
    RAISE EXCEPTION 'Incomplete resolution metadata accepted';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE incidents SET threat_level = 'EXTREME' WHERE id = i;
    RAISE EXCEPTION 'Unsupported threat level accepted';
  EXCEPTION WHEN invalid_text_representation THEN NULL; END;
  FOREACH lvl IN ARRAY enum_range(NULL::threat_level) LOOP
    UPDATE incidents SET threat_level = lvl WHERE id = i;
  END LOOP;
  INSERT INTO notifications(recipient_id, incident_id, alert_id, message) VALUES (u, i, a, 'Synthetic notification');
  INSERT INTO audit_logs(actor_id, actor_context, action, target_type, target_id, context) VALUES (u, 'synthetic test user', 'test', 'incident', i, '{}');
  INSERT INTO mitre_mappings(technique_id, technique_name) VALUES ('T9999', 'Synthetic test technique') RETURNING id INTO m;
  INSERT INTO rule_mitre_mappings VALUES (r, m);
  BEGIN
    DELETE FROM security_events WHERE id = e;
    RAISE EXCEPTION 'Referenced evidence deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    DELETE FROM users WHERE id = u;
    RAISE EXCEPTION 'Attributed user deleted';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END;
$test$;
ROLLBACK;
