-- Apply to Rut IQ Supabase before publishing Hunter Handles.
create table if not exists public.rut_field_handles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 handle text not null,
 updated_at timestamptz not null default now(),
 constraint rut_field_handle_format check (handle ~ '^[A-Za-z][A-Za-z0-9_]{2,19}$'),
 constraint rut_field_handle_reserved check (lower(handle) !~ '^(admin|administrator|moderator|support|official|rut_iq|rut_iq_support|ghostridge|ghost_ridge|system)$')
);
create unique index if not exists rut_field_handles_unique_lower on public.rut_field_handles(lower(handle));
alter table public.rut_field_handles enable row level security;
create policy rut_field_handles_public_read on public.rut_field_handles for select to anon,authenticated using (true);
create policy rut_field_handles_own_insert on public.rut_field_handles for insert to authenticated with check (user_id=(select auth.uid()));
create policy rut_field_handles_own_update on public.rut_field_handles for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));
grant select on public.rut_field_handles to anon,authenticated;
grant insert,update on public.rut_field_handles to authenticated;
