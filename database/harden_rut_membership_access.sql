-- Rut IQ only: narrow API privileges and isolate privileged aggregation.
create schema if not exists rut_private;
revoke all on schema rut_private from public, anon, authenticated;
grant usage on schema rut_private to anon, authenticated;
alter default privileges in schema rut_private revoke execute on functions from public;
revoke all on public.rut_reports from anon, authenticated;
grant select on public.rut_reports to authenticated;
grant insert(user_id,state,county,behavior,observed_on,notes) on public.rut_reports to authenticated;
revoke all on public.rut_memberships from anon, authenticated;
grant select on public.rut_memberships to authenticated;
alter function public.rut_is_pro() security invoker;
revoke all on function public.rut_is_pro() from public,anon;
grant execute on function public.rut_is_pro() to authenticated;
create or replace function rut_private.rut_prepare_report()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 new.created_at=now();
 new.status=case when exists(select 1 from auth.users u where u.id=new.user_id and u.raw_app_meta_data->>'rut_iq_qa'='true') then 'hidden' else 'approved' end;
 return new;
end; $$;
revoke all on function rut_private.rut_prepare_report() from public,anon,authenticated;
create trigger rut_prepare_report before insert on public.rut_reports for each row execute function rut_private.rut_prepare_report();
drop policy "hunters can submit their own sightings" on public.rut_reports;
create policy "hunters can submit their own sightings" on public.rut_reports for insert to authenticated with check ((select auth.uid())=user_id and status in ('approved','hidden') and created_at=now());

-- Fixed projection only; no notes, user IDs, or exact hunting locations.
create or replace function rut_private.rut_free_county_activity()
returns table ("state" text, "county" text, "reports_7d" bigint) language sql stable security definer set search_path='' as $fn$
 SELECT state,
    county,
    count(*) AS reports_7d
   FROM public.rut_reports
  WHERE status = 'approved'::text AND observed_on >= (CURRENT_DATE - 6) AND observed_on <= CURRENT_DATE
  GROUP BY state, county;
$fn$;
revoke all on function rut_private.rut_free_county_activity() from public;
grant execute on function rut_private.rut_free_county_activity() to anon,authenticated;
create or replace view public.rut_free_county_activity with (security_invoker=true,security_barrier=true) as select * from rut_private.rut_free_county_activity();
revoke all on public.rut_free_county_activity from anon,authenticated;
grant select on public.rut_free_county_activity to anon,authenticated;

-- Fixed projection only; no notes, user IDs, or exact hunting locations.
create or replace function rut_private.rut_daily_county_reports()
returns table ("state" text, "county" text, "reports_24h" bigint, "hunters_24h" bigint, "cruising_24h" bigint, "chasing_24h" bigint, "tending_24h" bigint, "breeding_24h" bigint, "signs_24h" bigint, "no_activity_24h" bigint, "latest_submission_at" timestamp with time zone) language sql stable security definer set search_path='' as $fn$
 SELECT state,
    county,
    count(*) AS reports_24h,
    count(DISTINCT user_id) AS hunters_24h,
    count(*) FILTER (WHERE behavior = 'Cruising'::text) AS cruising_24h,
    count(*) FILTER (WHERE behavior = 'Chasing'::text) AS chasing_24h,
    count(*) FILTER (WHERE behavior = 'Tending a doe'::text) AS tending_24h,
    count(*) FILTER (WHERE behavior = 'Breeding observed'::text) AS breeding_24h,
    count(*) FILTER (WHERE behavior = 'Scrape / rub activity'::text) AS signs_24h,
    count(*) FILTER (WHERE behavior = 'No rut activity observed'::text) AS no_activity_24h,
    max(created_at) AS latest_submission_at
   FROM public.rut_reports
  WHERE status = 'approved'::text AND created_at >= (now() - '24:00:00'::interval) AND observed_on >= (CURRENT_DATE - 1) AND observed_on <= CURRENT_DATE
  GROUP BY state, county;
$fn$;
revoke all on function rut_private.rut_daily_county_reports() from public;
grant execute on function rut_private.rut_daily_county_reports() to anon,authenticated;
create or replace view public.rut_daily_county_reports with (security_invoker=true,security_barrier=true) as select * from rut_private.rut_daily_county_reports();
revoke all on public.rut_daily_county_reports from anon,authenticated;
grant select on public.rut_daily_county_reports to anon,authenticated;

-- Fixed projection only; no notes, user IDs, or exact hunting locations.
create or replace function rut_private.rut_public_reports()
returns table ("id" uuid, "state" text, "county" text, "behavior" text, "observed_on" date, "created_at" timestamp with time zone) language plpgsql stable security definer set search_path='' as $fn$
begin
 if auth.uid() is null then return; end if;
 if not public.rut_is_pro() then return; end if;
 return query  SELECT id,
    state,
    county,
    behavior,
    observed_on,
    created_at
   FROM public.rut_reports
  WHERE status = 'approved'::text AND observed_on >= (CURRENT_DATE - 6) AND observed_on <= CURRENT_DATE;
end;
$fn$;
revoke all on function rut_private.rut_public_reports() from public;
grant execute on function rut_private.rut_public_reports() to anon,authenticated;
create or replace view public.rut_public_reports with (security_invoker=true,security_barrier=true) as select * from rut_private.rut_public_reports();
revoke all on public.rut_public_reports from anon,authenticated;
grant select on public.rut_public_reports to anon,authenticated;

create or replace function rut_private.rut_pro_county_signals()
returns setof public.rut_county_signals language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.rut_is_pro() then
  raise exception 'Rut IQ Pro membership required' using errcode='42501';
 end if;
 return query select * from public.rut_county_signals;
end; $$;
revoke all on function rut_private.rut_pro_county_signals() from public,anon;
grant execute on function rut_private.rut_pro_county_signals() to authenticated;
create or replace function public.rut_pro_county_signals()
returns setof public.rut_county_signals language sql stable security invoker set search_path='' as $$
 select * from rut_private.rut_pro_county_signals();
$$;
revoke all on function public.rut_pro_county_signals() from public,anon;
grant execute on function public.rut_pro_county_signals() to authenticated;
revoke all on public.rut_county_signals,public.rut_county_activity from anon,authenticated;
notify pgrst,'reload schema';

create or replace function rut_private.rut_public_reports()
returns table(id uuid,state text,county text,behavior text,observed_on date,created_at timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then return; end if;
 if not public.rut_is_pro() then return; end if;
 return query select r.id,r.state,r.county,r.behavior,r.observed_on,r.created_at
 from public.rut_reports r where r.status='approved' and r.observed_on between current_date-6 and current_date;
end; $$;