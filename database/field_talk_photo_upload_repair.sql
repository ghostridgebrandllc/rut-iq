-- Applied: correct the overly escaped JPEG path constraint and reconcile legacy scan statuses.
alter table public.rut_field_photos drop constraint if exists field_photo_jpeg;
alter table public.rut_field_photos
 add constraint field_photo_jpeg
 check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}[.]jpg$');
alter table public.rut_field_photos drop constraint if exists rut_field_photos_scan_status_check;
alter table public.rut_field_photos
 add constraint rut_field_photos_scan_status_check
 check (scan_status in ('pending','clean','flagged','error'));
drop trigger if exists rut_field_photo_scan_guard on public.rut_field_photos;
-- The newer rut_field_photo_approval_guard remains in effect.
