create function public.dono_site(actor uuid,key uuid,tenant uuid,body jsonb,location jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.api_requests; a public.associations; at_time timestamptz;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 r:=private.claim(actor,'site/'||tenant::text,key,body);
 perform private.require_actor(actor);
 select * into a from public.associations where id=tenant for update;
 if not found then raise exception 'not_found';end if;
 if a.approval_status='pending' then
  if a.registered_by<>actor then raise exception 'not_found';end if;
 else perform private.staff(actor,tenant,true);end if;
 if r.state='completed' then return r.result_refs;end if;
 if a.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
 if a.approval_status='pending' and body ?| array['address','timezone','opening_hours'] then raise exception 'forbidden';end if;
 if a.approval_status='approved' and body ?| array['name','rna','siret'] then raise exception 'forbidden';end if;
 at_time:=clock_timestamp();
 if body ? 'timezone' and body->>'timezone'<>a.timezone and exists(select 1 from public.slots where association_id=tenant) then raise exception 'invalid_transition';end if;
 if body ?| array['address','opening_hours'] and exists(select 1 from public.bookings where association_id=tenant and status='booked' and at_time<receivable_until) then raise exception 'invalid_transition';end if;
 if body ? 'opening_hours' and exists(select 1 from public.slots s where s.association_id=tenant and s.active and not exists(select 1 from jsonb_array_elements(body->'opening_hours') h where (h->>'weekday')::int=extract(isodow from s.starts_at at time zone a.timezone)::int and (h->>'start_local')::time<=(s.starts_at at time zone a.timezone)::time and (h->>'end_local')::time>=(s.ends_at at time zone a.timezone)::time)) then raise exception 'invalid_transition';end if;
 if body ? 'address' and (location is null or not location ?& array['display_address','latitude','longitude']) then raise exception 'validation_error';end if;
 update public.associations set name=coalesce(body->>'name',name),rna=coalesce(body->>'rna',rna),siret=coalesce(body->>'siret',siret),timezone=coalesce(body->>'timezone',timezone),opening_hours=coalesce(body->'opening_hours',opening_hours),display_address=coalesce(location->>'display_address',display_address),latitude=coalesce((location->>'latitude')::float8,latitude),longitude=coalesce((location->>'longitude')::float8,longitude),revision=revision+1,updated_at=at_time where id=tenant;
 update private.api_requests set state='completed',resource_id=tenant,http_status=200,result_refs=jsonb_build_object('id',tenant) where id=r.id;
 return jsonb_build_object('id',tenant);
end $$;
revoke all on function public.dono_site(uuid,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dono_site(uuid,uuid,uuid,jsonb,jsonb) to service_role;
