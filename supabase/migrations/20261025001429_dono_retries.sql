create function public.dono_retry_lookup(actor uuid,operation text,key uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.associations; r private.api_requests; o public.donation_offers; owner uuid; action text;
begin
 perform private.require_actor(actor);
 select * into r from private.api_requests q where q.actor_id=actor and q.operation=dono_retry_lookup.operation and q.idempotency_key=key and q.state='completed';
 if not found then return jsonb_build_object('found',false);end if;
 if r.request_hash<>encode(sha256(convert_to(body::text,'UTF8')),'hex') then raise exception 'idempotency_conflict';end if;
 if operation like 'site/%' then
  select * into a from public.associations where id=r.resource_id for update;
  if a.id is null then raise exception 'not_found';end if;
  if a.approval_status='pending' then
   if a.registered_by<>actor then raise exception 'not_found';end if;
  else perform private.staff(actor,a.id,true);end if;
  return jsonb_build_object('found',true,'result',r.result_refs);
 end if;
 action:=split_part(operation,'/',2);
 if operation like 'workflow/%' then select * into o from public.donation_offers where id=(r.result_refs->>'id')::uuid;
 elsif operation like 'stock/%' then select * into o from public.donation_offers where id=(r.result_refs->>'offer_id')::uuid;
 else raise exception 'forbidden';end if;
 select donor_id into owner from public.donations where id=o.donation_id;
 perform 1 from public.associations where id=o.association_id for update;
 if operation like 'workflow/%' and action in ('submit','book','withdraw') then
  if owner<>actor then raise exception 'not_found';end if;
 elsif operation like 'workflow/%' and action='cancel_booking' and owner=actor then null;
 else perform private.staff(actor,o.association_id);end if;
 return jsonb_build_object('found',true,'result',r.result_refs);
end $$;
revoke all on function public.dono_retry_lookup(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dono_retry_lookup(uuid,text,uuid,jsonb) to service_role;
