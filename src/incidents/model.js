const { AuthError } = require('../auth/errors');
const { CATEGORY_CODES } = require('../threats/taxonomy');
const INCIDENT_STATUSES=Object.freeze(['NEW','CONTAINED','INVESTIGATING','RESOLVED','DISMISSED']);
const TASK18_MUTABLE_STATUSES=Object.freeze(['INVESTIGATING','RESOLVED','DISMISSED']);
const INCIDENT_SEVERITIES=Object.freeze(['LOW','MEDIUM','HIGH','CRITICAL']);
const UUID=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fail=(message='Invalid incident input.')=>{throw new AuthError(400,message);};
function text(value,max,required=true){if(typeof value!=='string'||value.length>max||value.includes('\0')||(required&&!value.trim()))fail();return value.trim();}
function incidentId(id){if(typeof id!=='string'||!UUID.test(id))fail('Invalid incident identifier.');return id;}
function userId(value){if(value===null)return null;if(typeof value!=='string'||!UUID.test(value))fail('Invalid assignee identifier.');return value;}
function alertIds(values){if(!Array.isArray(values)||values.length<1||values.length>100||new Set(values).size!==values.length||values.some(v=>typeof v!=='string'||!UUID.test(v)))fail('Select 1–100 unique alerts.');return [...values];}
function createInput(body){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='alertIds,assignedTo,description,reason,title')fail();return{title:text(body.title,200),description:text(body.description,4000,false),alertIds:alertIds(body.alertIds),assignedTo:userId(body.assignedTo),reason:text(body.reason,500)};}
function assignmentInput(body){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='assignedTo,reason')fail();return{assignedTo:userId(body.assignedTo),reason:text(body.reason,500)};}
function statusInput(body){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='reason,resolutionNote,status'||!TASK18_MUTABLE_STATUSES.includes(body.status))fail('Provide an approved Task 18 incident status.');const reason=text(body.reason,500);if(['RESOLVED','DISMISSED'].includes(body.status)){if(typeof body.resolutionNote!=='string')fail('Resolution note is required.');return{status:body.status,reason,resolutionNote:text(body.resolutionNote,4000)};}if(body.resolutionNote!==null)fail('Resolution note is only valid for terminal incident states.');return{status:body.status,reason,resolutionNote:null};}
function assessmentInput(body){if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).sort().join(',')!=='categoryCode,reason,severity'||(body.categoryCode!==null&&!CATEGORY_CODES.includes(body.categoryCode))||!INCIDENT_SEVERITIES.includes(body.severity))fail('Provide an approved incident classification, severity and reason.');return{categoryCode:body.categoryCode,severity:body.severity,reason:text(body.reason,500)};}
module.exports={INCIDENT_STATUSES,TASK18_MUTABLE_STATUSES,INCIDENT_SEVERITIES,incidentId,createInput,assignmentInput,statusInput,assessmentInput};
