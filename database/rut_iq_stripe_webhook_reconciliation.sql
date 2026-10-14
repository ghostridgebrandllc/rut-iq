-- Already installed in the Rut IQ Supabase project.
-- Accepts events only from a privileged Stripe webhook service.
-- Tables are in the private schema with RLS on, no policies for clients.
create or replace function public.rut_iq_apply_stripe_event(
 p_event_id text,p_subscription_id text,p_customer_id text,
 p_user_id uuid,p_price_id text,p_status text,p_period_end timestamptz
) returns boolean language plpgsql security definer set search_path='' as $$
declare existing_source text;
begin
 if auth.role()<>'service_role' then
  raise exception 'Server access only';
 end if;
 if p_price_id not in ('price_1UOXLFRqpCnvGztzHmMXcHnE','price_1UOXLJRqpCnvGztzJhbRVsDs')
 or length(p_event_id)<5 or length(p_subscription_id)<5 or length(p_customer_id)<5 then
  raise exception 'Invalid billing event';
 end if;
 insert into rut_private.rut_billing_events(event_id) values(p_event_id)
 on conflict do nothing;
 if not found then return false; end if;
 insert into rut_private.rut_billing_subscriptions(
  stripe_subscription_id,stripe_customer_id,user_id,stripe_price_id,status,period_end
 ) values (p_subscription_id,p_customer_id,p_user_id,p_price_id,p_status,p_period_end)
 on conflict(stripe_subscription_id) do update
 set stripe_price_id=excluded.stripe_price_id,status=excluded.status,
     period_end=excluded.period_end,updated_at=now()
 where rut_private.rut_billing_subscriptions.user_id=excluded.user_id
   and rut_private.rut_billing_subscriptions.stripe_customer_id=excluded.stripe_customer_id;
 if not found then raise exception 'Subscription ownership mismatch'; end if;
 select source into existing_source from public.rut_memberships where user_id=p_user_id;
 if existing_source='tester' then return true; end if;
 insert into public.rut_memberships(user_id,plan,source,status,current_period_end)
 values(p_user_id,
  case when p_status='active' and (p_period_end is null or p_period_end>now()) then 'pro' else 'free' end,
  'stripe',
  case when p_status='active' then 'active' else 'inactive' end,p_period_end)
 on conflict(user_id) do update
 set plan=excluded.plan,source=excluded.source,status=excluded.status,
 current_period_end=excluded.current_period_end,updated_at=now()
 where public.rut_memberships.source<>'tester';
 return true;
end $$;
revoke all on function public.rut_iq_apply_stripe_event(text,text,text,uuid,text,text,timestamptz)
 from public,anon,authenticated;
grant execute on function public.rut_iq_apply_stripe_event(text,text,text,uuid,text,text,timestamptz)
 to service_role;
