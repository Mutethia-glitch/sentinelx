const {AuthError}=require('../auth/errors');
const {timestamp}=require('../events/model');
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
function reportQuery(params,{allowDates=true}={}){
 if(!(params instanceof URLSearchParams))throw new AuthError(400,'Invalid report parameters.');
 const allowed=new Set(allowDates?['from','to','format']:['format']);
 for(const key of params.keys())if(!allowed.has(key)||params.getAll(key).length!==1)throw new AuthError(400,'Invalid report parameters.');
 const out={format:params.get('format')||'json'};
 if(!['json','csv'].includes(out.format))throw new AuthError(400,'Unsupported report format.');
 for(const key of ['from','to'])if(params.get(key)){try{out[key]=timestamp(params.get(key));}catch{throw new AuthError(400,'Invalid report date range.');}}
 if(out.from&&out.to&&out.from>out.to)throw new AuthError(400,'Invalid report date range.');
 if(out.from&&out.to&&(Date.parse(out.to)-Date.parse(out.from)>366*86400000))throw new AuthError(400,'Report date range exceeds 366 days.');
 return out;
}
function incidentId(id){if(typeof id!=='string'||!UUID.test(id))throw new AuthError(400,'Invalid incident identifier.');return id;}
function csvEscape(value){const text=value==null?'':typeof value==='object'?JSON.stringify(value):String(value);return /[",\n\r]/.test(text)?'"'+text.replaceAll('"','""')+'"':text;}
function reportCsv(report){
 const rows=[['section','key','value']];
 function add(section,key,value){rows.push([section,key,value]);}
 function walk(section,value,prefix=''){
   if(Array.isArray(value)){value.forEach((item,index)=>walk(section,item,prefix?prefix+'.'+index:String(index)));return;}
   if(value&&typeof value==='object'){for(const [k,v] of Object.entries(value))walk(section,v,prefix?prefix+'.'+k:k);return;}
   add(section,prefix,value);
 }
 for(const [section,value] of Object.entries(report))walk(section,value);
 return rows.map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';
}
module.exports={reportQuery,incidentId,reportCsv};
