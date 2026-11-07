// Encrypted local-only recovery archive. Never prints rows, tokens or passwords.
// macOS Keychain holds the encryption key separately from the backup directory.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { createWriteStream, readFileSync, mkdirSync, chmodSync, appendFileSync, existsSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import { createGzip, gunzipSync } from 'node:zlib';
import { execFileSync, spawn } from 'node:child_process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';

const project='gwjsivqksyimuabbdyqq';
const keyService='CozyCraft local backup encryption v1';
const keyAccount='cozycraft-backup';
const security=(args)=>execFileSync('security',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
function encryptionKey(create=false) {
  let value;
  try { value=security(['find-generic-password','-s',keyService,'-a',keyAccount,'-w']); }
  catch { if(!create) throw Error('Backup encryption key unavailable in macOS Keychain'); value=randomBytes(32).toString('hex'); security(['add-generic-password','-s',keyService,'-a',keyAccount,'-w',value]); }
  if(!/^[a-f0-9]{64}$/.test(value)) throw Error('Invalid backup encryption key');
  return Buffer.from(value,'hex');
}
export async function encrypt(source,file,key) {
  const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key,iv), hash=createHash('sha256');let bytes=0;
  const output=createWriteStream(file,{flags:'wx',mode:0o600});output.write(Buffer.concat([Buffer.from('CCBACK01'),iv]));
  await pipeline(source,new Transform({transform(chunk,_encoding,done){hash.update(chunk);bytes+=chunk.length;done(null,chunk);}}),createGzip(),cipher,output);
  appendFileSync(file,cipher.getAuthTag());
  return {bytes,sha256:hash.digest('hex')};
}
export function decrypt(file,key) {
  const fd=readFileSync(file); // one encrypted object at a time, never plaintext on disk
  if(fd.subarray(0,8).toString()!=='CCBACK01'||fd.length<36)throw Error('Invalid backup format');
  const decipher=createDecipheriv('aes-256-gcm',key,fd.subarray(8,20));decipher.setAuthTag(fd.subarray(-16));
  return Readable.from(gunzipSync(Buffer.concat([decipher.update(fd.subarray(20,-16)),decipher.final()])));
}
async function verify(dir,key) {
  const chunks=[];for await(const chunk of decrypt(join(dir,'manifest.enc'),key))chunks.push(chunk);
  const manifest=JSON.parse(Buffer.concat(chunks).toString());
  for(const item of manifest.files){const hash=createHash('sha256');let bytes=0;for await(const chunk of decrypt(join(dir,item.file),key)){hash.update(chunk);bytes+=chunk.length;}if(bytes!==item.bytes||hash.digest('hex')!==item.sha256)throw Error('Backup integrity mismatch');}
  console.log(JSON.stringify({verified:true,project:manifest.project,files:manifest.files.length,storageObjects:manifest.objects.length,createdAt:manifest.createdAt,hasOperationalHistory:manifest.files.some(f=>f.file==='cron-history.enc')}));return manifest;
}
async function main() {
  const mode=process.argv[2]||'create';
  if(mode==='verify'){await verify(resolve(process.argv[3]),encryptionKey());return;}
  if(mode==='restore-check'){
    const dir=resolve(process.argv[3]),key=encryptionKey(),manifest=await verify(dir,key);
    const jsonFile=async file=>{const chunks=[];for await(const chunk of decrypt(join(dir,file),key))chunks.push(chunk);return Buffer.concat(chunks).toString();};
    const catalog=JSON.parse(await jsonFile('schema-catalog.enc'));
    const {PGlite}=await import('@electric-sql/pglite');const db=new PGlite();
    const quote=s=>'"'+s.replaceAll('"','""')+'"',literal=s=>"'"+s.replaceAll("'","''")+"'";
    let restored=0,rows=0,constraints=0;
    try{
      for(const schema of new Set(catalog.tables.map(t=>t.schema)))await db.exec(`create schema if not exists ${quote(schema)}`);
      const enums=new Map();for(const e of catalog.enums){const name=quote(e.schema)+'.'+quote(e.typname);enums.set(name,[...(enums.get(name)||[]),e.enumlabel]);}
      for(const [name,labels] of enums)await db.exec(`create type ${name} as enum (${labels.map(literal).join(',')})`);
      for(const table of manifest.files.filter(f=>f.kind==='table')){
        const name=quote(table.schema)+'.'+quote(table.table);
        const columns=catalog.columns.filter(c=>c.schema===table.schema&&c.table===table.table);
        await db.exec(`create table ${name} (${columns.map(c=>`${quote(c.name)} ${c.type}${c.attnotnull?' not null':''}`).join(',')})`);
        const payload=await jsonFile(table.file);
        await db.query(`insert into ${name} select * from jsonb_populate_recordset(null::${name},$1::jsonb)`,[payload]);
        const result=await db.query(`select count(*)::int n from ${name}`);
        if(result.rows[0].n!==table.rows)throw Error('Restored row count mismatch');restored++;rows+=table.rows;
      }
      // Verify referential integrity without executing triggers, functions,
      // cron jobs, emails, or any writes to the hosted project.
      for(const prefix of ['PRIMARY KEY','UNIQUE','FOREIGN KEY'])for(const c of catalog.constraints.filter(c=>c.definition.startsWith(prefix))){
        await db.exec(`alter table ${quote(c.schema)}.${quote(c.table)} add constraint ${quote(c.conname)} ${c.definition}`);constraints++;
      }
      console.log(JSON.stringify({logicalRowRestoreVerified:true,tables:restored,rows,relationalConstraints:constraints,scope:'In-memory typed-table and relational restore; not a full hosted Supabase disaster-recovery rehearsal'}));
    }finally{await db.close();}
    return;
  }
  if(mode==='stream'){const dir=resolve(process.argv[3]),file=process.argv[4];if(!/^(database|cron-history)\.enc$/.test(file))throw Error('Invalid archive');await pipeline(decrypt(join(dir,file),encryptionKey()),process.stdout);return;}
  if(mode!=='create')throw Error('Use create, verify DIRECTORY, or stream DIRECTORY database.enc');
  const root=resolve(homedir(),'CozyCraft Backups');mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);
  const dir=join(root,new Date().toISOString().replace(/[:.]/g,'-'));mkdirSync(dir,{mode:0o700});
  const key=encryptionKey(true);
  const raw=security(['find-generic-password','-s','Supabase CLI','-w']);const token=raw.startsWith('go-keyring-base64:')?Buffer.from(raw.slice(18),'base64').toString():raw;
  const headers={Authorization:`Bearer ${token}`,'Content-Type':'application/json'};
  const query=async sql=>{
    const r=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers,body:JSON.stringify({query:`begin read only; set local statement_timeout='25s'; ${sql}; commit;`}),signal:AbortSignal.timeout(35000)});
    if(!r.ok)throw Error(`Read-only backup query failed (${r.status}); archive incomplete`);
    return r.json();
  };
  const manifest={version:1,project,createdAt:new Date().toISOString(),files:[],objects:[],notes:['Logical recovery archive, not a physical or point-in-time snapshot. Managed platform configuration and Vault secrets require separate recovery setup.','Tables and Storage files are captured individually; this is not an atomic snapshot across tables and Storage.']};
  if(process.argv.includes('--native')) {
  const cli=process.env.COZY_SUPABASE_CLI||'supabase';
  const script=execFileSync(cli,['db','dump','--linked','--dry-run'],{env:{...process.env,SUPABASE_ACCESS_TOKEN:token},encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
  const pg={};for(const name of ['PGHOST','PGPORT','PGUSER','PGPASSWORD','PGDATABASE']){const match=script.match(new RegExp('^export '+name+'=([\x27"])([^\\n]*)\\1$','m'));if(!match)throw Error('Unsupported CLI credential output');pg[name]=match[2];}
  if(!pg.PGUSER.includes(project)&&!pg.PGHOST.includes(project))throw Error('Unexpected database project');
  // Use the native client: Docker's IPv4-only network cannot reach the Free
  // direct IPv6 endpoint. No database password reset or SSL bypass is needed.
  const dump=async(file,args)=>{
    const pgDump=process.env.COZY_PG_DUMP||'/opt/homebrew/opt/libpq/bin/pg_dump';
    const certificate=resolve('scripts/certs/supabase-prod-ca-2021.crt');
    if(!existsSync(pgDump)||!existsSync(certificate))throw Error('Install PostgreSQL client tools and the official Supabase CA certificate first');
    const child=spawn(pgDump,['--role=postgres','--format=custom','--no-owner',...args],{env:{...process.env,...pg,PGCONNECT_TIMEOUT:'15',PGSSLMODE:'verify-full',PGSSLROOTCERT:certificate},stdio:['ignore','pipe','pipe']});
    let diagnostic='';child.stderr.on('data',d=>diagnostic+=d);
    const completion=new Promise((done,fail)=>{child.on('error',fail);child.on('exit',code=>code===0?done():fail(Error('Database export failed: '+diagnostic.replaceAll(pg.PGPASSWORD,'[REDACTED]').slice(0,1200))));});
    const [entry]=await Promise.all([encrypt(child.stdout,join(dir,file),key),completion]);manifest.files.push({file,...entry});console.log(JSON.stringify({exported:file,bytes:entry.bytes}));
  };
  await dump('database.enc',['--schema=public','--schema=private','--schema=auth','--schema=storage','--schema=supabase_migrations','--schema=extensions']);
  await dump('cron-history.enc',['--data-only','--table=cron.job_run_details']);
  } else {
    // HTTPS Management API fallback for networks that cannot complete Postgres
    // connections. Row JSON is serialized by Postgres and kept verbatim so
    // bigint/numeric values never pass through JavaScript number conversion.
    const schemas="('public','private','auth','storage','supabase_migrations')";
    const tables=await query(`select n.nspname as schema,c.relname as name,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls,c.relacl::text as acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} and c.relkind='r' order by 1,2`);
    const catalog={tables};
    const catalogQueries={
      columns:`select n.nspname as schema,c.relname as table,a.attname as name,a.attnum,format_type(a.atttypid,a.atttypmod) as type,a.attnotnull,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid) as default_sql from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace left join pg_attrdef d on d.adrelid=c.oid and d.adnum=a.attnum where n.nspname in ${schemas} and c.relkind='r' and a.attnum>0 and not a.attisdropped order by 1,2,4`,
      functions:`select n.nspname as schema,p.proname,p.proacl::text as acl,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ${schemas} and p.prokind in ('f','p')`,
      constraints:`select n.nspname as schema,c.relname as table,k.conname,pg_get_constraintdef(k.oid) as definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas}`,
      policies:`select * from pg_policies where schemaname in ${schemas}`,
      indexes:`select * from pg_indexes where schemaname in ${schemas}`,
      triggers:`select n.nspname as schema,c.relname as table,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ${schemas} and not t.tgisinternal`,
      views:`select * from pg_views where schemaname in ${schemas}`,
      enums:`select n.nspname as schema,t.typname,e.enumlabel,e.enumsortorder from pg_enum e join pg_type t on t.oid=e.enumtypid join pg_namespace n on n.oid=t.typnamespace where n.nspname in ${schemas} order by 1,2,4`,
      sequences:`select * from pg_sequences where schemaname in ${schemas}`,
      extensions:'select extname,extversion from pg_extension',
      jobs:'select jobid,jobname,schedule,command,active from cron.job',
    };
    for(const [name,sql] of Object.entries(catalogQueries))catalog[name]=await query(sql);
    const save=async(file,source,meta={})=>{const info=await encrypt(source,join(dir,file),key);manifest.files.push({file,...info,...meta});};
    await save('schema-catalog.enc',Readable.from(JSON.stringify(catalog)),{kind:'schema-catalog'});
    for(let i=0;i<tables.length;i++) {
      const table=tables[i]; const quote=s=>'"'+s.replaceAll('"','""')+'"';
      const [result]=await query(`select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb)::text as payload,count(*)::int as count from ${quote(table.schema)}.${quote(table.name)} t`);
      await save(`table-${String(i).padStart(3,'0')}.enc`,Readable.from(result.payload),{kind:'table',schema:table.schema,table:table.name,rows:result.count});
      if((i+1)%20===0)console.log(JSON.stringify({tablesExported:i+1,total:tables.length}));
    }
    const [cutoff]=await query('select max(runid)::text as id from cron.job_run_details');let cursor='0',logRows=0;
    async function* logs(){
      if(!cutoff.id)return;
      while(true){
        const [page]=await query(`select coalesce(jsonb_agg(to_jsonb(t) order by runid),'[]'::jsonb)::text as payload,max(runid)::text as last,count(*)::int as count from (select * from cron.job_run_details where runid>${cursor} and runid<=${cutoff.id} order by runid limit 10000)t`);
        if(!page.count)break;
        if(!/^\d+$/.test(page.last)||BigInt(page.last)<=BigInt(cursor))throw Error('Log export cursor did not advance');
        yield page.payload+'\n';cursor=page.last;logRows+=page.count;
      }
    }
    await save('cron-history.enc',Readable.from(logs()),{kind:'log-pages'});
    manifest.cronRows=logRows;console.log(JSON.stringify({cronRows:logRows,tables:tables.length}));
  }
  const response=await fetch(`https://api.supabase.com/v1/projects/${project}/database/query`,{method:'POST',headers,body:JSON.stringify({query:'begin read only; select bucket_id,name,(metadata->>\'size\')::bigint as bytes from storage.objects order by bucket_id,name; commit;'}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Storage inventory unavailable');const objects=await response.json();
  const keysResponse=await fetch(`https://api.supabase.com/v1/projects/${project}/api-keys`,{headers,signal:AbortSignal.timeout(15000)});const keys=await keysResponse.json();const service=keys.find(k=>k.name==='service_role')?.api_key;if(!service)throw Error('Storage backup credential unavailable');
  for(let i=0;i<objects.length;i++){
    const object=objects[i],file=`object-${String(i).padStart(5,'0')}.enc`;
    const url=`https://${project}.supabase.co/storage/v1/object/authenticated/${encodeURIComponent(object.bucket_id)}/${object.name.split('/').map(encodeURIComponent).join('/')}`;
    const r=await fetch(url,{headers:{apikey:service,Authorization:`Bearer ${service}`},signal:AbortSignal.timeout(60000)});if(!r.ok||!r.body)throw Error(`Storage backup failed at object ${i}; archive incomplete`);
    const entry=await encrypt(Readable.fromWeb(r.body),join(dir,file),key);if(object.bytes!==null&&entry.bytes!==object.bytes)throw Error('Storage size changed during backup');
    manifest.files.push({file,...entry});manifest.objects.push({file,bucket:object.bucket_id,name:object.name});
    if((i+1)%50===0)console.log(JSON.stringify({storageProgress:i+1,total:objects.length}));
  }
  await encrypt(Readable.from(JSON.stringify(manifest)),join(dir,'manifest.enc'),key);
  await verify(dir,key);console.log(JSON.stringify({backupDirectory:dir,keyLocation:'macOS Keychain: '+keyService}));
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(new URL(import.meta.url).pathname))main().catch(error=>{console.error('Backup did not complete. Existing encrypted output is retained; no secrets are printed.');if(!error.code)console.error(error.message);process.exitCode=1;});
