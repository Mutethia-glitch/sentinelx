const {requirePermission}=require('../access/policy');
const {notificationId,inboxQuery,sendInput,readInput}=require('./model');
function notificationService(repository,access){
  async function authorize(token,permission){const identity=await access.me(token);requirePermission(identity.roles,permission);return identity.user;}
  return {
    async authorizeSend(token){return authorize(token,'notifications.send');},
    async list(token,params){const user=await authorize(token,'notifications.read');return repository.list(user.id,inboxQuery(params));},
    async send(token,body){const user=await authorize(token,'notifications.send');return repository.send(user.id,sendInput(body));},
    async markRead(token,id,body){const user=await authorize(token,'notifications.read');readInput(body);return repository.markRead(user.id,notificationId(id));},
  };
}
module.exports={notificationService};
