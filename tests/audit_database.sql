begin;

create temp table rut_audit_ids as select gen_random_uuid() id from generate_series(1,7);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select id,'authenticated','authenticated','audit-'||id||'@example.invalid','{"rut_iq_qa":true}'::jsonb,'{}'::jsonb,now(),now() from rut_audit_ids;
select set_config('request.jwt.claim.sub',(select id::text from rut_audit_ids limit 1),true);
do $$ begin
 set local role authenticated;
 begin
  insert into public.rut_reports(user_id,state,county,behavior,observed_on)
  values(auth.uid(),'Alabama','This County Does Not Exist','Cruising',current_date);
  raise exception 'FAIL invalid county accepted';
 exception when foreign_key_violation then null; end;
 begin
  perform * from public.rut_pro_signals_for_day(current_date);
  raise exception 'FAIL free Pro access';
 exception when insufficient_privilege then null; end;
 begin
  perform * from public.rut_free_counties_for_day(current_date-2);
  raise exception 'FAIL arbitrary historical day';
 exception when invalid_parameter_value then null; end;
 reset role;
end $$;
insert into public.rut_reports(user_id,state,county,behavior,observed_on)
select i.id,'Alabama','Tuscaloosa County',b, current_date-d
from rut_audit_ids i cross join unnest(array['Cruising','Chasing','Tending a doe','Breeding observed','Scrape / rub activity']) b cross join generate_series(0,5) d;
do $$ begin
 assert (select bool_and(status='hidden') from public.rut_reports where user_id in(select id from rut_audit_ids)),'QA hidden';
end $$;
-- These records remain uncommitted and are never visible to public clients.
update public.rut_reports set status='approved' where user_id in(select id from rut_audit_ids);
update public.rut_memberships set plan='pro',source='tester' where user_id in(select id from rut_audit_ids);
do $$ begin
 set local role authenticated;
 assert (select reports_7d=210 and cruising_7d=42 and reports_30d=210 from public.rut_pro_signals_for_day(current_date) where county='Tuscaloosa County' and state='Alabama'),'complete aggregates beyond 200';
 assert (select reports_7d=175 from public.rut_free_counties_for_day(current_date-1) where county='Tuscaloosa County' and state='Alabama'),'local day excludes next day';
 assert (select reports_24h=70 from public.rut_daily_counties_for_day(current_date) where county='Tuscaloosa County' and state='Alabama'),'today yesterday local daily';
 assert (select count(*)=210 from public.rut_reports_for_day(current_date) where county='Tuscaloosa County' and state='Alabama'),'detail shares date window';
 reset role;
end $$;
select 'PASS canonical counties, date bounds, local calendar, hidden QA, Free/Pro gates, complete 210-report aggregates' as result;

rollback;
