const { spawnSync } = require('node:child_process');
function executeSql(sql,sourceEnv=process.env) {
  const env = { ...sourceEnv };
  if (env.DATABASE_URL) {
    let url;
    try { url = new URL(env.DATABASE_URL); } catch { throw new Error('Invalid DATABASE_URL.'); }
    if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('PostgreSQL URL required.');
    if (url.search && [...url.searchParams.keys()].some(key => key !== 'sslmode')) throw new Error('Only sslmode is supported in DATABASE_URL query parameters.');
    env.PGHOST=url.hostname;env.PGPORT=url.port||'5432';env.PGUSER=decodeURIComponent(url.username);env.PGPASSWORD=decodeURIComponent(url.password);env.PGDATABASE=decodeURIComponent(url.pathname.slice(1));
    if(!env.PGHOST||!env.PGUSER||!env.PGDATABASE)throw new Error('Incomplete DATABASE_URL.');
    if(url.searchParams.has('sslmode'))env.PGSSLMODE=url.searchParams.get('sslmode');
    delete env.DATABASE_URL;
  } else if (!env.PGDATABASE) throw new Error('Set DATABASE_URL or PostgreSQL PG* environment variables.');
  const result=spawnSync('psql',['-X','--no-password','-v','ON_ERROR_STOP=1','-q'],{env,input:sql,encoding:'utf8',maxBuffer:1024*1024});
  if(result.error||result.status!==0)throw new Error('PostgreSQL operation failed. Check database access and SQL locally.');
}
module.exports={executeSql};
