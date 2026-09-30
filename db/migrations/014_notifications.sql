-- Task 23: stable severity snapshot for in-app notifications.
-- Keep nullable for historical Task 01 notification rows and direct core schema tests.
ALTER TABLE notifications ADD COLUMN severity threat_level;
UPDATE notifications n SET severity=COALESCE(
  (SELECT i.threat_level FROM incidents i WHERE i.id=n.incident_id),
  (SELECT a.threat_level FROM alerts a WHERE a.id=n.alert_id)
) WHERE severity IS NULL;
CREATE INDEX notifications_recipient_priority_idx
  ON notifications(recipient_id, read_at, severity, created_at DESC);
