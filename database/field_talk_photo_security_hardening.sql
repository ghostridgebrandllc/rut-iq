-- Applied to existing Supabase project in October 2026.
-- Only registered, pending thread attachments may be uploaded.
alter table public.rut_field_photos
 add constraint field_photo_target_path_matches
 check (split_part(storage_path,'/',2)=coalesce(post_id,comment_id)::text);

create or replace function public.rut_field_photo_limit_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
declare existing_count integer;
begin
 if new.post_id is not null then
  perform pg_advisory_xact_lock(hashtext(new.post_id::text));
  select count(*) into existing_count from public.rut_field_photos where post_id=new.post_id;
 else
  perform pg_advisory_xact_lock(hashtext(new.comment_id::text));
  select count(*) into existing_count from public.rut_field_photos where comment_id=new.comment_id;
 end if;
 if existing_count>=3 then raise exception 'Only 3 photos are allowed per thread entry'; end if;
 return new;
end $$;
revoke all on function public.rut_field_photo_limit_guard() from public,anon,authenticated;
drop trigger if exists rut_field_photo_limit on public.rut_field_photos;
create trigger rut_field_photo_limit before insert on public.rut_field_photos
 for each row execute function public.rut_field_photo_limit_guard();

drop policy if exists field_photo_storage_upload on storage.objects;
create policy field_photo_storage_upload on storage.objects for insert to authenticated
with check (
 bucket_id='rut-field-photos'
 and (storage.foldername(name))[1]=(select auth.uid())::text
 and lower(storage.extension(name))='jpg'
 and exists (
  select 1 from public.rut_field_photos f
  where f.storage_path=name and f.uploader_id=(select auth.uid()) and f.status='pending'
 )
);
drop policy if exists field_photos_delete_failed on public.rut_field_photos;
create policy field_photos_delete_failed on public.rut_field_photos for delete to authenticated
 using (uploader_id=(select auth.uid()) and status='pending');
grant delete on public.rut_field_photos to authenticated;
