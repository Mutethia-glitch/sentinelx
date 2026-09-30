const { AuthError } = require('../auth/errors');
const { validateUserId } = require('../access/policy');
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const STATUSES=Object.freeze(['ALL','UNREAD','READ']);
const SEVERITIES=Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
function invalid(message='Invalid notification request.'){throw new AuthError(400,message);}
function notificationId(id){if(typeof id!=='string'||!UUID.test(id))invalid('Invalid notification identifier.');return id;}
function inboxQuery(params){
  if(!(params instanceof URLSearchParams)||
    [...params.keys()].some(key=>!['status','page'].includes(key))||
    params.getAll('page').length>1||params.getAll('status').length>1)invalid('Invalid inbox filters.');
  const status=params.get('status')||'ALL',raw=params.get('page')||'1';
  if(!STATUSES.includes(status)||!/^[1-9][0-9]{0,3}$/.test(raw)||Number(raw)>2000)invalid('Invalid inbox filters.');
  return {status,page:Number(raw)};
}
function sendInput(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join(',')!=='alertId,incidentId,reason,recipientId')invalid();
  const incident=body.incidentId,alert=body.alertId;
  if((incident===null)===(alert===null))invalid('Select exactly one incident or alert.');
  if(incident!==null&&(typeof incident!=='string'||!UUID.test(incident)))invalid('Invalid incident identifier.');
  if(alert!==null&&(typeof alert!=='string'||!UUID.test(alert)))invalid('Invalid alert identifier.');
  if(typeof body.reason!=='string'||!body.reason.trim()||body.reason.length>500||body.reason.includes('\0'))invalid('Provide a reason (1–500 characters).');
  return {recipientId:validateUserId(body.recipientId),incidentId:incident,alertId:alert,reason:body.reason.trim()};
}
function readInput(body){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==0)invalid('Mark read requires an empty JSON object.');
  return {};
}
function deliveryMessage(severity,kind){
  if(!SEVERITIES.includes(severity)||!['INCIDENT','ALERT'].includes(kind))throw new TypeError('Unsupported notification source.');
  return severity+' '+(kind==='INCIDENT'?'incident':'alert')+(severity==='HIGH'||severity==='CRITICAL'?' requires timely review.':' shared for review.');
}
module.exports={STATUSES,SEVERITIES,notificationId,inboxQuery,sendInput,readInput,deliveryMessage};
