const {requirePermission}=require('../access/policy');
function dashboardService(repository,access){
  return {
    async snapshot(token){
      const identity=await access.me(token);
      requirePermission(identity.roles,'dashboard.read');
      return repository.snapshot();
    },
  };
}
module.exports={dashboardService};
