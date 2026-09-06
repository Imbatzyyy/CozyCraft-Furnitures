// Transactional role simulation: synthetic sessions are ALWAYS rolled back.
// Returns booleans/counts only. No tokens, emails, customer rows or messages.
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
const query = `begin;
create temporary table security_results(label text,passed boolean) on commit drop;
grant insert on security_results to authenticated;
do $$ declare u uuid; s uuid:=gen_random_uuid(); begin
  select id into u from public.profiles where role='superadmin' and staff_active limit 1;
  if u is null then raise exception 'No testable administrator identity'; end if;
  insert into auth.sessions(id,user_id,created_at,updated_at) values(s,u,now(),now());
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',s)::text,true);
end $$;
set local role authenticated;
insert into security_results select 'admin_before_mfa_denied',not public.security_action_allowed();
insert into security_results select 'directory_before_mfa_empty',count(*)=0 from public.admin_customer_directory();
insert into security_results select 'profiles_before_mfa_empty',count(*)=0 from public.profiles where role='customer';
reset role;
select set_config('request.jwt.claims',(current_setting('request.jwt.claims')::jsonb||jsonb_build_object('aal','aal2'))::text,true);
set local role authenticated;
insert into security_results select 'admin_after_mfa_allowed',public.security_action_allowed();
reset role;
insert into public.customer_device_sessions(session_id,user_id,device_label,browser_label,revoked_at)
values((auth.jwt()->>'session_id')::uuid,auth.uid(),'Security test','Security test',now());
set local role authenticated;
insert into security_results select 'revoked_session_denied',not public.security_action_allowed();
reset role;
select coalesce(jsonb_agg(jsonb_build_object('check',label,'passed',passed)),'[]') as checks from security_results;
rollback;`;
const result = execFileSync('npx',['supabase','db','query','--linked',query],{encoding:'utf8'});
// The CLI returns only the final SELECT rows; avoid printing incidental claims.
const parsed = JSON.parse(result);
const checks = parsed.rows?.find(row=>row.checks)?.checks;
assert.ok(Array.isArray(checks) && checks.length===5,'All live assertions returned');
assert.ok(checks.every(check=>check.passed),'Live authorization assertion failed');
console.log(JSON.stringify(checks));
