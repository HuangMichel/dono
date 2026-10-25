create function public.dono_offer_list(actor uuid,tenant uuid default null,item uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_actor(actor);
 if tenant is not null then perform private.staff(actor,tenant);
 elsif item is not null then
  if not exists(select 1 from public.donations where id=item and donor_id=actor) then raise exception 'not_found';end if;
 else raise exception 'forbidden';end if;
 select coalesce(jsonb_agg(public.dono_offer_context(actor,o.id) order by o.created_at desc,o.id desc),'[]') into result from public.donation_offers o where (tenant is null or o.association_id=tenant) and (item is null or o.donation_id=item);
 return jsonb_build_object('offers',result);
end $$;
create function public.dono_owner_summaries(actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_actor(actor);
 select coalesce(jsonb_object_agg(d.id::text,public.dono_item_summary(actor,d.id)),'{}') into result from public.donations d where d.donor_id=actor;
 return result;
end $$;
create function public.dono_budget_context(actor uuid,tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare at_time timestamptz;result jsonb;
begin
 perform private.require_actor(actor);perform private.staff(actor,tenant);at_time:=clock_timestamp();
 select jsonb_build_object('needs',coalesce((select jsonb_object_agg(n.id::text,jsonb_build_object('held_quantity',(select coalesce(sum(o.quantity),0)::text from public.donation_offers o where o.need_id=n.id and private.holds(o,at_time)),
 'fulfilled_quantity',(select coalesce(sum(m.quantity),0)::text from public.inventory_movements m join public.donation_offers o on o.id=m.offer_id where o.need_id=n.id and m.movement_type='receipt'),
 'available_quantity',(n.target_quantity-private.need_used(n.id,at_time))::text)) from public.needs n where n.association_id=tenant),'{}'),
 'capacity',coalesce((select jsonb_object_agg(c.category::text,jsonb_build_object('reserved_storage_units',(select coalesce(sum(o.quantity*o.storage_units_per_item),0) from public.donation_offers o where o.association_id=tenant and o.category=c.category and private.holds(o,at_time)),
 'occupied_storage_units',private.storage_used(tenant,c.category,at_time)-(select coalesce(sum(o.quantity*o.storage_units_per_item),0) from public.donation_offers o where o.association_id=tenant and o.category=c.category and private.holds(o,at_time)),
 'available_storage_units',c.limit_storage_units-private.storage_used(tenant,c.category,at_time))) from public.capacity c where c.association_id=tenant),'{}'),
 'quotas',coalesce((select jsonb_object_agg(q.category::text||'/'||q.service_date::text,jsonb_build_object('booked_quantity',(select coalesce(sum(o.quantity),0)::text from public.bookings b join public.donation_offers o on o.id=b.offer_id where b.association_id=tenant and b.category=q.category and b.quota_date=q.service_date and b.status='booked' and at_time<b.receivable_until),
 'received_quantity',(select coalesce(sum(o.quantity),0)::text from public.bookings b join public.donation_offers o on o.id=b.offer_id where b.association_id=tenant and b.category=q.category and b.quota_date=q.service_date and b.status='received'),
 'available_quantity',(q.limit_quantity-private.intake_used(tenant,q.category,q.service_date,at_time))::text)) from public.intake_quotas q where q.association_id=tenant),'{}'),
 'slots',coalesce((select jsonb_object_agg(s.id::text,jsonb_build_object('booked_count',(select count(*) from public.bookings b where b.slot_id=s.id and b.status='booked' and at_time<b.receivable_until),
 'received_count',(select count(*) from public.bookings b where b.slot_id=s.id and b.status='received'),'remaining_places',s.max_bookings-private.slot_used(s.id,at_time))) from public.slots s where s.association_id=tenant),'{}')) into result;
 return result;
end $$;
revoke all on function public.dono_offer_list(uuid,uuid,uuid),public.dono_owner_summaries(uuid),public.dono_budget_context(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dono_offer_list(uuid,uuid,uuid),public.dono_owner_summaries(uuid),public.dono_budget_context(uuid,uuid) to service_role;
