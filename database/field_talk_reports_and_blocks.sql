-- Applied in the existing Supabase project: moderation report resolution and user blocking.
alter table public.rut_field_flags add column if not exists resolved_at timestamptz;
alter table public.rut_field_flags add column if not exists resolution text;
create index if not exists rut_field_flags_pending on public.rut_field_flags(created_at)
 where resolved_at is null;
create policy field_flags_moderator_update on public.rut_field_flags for update to authenticated
 using ((select public.rut_field_is_moderator()))
 with check ((select public.rut_field_is_moderator()));
grant update on public.rut_field_flags to authenticated;

create table if not exists public.rut_field_blocks (
 blocker_id uuid not null references auth.users(id) on delete cascade,
 blocked_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (blocker_id,blocked_id),
 constraint rut_field_no_self_block check(blocker_id<>blocked_id)
);
alter table public.rut_field_blocks enable row level security;
create policy field_blocks_read on public.rut_field_blocks for select to authenticated
 using (blocker_id=(select auth.uid()));
create policy field_blocks_create on public.rut_field_blocks for insert to authenticated
 with check (blocker_id=(select auth.uid()));
create policy field_blocks_remove on public.rut_field_blocks for delete to authenticated
 using (blocker_id=(select auth.uid()));
grant select,insert,delete on public.rut_field_blocks to authenticated;
