'use strict';
const {isIP}=require('node:net');
const {timestamp,securityEvent}=require('../events/model');
const {AuthError}=require('../auth/errors');
/*
 * A category is reportable only by a designated authoritative issuer.
 * This catalog expresses supported SIGNAL CONTRACTS, not automatic web scanning.
 * An ordinary company website is intentionally barred from endpoint/mail/CI verdicts.
 */
const DECLARATIONS=[
 ['app_login_failed','application','BRUTE_FORCE','authentication','login','failed','LOW'],
 ['identity_password_spray','identity','CREDENTIAL_ATTACK','authentication','password_spray','failed','MEDIUM'],
 ['identity_credential_stuffing','identity','CREDENTIAL_ATTACK','authentication','credential_stuffing','failed','MEDIUM'],
 ['identity_unapproved_elevation','identity','PRIVILEGE_ESCALATION','authorization','privilege_escalation','success','HIGH'],
 ['identity_account_anomaly','identity','SUSPICIOUS_ACCOUNT_ACTIVITY','account','anomaly','suspicious','MEDIUM'],
 ['app_access_denied','application','UNAUTHORIZED_ACCESS','access','access_denied','denied','MEDIUM'],
 ['app_route_probe','application','RECONNAISSANCE','reconnaissance','probe','detected','LOW'],
 ['network_anomaly_verdict','network','SUSPICIOUS_NETWORK_ACTIVITY','network','anomalous_flow','suspicious','MEDIUM'],
 ['mail_phishing_verdict','mail','PHISHING_SOCIAL_ENGINEERING','phishing','provider_verdict','detected','MEDIUM'],
 ['endpoint_malware_verdict','endpoint','MALWARE','malware','provider_verdict','detected','MEDIUM'],
 ['endpoint_ransomware_verdict','endpoint','RANSOMWARE','ransomware','provider_verdict','detected','HIGH'],
 ['network_dos_verdict','network','DENIAL_OF_SERVICE','network','dos','detected','MEDIUM'],
 ['storage_exfiltration_verdict','storage','DATA_EXFILTRATION','data_transfer','exfiltration','detected','MEDIUM'],
 ['app_sqli_blocked','application','WEB_APPLICATION_ATTACK','web_application','sql_injection','blocked','MEDIUM'],
 ['app_xss_blocked','application','WEB_APPLICATION_ATTACK','web_application','xss','blocked','MEDIUM'],
 ['app_traversal_blocked','application','WEB_APPLICATION_ATTACK','web_application','path_traversal','blocked','MEDIUM'],
 ['app_command_injection_blocked','application','WEB_APPLICATION_ATTACK','web_application','command_injection','blocked','MEDIUM'],
 ['analyst_insider_finding','analyst','INSIDER_THREAT','insider_threat','analyst_finding','suspected','MEDIUM'],
 ['ci_supply_chain_verdict','ci','SUPPLY_CHAIN_COMPROMISE','supply_chain_compromise','integrity_verdict','detected','HIGH']
];
const EVIDENCE_SIGNALS=Object.freeze(Object.fromEntries(DECLARATIONS.map(([signal,issuer,categoryCode,type,action,status,severity])=>
 [signal,Object.freeze({issuer,categoryCode,type,action,status,severity})])));
const ISSUERS=Object.freeze([...new Set(DECLARATIONS.map(item=>item[1]))]);
const IP_REQUIRED=new Set(['identity_password_spray','identity_credential_stuffing','app_route_probe']);
const DESTINATION_REQUIRED=new Set(['network_anomaly_verdict','network_dos_verdict']);
const USER_REQUIRED=new Set(['identity_unapproved_elevation','identity_account_anomaly','analyst_insider_finding']);
const ID=/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
function reject(){throw new AuthError(400,'Invalid trusted security evidence.');}
function normalizeEvidence(body,feed,now=Date.now()){
 if(!body||typeof body!=='object'||Array.isArray(body)||
  Object.keys(body).some(k=>!['eventId','timestamp','signal','evidenceRef','sourceIp','destinationIp','subject'].includes(k)))reject();
 if(typeof body.eventId!=='string'||!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(body.eventId)||
    typeof body.evidenceRef!=='string'||!ID.test(body.evidenceRef))reject();
 const spec=EVIDENCE_SIGNALS[body.signal];
 if(!spec||spec.issuer!==feed.issuer)reject();
 let occurred;try{occurred=timestamp(body.timestamp);}catch{reject();}
 if(Math.abs(now-Date.parse(occurred))>10*60*1000)reject();
 for(const field of ['sourceIp','destinationIp'])
   if(body[field]!==undefined&&body[field]!==null&&(typeof body[field]!=='string'||!isIP(body[field])||body[field].includes('%')))reject();
 if(body.subject!==undefined&&body.subject!==null&&
    (typeof body.subject!=='string'||!/^[a-f0-9]{64}$/.test(body.subject)))reject();
 if(IP_REQUIRED.has(body.signal)&&!body.sourceIp)reject();
 if(DESTINATION_REQUIRED.has(body.signal)&&!body.destinationIp)reject();
 if(USER_REQUIRED.has(body.signal)&&!body.subject)reject();
 return securityEvent({
  timestamp:occurred,source:feed.source,type:spec.type,action:spec.action,
  status:spec.status,severity:spec.severity,sourceIp:body.sourceIp||null,
  destinationIp:body.destinationIp||null,user:body.subject||null,host:feed.host,
  rawData:{signal:body.signal,evidenceRef:body.evidenceRef},
  metadata:{sourceContract:'security-evidence-v1',issuer:spec.issuer,categoryCode:spec.categoryCode,
    tenantId:feed.tenantId,evidenceRef:body.evidenceRef,
    evidenceStatus:'source-attested-not-independently-verified',
    classification:'explicit-issuer-verdict'}
 });
}
module.exports={EVIDENCE_SIGNALS,ISSUERS,normalizeEvidence};
