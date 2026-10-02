const { AuthError } = require('../auth/errors');
const { loginInput,activationInput } = require('../auth/validation');
const { loginLimiter } = require('../auth/rate-limit');
const {pseudonymousLoginSubject}=require('../auth/subject');

function cookieToken(header, name) {
  if (!header) return null;
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(`${name}=`));
  if (matches.length !== 1) return null;
  return matches[0].slice(name.length + 1);
}
function sessionCookie(token, config, clear = false) {
  return `${config.cookieName}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : config.sessionSeconds}${config.secureCookie ? '; Secure' : ''}`;
}
function challengeCookie(id,config,clear=false){
  const name=config.challengeCookieName||'sentinelx_2fa',seconds=Number.isInteger(config.otpSeconds)?config.otpSeconds:600;
  return `${name}=${clear?'':id}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear?0:seconds}${config.secureCookie?'; Secure':''}`;
}
function readJson(req) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] || '') || req.headers['content-encoding']) {
    req.resume();
    return Promise.reject(new AuthError(415, 'Use application/json.'));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let rejected = false;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > 8192) {
        if (!rejected) { rejected = true; chunks.length = 0; reject(new AuthError(413, 'Request too large.')); }
      } else if (!rejected) chunks.push(chunk);
    });
    req.on('end', () => {
      if (rejected) return;
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new AuthError(400, 'Invalid JSON input.')); }
    });
    req.on('error', () => reject(new AuthError(400, 'Invalid request.')));
    req.on('aborted', () => reject(new AuthError(400, 'Invalid request.')));
  });
}
function authHandler(service, config, limiter = loginLimiter()) {
  const routes=new Set(['/api/auth/login','/api/auth/verify-2fa','/api/auth/resend-2fa','/api/auth/activate','/api/auth/logout','/api/auth/me']);
  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    const send = (status, body) => { res.statusCode = status; res.end(body ? JSON.stringify(body) : undefined); };
    const path = req.url;
    try {
      if (!routes.has(path)) return send(404, { error: 'Not found.' });
      const get=path==='/api/auth/me';
      if((get&&req.method!=='GET')||(!get&&req.method!=='POST')){
        res.setHeader('Allow',get?'GET':'POST');return send(405,{error:'Method not allowed.'});
      }
      if(req.method==='POST'&&req.headers.origin!==config.origin){
        req.resume();throw new AuthError(403,'Request origin rejected.');
      }
      const token=cookieToken(req.headers.cookie,config.cookieName);
      const challenge=cookieToken(req.headers.cookie,config.challengeCookieName);
      const client=req.sentinelxClientAddress||req.socket.remoteAddress||'unknown';

      if(path==='/api/auth/login'){
        limiter.ip(client);
        const input=loginInput(await readJson(req));limiter.account(input.email);
      // The response monitor may observe HTTP 401, but must never store an email.
      req.sentinelxAuthSubject=pseudonymousLoginSubject(config.otpSecret,input.email);
        const login=await service.login(input);
        if(login.requiresTwoFactor){
          res.setHeader('Set-Cookie',challengeCookie(login.challengeId,config));
          return send(202,{requiresTwoFactor:true,expiresInSeconds:login.expiresInSeconds});
        }
        res.setHeader('Set-Cookie',sessionCookie(login.token,config));
        return send(200,{user:login.user});
      }
      if(path==='/api/auth/verify-2fa'){
        limiter.ip(client);
        const verified=await service.verifyTwoFactor(challenge,await readJson(req));
        res.setHeader('Set-Cookie',[sessionCookie(verified.token,config),challengeCookie('',config,true)]);
        return send(200,{user:verified.user});
      }
      if(path==='/api/auth/resend-2fa'){
        limiter.ip(client);
        const body=await readJson(req);
        if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new AuthError(400,'Resend requires an empty JSON object.');
        const result=await service.resendTwoFactor(challenge);
        res.setHeader('Set-Cookie',challengeCookie(challenge,config));
        return send(200,result);
      }
      if(path==='/api/auth/activate'){
        limiter.ip(client);
        const input=activationInput(await readJson(req));limiter.account(input.email);
        const activated=await service.activate(input);
        return send(200,{user:activated.user,activated:true});
      }
      if(path==='/api/auth/me')return send(200,{user:await service.currentUser(token)});
      const body=await readJson(req);
      if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)throw new AuthError(400,'Logout requires an empty JSON object.');
      await service.logout(token);
      res.setHeader('Set-Cookie',[sessionCookie('',config,true),challengeCookie('',config,true)]);
      return send(204);
    } catch (error) {
      const expected=error instanceof AuthError;
      const status=expected?error.status:503;
      if(status===401&&!['/api/auth/login','/api/auth/verify-2fa','/api/auth/resend-2fa'].includes(path)){
        res.setHeader('Set-Cookie',[sessionCookie('',config,true),challengeCookie('',config,true)]);
      }
      if(status===429)res.setHeader('Retry-After','60');
      return send(status,{error:expected?error.message:'Authentication temporarily unavailable.'});
    }
  };
}
module.exports={authHandler,cookieToken,sessionCookie,challengeCookie,readJson};
