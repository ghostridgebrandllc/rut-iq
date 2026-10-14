-- Applied in Supabase; photo uploads remain private until server scan + manual moderator review.
alter table public.rut_field_photos
  add column if not exists scan_status text not null default 'pending'
    check(scan_status in ('pending','clean','flagged','error'));
alter table public.rut_field_photos
  add column if not exists scanned_at timestamptz;

create or replace function public.rut_field_photo_approval_guard()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if tg_op='INSERT' then
    if new.scan_status <> 'pending' or new.scanned_at is not null then
      raise exception 'Photo scan results must start pending';
    end if;
  else
    if (new.scan_status is distinct from old.scan_status
        or new.scanned_at is distinct from old.scanned_at)
       and current_setting('request.jwt.claim.role',true) is distinct from 'service_role'
    then
      raise exception 'Only scanner service may set photo scan results';
    end if;
    if new.status='approved' and old.status is distinct from 'approved' then
      if new.scan_status <> 'clean' or new.scanned_at is null then
        raise exception 'Photo requires a successful automated safety scan before approval';
      end if;
      if not exists (
        select 1 from storage.objects o
        where o.bucket_id='rut-field-photos' and o.name=new.storage_path
      ) then
        raise exception 'Photo file missing';
      end if;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.rut_field_photo_approval_guard() from public,anon,authenticated;
drop trigger if exists rut_field_photo_approval_guard on public.rut_field_photos;
create trigger rut_field_photo_approval_guard
  before insert or update on public.rut_field_photos
  for each row execute function public.rut_field_photo_approval_guard();
