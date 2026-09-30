const { isIP } = require('node:net');
const { AuthError } = require('../auth/errors');
const { timestamp } = require('../events/model');
const { CATEGORY_CODES } = require('../threats/taxonomy');

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const MITRE = /^T[0-9]{4}(?:\.[0-9]{3})?$/;
const SEVERITIES = Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
const ALERT_STATUSES = Object.freeze(['NEW','ACKNOWLEDGED']);
const INCIDENT_STATUSES = Object.freeze(['NEW','INVESTIGATING','CONTAINED','RESOLVED','DISMISSED']);
const COMMON = Object.freeze(['q','severity','status','categoryCode','source','sourceIp','destinationIp',
  'user','host','ruleId','mitreTechniqueId','from','to','page']);
const EXTRA = Object.freeze({
  event:['type','action'],
  alert:[],
  incident:['assignedTo'],
});

function parseFilters(kind, params) {
  const bad = () => { throw new AuthError(400, 'Invalid search filters.'); };
  if (!Object.hasOwn(EXTRA,kind) || !(params instanceof URLSearchParams) || params.toString().length > 4096) bad();
  const allowed = new Set([...COMMON,...EXTRA[kind]]);
  const result = { page:1 };
  for(const [key,raw] of params) {
    if(!allowed.has(key) || params.getAll(key).length!==1 || !raw || raw.includes('\0') || !raw.trim())bad();
    const value=raw.trim();
    if(key==='page'){
      if(!/^[1-9][0-9]{0,3}$/.test(value)||Number(value)>2000)bad();
      result.page=Number(value);
    } else if(key==='from'||key==='to'){
      try{result[key]=timestamp(value);}catch{bad();}
    } else if(key==='sourceIp'||key==='destinationIp'){
      if(value.length>45||!isIP(value))bad();
      result[key]=value;
    } else if(key==='severity'){
      if(!(kind==='event'&&value==='UNKNOWN')&&!SEVERITIES.includes(value))bad();
      result[key]=value;
    } else if(key==='status'){
      if(kind==='alert'&&!ALERT_STATUSES.includes(value))bad();
      if(kind==='incident'&&!INCIDENT_STATUSES.includes(value))bad();
      if(value.length>500)bad();
      result[key]=value;
    } else if(key==='categoryCode'){
      if(!CATEGORY_CODES.includes(value)&&!(kind==='incident'&&value==='UNCLASSIFIED'))bad();
      result[key]=value;
    } else if(key==='ruleId'){
      if(!UUID.test(value))bad();
      result[key]=value;
    } else if(key==='mitreTechniqueId'){
      if(!MITRE.test(value))bad();
      result[key]=value;
    } else if(key==='assignedTo'){
      if(value!=='UNASSIGNED'&&!UUID.test(value))bad();
      result[key]=value;
    } else {
      if(value.length>(key==='q'?200:500))bad();
      result[key]=value;
    }
  }
  if(result.from&&result.to&&result.from>result.to)bad();
  return result;
}
module.exports={parseFilters,COMMON,EXTRA,UUID,MITRE,SEVERITIES,ALERT_STATUSES,INCIDENT_STATUSES};
