-- Hosted postgres can use Auth but cannot grant custom roles USAGE on its schema.
-- Keep privileged Auth reads behind narrow helpers, following Supabase guidance:
-- https://supabase.com/kb/troubleshooting/permission-errors-when-granting-custom-roles-access-to-the-auth-schema
-- Existing application functions retain their owners and EXECUTE ACLs.

create or replace function private.current_user_id() returns uuid
language sql stable security definer set search_path = '' as $$
 select auth.uid()
$$;

create or replace function private.auth_user_exists(p_user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from auth.users where id=p_user_id)
$$;

alter function private.current_user_id() owner to postgres;
alter function private.auth_user_exists(uuid) owner to postgres;
revoke all on function private.current_user_id(), private.auth_user_exists(uuid)
 from public, anon, authenticated, service_role;
grant execute on function private.current_user_id(), private.auth_user_exists(uuid)
 to dono_command_owner;

create or replace function public.dono_profile(actor uuid, key uuid, action text, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; r private.api_requests;
begin
 if action='bootstrap' then
  if not private.auth_user_exists(actor) then raise exception 'not_found'; end if;
  insert into public.profiles(id,display_name,platform_role) values(actor,body->>'display_name','donor') on conflict(id) do nothing;
 end if;
 if action='bootstrap' then
  perform private.require_actor(actor);r:=private.claim(actor,'profile/'||action,key,body);
 else
  if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
  r:=private.claim(actor,'profile/'||action,key,body);perform private.require_actor(actor);
 end if;
 select * into p from public.profiles where id=actor;
 if r.state<>'completed' and action='edit' then
  if p.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision'; end if;
  update public.profiles set display_name=body->>'display_name',revision=revision+1,updated_at=clock_timestamp() where id=actor returning * into p;
 end if;
 update private.api_requests set state='completed',resource_id=actor,http_status=case when action='bootstrap' then 201 else 200 end,result_refs=jsonb_build_object('id',actor) where id=r.id;
 return to_jsonb(p)-'disabled_at';
end $$;

create or replace function private.enabled() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select private.current_user_id()) and disabled_at is null)
$$;
create or replace function private.member_of(tenant uuid, admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.enabled() and exists(select 1 from public.association_members m join public.associations a on a.id=m.association_id
 where m.profile_id=(select private.current_user_id()) and m.association_id=tenant and m.active and a.approval_status='approved' and (not admin_only or m.role='assoc_admin'))
$$;
create or replace function private.platform() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select private.current_user_id()) and disabled_at is null and platform_role='platform_admin')
$$;
create or replace function private.owns(item uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.enabled() and exists(select 1 from public.donations where id=item and donor_id=(select private.current_user_id()))
$$;
