-- Private aggregate helpers; public wrappers preserve existing Free/Pro boundaries.
create function rut_private.county_changes(focus_state text, focus_county text, as_of date, last_seen timestamptz default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d date:=rut_private.valid_report_day(as_of);
 start_at timestamptz:=greatest(coalesce(last_seen,now()),now()-interval '7 days');
 result jsonb; can_analyze boolean:=auth.uid() is not null and public.rut_is_pro();
begin
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
 and r.status='approved' and r.observed_on between d-6 and d and r.created_at>start_at and r.created_at<=now();
 return result;
end $$;
create function public.rut_county_changes(focus_state text,focus_county text,as_of date,last_seen timestamptz default null)
returns jsonb language sql stable set search_path='' as $$ select rut_private.county_changes(focus_state,focus_county,as_of,last_seen); $$;
revoke all on function rut_private.county_changes(text,text,date,timestamptz),public.rut_county_changes(text,text,date,timestamptz) from public,anon,authenticated;
grant execute on function rut_private.county_changes(text,text,date,timestamptz),public.rut_county_changes(text,text,date,timestamptz) to anon,authenticated;

create function rut_private.county_comparison(focus_state text,focus_county text,as_of date)
returns table(period text,starts_on date,ends_on date,reports bigint,hunters bigint,cruising bigint,chasing bigint,tending bigint,breeding bigint,signs bigint,no_activity bigint)
language plpgsql stable security definer set search_path='' as $$
declare d date:=rut_private.valid_report_day(as_of);
begin
 if auth.uid() is null or not public.rut_is_pro() then raise exception 'Rut IQ Pro membership required' using errcode='42501'; end if;
 if not exists(select 1 from rut_private.counties c where c.state=focus_state and c.county=focus_county) then raise exception 'Choose a valid county.' using errcode='22023'; end if;
 return query
 select p.label,d-p.older,d-p.newer,count(r.id),count(distinct r.user_id),
 count(r.id) filter(where r.behavior='Cruising'),count(r.id) filter(where r.behavior='Chasing'),
 count(r.id) filter(where r.behavior='Tending a doe'),count(r.id) filter(where r.behavior='Breeding observed'),
 count(r.id) filter(where r.behavior='Scrape / rub activity'),count(r.id) filter(where r.behavior='No rut activity observed')
 from (values('recent'::text,7,1),('previous'::text,14,8)) p(label,older,newer)
 left join public.rut_reports r on r.state=focus_state and r.county=focus_county and r.status='approved' and r.observed_on between d-p.older and d-p.newer
 group by p.label,p.older,p.newer order by p.newer;
end $$;
create function public.rut_county_comparison(focus_state text,focus_county text,as_of date)
returns table(period text,starts_on date,ends_on date,reports bigint,hunters bigint,cruising bigint,chasing bigint,tending bigint,breeding bigint,signs bigint,no_activity bigint)
language sql stable set search_path='' as $$ select * from rut_private.county_comparison(focus_state,focus_county,as_of); $$;
revoke all on function rut_private.county_comparison(text,text,date),public.rut_county_comparison(text,text,date) from public,anon,authenticated;
grant execute on function rut_private.county_comparison(text,text,date),public.rut_county_comparison(text,text,date) to authenticated;
