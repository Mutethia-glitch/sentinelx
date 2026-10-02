-- Task 41: align three disabled core rule grouping contracts to real source attribution.
-- Does not enable rules, change categories, create alerts or rewrite historical evidence.
-- Apply separately to each isolated tenant using the guarded migration runner.
DO $task41$
DECLARE eligible integer;
BEGIN
 SELECT count(*) INTO eligible FROM detection_rules
 WHERE enabled=false AND version=1 AND (
   (name='SX-CORE-001 Brute force authentication failures' AND definition->'groupBy'='["sourceIp","user"]'::jsonb)
   OR (name='SX-CORE-005 Repeated unauthorized access attempts' AND definition->'groupBy'='["sourceIp","user"]'::jsonb)
   OR (name='SX-CORE-006 Reconnaissance activity' AND definition->'groupBy'='["sourceIp","destinationIp"]'::jsonb)
 );
 IF eligible<>3 THEN
   RAISE EXCEPTION 'Task 41 rule grouping precondition failed: expected exactly three unmodified disabled core rules';
 END IF;

 UPDATE detection_rules SET
   definition=jsonb_set(definition,'{groupBy}',
     CASE name
       WHEN 'SX-CORE-001 Brute force authentication failures' THEN '["user"]'::jsonb
       WHEN 'SX-CORE-005 Repeated unauthorized access attempts' THEN '["sourceIp"]'::jsonb
       WHEN 'SX-CORE-006 Reconnaissance activity' THEN '["sourceIp","host"]'::jsonb
     END),
   description=CASE name
     WHEN 'SX-CORE-001 Brute force authentication failures' THEN
       'Detects five failed logins against the same pseudonymous target account within five minutes; unverified client IPs remain null.'
     WHEN 'SX-CORE-005 Repeated unauthorized access attempts' THEN
       'Detects three denied access events attributed to the same source IP within five minutes.'
     WHEN 'SX-CORE-006 Reconnaissance activity' THEN
       'Detects three source-attested reconnaissance probes from the same source IP against the same registered application host.'
   END,
   version=version+1,updated_at=clock_timestamp()
 WHERE enabled=false AND version=1 AND name IN (
   'SX-CORE-001 Brute force authentication failures',
   'SX-CORE-005 Repeated unauthorized access attempts',
   'SX-CORE-006 Reconnaissance activity'
 );
 GET DIAGNOSTICS eligible=ROW_COUNT;
 IF eligible<>3 THEN RAISE EXCEPTION 'Task 41 rule migration affected unexpected rows'; END IF;
END
$task41$;
