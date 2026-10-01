const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {executeSql}=require('../src/data/postgres');
function platformMigrationSql(){
 const directory=path.join(__dirname,'../platform/db/migrations');
 const files=fs.readdirSync(directory).filter(name=>/^\d{3}_[a-z0-9_]+\.sql$/.test(name)).sort();
 if(!files.length)throw new Error('No platform migrations found.');
 const blocks=files.map(name=>{const sql=fs.readFileSync(path.join(directory,name),'utf8'),checksum=createHash('sha256').update(sql).digest('hex');
 return`DO $migration$ BEGIN
 IF EXISTS(SELECT 1 FROM platform_schema_migrations WHERE name='${name}' AND checksum<>'${checksum}') THEN RAISE EXCEPTION 'Applied platform migration checksum mismatch'; END IF;
 IF NOT EXISTS(SELECT 1 FROM platform_schema_migrations WHERE name='${name}') THEN
 ${sql}
 INSERT INTO platform_schema_migrations(name,checksum) VALUES('${name}','${checksum}');
 END IF; END; $migration$;`;});
 return`BEGIN;SELECT pg_advisory_xact_lock(73482141);
 CREATE TABLE IF NOT EXISTS platform_schema_migrations(name text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz NOT NULL DEFAULT now());
 ${blocks.join('\n')} COMMIT;`;
}
if(require.main===module){try{if(!process.env.PLATFORM_DATABASE_URL)throw new Error('Set PLATFORM_DATABASE_URL.');executeSql(platformMigrationSql(),{...process.env,DATABASE_URL:process.env.PLATFORM_DATABASE_URL});console.log('SentinelX platform migrations verified/applied.');}catch(error){console.error(error.message);process.exitCode=1;}}
module.exports={platformMigrationSql};
