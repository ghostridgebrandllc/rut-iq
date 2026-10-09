begin;
create temp table premium_ids as select gen_random_uuid() id from generate_series(1,3);
insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
 select id,'authenticated','authenticated','premium-'||id||'@example.invalid','{"rut_iq_qa":true}'::jsonb,'{}'::jsonb,now(),now() from premium_ids;
insert into public.rut_reports(user_id,state,county,behavior,observed_on)
 select id,'Alabama','Tuscaloosa County','Cruising',current_date-days from premium_ids cross join unnest(array[0,1,7,8,14]) days;
do $$ begin
 assert (select bool_and(status='hidden') from public.rut_reports where user_id in(select id from premium_ids)),'QA must remain hidden';
 assert (public.rut_county_changes('Alabama','Tuscaloosa County',current_date,now()-interval '1 day')->>'new_reports')::int=0,'QA excluded';
end $$;
-- Visible only inside this rollback transaction, never published.
update public.rut_reports set status='approved' where user_id in(select id from premium_ids);
select set_config('request.jwt.claim.sub','',true);
do $$ declare j jsonb; begin
 set local role anon;
 j:=public.rut_county_changes('Alabama','Tuscaloosa County',current_date,now()-interval '1 day');
 assert (j->>'new_reports')::int=6,'current seven-day observations only';
 assert j->'behaviors'='null'::jsonb,'Free must not expose advanced behavior';
 assert (public.rut_county_changes('Alabama','Tuscaloosa County',current_date,null)->>'first_visit')::boolean,'first visit explicit';
 assert (public.rut_county_changes('Alabama','Tuscaloosa County',current_date,null)->>'new_reports')::int=0,'first visit not invented';
 begin perform * from public.rut_county_comparison('Alabama','Tuscaloosa County',current_date);raise exception 'Anon comparison accepted';exception when insufficient_privilege then null;end;
 begin perform public.rut_county_changes('Alabama','Invalid County',current_date,null);raise exception 'Invalid county accepted';exception when invalid_parameter_value then null;end;
 reset role;
end $$;
select set_config('request.jwt.claim.sub',(select id::text from premium_ids limit 1),true);
do $$ begin
 set local role authenticated;
 begin perform * from public.rut_county_comparison('Alabama','Tuscaloosa County',current_date);raise exception 'Free comparison accepted';exception when insufficient_privilege then null;end;
 reset role;
end $$;
update public.rut_memberships set plan='pro',source='tester' where user_id in(select id from premium_ids);
do $$ declare j jsonb; begin
 set local role authenticated;
 assert (select count(*)=2 and bool_and(reports=6 and hunters=3 and cruising=6) from public.rut_county_comparison('Alabama','Tuscaloosa County',current_date)),'equal completed weeks, accurate distinct hunters';
 assert (select starts_on=current_date-7 and ends_on=current_date-1 from public.rut_county_comparison('Alabama','Tuscaloosa County',current_date) where period='recent'),'today excluded';
 j:=public.rut_county_changes('Alabama','Tuscaloosa County',current_date,now()-interval '1 day');
 assert (j->'behaviors'->>'Cruising')::int=6,'Pro receives complete new behavior counts';
 reset role;
end $$;
update public.rut_memberships set status='inactive' where user_id in(select id from premium_ids);
do $$ begin
 set local role authenticated;
 begin perform * from public.rut_county_comparison('Alabama','Tuscaloosa County',current_date);raise exception 'Revoked Pro accepted';exception when insufficient_privilege then null;end;
 assert public.rut_county_changes('Alabama','Tuscaloosa County',current_date,now()-interval '1 day')->'behaviors'='null'::jsonb,'revocation removes behavior access';
 reset role;
end $$;
select 'PASS new submissions, first visit, QA exclusion, equal weeks, distinct hunters, anonymous/Free/Pro/revocation gates' result;
rollback;
