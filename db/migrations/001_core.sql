CREATE TYPE threat_level AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE incident_status AS ENUM ('NEW', 'CONTAINED', 'INVESTIGATING', 'RESOLVED', 'DISMISSED');

CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> '')
);
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL CHECK (btrim(email) <> ''),
  password_hash text NOT NULL CHECK (btrim(password_hash) <> ''),
  display_name text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));
CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  PRIMARY KEY (user_id, role_id)
);
CREATE INDEX user_roles_role_idx ON user_roles(role_id);

CREATE TABLE security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (btrim(source) <> ''),
  event_type text NOT NULL CHECK (btrim(event_type) <> ''),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  raw_data jsonb NOT NULL CHECK (jsonb_typeof(raw_data) = 'object'),
  normalized_data jsonb CHECK (jsonb_typeof(normalized_data) = 'object'),
  normalized_at timestamptz,
  CHECK ((normalized_data IS NULL) = (normalized_at IS NULL))
);
CREATE INDEX security_events_occurred_idx ON security_events(occurred_at DESC);
CREATE INDEX security_events_source_type_time_idx ON security_events(source, event_type, occurred_at DESC);

CREATE TABLE detection_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE CHECK (btrim(name) <> ''),
  description text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT false,
  definition jsonb NOT NULL CHECK (jsonb_typeof(definition) = 'object'),
  threat_level threat_level NOT NULL,
  created_by uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX detection_rules_creator_idx ON detection_rules(created_by);
CREATE TABLE alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES detection_rules(id) ON DELETE RESTRICT,
  threat_level threat_level NOT NULL,
  match_reason text NOT NULL CHECK (btrim(match_reason) <> ''),
  match_evidence jsonb NOT NULL CHECK (jsonb_typeof(match_evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerts_rule_idx ON alerts(rule_id);
CREATE INDEX alerts_threat_time_idx ON alerts(threat_level, created_at DESC);
CREATE TABLE alert_events (
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE RESTRICT,
  event_id uuid NOT NULL REFERENCES security_events(id) ON DELETE RESTRICT,
  PRIMARY KEY (alert_id, event_id)
);
CREATE INDEX alert_events_event_idx ON alert_events(event_id);

CREATE TABLE incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (btrim(title) <> ''),
  description text NOT NULL DEFAULT '',
  status incident_status NOT NULL DEFAULT 'NEW',
  threat_level threat_level NOT NULL,
  assigned_to uuid REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX incidents_status_time_idx ON incidents(status, created_at DESC);
CREATE INDEX incidents_threat_time_idx ON incidents(threat_level, created_at DESC);
CREATE INDEX incidents_assignee_idx ON incidents(assigned_to);
CREATE TABLE incident_alerts (
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  alert_id uuid NOT NULL REFERENCES alerts(id) ON DELETE RESTRICT,
  PRIMARY KEY (incident_id, alert_id)
);
CREATE INDEX incident_alerts_alert_idx ON incident_alerts(alert_id);

CREATE TABLE investigation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  content text NOT NULL CHECK (btrim(content) <> ''),
  evidence jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(evidence) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX investigation_notes_incident_time_idx ON investigation_notes(incident_id, created_at);
CREATE INDEX investigation_notes_author_idx ON investigation_notes(author_id);
CREATE TABLE response_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(id) ON DELETE RESTRICT,
  authorized_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL CHECK (btrim(action) <> ''),
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  result jsonb NOT NULL CHECK (jsonb_typeof(result) = 'object'),
  succeeded boolean NOT NULL,
  performed_at timestamptz NOT NULL
);
CREATE INDEX response_actions_incident_time_idx ON response_actions(incident_id, performed_at);
CREATE INDEX response_actions_actor_idx ON response_actions(authorized_by);
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  incident_id uuid REFERENCES incidents(id) ON DELETE RESTRICT,
  alert_id uuid REFERENCES alerts(id) ON DELETE RESTRICT,
  message text NOT NULL CHECK (btrim(message) <> ''),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_recipient_time_idx ON notifications(recipient_id, created_at DESC);
CREATE INDEX notifications_incident_idx ON notifications(incident_id);
CREATE INDEX notifications_alert_idx ON notifications(alert_id);
CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  actor_context text NOT NULL CHECK (btrim(actor_context) <> ''),
  action text NOT NULL CHECK (btrim(action) <> ''),
  target_type text NOT NULL CHECK (btrim(target_type) <> ''),
  target_id uuid,
  context jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(context) = 'object'),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_actor_time_idx ON audit_logs(actor_id, occurred_at DESC);
CREATE INDEX audit_logs_target_time_idx ON audit_logs(target_type, target_id, occurred_at);
CREATE INDEX audit_logs_time_idx ON audit_logs(occurred_at DESC);

CREATE TABLE mitre_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technique_id text NOT NULL UNIQUE CHECK (technique_id ~ '^T[0-9]{4}(\.[0-9]{3})?$'),
  technique_name text NOT NULL CHECK (btrim(technique_name) <> '')
);
CREATE TABLE rule_mitre_mappings (
  rule_id uuid NOT NULL REFERENCES detection_rules(id) ON DELETE RESTRICT,
  mapping_id uuid NOT NULL REFERENCES mitre_mappings(id) ON DELETE RESTRICT,
  PRIMARY KEY (rule_id, mapping_id)
);
CREATE INDEX rule_mitre_mappings_mapping_idx ON rule_mitre_mappings(mapping_id);
