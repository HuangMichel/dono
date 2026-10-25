-- Deadline-aware aggregates never rely on a scheduled cleanup job.
create function private.holds(o public.donation_offers, at_time timestamptz) returns boolean language sql stable set search_path='' as $$
 select o.status='approved' and exists(select 1 from public.donations d where d.id=o.donation_id and d.status='ready') and
 case when exists(select 1 from public.bookings where offer_id=o.id) then exists(select 1 from public.bookings where offer_id=o.id and status='booked' and at_time<receivable_until) else at_time<o.approval_deadline end
$$;
create function private.need_used(need uuid, at_time timestamptz) returns numeric language sql stable set search_path='' as $$
 select coalesce((select sum(o.quantity) from public.donation_offers o where o.need_id=need and private.holds(o,at_time)),0)+
 coalesce((select sum(m.quantity) from public.inventory_movements m join public.donation_offers o on o.id=m.offer_id where o.need_id=need and m.movement_type='receipt'),0)
$$;
create function private.storage_used(tenant uuid, cat public.donation_category, at_time timestamptz) returns bigint language sql stable set search_path='' as $$
 select (coalesce((select sum(o.quantity*o.storage_units_per_item) from public.donation_offers o where o.association_id=tenant and o.category=cat and private.holds(o,at_time)),0)+
 coalesce((select sum(m.quantity*o.storage_units_per_item) from public.inventory_movements m join public.donation_offers o on o.id=m.offer_id where m.association_id=tenant and o.category=cat and m.movement_type='receipt' and not exists(select 1 from public.inventory_movements x where x.donation_id=m.donation_id and x.movement_type='distribution')),0))::bigint
$$;
create function private.intake_used(tenant uuid,cat public.donation_category,day date,at_time timestamptz) returns numeric language sql stable set search_path='' as $$
 select coalesce(sum(o.quantity),0) from public.bookings b join public.donation_offers o on o.id=b.offer_id
 where b.association_id=tenant and b.category=cat and b.quota_date=day and (b.status='received' or (b.status='booked' and at_time<b.receivable_until))
$$;
create function private.slot_used(slot uuid,at_time timestamptz) returns bigint language sql stable set search_path='' as $$
 select count(*) from public.bookings where slot_id=slot and (status='received' or (status='booked' and at_time<receivable_until))
$$;
create function private.offer_event(o public.donation_offers, old_state public.offer_state, why public.offer_event_reason, actor uuid, note text, effective timestamptz) returns void language sql set search_path='' as $$
 insert into public.offer_events(offer_id,association_id,offer_revision,from_state,to_state,reason,actor_id,note,effective_at,recorded_at)
 values(o.id,o.association_id,o.revision,old_state,o.status,why,actor,note,effective,clock_timestamp())
$$;
create function private.expire_item(item uuid,at_time timestamptz) returns void language plpgsql set search_path='' as $$
declare o public.donation_offers; b public.bookings; cutoff timestamptz; why public.offer_event_reason; old_state public.offer_state;
begin
 select * into o from public.donation_offers where donation_id=item and status in ('pending_review','approved') for update;
 if not found then return;end if;
 select * into b from public.bookings where offer_id=o.id for update;
 if o.status='pending_review' then cutoff:=o.review_deadline;why:='review_timeout';
 elsif b.id is null then cutoff:=o.approval_deadline;why:='booking_timeout';
 else cutoff:=b.receivable_until;why:='no_show';end if;
 if at_time<cutoff then return;end if;
 old_state:=o.status;
 update public.donation_offers set status='expired',closed_at=cutoff,revision=revision+1,updated_at=at_time where id=o.id returning * into o;
 if b.status='booked' then update public.bookings set status='no_show',closed_at=cutoff,close_reason='no_show',revision=revision+1 where id=b.id;end if;
 perform private.offer_event(o,old_state,why,null,null,cutoff);
end $$;
create function private.staff(actor uuid,tenant uuid,admin_only boolean default false) returns void language plpgsql set search_path='' as $$
begin
 if not exists(select 1 from public.association_members m join public.associations a on a.id=m.association_id join public.profiles p on p.id=m.profile_id where m.association_id=tenant and m.profile_id=actor and m.active and p.disabled_at is null and a.approval_status='approved' and (not admin_only or m.role='assoc_admin')) then raise exception 'forbidden';end if;
end $$;
-- Context is server-only. Python applies category/attributes/season and read-time item-date guards.
create function public.dono_match_context(actor uuid,item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; at_time timestamptz:=clock_timestamp();
begin
 perform private.require_actor(actor);
 if not exists(select 1 from public.donations where id=item and donor_id=actor and status='ready') then raise exception 'not_found';end if;
 select jsonb_agg(jsonb_build_object('association',jsonb_build_object('id',a.id,'name',a.name,'display_address',a.display_address,'latitude',a.latitude,'longitude',a.longitude,'timezone',a.timezone),
 'need',jsonb_build_object('id',n.id,'category',n.category,'attributes',n.attributes,'seasons',n.seasons,'revision',n.revision,'storage_units_per_item',n.storage_units_per_item),
 'demand_available',n.target_quantity-private.need_used(n.id,at_time),
 'storage_available',c.limit_storage_units-private.storage_used(a.id,n.category,at_time),
 'slots',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'starts_at',s.starts_at,'ends_at',s.ends_at,'quota_date',q.service_date,'intake_available',q.limit_quantity-private.intake_used(a.id,n.category,q.service_date,at_time),'remaining_places',s.max_bookings-private.slot_used(s.id,at_time)) order by s.starts_at,s.id),'[]') from public.slots s join public.intake_quotas q on q.association_id=s.association_id and q.category=n.category and q.service_date=(s.starts_at at time zone a.timezone)::date where s.association_id=a.id and s.active and s.starts_at>at_time and s.starts_at<=at_time+interval '168 hours')))
 into result from public.needs n join public.associations a on a.id=n.association_id join public.capacity c on c.association_id=a.id and c.category=n.category where n.active and a.approval_status='approved' and a.display_address is not null and a.latitude is not null;
 return jsonb_build_object('as_of',at_time,'candidates',coalesce(result,'[]'));
end $$;
-- Guard context is never an HTTP input. It contains source identities and a local-day instant fence only.
create function private.date_fence(o public.donation_offers, guard jsonb,at_time timestamptz) returns void language plpgsql set search_path='' as $$
declare ids jsonb;
begin
 select coalesce(jsonb_agg(a.id::text order by a.id),'[]') into ids from public.donation_analysis a where o.evidence_snapshot->'analysis_request_ids' @> jsonb_build_array(a.request_id::text);
 if not coalesce(guard ?& array['offer_revision','analysis_ids','day_start','day_end'] and o.revision=(guard->>'offer_revision')::bigint and ids=guard->'analysis_ids' and at_time>=(guard->>'day_start')::timestamptz and at_time<(guard->>'day_end')::timestamptz,false) then raise exception 'date_context_stale';end if;
end $$;
create function public.dono_offer_command(actor uuid,key uuid,action text,item uuid,attempt uuid,body jsonb,guard jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.api_requests; d public.donations; o public.donation_offers; n public.needs; a public.associations; b public.bookings; s public.slots; q public.intake_quotas; at_time timestamptz; old_state public.offer_state; evidence jsonb; result jsonb; movement uuid;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 r:=private.claim(actor,'workflow/'||action||'/'||coalesce(item::text,attempt::text),key,body);
 perform private.require_actor(actor);
 if action='submit' then
  select * into d from public.donations where id=item and donor_id=actor;
  if not found then raise exception 'not_found';end if;
  -- Re-offering locks the old and new target mutexes in UUID order.
  perform 1 from public.associations where id=(body->>'association_id')::uuid or id in(select association_id from public.donation_offers where donation_id=item and status in ('pending_review','approved')) order by id for update;
 else
  select * into o from public.donation_offers where id=attempt;
  if not found then raise exception 'not_found';end if;
  item:=o.donation_id;
  perform 1 from public.associations where id=o.association_id for update;
 end if;
 select * into d from public.donations where id=item for update;
 if action in ('submit','book','withdraw') then
  if d.donor_id<>actor then raise exception 'not_found';end if;
 elsif action='cancel_booking' and d.donor_id=actor then null;
 else perform private.staff(actor,o.association_id);end if;
 if r.state='completed' then return r.result_refs;end if;
 at_time:=clock_timestamp();
 perform private.expire_item(item,at_time);
 if action='submit' then
  if d.status<>'ready' or d.revision<>(body->>'expected_donation_revision')::bigint then raise exception 'stale_revision';end if;
  if exists(select 1 from public.donation_offers where donation_id=item and status in ('pending_review','approved')) then raise exception 'active_offer_exists';end if;
  select * into n from public.needs where id=(body->>'need_id')::uuid and association_id=(body->>'association_id')::uuid and active;
  select * into a from public.associations where id=n.association_id and approval_status='approved';
  if n.id is null or a.id is null or n.category is distinct from d.category then raise exception 'ineligible_item';end if;
  -- Python eligibility is revision/day fenced so concurrent need/season changes cannot sneak through.
  if not coalesce(guard ?& array['need_revision','day_start','day_end'] and n.revision=(guard->>'need_revision')::bigint and at_time>=(guard->>'day_start')::timestamptz and at_time<(guard->>'day_end')::timestamptz,false) then raise exception 'date_context_stale';end if;
  if n.target_quantity-private.need_used(n.id,at_time)<d.quantity then raise exception 'demand_exhausted';end if;
  if coalesce((select limit_storage_units-private.storage_used(a.id,d.category,at_time) from public.capacity where association_id=a.id and category=d.category),-1)<d.quantity*n.storage_units_per_item then raise exception 'storage_exhausted';end if;
  if not exists(select 1 from public.slots sl join public.intake_quotas iq on iq.association_id=sl.association_id and iq.category=d.category and iq.service_date=(sl.starts_at at time zone a.timezone)::date where sl.association_id=a.id and sl.active and sl.starts_at>at_time and sl.starts_at<=at_time+interval '168 hours' and sl.max_bookings>private.slot_used(sl.id,at_time) and iq.limit_quantity-private.intake_used(a.id,d.category,iq.service_date,at_time)>=d.quantity) then raise exception 'intake_quota_exhausted';end if;
  evidence:=jsonb_build_object('photos',(select coalesce(jsonb_agg(jsonb_build_object('photo_id',id,'sha256',sha256) order by id),'[]') from public.donation_photos where donation_id=item),
   'analysis_request_ids',(select coalesce(jsonb_agg(id::text order by id),'[]') from private.api_requests where context->>'donation_id'=item::text and operation='analysis/'||item::text),
   'edit_ids',(select coalesce(jsonb_agg(id::text order by id),'[]') from public.donation_edits where donation_id=item));
  insert into public.donation_offers(donation_id,association_id,need_id,category,quantity,unit,facts_revision,facts_snapshot,evidence_snapshot,basis_analysis_id,status,review_deadline,policy_version,created_at,updated_at)
  values(item,a.id,n.id,d.category,d.quantity,d.unit,d.facts_revision,private.source_facts(item),evidence,d.basis_analysis_id,'pending_review',at_time+interval '72 hours','mvp-domain-v1',at_time,at_time) returning * into o;
  perform private.offer_event(o,null,'submitted',actor,null,at_time);
 else
  select * into o from public.donation_offers where id=attempt for update;
  if action<>'cancel_booking' and o.revision<>coalesce((body->>'expected_revision')::bigint,(body->>'expected_offer_revision')::bigint) then raise exception 'stale_revision';end if;
  old_state:=o.status;
  select * into a from public.associations where id=o.association_id;
  if action='decision' then
   if o.status<>'pending_review' then raise exception 'invalid_transition';end if;
   if body->>'decision'='approved' then
    perform private.date_fence(o,guard,at_time);
    if body->'intake_checks'->>'not_medicine' is distinct from 'true' or (o.category='food' and body->'intake_checks'->>'eligible_individual_food' is distinct from 'true') then raise exception 'ineligible_item';end if;
    select * into n from public.needs where id=o.need_id and active;
    if n.id is null or n.revision<>(guard->>'need_revision')::bigint then raise exception 'date_context_stale';end if;
    if n.target_quantity-private.need_used(n.id,at_time)<o.quantity then raise exception 'demand_exhausted';end if;
    if coalesce((select limit_storage_units-private.storage_used(a.id,o.category,at_time) from public.capacity where association_id=a.id and category=o.category),-1)<o.quantity*n.storage_units_per_item then raise exception 'storage_exhausted';end if;
    if not exists(select 1 from public.slots sl join public.intake_quotas iq on iq.association_id=sl.association_id and iq.category=o.category and iq.service_date=(sl.starts_at at time zone a.timezone)::date where sl.association_id=a.id and sl.active and sl.starts_at>at_time and sl.starts_at<=at_time+interval '168 hours' and sl.max_bookings>private.slot_used(sl.id,at_time) and iq.limit_quantity-private.intake_used(a.id,o.category,iq.service_date,at_time)>=o.quantity) then raise exception 'intake_quota_exhausted';end if;
   elsif body->>'decision'<>'refused' then raise exception 'validation_error';end if;
   update public.donation_offers set status=(body->>'decision')::public.offer_state,decision=(body->>'decision')::public.donation_decision,decided_by=actor,decided_at=at_time,intake_checks=body->'intake_checks',storage_units_per_item=case when body->>'decision'='approved' then n.storage_units_per_item end,approval_deadline=case when body->>'decision'='approved' then at_time+interval '24 hours' end,closed_at=case when body->>'decision'='refused' then at_time end,revision=revision+1,updated_at=at_time where id=o.id returning * into o;
   perform private.offer_event(o,old_state,case when o.decision='approved' then 'human_approved'::public.offer_event_reason else 'human_refused'::public.offer_event_reason end,actor,body->>'reason',at_time);
  elsif action='book' then
   if o.status<>'approved' or not private.holds(o,at_time) then raise exception 'deadline_elapsed';end if;
   if exists(select 1 from public.bookings where offer_id=o.id) then raise exception 'invalid_transition';end if;
   perform private.date_fence(o,guard,at_time);
   select * into s from public.slots where id=(body->>'slot_id')::uuid and association_id=o.association_id and active;
   if s.id is null or s.starts_at<=at_time or s.starts_at>at_time+interval '168 hours' then raise exception 'invalid_transition';end if;
   select * into q from public.intake_quotas where association_id=o.association_id and category=o.category and service_date=(s.starts_at at time zone a.timezone)::date;
   if q.association_id is null or q.limit_quantity-private.intake_used(a.id,o.category,q.service_date,at_time)<o.quantity then raise exception 'intake_quota_exhausted';end if;
   if s.max_bookings<=private.slot_used(s.id,at_time) then raise exception 'slot_full';end if;
   insert into public.bookings(donation_id,association_id,slot_id,qr_nonce,offer_id,category,quota_date,status,receivable_until,dropoff_address,timezone,policy_version)
   values(item,a.id,s.id,gen_random_uuid(),o.id,o.category,q.service_date,'booked',s.ends_at+interval '30 minutes',a.display_address,a.timezone,'mvp-domain-v1') returning * into b;
   update public.donation_offers set revision=revision+1,updated_at=at_time where id=o.id returning * into o;
   perform private.offer_event(o,old_state,'booked',actor,null,at_time);
  elsif action in ('withdraw','cancel','cancel_booking') then
   if action='cancel_booking' then
    select * into b from public.bookings where offer_id=o.id for update;
    if b.id is null or b.status<>'booked' then raise exception 'invalid_transition';end if;
    if b.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
   end if;
   if o.status not in ('pending_review','approved') or (action='cancel' and o.status<>'approved') then raise exception 'invalid_transition';end if;
   update public.bookings set status='cancelled',closed_at=at_time,closed_by=actor,close_reason=coalesce(body->>'reason','donor_withdrawal'),revision=revision+1 where offer_id=o.id and status='booked';
   update public.donation_offers set status=case when action='withdraw' then 'withdrawn'::public.offer_state else 'cancelled'::public.offer_state end,closed_at=at_time,revision=revision+1,updated_at=at_time where id=o.id returning * into o;
   perform private.offer_event(o,old_state,case when action='withdraw' then 'donor_withdrawal'::public.offer_event_reason when action='cancel_booking' then 'booking_cancelled'::public.offer_event_reason else 'staff_cancellation'::public.offer_event_reason end,actor,body->>'reason',at_time);
  else raise exception 'invalid_transition';end if;
 end if;
 if action='decision' and o.decision='approved' then
  update private.api_requests set context=jsonb_build_object('intake_checks',body->'intake_checks','reason',body->>'reason','reviewed_analysis_ids',guard->'analysis_ids') where id=r.id;
 end if;
 result:=jsonb_build_object('id',o.id,'booking_id',b.id,'movement_id',movement);
 update private.api_requests set state='completed',resource_id=o.id,http_status=case when action in ('submit','book') then 201 else 200 end,result_refs=result where id=r.id;
 return result;
end $$;
revoke all on function public.dono_match_context(uuid,uuid),public.dono_offer_command(uuid,uuid,text,uuid,uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.dono_match_context(uuid,uuid),public.dono_offer_command(uuid,uuid,text,uuid,uuid,jsonb,jsonb) to service_role;
revoke all on function private.holds(public.donation_offers,timestamptz),private.need_used(uuid,timestamptz),private.storage_used(uuid,public.donation_category,timestamptz),private.intake_used(uuid,public.donation_category,date,timestamptz),private.slot_used(uuid,timestamptz),private.offer_event(public.donation_offers,public.offer_state,public.offer_event_reason,uuid,text,timestamptz),private.expire_item(uuid,timestamptz),private.staff(uuid,uuid,boolean),private.date_fence(public.donation_offers,jsonb,timestamptz) from public,anon,authenticated;
