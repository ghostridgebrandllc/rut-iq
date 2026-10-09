begin;
create temp table rut_qa_ids(role text,id uuid default gen_random_uuid());
insert into rut_qa_ids(role) values('free'),('pro'),('other');
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'authenticated','authenticated',role||'-rut-test@example.invalid','{"rut_iq_qa":true}'::jsonb,'{}'::jsonb,now(),now() from rut_qa_ids;
do $$
declare f uuid; p uuid; o uuid; n bigint;
begin
 select id into f from rut_qa_ids where role='free';
 select id into p from rut_qa_ids where role='pro';
 select id into o from rut_qa_ids where role='other';
 assert (select count(*)=3 from public.rut_memberships where user_id in(f,p,o) and plan='free' and source='free' and status='active'),'automatic free membership';
 perform set_config('request.jwt.claim.sub',f::text,true);
 set local role authenticated;
 assert not public.rut_is_pro(),'free denied';
 assert (select count(*)=1 from public.rut_memberships),'own membership only';
 assert not has_table_privilege('authenticated','public.rut_reports','TRUNCATE'),'no truncate';
 begin
  update public.rut_memberships set plan='pro' where user_id=f;
  raise exception 'FAIL self upgrade';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.rut_pro_county_signals();
  raise exception 'FAIL free pro RPC';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.rut_county_signals;
  raise exception 'FAIL raw signal view';
 exception when insufficient_privilege then null; end;
 insert into public.rut_reports(user_id,state,county,behavior,observed_on,notes) values(f,'Alabama','Tuscaloosa County','Cruising',current_date,'ISOLATED QA ONLY');
 assert (select status='hidden' from public.rut_reports where user_id=f),'QA hidden';
 begin
  insert into public.rut_reports(user_id,state,county,behavior,observed_on) values(o,'Alabama','Tuscaloosa County','Chasing',current_date);
  raise exception 'FAIL spoofed owner';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.rut_reports(user_id,state,county,behavior,observed_on,status) values(f,'Alabama','Tuscaloosa County','Chasing',current_date,'approved');
  raise exception 'FAIL status spoof';
 exception when insufficient_privilege then null; end;
 reset role;
 -- These fixtures are uncommitted and cannot be seen by API clients.
 update public.rut_reports set status='approved' where user_id=f;
 insert into public.rut_reports(user_id,state,county,behavior,observed_on) values(p,'Alabama','Tuscaloosa County','Chasing',current_date-10);
 update public.rut_reports set status='approved' where user_id=p;
 update public.rut_memberships set plan='pro',source='tester' where user_id=p;
 set local role anon;
 assert (select reports_7d=1 from public.rut_free_county_activity where state='Alabama' and county='Tuscaloosa County'),'7d aggregate';
 assert (select reports_24h=1 and cruising_24h=1 from public.rut_daily_county_reports where state='Alabama' and county='Tuscaloosa County'),'daily aggregate';
 perform set_config('request.jwt.claim.sub','',true);
 assert (select count(*)=0 from public.rut_public_reports),'guest raw reports blocked';
 reset role;
 perform set_config('request.jwt.claim.sub',f::text,true);
 set local role authenticated;
 assert (select count(*)=0 from public.rut_public_reports),'free raw behavior blocked';
 assert (select count(*)=1 from public.rut_reports),'own raw reports only';
 reset role;
 perform set_config('request.jwt.claim.sub',p::text,true);
 set local role authenticated;
 assert public.rut_is_pro(),'authorized tester';
 assert (select reports_7d=1 and reports_30d=2 and chasing_30d=1 from public.rut_pro_county_signals() where state='Alabama' and county='Tuscaloosa County'),'pro aggregates';
 assert (select count(*)=1 from public.rut_public_reports),'pro sanitized reports';
 reset role;
 update public.rut_memberships set current_period_end=now()-interval '1 minute' where user_id=p;
 set local role authenticated;
 assert not public.rut_is_pro(),'expired tester denied';
 begin
  perform * from public.rut_pro_county_signals();
  raise exception 'FAIL expired pro';
 exception when insufficient_privilege then null; end;
 reset role;
 update public.rut_memberships set source='stripe',current_period_end=null where user_id=p;
 set local role authenticated;
 assert not public.rut_is_pro(),'stripe missing period denied';
 reset role;
 update public.rut_memberships set current_period_end=now()+interval '1 day' where user_id=p;
 set local role authenticated;
 assert public.rut_is_pro(),'active stripe entitlement';
 reset role;
 update public.rut_memberships set status='past_due' where user_id=p;
 set local role authenticated;
 assert not public.rut_is_pro(),'past due denied';
 reset role;
end $$;
select 'PASS: automatic Free, role isolation, self-upgrade denial, owner spoof denial, protected status/timestamps, hidden QA, 7/30-day aggregation, Daily Report, Pro tester, expiry and Stripe entitlement states' as result;
rollback;