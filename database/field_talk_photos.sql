-- Private photo attachments. Posts and comments remain moderated.
-- No direct messages or user-to-user file sharing.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('rut-field-photos','rut-field-photos',false,5242880,array['image/jpeg'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];

create table if not exists public.rut_field_photos (
 id uuid primary key default gen_random_uuid(),
 uploader_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references public.rut_field_posts(id) on delete cascade,
 comment_id uuid references public.rut_field_comments(id) on delete cascade,
 storage_path text not null unique,
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz,
 constraint field_photo_one_thread_target check ((post_id is null) <> (comment_id is null)),
 constraint field_photo_owner_path check(split_part(storage_path,'/',1)=uploader_id::text),
 constraint field_photo_jpeg check(storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\\.jpg$')
);
create index if not exists field_photos_post_idx on public.rut_field_photos(post_id) where status='approved';
create index if not exists field_photos_comment_idx on public.rut_field_photos(comment_id) where status='approved';
alter table public.rut_field_photos enable row level security;

drop policy if exists field_photos_read on public.rut_field_photos;
create policy field_photos_read on public.rut_field_photos for select to authenticated using (
 uploader_id=(select auth.uid()) or (select public.rut_field_is_moderator()) or
 (status='approved' and (
   (post_id is not null and exists(select 1 from public.rut_field_posts p where p.id=post_id and p.status='approved'))
   or (comment_id is not null and exists(select 1 from public.rut_field_comments c
     join public.rut_field_posts p on p.id=c.post_id
     where c.id=comment_id and c.status='approved' and p.status='approved'))
 ))
);
drop policy if exists field_photos_insert on public.rut_field_photos;
create policy field_photos_insert on public.rut_field_photos for insert to authenticated with check (
 uploader_id=(select auth.uid()) and status='pending' and reviewed_at is null and (
   (post_id is not null and exists(select 1 from public.rut_field_posts p
      where p.id=post_id and p.author_id=(select auth.uid()) and p.status='pending'))
   or (comment_id is not null and exists(select 1 from public.rut_field_comments c
      where c.id=comment_id and c.author_id=(select auth.uid()) and c.status='pending'))
 )
);
drop policy if exists field_photos_moderate on public.rut_field_photos;
create policy field_photos_moderate on public.rut_field_photos for update to authenticated
 using ((select public.rut_field_is_moderator()))
 with check ((select public.rut_field_is_moderator()));
grant select,insert,update on public.rut_field_photos to authenticated;
revoke all on public.rut_field_photos from anon;

drop policy if exists field_photo_storage_upload on storage.objects;
create policy field_photo_storage_upload on storage.objects for insert to authenticated
 with check (bucket_id='rut-field-photos'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and lower(storage.extension(name))='jpg');

drop policy if exists field_photo_storage_read on storage.objects;
create policy field_photo_storage_read on storage.objects for select to authenticated
 using (bucket_id='rut-field-photos'
   and exists(select 1 from public.rut_field_photos f where f.storage_path=name));

-- No delete or update policy for users. Unattached objects require privileged cleanup.
