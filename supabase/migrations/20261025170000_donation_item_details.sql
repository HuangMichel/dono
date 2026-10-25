-- Donor-authored identity. Existing evidence remains immutable and keeps its original shape.
alter table public.donations
 add column name text check(name is null or (name=btrim(name) and length(name) between 1 and 120)),
 add column description text check(description is null or (description=btrim(description) and length(description) between 1 and 2000));

-- Deterministic compatibility names for items that existed before this migration.
-- No current donor details are copied into historical offers or immutable edits.
update public.donations set name=btrim(left(coalesce(nullif(btrim(attributes->>'product'),''),
 nullif(btrim(attributes->>'type'),''),case category
 when 'clothes' then 'Clothes' when 'shoes' then 'Shoes' when 'food' then 'Food'
 when 'para' then 'Hygiene & care' when 'furniture' then 'Small furniture' end),120));

create or replace function private.source_facts(item uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('name',d.name,'description',d.description,'category',d.category,'attributes',d.attributes,'quantity',d.quantity::text,'unit',d.unit,
 'expiry',jsonb_build_object('expiry_date',e.expiry_date,'date_type',e.date_type,'pao_months',e.pao_months,'opened_on',e.opened_on,'date_precision',e.date_precision,'raw_label',e.raw_label,'readability',e.readability))
 from public.donations d join public.expiry_info e on e.donation_id=d.id where d.id=item
$$;

create or replace function public.dono_item(actor uuid, key uuid, action text, item uuid, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.donations; r private.api_requests; before_facts jsonb; after_facts jsonb; before_state public.donation_state; kind public.donation_change_kind; human_facts boolean;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 -- Authorization precedes replay; creation is scoped through its durable actor key.
 if action<>'create' then
  select * into d from public.donations where id=item and donor_id=actor;
  if not found then raise exception 'not_found'; end if;
 end if;
 r:=private.claim(actor,'item/'||action||'/'||coalesce(item::text,''),key,body);
 perform private.require_actor(actor);
 if action<>'create' then
  select * into d from public.donations where id=item and donor_id=actor for update;
  if not found then raise exception 'not_found';end if;
 end if;
 if r.state='completed' then return jsonb_build_object('id',r.resource_id,'replay',true); end if;
 -- Identity alone does not confirm category/date facts or prevent AI suggestions.
 human_facts := body->'facts'->>'category' is not null
  or body->'facts'->>'quantity' is not null or body->'facts'->>'unit' is not null
  or coalesce(body->'facts'->'attributes','{}')<>'{}'::jsonb
  or exists(select 1 from jsonb_each_text(coalesce(body->'facts'->'expiry','{}')) e
   where e.value is not null
   and not (e.key in ('date_precision','readability') and e.value='unknown'));
 if action='create' then
  insert into public.donations(donor_id,name,description,category,attributes,quantity,unit,status,facts_origin)
  values(actor,nullif(btrim(body->'facts'->>'name'),''),nullif(btrim(body->'facts'->>'description'),''),(body->'facts'->>'category')::public.donation_category,coalesce(body->'facts'->'attributes','{}'),(body->'facts'->>'quantity')::numeric,(body->'facts'->>'unit')::public.quantity_unit,'draft',case when human_facts then 'human'::public.facts_origin else 'empty'::public.facts_origin end) returning * into d;
  perform private.put_source_dates(d.id,case when body ? 'facts' then actor else null end,coalesce(body->'facts'->'expiry','{}'));
  before_facts:='{}'; kind:='created'; before_state:=null;
 else
  if d.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision'; end if;
  if d.status='transferred' or private.live_offer(d.id,clock_timestamp()) then raise exception 'invalid_transition'; end if;
  before_facts:=private.source_facts(d.id);before_state:=d.status;
  if action='edit' then
   update public.donations set name=nullif(btrim(body->'facts'->>'name'),''),description=nullif(btrim(body->'facts'->>'description'),''),category=(body->'facts'->>'category')::public.donation_category,attributes=body->'facts'->'attributes',quantity=(body->'facts'->>'quantity')::numeric,unit=(body->'facts'->>'unit')::public.quantity_unit,facts_origin=case when human_facts then 'human'::public.facts_origin else 'empty'::public.facts_origin end,facts_revision=facts_revision+1 where id=d.id;
   perform private.put_source_dates(d.id,actor,body->'facts'->'expiry');kind:='facts_edited';
  elsif action in ('publication','restoration') then
   if (action='publication' and d.status<>'draft') or (action='restoration' and d.status<>'withdrawn') then raise exception 'invalid_transition'; end if;
   if d.name is null or d.category is null or d.quantity is null or d.unit is null or not exists(select 1 from public.donation_photos where donation_id=d.id) then raise exception 'ineligible_item'; end if;
   if coalesce(d.attributes->>case when d.category in ('food','para') then 'product' else 'type' end,'')='' then raise exception 'ineligible_item';end if;
   if d.category='food' and (d.attributes->>'storage_condition' is distinct from 'room_temperature' or d.attributes->>'non_perishable' is distinct from 'true' or d.attributes->>'packaging_state'='opened') then raise exception 'ineligible_item';end if;
   update public.donations set status='ready' where id=d.id;kind:=case when action='publication' then 'published'::public.donation_change_kind else 'restored'::public.donation_change_kind end;
  else raise exception 'invalid_transition'; end if;
  update public.donations set revision=revision+1,updated_at=clock_timestamp() where id=d.id;
 end if;
 after_facts:=private.source_facts(d.id);
 insert into public.donation_edits(donation_id,actor_id,basis_analysis_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state)
 select id,actor,basis_analysis_id,case when action='create' then 0 else d.revision end,before_facts,after_facts,kind,before_state,status from public.donations where id=d.id;
 update private.api_requests set state='completed',resource_id=d.id,http_status=case when action='create' then 201 else 200 end,result_refs=jsonb_build_object('id',d.id) where id=r.id;
 return jsonb_build_object('id',d.id,'replay',false);
end $$;

create or replace function public.dono_offer_command(actor uuid,key uuid,action text,item uuid,attempt uuid,body jsonb,guard jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if d.name is null then raise exception 'ineligible_item';end if;
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

create or replace function private.postable(item uuid) returns boolean language sql stable set search_path='' as $$
 select exists(
 select 1 from public.donations d join public.profiles owner on owner.id=d.donor_id
 where d.id=item and d.status='ready' and owner.disabled_at is null
 and not private.live_offer(item,statement_timestamp())
 and d.name is not null and d.category is not null and d.quantity>0 and d.unit='item'
 and coalesce(d.attributes->>case when d.category in ('food','para') then 'product' else 'type' end,'')<>''
 and exists(select 1 from public.donation_photos p where p.donation_id=item and p.kind='item')
 and (d.category<>'food' or (d.attributes->>'storage_condition'='room_temperature'
   and d.attributes->>'non_perishable'='true' and d.attributes->>'packaging_state'='sealed'))
 and exists(select 1 from public.donation_analysis a where a.donation_id=item and a.category=d.category
   and not exists(select 1 from public.donation_photos photo where photo.donation_id=item
    and not (a.input_photos @> jsonb_build_array(jsonb_build_object('photo_id',photo.id::text,'sha256',photo.sha256)))))
 and not exists(select 1 from public.donation_analysis a join public.donation_indicators i on i.analysis_id=a.id
   where a.donation_id=item and i.key in ('looks_like_medicine','chilled_or_frozen') and i.level in ('medium','high'))
 )
$$;

create or replace function public.dono_posted_donations(actor uuid,tenant uuid,filter_category public.donation_category default null,
 radius_km double precision default 25,page_limit integer default 10,page_offset integer default 0)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare origin public.associations; result jsonb;
begin
 perform private.require_actor(actor);perform private.staff(actor,tenant);
 select * into origin from public.associations where id=tenant;
 if origin.latitude is null or origin.longitude is null then raise exception 'association_location_required';end if;
 if radius_km is null or radius_km not between 1 and 200 or page_limit is null or page_limit not between 1 and 50 or page_offset is null or page_offset<0 then raise exception 'validation_error';end if;
 with candidates as materialized (
  select p.*,d.name,d.description,d.category,d.attributes,d.quantity,d.unit,
   6371.0088*2*asin(sqrt(least(1.0,power(sin(radians(p.latitude-origin.latitude)/2),2)
    +cos(radians(origin.latitude))*cos(radians(p.latitude))*power(sin(radians(p.longitude-origin.longitude)/2),2)))) as distance_km
  from private.donation_postings p join public.donations d on d.id=p.donation_id
  where (filter_category is null or d.category=filter_category) and p.facts_revision=d.facts_revision
  and p.latitude between origin.latitude-radius_km/111.2 and origin.latitude+radius_km/111.2
  and private.postable(d.id)
 ), bounded as (
  select * from candidates where distance_km<=radius_km
  order by distance_km,posted_at desc,donation_id limit page_limit+1 offset page_offset
 ), numbered as (
  select *,row_number() over(order by distance_km,posted_at desc,donation_id) position from bounded
 )
 select jsonb_build_object('data',coalesce(jsonb_agg(jsonb_build_object(
  'id',donation_id,'name',name,'description',description,'category',category,
  'attributes',(select coalesce(jsonb_object_agg(key,value),'{}') from jsonb_each(attributes)
    where key in ('type','size','audience','seasons','pair_complete','product','brand','storage_condition','non_perishable','packaging_state','product_kind','opening_state','seal_state','size_class','printed_dimensions')),
  'quantity',quantity::text,'unit',unit,'locality',locality,'posted_at',posted_at,'distance_km',round(distance_km::numeric,1),
  'expiry',(select jsonb_build_object('expiry_date',expiry_date,'date_type',date_type,'pao_months',pao_months,'opened_on',opened_on,'date_precision',date_precision,'readability',readability) from public.expiry_info where donation_id=n.donation_id),
  'photos',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'content_url','/api/v1/associations/'||tenant::text||'/posted-donations/'||n.donation_id::text||'/photos/'||id::text||'/content') order by id),'[]') from public.donation_photos where donation_id=n.donation_id and kind='item'),
  'indicators',(select coalesce(jsonb_agg(jsonb_build_object('key',i.key,'value',null,'probability',i.probability,'level',i.level) order by i.key),'[]') from public.donation_indicators i
   where i.analysis_id=(select a.id from public.donation_analysis a join public.donations d on d.id=a.donation_id where a.donation_id=n.donation_id and a.category=d.category and not exists(select 1 from public.donation_photos photo where photo.donation_id=n.donation_id and not (a.input_photos @> jsonb_build_array(jsonb_build_object('photo_id',photo.id::text,'sha256',photo.sha256)))) order by a.created_at desc,a.id limit 1))
 ) order by position) filter(where position<=page_limit),'[]'),'has_more',count(*)>page_limit,'as_of',statement_timestamp()) into result from numbered n;
 return result;
end $$;

-- CREATE OR REPLACE preserves existing ownership and execution grants.
-- No extra table, privileged endpoint, query or matching input is introduced.
