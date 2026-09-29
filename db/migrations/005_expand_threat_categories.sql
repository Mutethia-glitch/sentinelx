-- User-approved expansion: classification catalog only, not detection coverage.
-- Do not edit migration 004, which may already be applied.
ALTER TABLE threat_categories DROP CONSTRAINT threat_categories_code_check;
ALTER TABLE threat_categories ADD CONSTRAINT threat_categories_code_check CHECK (code IN (
  'BRUTE_FORCE', 'CREDENTIAL_ATTACK', 'PRIVILEGE_ESCALATION', 'SUSPICIOUS_ACCOUNT_ACTIVITY',
  'UNAUTHORIZED_ACCESS', 'RECONNAISSANCE', 'SUSPICIOUS_NETWORK_ACTIVITY',
  'PHISHING_SOCIAL_ENGINEERING', 'MALWARE', 'RANSOMWARE', 'DENIAL_OF_SERVICE',
  'DATA_EXFILTRATION', 'WEB_APPLICATION_ATTACK', 'INSIDER_THREAT', 'SUPPLY_CHAIN_COMPROMISE'
));
INSERT INTO threat_categories(code, name, description) VALUES
  ('PHISHING_SOCIAL_ENGINEERING', 'Phishing and social engineering', 'Deceptive messages or impersonation, including business email compromise; classification only, no detection claim.'),
  ('MALWARE', 'Malware', 'Malicious software activity without a more specific supported classification; classification only, no detection claim.'),
  ('RANSOMWARE', 'Ransomware', 'Ransomware-related encryption or extortion evidence; classification only, no detection claim.'),
  ('DENIAL_OF_SERVICE', 'Denial of service (DoS/DDoS)', 'Activity disrupting service availability through resource or traffic exhaustion; classification only, no detection claim.'),
  ('DATA_EXFILTRATION', 'Data exfiltration', 'Unauthorized removal or transfer of organization data; classification only, no detection claim.'),
  ('WEB_APPLICATION_ATTACK', 'Web application attacks', 'Attacks targeting web applications or their APIs, including injection; classification only, no detection claim.'),
  ('INSIDER_THREAT', 'Insider threat', 'Harmful misuse of legitimate organizational access; classification only, no detection claim.'),
  ('SUPPLY_CHAIN_COMPROMISE', 'Supply-chain compromise', 'Compromise involving a vendor, dependency or trusted service provider; classification only, no detection claim.');
