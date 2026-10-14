-- Applied to Rut IQ Supabase project. Sensitive billing records are not visible to users.
create table if not exists rut_private.rut_billing_subscriptions (
 stripe_subscription_id text primary key,
 stripe_customer_id text not null,
 user_id uuid not null references auth.users(id) on delete cascade,
 stripe_price_id text not null,
 status text not null,
 period_end timestamptz,
 updated_at timestamptz not null default now()
);
create unique index if not exists rut_billing_customer_user_idx
 on rut_private.rut_billing_subscriptions(stripe_customer_id,user_id);
create table if not exists rut_private.rut_billing_events (
 event_id text primary key,
 created_at timestamptz not null default now()
);
revoke all on rut_private.rut_billing_subscriptions,rut_private.rut_billing_events from anon,authenticated;
