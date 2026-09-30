const {requirePermission}=require('../access/policy');
const {auditQuery}=require('./model');
function auditService(repository,access){return{async list(token,params){const identity=await access.me(token);requirePermission(identity.roles,'audit.read');return repository.list(auditQuery(params));}};}
module.exports={auditService};
