-- Task 28: documented contextual MITRE ATT&CK mapping for implemented core rules.
-- This is intentionally partial coverage; broad rules without a precise technique remain unmapped.
CREATE TABLE mitre_tactics (
  tactic_id text PRIMARY KEY CHECK (tactic_id ~ '^TA[0-9]{4}$'),
  tactic_name text NOT NULL UNIQUE CHECK (btrim(tactic_name) <> '')
);
CREATE TABLE mitre_mapping_tactics (
  mapping_id uuid NOT NULL REFERENCES mitre_mappings(id) ON DELETE RESTRICT,
  tactic_id text NOT NULL REFERENCES mitre_tactics(tactic_id) ON DELETE RESTRICT,
  PRIMARY KEY(mapping_id,tactic_id)
);
CREATE INDEX mitre_mapping_tactics_tactic_idx ON mitre_mapping_tactics(tactic_id);

INSERT INTO mitre_tactics(tactic_id,tactic_name) VALUES
 ('TA0001','Initial Access'),
 ('TA0006','Credential Access'),
 ('TA0007','Discovery'),
 ('TA0040','Impact');

INSERT INTO mitre_mappings(technique_id,technique_name) VALUES
 ('T1046','Network Service Discovery'),
 ('T1190','Exploit Public-Facing Application'),
 ('T1195','Supply Chain Compromise'),
 ('T1486','Data Encrypted for Impact'),
 ('T1498','Network Denial of Service'),
 ('T1566','Phishing')
ON CONFLICT (technique_id) DO NOTHING;

INSERT INTO mitre_mapping_tactics(mapping_id,tactic_id)
SELECT m.id,x.tactic_id FROM (VALUES
 ('T1110','TA0006'),
 ('T1046','TA0007'),
 ('T1190','TA0001'),
 ('T1195','TA0001'),
 ('T1486','TA0040'),
 ('T1498','TA0040'),
 ('T1566','TA0001')
) x(technique_id,tactic_id)
JOIN mitre_mappings m ON m.technique_id=x.technique_id
ON CONFLICT DO NOTHING;

INSERT INTO rule_mitre_mappings(rule_id,mapping_id)
SELECT r.id,m.id FROM (VALUES
 ('SX-CORE-001 Brute force authentication failures','T1110'),
 ('SX-CORE-002 Credential attack indicators','T1110'),
 ('SX-CORE-006 Reconnaissance activity','T1046'),
 ('SX-CORE-008 Phishing or social engineering report','T1566'),
 ('SX-CORE-010 Ransomware event','T1486'),
 ('SX-CORE-011 Denial of service indicators','T1498'),
 ('SX-CORE-015 Supply chain compromise classification','T1195')
) x(rule_name,technique_id)
JOIN detection_rules r ON r.name=x.rule_name
JOIN mitre_mappings m ON m.technique_id=x.technique_id
ON CONFLICT DO NOTHING;
