-- Applied in Supabase: reject approvals for photo attachments without an actual stored file.
create or replace function public.rut_field_photo_approval_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 if new.status='approved' and old.status is distinct from 'approved' then
  if not exists (
   select 1 from storage.objects o
   where o.bucket_id='rut-field-photos' and o.name=new.storage_path
  ) then
   raise exception 'Photo file is missing and cannot be approved';
  end if;
 end if;
 return new;
end $$;
revoke all on function public.rut_field_photo_approval_guard() from public,anon,authenticated;
drop trigger if exists rut_field_photo_approval_guard on public.rut_field_photos;
create trigger rut_field_photo_approval_guard before update on public.rut_field_photos
for each row execute function public.rut_field_photo_approval_guard();
