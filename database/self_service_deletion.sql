-- Rut IQ only. A caller can remove only the account in their verified JWT.
-- Keep privileged code outside the exposed API schema.
begin;
create or replace function rut_private.delete_own_account(confirmation text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  session_claim text := auth.jwt()->>'session_id';
begin
  if caller is null or confirmation is distinct from 'DELETE' then
    raise exception 'Sign in and type DELETE to confirm.' using errcode='42501';
  end if;
  perform 1 from auth.users u where u.id=caller for update;
  if not found then
    raise exception 'Sign in again before deleting your account.' using errcode='42501';
  end if;
  if not exists (select 1 from auth.sessions s where s.user_id=caller
       and s.id::text=session_claim and (s.not_after is null or s.not_after>now())) then
    raise exception 'Sign in again before deleting your account.' using errcode='42501';
  end if;
  -- Paid checkout is disabled. Prevent orphaned billing if it is introduced later.
  if exists(select 1 from public.rut_memberships m where m.user_id=caller
       and m.source='stripe' and m.status not in ('canceled','expired','inactive')) then
    raise exception 'Cancel your paid subscription before deleting your account.' using errcode='P0001';
  end if;
  delete from auth.sessions where user_id=caller;
  delete from auth.users where id=caller;
  -- Existing foreign keys cascade to Rut IQ reports, membership and identities.
  return jsonb_build_object('deleted',true);
end;
$$;
revoke all on function rut_private.delete_own_account(text) from public, anon, authenticated;
grant execute on function rut_private.delete_own_account(text) to authenticated;
create or replace function public.rut_delete_my_account(confirmation text)
returns jsonb language sql security invoker set search_path = '' as $$
  select rut_private.delete_own_account(confirmation);
$$;
revoke all on function public.rut_delete_my_account(text) from public, anon, authenticated;
grant execute on function public.rut_delete_my_account(text) to authenticated;
commit;
