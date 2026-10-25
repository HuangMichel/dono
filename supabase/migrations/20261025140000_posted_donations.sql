-- Explicit sharing consent is separate from the item's ready lifecycle.
create table private.donation_postings (
 donation_id uuid primary key references public.donations(id) on delete cascade,
 facts_revision bigint not null check(facts_revision>0),
 locality text not null check(length(locality) between 1 and 200),
 latitude double precision not null check(latitude between -90 and 90),
 longitude double precision not null check(longitude between -180 and 180),
 posted_at timestamptz not null default clock_timestamp()
);
alter table private.donation_postings enable row level security;
create index donation_postings_latitude_idx on private.donation_postings(latitude);

create function private.postable(item uuid) returns boolean language sql stable set search_path='' as $$
 select exists(
 select 1 from public.donations d join public.profiles owner on owner.id=d.donor_id
 where d.id=item and d.status='ready' and owner.disabled_at is null
 and not private.live_offer(item,statement_timestamp())
 and d.category is not null and d.quantity>0 and d.unit='item'
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

-- Do not silently restore old sharing consent after edits, withdrawal or an offer.
create function private.invalidate_posting() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='donation_offers' then
  delete from private.donation_postings where donation_id=new.donation_id;
 elsif new.facts_revision<>old.facts_revision or new.status<>old.status then
  delete from private.donation_postings where donation_id=new.id;
 end if;
 return new;
end $$;
create trigger donation_posting_changed after update on public.donations
 for each row execute function private.invalidate_posting();
create trigger donation_posting_offered after insert on public.donation_offers
 for each row execute function private.invalidate_posting();

create function public.dono_posting(actor uuid,key uuid,item uuid,action text,body jsonb)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.donations; r private.api_requests;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 if not exists(select 1 from public.donations where id=item and donor_id=actor) then raise exception 'not_found';end if;
 r:=private.claim(actor,'posting/'||action||'/'||item::text,key,body-'latitude'-'longitude'-'locality');
 perform private.require_actor(actor);
 select * into d from public.donations where id=item and donor_id=actor for update;
 if not found then raise exception 'not_found';end if;
 if r.state='completed' then return jsonb_build_object('id',item,'replay',true);end if;
 if d.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
 if action='posting' then
  if not private.postable(item) then raise exception 'ineligible_item';end if;
  insert into private.donation_postings(donation_id,facts_revision,locality,latitude,longitude)
  values(item,d.facts_revision,body->>'locality',(body->>'latitude')::double precision,(body->>'longitude')::double precision)
  on conflict(donation_id) do update set facts_revision=excluded.facts_revision,locality=excluded.locality,
   latitude=excluded.latitude,longitude=excluded.longitude,posted_at=clock_timestamp();
 elsif action='unposting' then
  delete from private.donation_postings where donation_id=item;
 else raise exception 'validation_error';end if;
 update public.donations set revision=revision+1,updated_at=clock_timestamp() where id=item;
 update private.api_requests set state='completed',resource_id=item,http_status=200,result_refs=jsonb_build_object('id',item) where id=r.id;
 return jsonb_build_object('id',item,'replay',false);
end $$;

create or replace function public.dono_item_summary(actor uuid,item uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; at_time timestamptz:=clock_timestamp();
begin
 perform private.require_actor(actor);
 if not exists(select 1 from public.donations where id=item and donor_id=actor) then raise exception 'not_found';end if;
 select jsonb_build_object('posting',(select jsonb_build_object('posted_at',p.posted_at,'locality',p.locality) from private.donation_postings p join public.donations d on d.id=p.donation_id where p.donation_id=item and p.facts_revision=d.facts_revision and private.postable(item)), 'active_offer_id',(select id from public.donation_offers o where donation_id=item and ((status='pending_review' and at_time<review_deadline) or private.holds(o,at_time)) limit 1),
 'inventory_state',case when exists(select 1 from public.inventory_movements where donation_id=item and movement_type='distribution') then 'distributed' when exists(select 1 from public.inventory_movements where donation_id=item and movement_type='receipt') then 'in_stock' else 'unreceived' end) into result;
 return result;
end $$;

create function public.dono_posted_donations(actor uuid,tenant uuid,filter_category public.donation_category default null,
 radius_km double precision default 25,page_limit integer default 10,page_offset integer default 0)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare origin public.associations; result jsonb;
begin
 perform private.require_actor(actor);perform private.staff(actor,tenant);
 select * into origin from public.associations where id=tenant;
 if origin.latitude is null or origin.longitude is null then raise exception 'association_location_required';end if;
 if radius_km is null or radius_km not between 1 and 200 or page_limit is null or page_limit not between 1 and 50 or page_offset is null or page_offset<0 then raise exception 'validation_error';end if;
 with candidates as materialized (
  select p.*,d.category,d.attributes,d.quantity,d.unit,
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
  'id',donation_id,'category',category,
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

create function public.dono_posted_photo(actor uuid,tenant uuid,item uuid,photo uuid)
 returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.donation_photos; content text;
begin
 perform private.require_actor(actor);perform private.staff(actor,tenant);
 if not exists(select 1 from private.donation_postings s join public.donations d on d.id=s.donation_id
  where s.donation_id=item and s.facts_revision=d.facts_revision and private.postable(item)) then raise exception 'not_found';end if;
 select * into p from public.donation_photos where id=photo and donation_id=item and kind='item';
 if not found then raise exception 'not_found';end if;
 select image_base64 into content from private.photo_contents where photo_id=photo;
 if content is null then raise exception 'photo_integrity_error';end if;
 return jsonb_build_object('photo',jsonb_build_object('mime_type',p.mime_type,'size_bytes',p.size_bytes,'sha256',p.sha256),'image_base64',content);
end $$;

-- Match existing restricted command ownership, preserving schema privileges.
do $$
declare f record; public_create boolean:=has_schema_privilege('dono_command_owner','public','CREATE');
 private_create boolean:=has_schema_privilege('dono_command_owner','private','CREATE');
begin
 if not public_create then grant create on schema public to dono_command_owner;end if;
 if not private_create then grant create on schema private to dono_command_owner;end if;
 alter table private.donation_postings owner to dono_command_owner;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where (n.nspname='private' and p.proname in ('postable','invalidate_posting'))
 or (n.nspname='public' and p.proname in ('dono_posting','dono_posted_donations','dono_posted_photo')) loop
  execute format('alter function %s owner to dono_command_owner',f.signature);
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.signature::text like '%dono_%' then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
 if not public_create then revoke create on schema public from dono_command_owner;end if;
 if not private_create then revoke create on schema private from dono_command_owner;end if;
end $$;
revoke all on private.donation_postings from public,anon,authenticated,service_role;
