const {requirePermission}=require('../access/policy');
const {reportQuery,incidentId}=require('./model');
function reportService(repository,access){
 async function authorize(token){const identity=await access.me(token);requirePermission(identity.roles,'reports.read');}
 return {
  async security(token,params){await authorize(token);const query=reportQuery(params);return{format:query.format,report:await repository.security(query)};},
  async incident(token,id,params){await authorize(token);const query=reportQuery(params);return{format:query.format,report:await repository.incident(incidentId(id),query)};},
 };
}
module.exports={reportService};
