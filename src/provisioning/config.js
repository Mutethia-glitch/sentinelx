const {emailConfig}=require('../email/delivery');
function provisioningConfig(env=process.env){
 const required=name=>{const value=env[name];if(typeof value!=='string'||!value.trim())throw new Error('Set '+name+'.');return value.trim();};
 const token=required('TENANT_PROVISIONER_TOKEN');if(token.length<32)throw new Error('Provisioner token must contain at least 32 characters.');
 const ownerId=required('RENDER_OWNER_ID'),orgId=required('NEON_ORG_ID');
 if(!/^tea-[a-z0-9]+$/.test(ownerId)||!/^org-[a-z0-9-]+$/.test(orgId))throw new Error('Invalid provider ownership configuration.');
 const originMode='render';
 const port=Number(env.PORT||env.PROVISIONER_PORT||3200);if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Invalid provisioner port.');
 const repo=env.TENANT_REPOSITORY_URL||'https://github.com/Mutethia-glitch/sentinelx';
 if(!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo))throw new Error('Invalid tenant repository URL.');
 const signupUrl=env.COMPANY_SIGNUP_URL||'';
 if(signupUrl){let parsed;try{parsed=new URL(signupUrl);}catch{throw new Error('Invalid COMPANY_SIGNUP_URL.');}if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw new Error('Invalid COMPANY_SIGNUP_URL.');}
 const otpKey=required('PROVISIONER_OTP_KEY');if(otpKey.length<32)throw new Error('Provisioner OTP derivation key must contain at least 32 characters.');
 return{token,ownerId,orgId,originMode,port,repo,otpKey,signupUrl,databaseUrl:required('PLATFORM_DATABASE_URL'),
  renderKey:required('RENDER_API_KEY'),neonKey:required('NEON_API_KEY'),email:emailConfig({...env,NODE_ENV:'production'})};
}
module.exports={provisioningConfig};
