-- Test APIs read only the authenticated QA user's hidden reports. Public APIs are unchanged.
create function rut_private.test_access() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null
 and exists(select 1 from auth.users u where u.id=auth.uid() and u.raw_app_meta_data->>'rut_iq_qa'='true')
 and exists(select 1 from auth.sessions s where s.user_id=auth.uid() and s.id::text=auth.jwt()->>'session_id' and (s.not_after is null or s.not_after>now()));
$$;
revoke all on function rut_private.test_access() from public,anon,authenticated;
create function public.rut_test_access() returns boolean language sql stable set search_path='' as $$ select rut_private.test_access(); $$;
revoke all on function public.rut_test_access() from public,anon,authenticated;
grant execute on function rut_private.test_access(),public.rut_test_access() to authenticated;
create function rut_private.require_test_session() returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not rut_private.test_access() then raise exception 'Private tester access requires an active authorized session.' using errcode='42501';end if;
end $$;
revoke all on function rut_private.require_test_session() from public,anon,authenticated;
CREATE OR REPLACE FUNCTION rut_private.county_changes_test(focus_state text, focus_county text, as_of date, last_seen timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date:=rut_private.valid_report_day(as_of);
 start_at timestamptz:=greatest(coalesce(last_seen,now()),now()-interval '7 days');
 result jsonb; can_analyze boolean:=auth.uid() is not null and public.rut_is_pro();
begin
 perform rut_private.require_test_session();
 if not exists(select 1 from rut_private.counties c where c.state=focus_state and c.county=focus_county) then
  raise exception 'Choose a valid county.' using errcode='22023';
 end if;
 start_at:=least(start_at,now());
 select jsonb_build_object('checked_at',now(),'since',start_at,'first_visit',last_seen is null,
 'new_reports',count(*),'behaviors',case when can_analyze then
 jsonb_build_object('Cruising',count(*) filter(where behavior='Cruising'),
 'Chasing',count(*) filter(where behavior='Chasing'),
 'Tending',count(*) filter(where behavior='Tending a doe'),
 'Breeding',count(*) filter(where behavior='Breeding observed'),
 'Scrapes / rubs',count(*) filter(where behavior='Scrape / rub activity'),
 'No rut activity observed',count(*) filter(where behavior='No rut activity observed')) else null end)
 into result from public.rut_reports r where r.state=focus_state and r.county=focus_county
 and r.status='hidden' and r.user_id=auth.uid() and r.observed_on between d-6 and d and r.created_at>start_at and r.created_at<=now();
 return result;
end $function$
;
create function public.rut_county_changes_test(focus_state text, focus_county text, as_of date, last_seen timestamp with time zone DEFAULT NULL::timestamp with time zone) returns jsonb language sql stable set search_path='' as $$ select * from rut_private.county_changes_test(focus_state,focus_county,as_of,last_seen); $$;
revoke all on function rut_private.county_changes_test(text,text,date,timestamptz),public.rut_county_changes_test(text,text,date,timestamptz) from public,anon,authenticated;
grant execute on function rut_private.county_changes_test(text,text,date,timestamptz),public.rut_county_changes_test(text,text,date,timestamptz) to authenticated;
CREATE OR REPLACE FUNCTION rut_private.reports_for_day_test(as_of date)
 RETURNS SETOF public.rut_public_reports
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date := rut_private.valid_report_day(as_of);
begin
 perform rut_private.require_test_session();
 if auth.uid() is null or not public.rut_is_pro() then
  raise exception 'Rut IQ Pro membership required' using errcode='42501';
 end if;
 return query select r.id,r.state,r.county,r.behavior,r.observed_on,r.created_at
 from public.rut_reports r where r.status='hidden' and r.user_id=auth.uid() and r.observed_on between d-6 and d;
end $function$
;
create function public.rut_reports_for_day_test(as_of date) returns SETOF public.rut_public_reports language sql stable set search_path='' as $$ select * from rut_private.reports_for_day_test(as_of); $$;
revoke all on function rut_private.reports_for_day_test(date),public.rut_reports_for_day_test(date) from public,anon,authenticated;
grant execute on function rut_private.reports_for_day_test(date),public.rut_reports_for_day_test(date) to authenticated;
CREATE OR REPLACE FUNCTION rut_private.county_comparison_test(focus_state text, focus_county text, as_of date)
 RETURNS TABLE(period text, starts_on date, ends_on date, reports bigint, hunters bigint, cruising bigint, chasing bigint, tending bigint, breeding bigint, signs bigint, no_activity bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date:=rut_private.valid_report_day(as_of);
begin
 perform rut_private.require_test_session();
 if auth.uid() is null or not public.rut_is_pro() then raise exception 'Rut IQ Pro membership required' using errcode='42501'; end if;
 if not exists(select 1 from rut_private.counties c where c.state=focus_state and c.county=focus_county) then raise exception 'Choose a valid county.' using errcode='22023'; end if;
 return query
 select p.label,d-p.older,d-p.newer,count(r.id),count(distinct r.user_id),
 count(r.id) filter(where r.behavior='Cruising'),count(r.id) filter(where r.behavior='Chasing'),
 count(r.id) filter(where r.behavior='Tending a doe'),count(r.id) filter(where r.behavior='Breeding observed'),
 count(r.id) filter(where r.behavior='Scrape / rub activity'),count(r.id) filter(where r.behavior='No rut activity observed')
 from (values('recent'::text,7,1),('previous'::text,14,8)) p(label,older,newer)
 left join public.rut_reports r on r.state=focus_state and r.county=focus_county and r.status='hidden' and r.user_id=auth.uid() and r.observed_on between d-p.older and d-p.newer
 group by p.label,p.older,p.newer order by p.newer;
end $function$
;
create function public.rut_county_comparison_test(focus_state text, focus_county text, as_of date) returns TABLE(period text, starts_on date, ends_on date, reports bigint, hunters bigint, cruising bigint, chasing bigint, tending bigint, breeding bigint, signs bigint, no_activity bigint) language sql stable set search_path='' as $$ select * from rut_private.county_comparison_test(focus_state,focus_county,as_of); $$;
revoke all on function rut_private.county_comparison_test(text,text,date),public.rut_county_comparison_test(text,text,date) from public,anon,authenticated;
grant execute on function rut_private.county_comparison_test(text,text,date),public.rut_county_comparison_test(text,text,date) to authenticated;
CREATE OR REPLACE FUNCTION rut_private.pro_signals_for_day_test(as_of date)
 RETURNS SETOF public.rut_county_signals
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date := rut_private.valid_report_day(as_of);
begin
 perform rut_private.require_test_session();
 if auth.uid() is null or not public.rut_is_pro() then
  raise exception 'Rut IQ Pro membership required' using errcode='42501';
 end if;
 return query select r.state,r.county,
 count(*) filter(where r.observed_on>=d-6),
 count(distinct r.user_id) filter(where r.observed_on>=d-6),
 count(*) filter(where r.observed_on>=d-6 and r.behavior='Cruising'),
 count(*) filter(where r.observed_on>=d-6 and r.behavior='Chasing'),
 count(*) filter(where r.observed_on>=d-6 and r.behavior='Tending a doe'),
 count(*) filter(where r.observed_on>=d-6 and r.behavior='Breeding observed'),
 count(*) filter(where r.observed_on>=d-6 and r.behavior='Scrape / rub activity'),
 count(*) filter(where r.observed_on>=d-6 and r.behavior='No rut activity observed'),
 count(*),count(distinct r.user_id),
 count(*) filter(where r.behavior='Cruising'),
 count(*) filter(where r.behavior='Chasing'),
 count(*) filter(where r.behavior='Tending a doe'),
 count(*) filter(where r.behavior='Breeding observed'),
 count(*) filter(where r.behavior='Scrape / rub activity'),
 count(*) filter(where r.behavior='No rut activity observed')
 from public.rut_reports r where r.status='hidden' and r.user_id=auth.uid()
 and r.observed_on between d-29 and d group by r.state,r.county;
end $function$
;
create function public.rut_pro_signals_for_day_test(as_of date) returns SETOF public.rut_county_signals language sql stable set search_path='' as $$ select * from rut_private.pro_signals_for_day_test(as_of); $$;
revoke all on function rut_private.pro_signals_for_day_test(date),public.rut_pro_signals_for_day_test(date) from public,anon,authenticated;
grant execute on function rut_private.pro_signals_for_day_test(date),public.rut_pro_signals_for_day_test(date) to authenticated;
CREATE OR REPLACE FUNCTION rut_private.free_counties_for_day_test(as_of date)
 RETURNS SETOF public.rut_free_county_activity
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date := rut_private.valid_report_day(as_of);
begin
 perform rut_private.require_test_session();
 return query select r.state,r.county,count(*) from public.rut_reports r
 where r.status='hidden' and r.user_id=auth.uid() and r.observed_on between d-6 and d
 group by r.state,r.county;
end $function$
;
create function public.rut_free_counties_for_day_test(as_of date) returns SETOF public.rut_free_county_activity language sql stable set search_path='' as $$ select * from rut_private.free_counties_for_day_test(as_of); $$;
revoke all on function rut_private.free_counties_for_day_test(date),public.rut_free_counties_for_day_test(date) from public,anon,authenticated;
grant execute on function rut_private.free_counties_for_day_test(date),public.rut_free_counties_for_day_test(date) to authenticated;
CREATE OR REPLACE FUNCTION rut_private.daily_counties_for_day_test(as_of date)
 RETURNS SETOF public.rut_daily_county_reports
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare d date := rut_private.valid_report_day(as_of);
begin
 perform rut_private.require_test_session();
 return query select r.state,r.county,count(*),count(distinct r.user_id),
 count(*) filter(where r.behavior='Cruising'),
 count(*) filter(where r.behavior='Chasing'),
 count(*) filter(where r.behavior='Tending a doe'),
 count(*) filter(where r.behavior='Breeding observed'),
 count(*) filter(where r.behavior='Scrape / rub activity'),
 count(*) filter(where r.behavior='No rut activity observed'),max(r.created_at)
 from public.rut_reports r where r.status='hidden' and r.user_id=auth.uid()
 and r.created_at>=now()-interval '24 hours'
 and r.observed_on between d-1 and d group by r.state,r.county;
end $function$
;
create function public.rut_daily_counties_for_day_test(as_of date) returns SETOF public.rut_daily_county_reports language sql stable set search_path='' as $$ select * from rut_private.daily_counties_for_day_test(as_of); $$;
revoke all on function rut_private.daily_counties_for_day_test(date),public.rut_daily_counties_for_day_test(date) from public,anon,authenticated;
grant execute on function rut_private.daily_counties_for_day_test(date),public.rut_daily_counties_for_day_test(date) to authenticated;
