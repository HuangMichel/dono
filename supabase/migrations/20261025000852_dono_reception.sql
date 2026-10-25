create function public.dono_offer_context(actor uuid,attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.donation_offers; result jsonb;
begin
 perform private.require_actor(actor);
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select * into o from public.donation_offers where id=attempt;
 if not found or not private.read_offer(attempt) then raise exception 'not_found';end if;
 select jsonb_build_object('offer',to_jsonb(o),'as_of',clock_timestamp(),
 'human_facts_confirmed',exists(select 1 from public.donation_edits ed where o.evidence_snapshot->'edit_ids' @> jsonb_build_array(ed.id::text) and ed.actor_id is not null and ed.change_kind in ('created','facts_edited') and ed.after_facts=o.facts_snapshot and ed.after_facts->>'quantity' is not null),
 'date_label_correction_analysis_ids',coalesce((select q.context->'reviewed_analysis_ids' from private.api_requests q where q.operation='workflow/decision/'||o.id::text and q.resource_id=o.id and q.state='completed' and q.context->'intake_checks'->>'date_label_correction_confirmed'='true' limit 1),'[]'),
 'association',jsonb_build_object('id',a.id,'timezone',a.timezone,'revision',a.revision),
 'need',jsonb_build_object('id',n.id,'category',n.category,'attributes',n.attributes,'seasons',n.seasons,'revision',n.revision,'active',n.active),
 'booking',(select to_jsonb(b) from public.bookings b where offer_id=attempt),
 'slot',(select to_jsonb(s) from public.slots s join public.bookings b on b.slot_id=s.id where b.offer_id=attempt),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'state',case q.state when 'in_progress' then 'pending' when 'completed' then 'succeeded' else 'unavailable' end) order by q.id),'[]') from private.api_requests q where o.evidence_snapshot->'analysis_request_ids' @> jsonb_build_array(q.id::text)),
 'analyses',(select coalesce(jsonb_agg(jsonb_build_object('analysis',to_jsonb(da),'indicators',(select coalesce(jsonb_agg(to_jsonb(di)),'[]') from public.donation_indicators di where di.analysis_id=da.id)) order by da.id),'[]') from public.donation_analysis da where o.evidence_snapshot->'analysis_request_ids' @> jsonb_build_array(da.request_id::text)))
 into result from public.associations a join public.needs n on n.association_id=a.id and n.id=o.need_id where a.id=o.association_id;
 return result;
end $$;
create function public.dono_stock_command(actor uuid,key uuid,action text,booking uuid,receipt uuid,body jsonb,guard jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.api_requests; b public.bookings; o public.donation_offers; d public.donations; s public.slots; m public.inventory_movements; original public.inventory_movements; at_time timestamptz; result jsonb; before_source jsonb;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 r:=private.claim(actor,'stock/'||action||'/'||coalesce(booking::text,receipt::text),key,body);
 perform private.require_actor(actor);
 if action='distribute' then
  select * into original from public.inventory_movements where id=receipt and movement_type='receipt';
  if not found then raise exception 'not_found';end if;
  booking:=original.booking_id;
 end if;
 select * into b from public.bookings where id=booking;
 if not found then raise exception 'not_found';end if;
 perform 1 from public.associations where id=b.association_id for update;
 perform private.staff(actor,b.association_id);
 select * into d from public.donations where id=b.donation_id for update;
 select * into o from public.donation_offers where id=b.offer_id for update;
 select * into b from public.bookings where id=booking for update;
 if r.state='completed' then return r.result_refs;end if;
 at_time:=clock_timestamp();
 perform private.date_fence(o,guard,at_time);
 if action='receive' then
  if body->>'confirm_full_received' is distinct from 'true' or b.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
  if b.status<>'booked' or o.status<>'approved' or d.status<>'ready' then raise exception 'invalid_transition';end if;
  if b.qr_nonce is distinct from (guard->>'qr_nonce')::uuid then raise exception 'invalid_qr';end if;
  select * into s from public.slots where id=b.slot_id;
  if at_time<s.starts_at or at_time>=b.receivable_until then raise exception 'outside_reception_window';end if;
  if exists(select 1 from public.inventory_movements where donation_id=d.id and movement_type='receipt') then raise exception 'already_received';end if;
  before_source:=private.source_facts(d.id);
  insert into public.inventory_movements(donation_id,association_id,movement_type,quantity,unit,actor_id,offer_id,booking_id,created_at)
  values(d.id,b.association_id,'receipt',o.quantity,o.unit,actor,o.id,b.id,at_time) returning * into m;
  update public.bookings set status='received',closed_at=at_time,closed_by=actor,close_reason='received',revision=revision+1 where id=b.id;
  update public.donation_offers set status='fulfilled',closed_at=at_time,revision=revision+1,updated_at=at_time where id=o.id returning * into o;
  perform private.offer_event(o,'approved','received',actor,body->>'reason',at_time);
  update public.donations set status='transferred',revision=revision+1,updated_at=at_time where id=d.id;
  insert into public.donation_edits(donation_id,actor_id,basis_analysis_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state)
  values(d.id,actor,d.basis_analysis_id,d.revision,before_source,before_source,'transferred',d.status,'transferred');
 elsif action='distribute' then
  if body->>'confirm_full_distribution' is distinct from 'true' or b.status<>'received' or o.status<>'fulfilled' or d.status<>'transferred' then raise exception 'invalid_transition';end if;
  if exists(select 1 from public.inventory_movements where donation_id=d.id and movement_type='distribution') then raise exception 'already_distributed';end if;
  insert into public.inventory_movements(donation_id,association_id,movement_type,quantity,unit,actor_id,offer_id,booking_id,created_at)
  values(d.id,b.association_id,'distribution',o.quantity,o.unit,actor,o.id,b.id,at_time) returning * into m;
 else raise exception 'invalid_transition';end if;
 result:=jsonb_build_object('id',m.id,'offer_id',o.id,'booking_id',b.id);
 update private.api_requests set state='completed',resource_id=m.id,http_status=case when action='receive' then 200 else 201 end,result_refs=result,context=jsonb_build_object('date_checks',body->'date_checks','reason',body->>'reason') where id=r.id;
 return result;
end $$;
revoke all on function public.dono_offer_context(uuid,uuid),public.dono_stock_command(uuid,uuid,text,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dono_offer_context(uuid,uuid),public.dono_stock_command(uuid,uuid,text,uuid,uuid,jsonb,jsonb) to service_role;
create function public.dono_offer_slots(actor uuid,attempt uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare o public.donation_offers; at_time timestamptz:=clock_timestamp(); result jsonb;
begin
 perform private.require_actor(actor);
 select x.* into o from public.donation_offers x join public.donations d on d.id=x.donation_id where x.id=attempt and d.donor_id=actor;
 if not found then raise exception 'not_found';end if;
 if not private.holds(o,at_time) then raise exception 'deadline_elapsed';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'quota_date',q.service_date) order by s.starts_at,s.id),'[]') into result
 from public.slots s join public.associations a on a.id=s.association_id join public.intake_quotas q on q.association_id=a.id and q.category=o.category and q.service_date=(s.starts_at at time zone a.timezone)::date
 where s.association_id=o.association_id and s.active and s.starts_at>at_time and s.starts_at<=at_time+interval '168 hours' and q.limit_quantity-private.intake_used(a.id,o.category,q.service_date,at_time)>=o.quantity and s.max_bookings>private.slot_used(s.id,at_time);
 return jsonb_build_object('slots',result);
end $$;
revoke all on function public.dono_offer_slots(uuid,uuid) from public,anon,authenticated;
grant execute on function public.dono_offer_slots(uuid,uuid) to service_role;
