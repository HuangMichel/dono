create function public.dono_association(actor uuid,key uuid,action text,tenant uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.associations; m public.association_members; r private.api_requests; target uuid; old_role public.assoc_role; old_active boolean; event_id uuid; other_event_id uuid; result jsonb;
begin
 -- Current identity is checked before claiming/replaying; actual locks follow request first.
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 r:=private.claim(actor,'association/'||action||'/'||coalesce(tenant::text,''),key,body);
 target:=case when action='grant' then (body->>'profile_id')::uuid when action='transfer' then (body->>'target_profile_id')::uuid when action='member_edit' then (body->>'profile_id')::uuid when action in ('approval','recovery') then (select registered_by from public.associations where id=tenant) else null end;
 perform 1 from public.profiles where id in (actor,target) order by id for update;
 perform private.require_actor(actor);
 if action='create' then
  if r.state='completed' then return jsonb_build_object('id',r.resource_id);end if;
  insert into public.associations(name,registered_by,rna,siret,approval_status,timezone,opening_hours)
  values(body->>'name',actor,body->>'rna',body->>'siret','pending',coalesce(body->>'timezone','Europe/Paris'),'[]') returning * into a;
  insert into public.association_members(association_id,profile_id,role,active) values(a.id,actor,'assoc_admin',false);
  insert into public.membership_events(association_id,profile_id,action,role_after,active_before,active_after,actor_id)
  values(a.id,actor,'bootstrap','assoc_admin',false,false,actor);
 else
  select * into a from public.associations where id=tenant for update;
  if not found then raise exception 'not_found';end if;
  if action in ('approval','recovery') then
   if not exists(select 1 from public.profiles where id=actor and platform_role='platform_admin' and disabled_at is null) then raise exception 'forbidden';end if;
  else
   select * into m from public.association_members where association_id=tenant and profile_id=actor and active and role='assoc_admin' for update;
   if not found or a.approval_status<>'approved' then raise exception 'forbidden';end if;
  end if;
  if r.state='completed' then
   if action in ('approval','recovery') then return r.result_refs||jsonb_build_object('membership',(select to_jsonb(am) from public.association_members am where am.association_id=tenant and am.profile_id=a.registered_by));end if;
   return coalesce(r.result_refs,jsonb_build_object('id',tenant));
  end if;
  if action in ('approval','recovery') then
   if a.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
   if not exists(select 1 from public.profiles where id=a.registered_by and disabled_at is null) then raise exception 'forbidden';end if;
   if action='approval' then
    if a.approval_status<>'pending' then raise exception 'invalid_transition';end if;
    update public.associations set approval_status='approved',approved_by=actor,approved_at=clock_timestamp(),revision=revision+1,updated_at=clock_timestamp() where id=tenant;
   elsif a.approval_status<>'approved' or exists(select 1 from public.association_members am join public.profiles p on p.id=am.profile_id where am.association_id=tenant and am.role='assoc_admin' and am.active and p.disabled_at is null) then raise exception 'admin_recovery_not_allowed';
   elsif coalesce(trim(body->>'reason'),'')='' then raise exception 'validation_error';end if;
   select * into m from public.association_members where association_id=tenant and profile_id=a.registered_by for update;
   update public.association_members set role='assoc_admin',active=true,revision=revision+1,updated_at=clock_timestamp() where association_id=tenant and profile_id=a.registered_by;
   insert into public.membership_events(association_id,profile_id,action,role_before,role_after,active_before,active_after,actor_id,reason)
   values(tenant,a.registered_by,case when action='approval' then 'activate'::public.membership_action else 'recovery'::public.membership_action end,m.role,'assoc_admin',m.active,true,actor,body->>'reason') returning id into event_id;
  elsif action='transfer' then
   if target=actor or not exists(select 1 from public.profiles where id=target and disabled_at is null) then raise exception 'not_found';end if;
   if m.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
   select role,active into old_role,old_active from public.association_members where association_id=tenant and profile_id=target for update;
   insert into public.association_members(association_id,profile_id,role,active) values(tenant,target,'assoc_admin',true)
    on conflict(association_id,profile_id) do update set role='assoc_admin',active=true,revision=public.association_members.revision+1,updated_at=clock_timestamp();
   update public.association_members set role='assoc_staff',revision=revision+1,updated_at=clock_timestamp() where association_id=tenant and profile_id=actor;
   insert into public.membership_events(association_id,profile_id,action,role_before,role_after,active_before,active_after,actor_id)
    values(tenant,target,'transfer',old_role,'assoc_admin',coalesce(old_active,false),true,actor) returning id into event_id;
   insert into public.membership_events(association_id,profile_id,action,role_before,role_after,active_before,active_after,actor_id)
    values(tenant,actor,'transfer','assoc_admin','assoc_staff',true,true,actor) returning id into other_event_id;
  elsif action='grant' then
   if exists(select 1 from public.association_members where association_id=tenant and profile_id=target) then raise exception 'invalid_transition';end if;
   if not exists(select 1 from public.profiles where id=target and disabled_at is null) then raise exception 'not_found';end if;
   insert into public.association_members(association_id,profile_id,role,active) values(tenant,target,(body->>'role')::public.assoc_role,true);
   insert into public.membership_events(association_id,profile_id,action,role_after,active_before,active_after,actor_id)
   values(tenant,target,'grant',(body->>'role')::public.assoc_role,false,true,actor) returning id into event_id;
  elsif action='member_edit' then
   target:=(body->>'profile_id')::uuid;
   select * into m from public.association_members where association_id=tenant and profile_id=target for update;
   if not found then raise exception 'not_found';end if;
   if m.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
   old_role:=m.role;old_active:=m.active;
   m.role:=coalesce((body->>'role')::public.assoc_role,m.role);m.active:=coalesce((body->>'active')::boolean,m.active);
   if not m.active and coalesce(trim(body->>'reason'),'')='' then raise exception 'validation_error';end if;
   if old_role='assoc_admin' and old_active and (not m.active or m.role<>'assoc_admin') and not exists(select 1 from public.association_members am join public.profiles p on p.id=am.profile_id where am.association_id=tenant and am.profile_id<>target and am.role='assoc_admin' and am.active and p.disabled_at is null) then raise exception 'last_admin_required';end if;
   if m.active and not exists(select 1 from public.profiles where id=target and disabled_at is null) then raise exception 'forbidden';end if;
   update public.association_members set role=m.role,active=m.active,revision=revision+1,updated_at=clock_timestamp() where association_id=tenant and profile_id=target;
   insert into public.membership_events(association_id,profile_id,action,role_before,role_after,active_before,active_after,actor_id,reason)
   values(tenant,target,case when not m.active then 'revoke'::public.membership_action else 'role_change'::public.membership_action end,old_role,m.role,old_active,m.active,actor,body->>'reason') returning id into event_id;
  else raise exception 'invalid_transition';end if;
 end if;
 result:=jsonb_build_object('id',a.id,'profile_id',target,'event_id',event_id);
 if action='transfer' then result:=result||jsonb_build_object('event_ids',jsonb_build_array(event_id,other_event_id));end if;
 update private.api_requests set state='completed',resource_id=a.id,http_status=case when action in ('create','grant') then 201 else 200 end,result_refs=result where id=r.id;
 if action in ('approval','recovery') then
  return result||jsonb_build_object('membership',(select to_jsonb(am) from public.association_members am where am.association_id=tenant and am.profile_id=a.registered_by));
 elsif action='transfer' then
  return result||jsonb_build_object('initiator',(select to_jsonb(am) from public.association_members am where am.association_id=tenant and am.profile_id=actor),
   'target',(select to_jsonb(am) from public.association_members am where am.association_id=tenant and am.profile_id=target),
   'event_ids',jsonb_build_array(event_id,other_event_id));
 end if;
 return result;
end $$;
revoke all on function public.dono_association(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dono_association(uuid,uuid,text,uuid,jsonb) to service_role;
