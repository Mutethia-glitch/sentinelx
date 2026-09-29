ALTER TABLE detection_rules ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE detection_rules ADD COLUMN version integer NOT NULL DEFAULT 1 CHECK (version > 0);
INSERT INTO mitre_mappings(technique_id, technique_name) VALUES
  ('T1110', 'Brute Force'), ('T1078', 'Valid Accounts'), ('T1087', 'Account Discovery')
ON CONFLICT (technique_id) DO NOTHING;
