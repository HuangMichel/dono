-- All RPC wrappers are service_role only; each validates actor/ownership itself.
create function private.require_actor(actor uuid) returns void language plpgsql set search_path='' as $$
begin
 perform 1 from public.profiles where id=actor and disabled_at is null for update;
 if not found then raise exception 'account_disabled'; end if;
end $$;
create function private.live_offer(item uuid, at_time timestamptz) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.donation_offers o left join public.bookings b on b.offer_id=o.id
 where o.donation_id=item and ((o.status='pending_review' and at_time<o.review_deadline)
 or (o.status='approved' and ((b.id is null and at_time<o.approval_deadline) or (b.status='booked' and at_time<b.receivable_until)))))
$$;
create function private.source_facts(item uuid) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('category',d.category,'attributes',d.attributes,'quantity',d.quantity::text,'unit',d.unit,
 'expiry',jsonb_build_object('expiry_date',e.expiry_date,'date_type',e.date_type,'pao_months',e.pao_months,'opened_on',e.opened_on,'date_precision',e.date_precision,'raw_label',e.raw_label,'readability',e.readability))
 from public.donations d join public.expiry_info e on e.donation_id=d.id where d.id=item
$$;
create function private.put_source_dates(item uuid, actor uuid, facts jsonb) returns void language sql set search_path='' as $$
 insert into public.expiry_info(donation_id,expiry_date,date_type,pao_months,opened_on,date_precision,raw_label,readability,edited_by)
 values(item,(facts->>'expiry_date')::date,(facts->>'date_type')::public.expiry_date_type,(facts->>'pao_months')::smallint,(facts->>'opened_on')::date,
 coalesce(facts->>'date_precision','unknown')::public.date_precision,facts->>'raw_label',coalesce(facts->>'readability','unknown')::public.date_readability,actor)
 on conflict(donation_id) do update set expiry_date=excluded.expiry_date,date_type=excluded.date_type,pao_months=excluded.pao_months,opened_on=excluded.opened_on,
 date_precision=excluded.date_precision,raw_label=excluded.raw_label,readability=excluded.readability,edited_by=excluded.edited_by,updated_at=clock_timestamp()
$$;
create function private.claim(actor uuid, p_operation text, key uuid, body jsonb) returns private.api_requests language plpgsql set search_path='' as $$
declare r private.api_requests; h text:=encode(sha256(convert_to(body::text,'UTF8')),'hex');
begin
 insert into private.api_requests(actor_id,operation,idempotency_key,request_hash,state,attempt_id,context)
 values(actor,p_operation,key,h,'in_progress',gen_random_uuid(),'{}') on conflict(actor_id,operation,idempotency_key) do nothing;
 select * into r from private.api_requests q where q.actor_id=actor and q.operation=p_operation and q.idempotency_key=key for update;
 if r.request_hash<>h then raise exception 'idempotency_conflict'; end if;
 return r;
end $$;
create function public.dono_profile(actor uuid, key uuid, action text, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.profiles; r private.api_requests;
begin
 if action='bootstrap' then
  if not exists(select 1 from auth.users where id=actor) then raise exception 'not_found'; end if;
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
create function public.dono_item(actor uuid, key uuid, action text, item uuid, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.donations; r private.api_requests; before_facts jsonb; after_facts jsonb; before_state public.donation_state; kind public.donation_change_kind;
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
 if action='create' then
  insert into public.donations(donor_id,category,attributes,quantity,unit,status,facts_origin)
  values(actor,(body->'facts'->>'category')::public.donation_category,coalesce(body->'facts'->'attributes','{}'),(body->'facts'->>'quantity')::numeric,(body->'facts'->>'unit')::public.quantity_unit,'draft',case when body ? 'facts' then 'human'::public.facts_origin else 'empty'::public.facts_origin end) returning * into d;
  perform private.put_source_dates(d.id,case when body ? 'facts' then actor else null end,coalesce(body->'facts'->'expiry','{}'));
  before_facts:='{}'; kind:='created'; before_state:=null;
 else
  if d.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision'; end if;
  if d.status='transferred' or private.live_offer(d.id,clock_timestamp()) then raise exception 'invalid_transition'; end if;
  before_facts:=private.source_facts(d.id);before_state:=d.status;
  if action='edit' then
   update public.donations set category=(body->'facts'->>'category')::public.donation_category,attributes=body->'facts'->'attributes',quantity=(body->'facts'->>'quantity')::numeric,unit=(body->'facts'->>'unit')::public.quantity_unit,facts_origin='human',facts_revision=facts_revision+1 where id=d.id;
   perform private.put_source_dates(d.id,actor,body->'facts'->'expiry');kind:='facts_edited';
  elsif action in ('publication','restoration') then
   if (action='publication' and d.status<>'draft') or (action='restoration' and d.status<>'withdrawn') then raise exception 'invalid_transition'; end if;
   if d.category is null or d.quantity is null or d.unit is null or not exists(select 1 from public.donation_photos where donation_id=d.id) then raise exception 'ineligible_item'; end if;
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

revoke all on function public.dono_profile(uuid,uuid,text,jsonb),public.dono_item(uuid,uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dono_profile(uuid,uuid,text,jsonb),public.dono_item(uuid,uuid,text,uuid,jsonb) to service_role;
revoke all on function private.require_actor(uuid),private.live_offer(uuid,timestamptz),private.source_facts(uuid),private.put_source_dates(uuid,uuid,jsonb),private.claim(uuid,text,uuid,jsonb) from public,anon,authenticated;
