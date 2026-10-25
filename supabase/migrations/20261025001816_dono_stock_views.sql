create function public.dono_stock_context(actor uuid,tenant uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 perform private.require_actor(actor);perform private.staff(actor,tenant);
 select jsonb_build_object('as_of',clock_timestamp(),'timezone',a.timezone,'lots',coalesce((
 select jsonb_agg(jsonb_build_object('receipt',to_jsonb(m),'offer',to_jsonb(o),
 'human_facts_confirmed',exists(select 1 from public.donation_edits ed where o.evidence_snapshot->'edit_ids' @> jsonb_build_array(ed.id::text) and ed.actor_id is not null and ed.change_kind in ('created','facts_edited') and ed.after_facts=o.facts_snapshot and ed.after_facts->>'quantity' is not null),
 'date_label_correction_analysis_ids',coalesce((select q.context->'reviewed_analysis_ids' from private.api_requests q where q.operation='workflow/decision/'||o.id::text and q.resource_id=o.id and q.state='completed' and q.context->'intake_checks'->>'date_label_correction_confirmed'='true' limit 1),'[]'),
 'distributed',exists(select 1 from public.inventory_movements x where x.donation_id=m.donation_id and x.movement_type='distribution'),
 'analyses',(select coalesce(jsonb_agg(to_jsonb(da)),'[]') from public.donation_analysis da where o.evidence_snapshot->'analysis_request_ids' @> jsonb_build_array(da.request_id::text)),
 'indicators',(select coalesce(jsonb_agg(to_jsonb(di)),'[]') from public.donation_indicators di join public.donation_analysis da on da.id=di.analysis_id where o.evidence_snapshot->'analysis_request_ids' @> jsonb_build_array(da.request_id::text)),
 'photos',(select coalesce(jsonb_agg(to_jsonb(p)),'[]') from public.donation_photos p where o.evidence_snapshot->'photos' @> jsonb_build_array(jsonb_build_object('photo_id',p.id::text)))) order by m.created_at,m.id)
 from public.inventory_movements m join public.donation_offers o on o.id=m.offer_id where m.association_id=tenant and m.movement_type='receipt'),'[]')) into result
 from public.associations a where a.id=tenant;
 return result;
end $$;
create function public.dono_item_summary(actor uuid,item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; at_time timestamptz:=clock_timestamp();
begin
 perform private.require_actor(actor);
 if not exists(select 1 from public.donations where id=item and donor_id=actor) then raise exception 'not_found';end if;
 select jsonb_build_object('active_offer_id',(select id from public.donation_offers o where donation_id=item and ((status='pending_review' and at_time<review_deadline) or private.holds(o,at_time)) limit 1),
 'inventory_state',case when exists(select 1 from public.inventory_movements where donation_id=item and movement_type='distribution') then 'distributed' when exists(select 1 from public.inventory_movements where donation_id=item and movement_type='receipt') then 'in_stock' else 'unreceived' end) into result;
 return result;
end $$;
revoke all on function public.dono_stock_context(uuid,uuid),public.dono_item_summary(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dono_stock_context(uuid,uuid),public.dono_item_summary(uuid,uuid) to service_role;
