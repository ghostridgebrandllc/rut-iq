-- All QA fixtures and deletions are rolled back. Nothing enters public activity.
begin;
create temporary table qa_ids(a uuid,b uuid,sa uuid,sb uuid);
insert into qa_ids values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid());
insert into auth.users(id,aud,role,email,raw_app_meta_data,created_at,updated_at)
select a,'authenticated','authenticated','rut-delete-a@example.invalid','{"rut_iq_qa":true}'::jsonb,now(),now() from qa_ids
union all select b,'authenticated','authenticated','rut-delete-b@example.invalid','{"rut_iq_qa":true}'::jsonb,now(),now() from qa_ids;
insert into auth.sessions(id,user_id,created_at,updated_at,aal)
select sa,a,now(),now(),'aal1'::auth.aal_level from qa_ids union all select sb,b,now(),now(),'aal1'::auth.aal_level from qa_ids;
insert into public.rut_reports(user_id,state,county,behavior,observed_on,notes)
select a,'Alabama','Tuscaloosa County','Cruising',current_date,'QA rollback only' from qa_ids
union all select b,'Alabama','Tuscaloosa County','Chasing',current_date,'QA rollback only' from qa_ids;
-- Claim A with B's session: must reject.
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sb)::text,true) from qa_ids;
set local role authenticated;
do $$begin
 begin perform public.rut_delete_my_account('DELETE');raise exception 'FAIL: mismatched session accepted';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
select set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated','session_id',sa)::text,true) from qa_ids;
set local role authenticated;
do $$begin
 begin perform public.rut_delete_my_account('wrong');raise exception 'FAIL: bad confirmation accepted';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
-- Test Pro tester deletion as well as reports and session cleanup.
update public.rut_memberships set plan='pro',source='tester',status='active' where user_id=(select a from qa_ids);
set local role authenticated;
select public.rut_delete_my_account('DELETE');
-- Same signed JWT must fail after its session/account has been removed.
do $$begin
 begin perform public.rut_delete_my_account('DELETE');raise exception 'FAIL: deleted account reused';
 exception when insufficient_privilege then null;end;
end$$;
reset role;
do $$declare q record;begin
 select * into q from qa_ids;
 if exists(select 1 from auth.users where id=q.a) or exists(select 1 from auth.sessions where user_id=q.a)
 or exists(select 1 from public.rut_reports where user_id=q.a) or exists(select 1 from public.rut_memberships where user_id=q.a) then raise exception 'FAIL: deletion incomplete';end if;
 if not exists(select 1 from auth.users where id=q.b) or not exists(select 1 from public.rut_reports where user_id=q.b)
 or not exists(select 1 from public.rut_memberships where user_id=q.b) or not exists(select 1 from auth.sessions where user_id=q.b) then raise exception 'FAIL: other hunter modified';end if;
 if has_function_privilege('anon','public.rut_delete_my_account(text)','execute') then raise exception 'FAIL: anonymous access';end if;
end$$;
-- Free account deletion.
select set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated','session_id',sb)::text,true) from qa_ids;
set local role authenticated;
select public.rut_delete_my_account('DELETE');
reset role;
do $$begin
 if exists(select 1 from auth.users where id in (select b from qa_ids)) then raise exception 'FAIL: Free account remains';end if;
end$$;
rollback;
select 'PASS: Free and Pro deletion, confirmation, session ownership, stale token rejection, cascades and other-account isolation; all QA rolled back' as result;
