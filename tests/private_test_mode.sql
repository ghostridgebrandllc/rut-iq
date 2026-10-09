begin;
create temp table qa_mode_ids(a uuid,b uuid,sa uuid,sb uuid);
insert into qa_mode_ids values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id,aud,role,email,raw_app_meta_data,created_at,updated_at)
 select a,'authenticated','authenticated','mode-a@example.invalid','{"rut_iq_qa":true}'::jsonb,now(),now() from qa_mode_ids
 union all select b,'authenticated','authenticated','mode-b@example.invalid','{"rut_iq_qa":true}'::jsonb,now(),now() from qa_mode_ids;
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
 select sa,a,now(),now(),'aal1'::auth.aal_level from qa_mode_ids union all select sb,b,now(),now(),'aal1'::auth.aal_level from qa_mode_ids;
create temp table public_before as select coalesce(sum(reports_7d),0) n from public.rut_free_counties_for_day(current_date);
insert into public.rut_reports(user_id,state,county,behavior,observed_on)
 select a,'Alabama','Tuscaloosa County','Cruising',current_date from qa_mode_ids
 union all select b,'Alabama','Tuscaloosa County','Chasing',current_date from qa_mode_ids;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sa)::text,true) from qa_mode_ids;
set local role authenticated;
do $$ begin
 assert public.rut_test_access(),'QA session access';
 assert (select count(*)=1 and bool_and(reports_7d=1) from public.rut_free_counties_for_day_test(current_date)),'only own county report';
 assert (select reports_24h=1 and hunters_24h=1 and cruising_24h=1 and chasing_24h=0 from public.rut_daily_counties_for_day_test(current_date)),'other tester excluded';
 assert (public.rut_county_changes_test('Alabama','Tuscaloosa County',current_date,now()-interval '1 day')->>'new_reports')::int=1,'own updates only';
 begin perform * from public.rut_pro_signals_for_day_test(current_date);raise exception 'FAIL Free bypass';exception when insufficient_privilege then null;end;
end $$;
reset role;
update public.rut_memberships set plan='pro',source='tester' where user_id=(select a from qa_mode_ids);
set local role authenticated;
do $$ begin
 assert (select count(*)=1 and bool_and(reports_7d=1 and hunters_7d=1 and cruising_7d=1 and chasing_7d=0) from public.rut_pro_signals_for_day_test(current_date)),'own Pro aggregates';
 assert (select count(*)=1 and bool_and(behavior='Cruising') from public.rut_reports_for_day_test(current_date)),'own sanitized details';
 assert (select count(*)=2 and bool_and(reports=0) from public.rut_county_comparison_test('Alabama','Tuscaloosa County',current_date)),'completed weeks exclude today';
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sb)::text,true) from qa_mode_ids;
set local role authenticated;
do $$ begin
 assert not public.rut_test_access(),'mismatched session denied';
 begin perform * from public.rut_free_counties_for_day_test(current_date);raise exception 'FAIL mismatched session';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sa)::text,true) from qa_mode_ids;
update auth.sessions set not_after=now()-interval '1 minute' where id=(select sa from qa_mode_ids);
set local role authenticated;
do $$ begin
 assert not public.rut_test_access(),'expired session denied';
 begin perform * from public.rut_daily_counties_for_day_test(current_date);raise exception 'FAIL stale session';exception when insufficient_privilege then null;end;
end $$;
reset role;
update auth.sessions set not_after=null where id=(select sa from qa_mode_ids);
update auth.users set raw_app_meta_data='{}',raw_user_meta_data='{"rut_iq_qa":true}' where id=(select a from qa_mode_ids);
set local role authenticated;
do $$ begin
 assert not public.rut_test_access(),'user-editable metadata cannot grant QA';
 begin perform * from public.rut_reports_for_day_test(current_date);raise exception 'FAIL revoked QA';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.rut_free_counties_for_day_test(current_date);raise exception 'FAIL anonymous';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin
 assert (select coalesce(sum(reports_7d),0)=(select n from public_before) from public.rut_free_counties_for_day(current_date)),'public totals unchanged';
 assert (select bool_and(status='hidden') from public.rut_reports where user_id in(select a from qa_mode_ids union all select b from qa_mode_ids)),'reports never published';
end $$;
rollback;
select 'PASS own QA data, unchanged public totals, anonymous/non-QA/stale/mismatched/revoked access rejection, preserved Pro gate' result;
