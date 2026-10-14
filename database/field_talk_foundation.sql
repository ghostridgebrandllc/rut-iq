-- Field Talk staged foundation. No existing reports or memberships are modified.
-- All community submissions start pending; nothing publishes automatically.
create table if not exists public.rut_field_posts (
 id uuid primary key default gen_random_uuid(),
 author_id uuid not null references auth.users(id) on delete cascade,
 state text not null check (char_length(state) between 2 and 50),
 county text check (county is null or char_length(county) between 2 and 100),
 category text not null default 'Field Talk'
   check (category in ('Field Talk','Trail Camera','Rut Sighting','Deer Sign','Successful Hunt','From the Woods')),
 caption text not null check (char_length(trim(caption)) between 1 and 2000),
 status text not null default 'pending'
   check (status in ('pending','approved','hidden','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint field_post_county_valid foreign key (state,county)
   references rut_private.counties(state,county)
);
create table if not exists public.rut_field_comments (
 id uuid primary key default gen_random_uuid(),
 post_id uuid not null references public.rut_field_posts(id) on delete cascade,
 author_id uuid not null references auth.users(id) on delete cascade,
 body text not null check (char_length(trim(body)) between 1 and 1000),
 status text not null default 'pending'
   check (status in ('pending','approved','hidden','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create table if not exists public.rut_field_flags (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references public.rut_field_posts(id) on delete cascade,
 comment_id uuid references public.rut_field_comments(id) on delete cascade,
 reason text not null check (reason in ('spam','harassment','graphic','privacy','illegal','other')),
 details text check (details is null or char_length(details)<=500),
 created_at timestamptz not null default now(),
 constraint flag_one_target check ((post_id is null) <> (comment_id is null))
);
create unique index if not exists rut_field_post_flag_unique
 on public.rut_field_flags(reporter_id,post_id) where post_id is not null;
create unique index if not exists rut_field_comment_flag_unique
 on public.rut_field_flags(reporter_id,comment_id) where comment_id is not null;
create index if not exists rut_field_posts_feed
 on public.rut_field_posts(state,county,created_at desc) where status='approved';
create index if not exists rut_field_comments_feed
 on public.rut_field_comments(post_id,created_at) where status='approved';
create table if not exists rut_private.field_moderators (
 user_id uuid primary key references auth.users(id) on delete cascade,
 added_at timestamptz not null default now()
);
revoke all on rut_private.field_moderators from anon,authenticated;
create or replace function public.rut_field_is_moderator()
returns boolean language sql stable security definer
set search_path = ''
as $$ select exists(select 1 from rut_private.field_moderators where user_id=(select auth.uid())) $$;
revoke all on function public.rut_field_is_moderator() from public,anon;
grant execute on function public.rut_field_is_moderator() to authenticated;
alter table public.rut_field_posts enable row level security;
alter table public.rut_field_comments enable row level security;
alter table public.rut_field_flags enable row level security;
alter table rut_private.field_moderators enable row level security;
drop policy if exists field_posts_read on public.rut_field_posts;
create policy field_posts_read on public.rut_field_posts for select to authenticated
 using (status='approved' or author_id=(select auth.uid()) or (select public.rut_field_is_moderator()));
drop policy if exists field_posts_create on public.rut_field_posts;
create policy field_posts_create on public.rut_field_posts for insert to authenticated
 with check (author_id=(select auth.uid()) and status='pending' and reviewed_at is null);
drop policy if exists field_comments_read on public.rut_field_comments;
create policy field_comments_read on public.rut_field_comments for select to authenticated
 using ((status='approved' and exists(select 1 from public.rut_field_posts p where p.id=post_id and p.status='approved'))
 or author_id=(select auth.uid()) or (select public.rut_field_is_moderator()));
drop policy if exists field_comments_create on public.rut_field_comments;
create policy field_comments_create on public.rut_field_comments for insert to authenticated
 with check (author_id=(select auth.uid()) and status='pending' and reviewed_at is null
 and exists(select 1 from public.rut_field_posts p where p.id=post_id and p.status='approved'));
drop policy if exists field_flags_create on public.rut_field_flags;
create policy field_flags_create on public.rut_field_flags for insert to authenticated
 with check (reporter_id=(select auth.uid()));
drop policy if exists field_flags_moderator_read on public.rut_field_flags;
create policy field_flags_moderator_read on public.rut_field_flags for select to authenticated
 using ((select public.rut_field_is_moderator()));
-- Only moderators may change publication status. Authors cannot self-approve.
drop policy if exists field_posts_moderate on public.rut_field_posts;
create policy field_posts_moderate on public.rut_field_posts for update to authenticated
 using ((select public.rut_field_is_moderator()))
 with check ((select public.rut_field_is_moderator()));
drop policy if exists field_comments_moderate on public.rut_field_comments;
create policy field_comments_moderate on public.rut_field_comments for update to authenticated
 using ((select public.rut_field_is_moderator()))
 with check ((select public.rut_field_is_moderator()));
grant select,insert,update on public.rut_field_posts to authenticated;
grant select,insert,update on public.rut_field_comments to authenticated;
grant select,insert on public.rut_field_flags to authenticated;
revoke all on public.rut_field_posts,public.rut_field_comments,public.rut_field_flags from anon;
