create function public.dono_config(actor uuid,key uuid,kind text,tenant uuid,resource uuid,category public.donation_category,day date,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare r private.api_requests; n public.needs; c public.capacity; q public.intake_quotas; s public.slots; a public.associations; at_time timestamptz; used numeric; result jsonb; new_start timestamptz; new_end timestamptz;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 r:=private.claim(actor,'config/'||kind||'/'||tenant::text||'/'||coalesce(resource::text,category::text,'')||'/'||coalesce(day::text,''),key,body);
 perform private.require_actor(actor);
 select * into a from public.associations where id=tenant for update;
 if not found then raise exception 'not_found';end if;
 perform private.staff(actor,tenant,true);
 if r.state='completed' then return r.result_refs;end if;
 at_time:=clock_timestamp();
 if kind='need' then
  if resource is null then
   insert into public.needs(association_id,category,attributes,seasons,target_quantity,unit,storage_units_per_item,active,source_text,created_by)
   values(tenant,(body->>'category')::public.donation_category,body->'attributes',array(select jsonb_array_elements_text(body->'seasons'))::public.need_season[],(body->>'target_quantity')::numeric,'item',(body->>'storage_units_per_item')::int,(body->>'active')::boolean,body->>'source_text',actor) returning * into n;
  else
   select * into n from public.needs where id=resource and association_id=tenant for update;
   if not found then raise exception 'not_found';end if;
   if n.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
   if coalesce((body->>'target_quantity')::numeric,n.target_quantity)<private.need_used(n.id,at_time) then raise exception 'configuration_below_commitment';end if;
   update public.needs set attributes=coalesce(body->'attributes',attributes),seasons=case when body ? 'seasons' then array(select jsonb_array_elements_text(body->'seasons'))::public.need_season[] else seasons end,target_quantity=coalesce((body->>'target_quantity')::numeric,target_quantity),storage_units_per_item=coalesce((body->>'storage_units_per_item')::int,storage_units_per_item),active=coalesce((body->>'active')::boolean,active),revision=revision+1,updated_at=at_time where id=n.id returning * into n;
  end if;
  result:=jsonb_build_object('id',n.id);
 elsif kind='capacity' then
  select * into c from public.capacity where association_id=tenant and capacity.category=dono_config.category for update;
  if found and (body->>'expected_revision' is null or c.revision<>(body->>'expected_revision')::bigint) then raise exception 'stale_revision';end if;
  if c.association_id is null and body ? 'expected_revision' then raise exception 'stale_revision';end if;
  if (body->>'limit_storage_units')::bigint<private.storage_used(tenant,category,at_time) then raise exception 'configuration_below_commitment';end if;
  insert into public.capacity(association_id,category,storage_unit,limit_storage_units) values(tenant,category,'item_slot',(body->>'limit_storage_units')::int)
  on conflict(association_id,category) do update set limit_storage_units=excluded.limit_storage_units,revision=public.capacity.revision+1,updated_at=at_time;
  result:=jsonb_build_object('association_id',tenant,'category',category);
 elsif kind='quota' then
  select * into q from public.intake_quotas iq where iq.association_id=tenant and iq.category=dono_config.category and iq.service_date=day for update;
  if found and (body->>'expected_revision' is null or q.revision<>(body->>'expected_revision')::bigint) then raise exception 'stale_revision';end if;
  if q.association_id is null and body ? 'expected_revision' then raise exception 'stale_revision';end if;
  if (body->>'limit_quantity')::numeric<private.intake_used(tenant,category,day,at_time) then raise exception 'configuration_below_commitment';end if;
  insert into public.intake_quotas(association_id,category,service_date,unit,limit_quantity) values(tenant,category,day,'item',(body->>'limit_quantity')::numeric)
  on conflict(association_id,category,service_date) do update set limit_quantity=excluded.limit_quantity,revision=public.intake_quotas.revision+1,updated_at=at_time;
  result:=jsonb_build_object('association_id',tenant,'category',category,'service_date',day);
 elsif kind='slot' then
  if resource is not null then
   select * into s from public.slots where id=resource and association_id=tenant for update;
   if not found then raise exception 'not_found';end if;
   if s.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
   if (body ? 'starts_at' or body ? 'ends_at') and exists(select 1 from public.bookings where slot_id=s.id) then raise exception 'invalid_transition';end if;
   if coalesce((body->>'max_bookings')::int,s.max_bookings)<private.slot_used(s.id,at_time) then raise exception 'configuration_below_commitment';end if;
  end if;
  new_start:=coalesce((body->>'starts_at')::timestamptz,s.starts_at);new_end:=coalesce((body->>'ends_at')::timestamptz,s.ends_at);
  if resource is null or body ? 'starts_at' or body ? 'ends_at' or coalesce((body->>'active')::boolean,false) then
   if new_start<=at_time or new_end<=new_start or (new_start at time zone a.timezone)::date<>(new_end at time zone a.timezone)::date then raise exception 'validation_error';end if;
   if not exists(select 1 from jsonb_array_elements(a.opening_hours) h where (h->>'weekday')::int=extract(isodow from new_start at time zone a.timezone)::int and (h->>'start_local')::time<=(new_start at time zone a.timezone)::time and (h->>'end_local')::time>=(new_end at time zone a.timezone)::time) then raise exception 'validation_error';end if;
  end if;
  if coalesce((body->>'active')::boolean,s.active,true) and exists(select 1 from public.slots x where x.association_id=tenant and x.active and x.id is distinct from resource and x.starts_at<new_end and x.ends_at>new_start) then raise exception 'invalid_transition';end if;
  if resource is null then
   insert into public.slots(association_id,starts_at,ends_at,max_bookings,active) values(tenant,new_start,new_end,(body->>'max_bookings')::int,true) returning * into s;
  else
   update public.slots set starts_at=new_start,ends_at=new_end,max_bookings=coalesce((body->>'max_bookings')::int,max_bookings),active=coalesce((body->>'active')::boolean,active),revision=revision+1,updated_at=at_time where id=s.id returning * into s;
  end if;
  result:=jsonb_build_object('id',s.id);
 else raise exception 'validation_error';end if;
 update private.api_requests set state='completed',resource_id=coalesce(n.id,s.id),http_status=case when kind in ('need','slot') and resource is null then 201 else 200 end,result_refs=result where id=r.id;
 return result;
end $$;
revoke all on function public.dono_config(uuid,uuid,text,uuid,uuid,public.donation_category,date,jsonb) from public,anon,authenticated;
grant execute on function public.dono_config(uuid,uuid,text,uuid,uuid,public.donation_category,date,jsonb) to service_role;
