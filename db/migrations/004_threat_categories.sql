CREATE TABLE threat_categories (
  code text PRIMARY KEY CHECK (code IN ('BRUTE_FORCE', 'CREDENTIAL_ATTACK', 'PRIVILEGE_ESCALATION', 'SUSPICIOUS_ACCOUNT_ACTIVITY', 'UNAUTHORIZED_ACCESS', 'RECONNAISSANCE', 'SUSPICIOUS_NETWORK_ACTIVITY')),
  name text NOT NULL CHECK (btrim(name) <> '' AND length(name) <= 100),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 1000),
  enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO threat_categories(code, name, description) VALUES
  ('BRUTE_FORCE', 'Brute force', 'Repeated authentication attempts; category does not imply implemented detection.'),
  ('CREDENTIAL_ATTACK', 'Credential attacks', 'Credential-related attack activity; category does not imply implemented detection.'),
  ('PRIVILEGE_ESCALATION', 'Privilege escalation', 'Activity involving elevated permissions; category does not imply implemented detection.'),
  ('SUSPICIOUS_ACCOUNT_ACTIVITY', 'Suspicious account activity', 'Account behavior requiring investigation; category does not imply implemented detection.'),
  ('UNAUTHORIZED_ACCESS', 'Unauthorized access', 'Access without approved authorization; category does not imply implemented detection.'),
  ('RECONNAISSANCE', 'Reconnaissance', 'Discovery or probing activity observed in source evidence; category does not imply implemented detection.'),
  ('SUSPICIOUS_NETWORK_ACTIVITY', 'Suspicious network activity', 'Network behavior requiring investigation; category does not imply implemented detection.');
ALTER TABLE detection_rules ADD COLUMN category_code text REFERENCES threat_categories(code) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE incidents ADD COLUMN category_code text REFERENCES threat_categories(code) ON DELETE RESTRICT ON UPDATE RESTRICT;
CREATE INDEX detection_rules_category_idx ON detection_rules(category_code);
CREATE INDEX incidents_category_idx ON incidents(category_code);
CREATE FUNCTION check_selectable_threat_category() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE selectable boolean;
BEGIN
  IF NEW.category_code IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.category_code IS NOT DISTINCT FROM OLD.category_code THEN RETURN NEW; END IF;
  END IF;
  SELECT enabled INTO selectable FROM threat_categories WHERE code = NEW.category_code FOR SHARE;
  IF selectable IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'Threat category is not selectable.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER detection_rules_category_selectable BEFORE INSERT OR UPDATE OF category_code ON detection_rules FOR EACH ROW EXECUTE FUNCTION check_selectable_threat_category();
CREATE TRIGGER incidents_category_selectable BEFORE INSERT OR UPDATE OF category_code ON incidents FOR EACH ROW EXECUTE FUNCTION check_selectable_threat_category();
