-- ONE-TIME SYNTHETIC DATA for the association "Offers nearby" screen.
-- Target: Dono wivxerqtkeiflfoyanpp. Run as postgres in its SQL editor.
-- Requires dummy_workflow.sql, demo_user_access.sql and item-details migrations.
-- Manual fixture only. Fixed namespace d0d10000-0000-4000-8000-*.
-- Creates five posted items near each DEMO association, one per category.
-- Analysis rows are SYNTHETIC eligibility fixtures, not model executions.
-- Their model/provenance identify this explicitly. No indicators are fabricated.
-- Existing donations, memberships, schema and access rules are not changed.
begin;
do $fixture$
declare
  actor constant uuid := 'a8a99f5e-11a4-4172-af5e-bb0e93fa60fc';
  staff_actor constant uuid := 'f67d84f4-5e4d-416b-8715-f15a0795e899';
  ns constant text := 'd0d10000-0000-4000-8000-';
  demo_ns constant text := 'd0d00000-0000-4000-8000-';
  model_label constant text := 'DEMO-SYNTHETIC-NO-MODEL';
  categories public.donation_category[] := array['clothes','shoes','food','para','furniture']::public.donation_category[];
  labels text[] := array['Coat','Pair of shoes','Dry rice','Soap','Chair'];
  today date := (statement_timestamp() at time zone 'Europe/Paris')::date;
  source_photo public.donation_photos;
  source_content text;
  tenant uuid; item uuid; photo uuid; analysis uuid; request uuid;
  attrs jsonb; facts jsonb; input_photos jsonb; result jsonb; filtered jsonb;
  category public.donation_category;
  city text; lat double precision; lon double precision;
  fixture_ids uuid[]; city_ids uuid[];
  t integer; c integer; n integer; seen integer;
begin
  perform pg_advisory_xact_lock(20261025, 27403);
  if not exists(select 1 from public.profiles where id=actor and platform_role='donor' and disabled_at is null) then
    raise exception 'Expected active fixture donor is missing; nothing inserted';
  end if;
  if exists(select 1 from public.donations where id::text like ns||'%')
     or exists(select 1 from public.donation_photos where id::text like ns||'%')
     or exists(select 1 from public.donation_analysis where id::text like ns||'%')
     or exists(select 1 from public.donation_edits where id::text like ns||'%')
     or exists(select 1 from private.api_requests where id::text like ns||'%' or idempotency_key::text like ns||'%') then
    raise exception 'Nearby DEMO namespace already exists; no rows changed';
  end if;
  -- Copy only the known synthetic fixture image. Verify its content before reuse.
  select * into strict source_photo from public.donation_photos
    where id=(demo_ns||'000000005001')::uuid
      and donation_id=(demo_ns||'000000004001')::uuid and uploaded_by=actor;
  select image_base64 into strict source_content from private.photo_contents where photo_id=source_photo.id;
  if source_photo.mime_type<>'image/png' or source_content is null
     or octet_length(decode(source_content,'base64'))<>source_photo.size_bytes
     or encode(sha256(decode(source_content,'base64')),'hex')<>source_photo.sha256 then
    raise exception 'Synthetic source photo failed integrity checks; nothing inserted';
  end if;

  for t in 1..2 loop
    tenant := (demo_ns||lpad((100+t)::text,12,'0'))::uuid;
    city := case t when 1 then 'Paris' else 'Mulhouse' end;
    lat := case t when 1 then 48.8566 else 47.7508 end;
    lon := case t when 1 then 2.3522 else 7.3359 end;
    if not exists(select 1 from public.associations where id=tenant and name like 'DEMO %'
      and approval_status='approved' and registered_by=actor
      and abs(latitude-lat)<0.05 and abs(longitude-lon)<0.05) then
      raise exception 'Expected approved DEMO association near % is missing or changed',city;
    end if;
    -- This also checks the demo account is enabled and an active tenant member.
    perform private.require_actor(staff_actor);
    perform private.staff(staff_actor,tenant);

    for c in 1..5 loop
      n := (t-1)*5+c;
      category := categories[c];
      item := (ns||lpad((1000+n)::text,12,'0'))::uuid;
      photo := (ns||lpad((2000+n)::text,12,'0'))::uuid;
      analysis := (ns||lpad((3000+n)::text,12,'0'))::uuid;
      request := (ns||lpad((4000+n)::text,12,'0'))::uuid;
      fixture_ids := array_append(fixture_ids,item);
      attrs := case category
        when 'clothes' then jsonb_build_object('type','coat','size','M','audience','adult','seasons',jsonb_build_array('autumn','winter'))
        when 'shoes' then jsonb_build_object('type','sneakers','size','42','pair_complete',true)
        when 'food' then jsonb_build_object('product','DEMO dry rice','brand','DEMO SYNTHETIC','storage_condition','room_temperature','non_perishable',true,'packaging_state','sealed')
        when 'para' then jsonb_build_object('product','DEMO soap','brand','DEMO SYNTHETIC','product_kind','hygiene','opening_state','unopened','seal_state','intact')
        else jsonb_build_object('type','chair','size_class','small','printed_dimensions','DEMO 40 x 40 x 80 cm') end;
      insert into public.donations(id,donor_id,name,description,category,attributes,quantity,unit,status,revision,facts_revision,facts_origin)
      values(item,actor,'DEMO '||labels[c]||' - '||city,
        'DEMO SYNTHETIC: fictional item for testing nearby offers. Placeholder image. No AI analysis was run.',
        category,attrs,1,'item','ready',2,1,'human');
      insert into public.expiry_info(donation_id,expiry_date,date_type,date_precision,raw_label,readability,edited_by)
      values(item,case when category in ('food','para') then today+120 end,
        case when category='food' then 'DDM'::public.expiry_date_type when category='para' then 'expiry'::public.expiry_date_type end,
        case when category in ('food','para') then 'day'::public.date_precision else 'unknown'::public.date_precision end,
        case when category in ('food','para') then 'DEMO SYNTHETIC: fictional date' end,
        case when category in ('food','para') then 'readable'::public.date_readability else 'unknown'::public.date_readability end,actor);
      insert into public.donation_photos(id,donation_id,mime_type,size_bytes,sha256,kind,uploaded_by)
      values(photo,item,source_photo.mime_type,source_photo.size_bytes,source_photo.sha256,'item',actor);
      insert into private.photo_contents(photo_id,image_base64) values(photo,source_content);
      facts := private.source_facts(item);
      insert into public.donation_edits(id,donation_id,actor_id,base_revision,before_facts,after_facts,change_kind,to_state)
      values((ns||lpad((5000+n)::text,12,'0'))::uuid,item,actor,0,'{}',facts,'created','draft');
      insert into public.donation_edits(id,donation_id,actor_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state)
      values((ns||lpad((6000+n)::text,12,'0'))::uuid,item,actor,1,facts,facts,'published','draft','ready');
      input_photos := jsonb_build_array(jsonb_build_object('photo_id',photo,'sha256',source_photo.sha256));
      -- The provider enum has no fixture value. Preserve the contract and mark
      -- the record as synthetic in model, provenance and request context.
      insert into private.api_requests(id,actor_id,operation,idempotency_key,request_hash,state,attempt_id,
        resource_id,http_status,result_refs,context)
      values(request,actor,'analysis/'||item::text,(ns||lpad((7000+n)::text,12,'0'))::uuid,
        encode(sha256(convert_to(input_photos::text,'UTF8')),'hex'),'completed',
        (ns||lpad((8000+n)::text,12,'0'))::uuid,analysis,201,jsonb_build_object('id',analysis),
        jsonb_build_object('donation_id',item,'facts_revision',1,'photos',input_photos,
          'synthetic',true,'model_executed',false,'fixture','nearby_offers'));
      insert into public.donation_analysis(id,donation_id,provider,model,category,extracted,confidence,
        input_photos,input_facts_revision,provenance,request_id)
      values(analysis,item,'openai',model_label,category,'{}',0,input_photos,1,
        jsonb_build_object('synthetic',true,'model_executed',false,'fixture','nearby_offers',
          'note','Synthetic eligibility fixture only. No AI extraction or probability indicators.'),request);
      -- Reuse the real guarded consent command. It enforces eligibility,
      -- ownership and revisions and records a completed idempotent request.
      perform public.dono_posting(actor,(ns||lpad((9000+n)::text,12,'0'))::uuid,item,'posting',
        jsonb_build_object('expected_revision',2,'locality','DEMO '||city,
          'latitude',lat,'longitude',lon));
    end loop;
  end loop;

  -- Fail the whole transaction if the real projection cannot find five nearby
  -- fixture items per city. Count fixture IDs only, allowing existing real data.
  for t in 1..2 loop
    tenant := (demo_ns||lpad((100+t)::text,12,'0'))::uuid;
    city_ids := fixture_ids[(t-1)*5+1:t*5];
    result := public.dono_posted_donations(staff_actor,tenant,null,25,50,0);
    select count(*) into seen from jsonb_array_elements(result->'data') row_data
      where (row_data->>'id')::uuid=any(city_ids);
    if seen<>5 then raise exception 'Expected five nearby DEMO items for %, got %',tenant,seen;end if;
    if exists(select 1 from jsonb_array_elements(result->'data') row_data
      where (row_data->>'id')::uuid=any(fixture_ids)
        and not ((row_data->>'id')::uuid=any(city_ids))) then
      raise exception 'The other city fixture leaked into the 25 km results';
    end if;
    for c in 1..5 loop
      filtered := public.dono_posted_donations(staff_actor,tenant,categories[c],25,50,0);
      select count(*) into seen from jsonb_array_elements(filtered->'data') row_data
        where (row_data->>'id')::uuid=any(city_ids);
      if seen<>1 or not exists(select 1 from jsonb_array_elements(filtered->'data') row_data
        where (row_data->>'id')::uuid=city_ids[c] and row_data->>'category'=categories[c]::text) then
        raise exception 'Expected one nearby DEMO item for category % at %',categories[c],tenant;
      end if;
    end loop;
  end loop;
  if exists(select 1 from public.donation_indicators i join public.donation_analysis a on a.id=i.analysis_id
    where a.donation_id=any(fixture_ids)) then
    raise exception 'Synthetic items must have no probability indicators';
  end if;
  raise notice 'Validated ten synthetic posted items: five near Paris, five near Mulhouse; all five category filters passed';
end
$fixture$;

select a.name as association, count(*) as nearby_demo_items,
  array_agg(row_data->>'category' order by row_data->>'category') as categories
from public.associations a
cross join lateral jsonb_array_elements(public.dono_posted_donations(
  'f67d84f4-5e4d-416b-8715-f15a0795e899'::uuid,a.id,null,25,50,0)->'data') row_data
where a.id in ('d0d00000-0000-4000-8000-000000000101'::uuid,
  'd0d00000-0000-4000-8000-000000000102'::uuid)
  and row_data->>'id' like 'd0d10000-0000-4000-8000-%'
group by a.id,a.name
order by a.name;
commit;
