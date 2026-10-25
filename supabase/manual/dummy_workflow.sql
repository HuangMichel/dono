-- ONE-TIME SYNTHETIC DATA, explicitly requested for the full donation workflow.
-- Target: Dono wivxerqtkeiflfoyanpp. Run as postgres in its SQL editor.
-- Fixed namespace d0d00000-0000-4000-8000-*. Existing rows are never updated.
-- This is a manual fixture, not an automatic seed or a database migration.
-- The existing donor owns the items and administers ONLY the two DEMO tenants.
-- All decisions/history are simulated human actions; there are NO AI results.
begin;
do $fixture$
declare
  actor constant uuid := 'a8a99f5e-11a4-4172-af5e-bb0e93fa60fc';
  ns constant text := 'd0d00000-0000-4000-8000-';
  at_time timestamptz := statement_timestamp();
  today date := (statement_timestamp() at time zone 'Europe/Paris')::date;
  png constant text := 'iVBORw0KGgoAAAANSUhEUgAAARgAAABkCAIAAADSe7jVAAANJklEQVR42u2de1yM2R/Hzzwz00257a7bSkpEklJKt1VbyGIpiYj6uUTlUklSJN0kSSXbZW1u5Vcs7WpZly2kKBIti11tv7B23WJXV3P9/fHY+U0z03hq7Xrl93n/NZ35Pt/vOcf5zHPO0/jE+q3+DwIA+GtQmAIAICQAICQAICQAAIQEAIQEAIQEAIQEAICQAICQAICQAICQAAAQEgAQEgAQEgAQEgAAQgIAQgIAQgIAQgIAQEgAvA04f/H6MR9NHjVyOIuw+AK+2/QpLlOdJY10gIOdtffcWaZ2zvZ2VtvjNtKNIRvjTheXXD1/ghBS8M2J3IMFXC6Xz+d7znadMWVSe7Vu/ngnKS1LIBCyOezY9WuamluCwqMKcnZRFIsQMstrWVzEWndv39FGhnvSk+hLLB2nVRQVfne2dH/+YUJI1bXrY0xGEULmzZqxITaxoqhQkpyOlO/8wAH9lVx76KtjeUeOdtNQ11BXjwwN7Ne3j8zMSE8CXaK0/PLBgsLULVGEkJraurDoLYsXeOQeLFDSPZm+icXipuaW0AC/sWNGy1fBmu6SQuJyOXvTtxNCWlpa/YLDNdTVJzmOlzRKUFHh1t29LxSJ2BQlFovv//KrigqXEFJafvnw0eO7d27T0tJsaGj0XR3W94P3rSzMFNYKj07ISIrr2+eDU2dKElIzkmIjhurpnig688mEj8+VlWsPHDB0iK6KClcgFF6qumYxxkRyoZO9rZO9Lb0iJR3bEJuofETSlyu89sKlK8dPFeV+nqqmqnr+wqV1UVt279ymJA+N7bixuQcLKq9+b25qHL99Z/jqFaONDCc6fMSke5KcP/1cG7Ih7qsDu9qrArrq1k5dXS14xVL6w1shhsOH3bh5mxBy+6caA309ujE7Jz94xTItLU1CiJaW5urlS3ftz2svw7Pnv7/k8QghH9tZz5vlQgjxWzw/c3euSCT+fO8B/8VedNgKH++0rD3/wNztzskP8FuspqpKCLGzthg0cIBAIGByYcgq321pWafOlAzo32+0kWEnSg/V03305AmW77t5RjLQ17t7/0F779qMMy8tv0wIKS2vtBk3lm6s/c/dEQb6UmIb+nNtXXsZAnwXefqsWh+z9Ur1DTOTUYQQvcE6Bvp6kfFJ/fv2GaKr82ojZG5KCKm4cu3vnrua2roRw4ZKfty0bjWHw+gOr6ujbTxyRPz2z4L8l3SudFlFpaX5GCzfd2drJ41AKKRXEp8v8PINpBsD/ZaYjDIkhNhYjj1w6Gv/xV4VlVUebtMVZhCLxSwWi36dkpFdVX19/uyZ9M6KEOIy1dlxvE3RubL4pDQnezv/JV6EEN9FC6bN8S7Ma3MLWu7jvSNzt2VmipLeSneS/lG+XdJ5hQhFIob5I0ODdHW0pd9tbGrisNnNLS09e3RnPsN0ToFAUFt3rzBvd4d6C7qMkK7/cHuYvm57x4Me3bUoivXw0WNCiGY3DbpxiN7gm7fvmBqPfPU44fYdfb3B9OtVyxbK7Ovu3n9gajzSZarzeJtx0+cuooWkq6PdTUNDZplajDFhU+yKyqtMTneSA73ys408gwcNvH2nxnjkCPojICxqy+aNoa89IxFCqqpvNDY1Ra4Lik3csTMxRmEMi0XRR0qhUMhms2VyfrE/r+Cbk0u8PHBGete2di8aGralZS2aP0dJjK2VRXL6F9LPEhZ6zt6WltnQ2EQIaWhoTNrZbgYWixUUtonW4e9/vOjfr4/y/iz38d7xN5+UPGZOT8nI5vH4hJDjp8/w+HwmVwmFwvjkncErlllbmHE47OKSMoVhowwNLlZU0s9jjAyHy7xrbWF2/eYtLN93545Eby1YhCUQChYv8KCflUnvN0xGGQb6vToJjLcZl5L+xVe5u/53cLI0f/T4ibdfkAqXy+fz57m7jBureOvfq2ePTWGrA9ZtUlNVpdhU7PoQ5R0zNzXmcjn0Ku/EiOQ7L8/kCQ537z9w81rau2fP3r17blizikn+/flHrMeaaX/YnxASGuC/ZFWI1VgzdXU1mbDw4JURcYlZew8QQqLCguVOWYN+rKkVicTMewv+Vlj4axQA4JsNAEBIAEBIAAAICQAICQAICQAICQAAIQEAIQEAIQEAIQEAICQAICQAICQAICQAAIQEAIQEAIQEAIFnQ4cwtXOWtwgmSo2IGfrufvn1seitKcVH89/r3Us6M2Hgmaywentdlaml3N+4o5mleygQCkID/I0MDWQClEyaws40NbcwNHkGXUZICi2ClRsRM/TdPXP+oqe7a8mFClobhLFncrduGgqrK+yqfC0l/sbtjUtJZpnxro/eenBPusKBKEwu35nS8sv78g4zNHkGXWlrJ28RzNCIWInvbmvry5bWVrfpU86WXiQd9ExWUl2hmzHzWh3NLMOwIXq//PpbJ5J3Igx0PSHJWwQzNCJW4rtbWn7ZzspCV0f7wa8PJR6ohJlnspLqCt2MmdfqaGYZyi9XDR+m34nknQgDXdJpVblFsLQRMWHmu1tcUnbrp5qTReceP62/fLXamtnWhfZMFrd1EpapLt/VztVikll6vGKxWEuzW3R4sBK3ZCXJGfYBdG0hyVgEKzEiZuK7KxSJ6u7dL8j5nL5dnC29yHBx057JAoFQSXWZrnaolvJxteeTLH8CVOiWrDw5wz6ALv/4W9oimKERcXu+u1erbxgMHUK/NjcxvlBRSTrimfza6tJd7VCtDmXuKAwnjbnJM+iSJvrSFsEMjYjb893l8wXj/jw7qamp9u7Vs7buLp8v8PRZSTeaGhutXu6jxDNZeXXprhaXlMnX0huso3CMrx1Xp32SmU8ac5NnQGBZDAC+2QAAhAQAgJAAgJAAgJAAgJAAABASABASABASAABCAgBCAgBCAgBCAgBASABASABASF2e2rp7u/b9m/4PqgC8MSGZ2jl7+waRtvYDSvjy62OjbSfWP3vOMP61vDZDTW1d3uGjb2q+Vq6NUFNV5bDZb/xf4q9PBejCQpJ4IzKMl1gx/mMj1NcbPGfmp28q25P6Z56zXdXV1bB0AHmzng20N+K+jGRJy9P6Z+ExCc3NLRoa6rHrQ95/rzdpa8WYnL5L3j+1prYuMj7pRUPjzE8/8fJwoz+kPdxmVFVfb2ho9F/i7WRvKx9D4zrfJ3nzxkEDP2xsanZbsNTT3eXINydYLFaQ/xIbS3PaEzj3YMHhwm8ljZL7gNv0KdU3brFYZPPG0O5amjGJO57WP+Pz+SErfWkjZUvHaU72diOG6XM4nOamZi/fwJjwNTHbUqUHKInxnO1Kv668Wr3Qc86V6uvXvv9hnruLl4fbi4YGmeT1z55HxCX+8aJx0MABWIswiJT1RkxISZ8y0XF/ZsqUiY4JqRmEmRVj7qGCQL8l+zNTsnPyyZ/GJr169tiXkZyaEB2XlKYwhmbKxI+LzpURQs5fqJjgYJexO2d/ZvLWqPDCb09LYtKz98s38nh8oxEGOVkp7jOmbklO35qa6enukp2WmLApPGLzNknM5AkOnrNd58z8VENDfW/69h1Zu2UGKIkhhLzk8Wa7Ttvz2faohOT57q570pPo3sonT0jNmOzkkJOV4jje5iWPh+UIg8g23oiXrlyLWR9CCHF2tE9KyyLMrBiDVyw9furM2dKLjU2vjvIisch1qjMhRPvD/o2NjQpjJEJaExH7r3nuxSVli+bPqX/2PDQy3sNtenzkOknMR9aW8o0sFsvJ3o4QMsnRPiE1g8Ph3PvlAf1WS0urUCRiUxTFpqwtzKXLyQ9QOoZiUSNHGLApisvljBxhQFGs1tZW+nNEJvmlK9eiw4IJIfa2VhSFBz8wiGzrjShWFPNaK8bAdZsmOHzk6e4ieTbA5XBpk2t6xSuMoenXtw9FUY+ePH3w28Phw/TjItZWXv1+X96Xx04WxW4IoWMUNrIoFsWmJOc9Pl+QlbJFVUVFJBJXVV9nUxQhhMNmU1QbN1P5AUrHcLkc+kJVFRXpC4VCoUxyPv+VcZdIJFY8a+D/2SDS0szkVPE5Qsip4nMWZiYMrRhv3PrR2cn+JY/H47/a5MgsX4UxEiY7OWxJ/szOyrKhsWnBsgCTUYZbIsPOlZXT7ypspBd3SVkFIeRk0VlLM9MxxkbfnS0lhJy/WJG190C7u1lFA3wt8slNjY2KS8oIId+dPS8WQ0kwiGzrjRi8ctn6mK35BYXq6uqx69dI9nXyVozSGTzcps9dvHz40CFampo8Hl9FhStfRT5GR3tg1t4DPl5zJzmOj0tKC/BdpKXZzd7Was5Cf5FY7LtoAX2hwkb6pnH6TEl2Tl53Lc3o8DU8Hi9ic1L+kaNsNjsqLLi9wSoc4GsJDfSTSb42wHfdpvjcQwWmxkYKxwsIDCL/YR4+ehwWnZCdltjR394o/PtlALydO9Lb5cz5Czuy9jC/OQCAOxIA+K4dABASAABCAgBCAgBCAgBCAgBASABASABASABASAAACAkACAkACAkACAkAACEB8Hb4L4OG8yVZQ2s3AAAAAElFTkSuQmCC';
  tenant uuid; item uuid; need uuid; offer uuid; photo uuid; edit uuid;
  slot uuid; booking uuid; facts jsonb; evidence jsonb; attrs jsonb;
  submitted timestamptz; decided timestamptz; booked timestamptz;
  received timestamptz; slot_start timestamptz; slot_end timestamptz;
  final_status public.offer_state; category public.donation_category;
  n integer; t integer; day_offset integer; cat_index integer;
  categories public.donation_category[] := array['clothes','shoes','food','para','furniture']::public.donation_category[];
  scenario record;
begin
  perform pg_advisory_xact_lock(20261025, 27401);
  if not exists(select 1 from public.profiles where id=actor and platform_role='donor' and disabled_at is null) then
    raise exception 'Expected active donor profile is missing or changed; nothing inserted';
  end if;
  -- Abort on any previous/partial fixture, including a concurrent repeat.
  if exists(select 1 from public.associations where id::text like ns||'%')
     or exists(select 1 from public.donations where id::text like ns||'%')
     or exists(select 1 from public.needs where id::text like ns||'%')
     or exists(select 1 from public.donation_offers where id::text like ns||'%')
     or exists(select 1 from public.slots where id::text like ns||'%') then
    raise exception 'DEMO namespace already exists; no rows changed. Inspect existing fixture before retrying';
  end if;

  for t in 1..2 loop
    tenant := (ns||lpad((100+t)::text,12,'0'))::uuid;
    insert into public.associations(id,name,registered_by,rna,approval_status,approved_by,approved_at,
      display_address,latitude,longitude,timezone,opening_hours,created_at,updated_at)
    values(tenant,case t when 1 then 'DEMO Paris Solidaire - association fictive'
      else 'DEMO Mulhouse Entraide - association fictive' end,actor,
      case t when 1 then 'W999990001' else 'W999990002' end,'approved',actor,at_time-interval '6 days',
      case t when 1 then 'DEMO - 10 Place de la Republique, 75011 Paris'
        else 'DEMO - 2 Place de la Reunion, 68100 Mulhouse' end,
      case t when 1 then 48.8674 else 47.7461 end,case t when 1 then 2.3638 else 7.3380 end,
      'Europe/Paris',(select jsonb_agg(jsonb_build_object('weekday',weekday,'start_local','00:00','end_local','23:59'))
        from generate_series(1,7) weekday),at_time-interval '7 days',at_time-interval '6 days');
    insert into public.association_members(association_id,profile_id,role,active,created_at,updated_at)
      values(tenant,actor,'assoc_admin',true,at_time-interval '7 days',at_time-interval '7 days');
    insert into public.membership_events(id,association_id,profile_id,action,role_after,active_before,active_after,actor_id,reason,created_at)
      values((ns||lpad((200+t)::text,12,'0'))::uuid,tenant,actor,'bootstrap','assoc_admin',false,true,actor,
        'DEMO SYNTHETIC: administration of this fictional association only; global donor role unchanged.',at_time-interval '7 days');
    for cat_index in 1..5 loop
      category := categories[cat_index];
      need := (ns||lpad((t*1000+cat_index)::text,12,'0'))::uuid;
      insert into public.needs(id,association_id,category,attributes,seasons,target_quantity,unit,active,
        source_text,created_by,storage_units_per_item,created_at,updated_at)
      values(need,tenant,category,'{}','{}',100,'item',true,
        'DEMO SYNTHETIC: besoin fictif de categorie '||category::text||', tous publics et toutes saisons.',
        actor,case when category='furniture' then 3 else 1 end,at_time-interval '6 days',at_time-interval '6 days');
      insert into public.capacity(association_id,category,storage_unit,limit_storage_units)
        values(tenant,category,'item_slot',200);
      for day_offset in -2..6 loop
        insert into public.intake_quotas(association_id,category,service_date,unit,limit_quantity)
          values(tenant,category,today+day_offset,'item',50);
      end loop;
    end loop;
    -- One historical slot, one arrival slot open today, six future appointment slots.
    for day_offset in -2..6 loop
      if day_offset=-1 then continue; end if;
      slot := (ns||lpad((3000+t*100+day_offset+2)::text,12,'0'))::uuid;
      slot_start := ((today+day_offset)+case when day_offset=0 then time '00:00' else time '10:00' end) at time zone 'Europe/Paris';
      slot_end := ((today+day_offset)+case when day_offset=0 then time '23:59' else time '12:00' end) at time zone 'Europe/Paris';
      insert into public.slots(id,association_id,starts_at,ends_at,max_bookings,active,created_at,updated_at)
        values(slot,tenant,slot_start,slot_end,10,true,at_time-interval '6 days',at_time-interval '6 days');
    end loop;
  end loop;

  -- Twelve fixtures: draft, unoffered, review, approval, booking, refusal, stock and distribution.
  for scenario in select * from (values
    (1,1,1,'draft',1),(2,2,2,'ready',1),
    (3,1,1,'pending_review',2),(4,2,4,'pending_review',3),
    (5,1,3,'approved',4),(6,2,5,'approved',1),
    (7,1,1,'booked_today',2),(8,2,2,'booked_future',1),
    (9,2,2,'refused',1),(10,1,3,'received',5),
    (11,2,4,'received',3),(12,1,3,'distributed',4)
  ) as fixtures(number,tenant_number,category_number,stage,quantity) loop
    n := scenario.number;
    category := categories[scenario.category_number];
    tenant := (ns||lpad((100+scenario.tenant_number)::text,12,'0'))::uuid;
    need := (ns||lpad((scenario.tenant_number*1000+scenario.category_number)::text,12,'0'))::uuid;
    item := (ns||lpad((4000+n)::text,12,'0'))::uuid;
    photo := (ns||lpad((5000+n)::text,12,'0'))::uuid;
    edit := (ns||lpad((6000+n)::text,12,'0'))::uuid;
    offer := (ns||lpad((7000+n)::text,12,'0'))::uuid;
    attrs := case category
      when 'clothes' then jsonb_build_object('type','coat','size','DEMO / M','audience','adult','seasons',jsonb_build_array('autumn','winter'))
      when 'shoes' then jsonb_build_object('type','sneakers','size','DEMO / 42','pair_complete',true)
      when 'food' then jsonb_build_object('product','DEMO riz sec - produit fictif '||n,'brand','DEMO SYNTHETIC',
        'storage_condition','room_temperature','non_perishable',true,'packaging_state','sealed')
      when 'para' then jsonb_build_object('product','DEMO savon - produit fictif '||n,'brand','DEMO SYNTHETIC',
        'product_kind','hygiene','opening_state','unopened','seal_state','intact')
      else jsonb_build_object('type','chair','size_class','small','printed_dimensions','DEMO SYNTHETIC / 40 x 40 x 80 cm') end;
    insert into public.donations(id,donor_id,category,attributes,quantity,unit,status,revision,facts_revision,facts_origin,created_at,updated_at)
      values(item,actor,category,attrs,scenario.quantity,'item',
        case when scenario.stage='draft' then 'draft'::public.donation_state
          when scenario.stage in ('received','distributed') then 'transferred'::public.donation_state
          else 'ready'::public.donation_state end,
        case when scenario.stage='draft' then 2 when scenario.stage in ('received','distributed') then 4 else 3 end,
        2,'human',at_time-interval '5 days',at_time);
    insert into public.expiry_info(donation_id,expiry_date,date_type,date_precision,raw_label,readability,edited_by,updated_at)
      values(item,case when category in ('food','para') then today+case n when 10 then 5 when 12 then 20 else 120 end end,
        case when category='food' then 'DDM'::public.expiry_date_type when category='para' then 'expiry'::public.expiry_date_type end,
        case when category in ('food','para') then 'day'::public.date_precision else 'unknown'::public.date_precision end,
        case when category in ('food','para') then 'DEMO SYNTHETIC: date fictive '||(today+case n when 10 then 5 when 12 then 20 else 120 end)::text end,
        case when category in ('food','para') then 'readable'::public.date_readability else 'unknown'::public.date_readability end,
        actor,at_time-interval '5 days');
    insert into public.donation_photos(id,donation_id,mime_type,size_bytes,sha256,kind,uploaded_by,created_at)
      values(photo,item,'image/png',octet_length(decode(png,'base64')),encode(sha256(decode(png,'base64')),'hex'),
        'item',actor,at_time-interval '5 days');
    insert into private.photo_contents(photo_id,image_base64) values(photo,png);
    facts := private.source_facts(item);
    insert into public.donation_edits(id,donation_id,actor_id,base_revision,before_facts,after_facts,change_kind,to_state,created_at)
      values(edit,item,actor,0,'{}',facts,'created','draft',at_time-interval '5 days');
    insert into public.donation_edits(id,donation_id,actor_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state,created_at)
      values((ns||lpad((6300+n)::text,12,'0'))::uuid,item,actor,1,facts,facts,'facts_edited','draft','draft',at_time-interval '5 days');
    if scenario.stage='draft' then continue; end if;
    insert into public.donation_edits(id,donation_id,actor_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state,created_at)
      values((ns||lpad((6100+n)::text,12,'0'))::uuid,item,actor,2,facts,facts,'published','draft','ready',at_time-interval '4 days');
    if scenario.stage='ready' then continue; end if;

    evidence := jsonb_build_object('photos',jsonb_build_array(jsonb_build_object('photo_id',photo,'sha256',encode(sha256(decode(png,'base64')),'hex'))),
      'analysis_request_ids','[]'::jsonb,'edit_ids',jsonb_build_array(edit,(ns||lpad((6300+n)::text,12,'0'))::uuid,(ns||lpad((6100+n)::text,12,'0'))::uuid));
    submitted := case when scenario.stage in ('received','distributed') then at_time-interval '3 days'
      when scenario.stage='booked_today' then ((today-1)+time '09:00') at time zone 'Europe/Paris'
      else at_time-interval '3 hours' end;
    decided := submitted+interval '1 hour';
    booked := submitted+interval '2 hours';
    received := ((today-2)+time '10:30') at time zone 'Europe/Paris';
    final_status := case when scenario.stage='pending_review' then 'pending_review'::public.offer_state
      when scenario.stage='refused' then 'refused'::public.offer_state
      when scenario.stage in ('received','distributed') then 'fulfilled'::public.offer_state else 'approved'::public.offer_state end;
    insert into public.donation_offers(id,donation_id,association_id,need_id,category,quantity,unit,facts_revision,facts_snapshot,evidence_snapshot,
      status,decision,decided_by,decided_at,intake_checks,storage_units_per_item,review_deadline,approval_deadline,closed_at,
      revision,created_at,updated_at,policy_version)
    values(offer,item,tenant,need,category,scenario.quantity,'item',2,facts,evidence,final_status,
      case when final_status='pending_review' then null when final_status='refused' then 'refused'::public.donation_decision else 'approved'::public.donation_decision end,
      case when final_status<>'pending_review' then actor end,case when final_status<>'pending_review' then decided end,
      case when final_status in ('approved','fulfilled') then jsonb_build_object('not_medicine',true,'eligible_individual_food',true) else '{}'::jsonb end,
      case when final_status in ('approved','fulfilled') then case when category='furniture' then 3 else 1 end end,
      submitted+interval '72 hours',case when final_status in ('approved','fulfilled') then decided+interval '24 hours' end,
      case when final_status='refused' then decided when final_status='fulfilled' then received end,
      case when final_status='pending_review' then 1 when final_status in ('refused') or scenario.stage='approved' then 2
        when final_status='fulfilled' then 4 else 3 end,submitted,
      case when final_status='pending_review' then submitted when final_status='fulfilled' then received
        when scenario.stage like 'booked_%' then booked else decided end,'mvp-domain-v1');
    insert into public.offer_events(id,offer_id,association_id,offer_revision,to_state,reason,note,actor_id,effective_at,recorded_at)
      values((ns||lpad((8000+n)::text,12,'0'))::uuid,offer,tenant,1,'pending_review','submitted',
        'DEMO SYNTHETIC: proposition fictive, photo de demonstration, aucune inference IA.',actor,submitted,submitted);
    if final_status='pending_review' then continue; end if;
    insert into public.offer_events(id,offer_id,association_id,offer_revision,from_state,to_state,reason,note,actor_id,effective_at,recorded_at)
      values((ns||lpad((8100+n)::text,12,'0'))::uuid,offer,tenant,2,'pending_review',
        case when final_status='refused' then 'refused'::public.offer_state else 'approved'::public.offer_state end,
        case when final_status='refused' then 'human_refused'::public.offer_event_reason else 'human_approved'::public.offer_event_reason end,
        case when final_status='refused' then 'DEMO SYNTHETIC: refus humain simule, taille inadaptee au besoin actuel.'
          else 'DEMO SYNTHETIC: accord humain simule et controles fictifs; aucune decision IA.' end,actor,decided,decided);
    if final_status='refused' or scenario.stage='approved' then continue; end if;

    day_offset := case when scenario.stage='booked_today' then 0 when scenario.stage='booked_future' then 1 else -2 end;
    slot := (ns||lpad((3000+scenario.tenant_number*100+day_offset+2)::text,12,'0'))::uuid;
    booking := (ns||lpad((9000+n)::text,12,'0'))::uuid;
    select starts_at,ends_at into slot_start,slot_end from public.slots where id=slot;
    insert into public.bookings(id,donation_id,association_id,slot_id,qr_nonce,offer_id,category,quota_date,status,
      receivable_until,dropoff_address,timezone,closed_at,closed_by,close_reason,revision,policy_version,created_at)
      select booking,item,tenant,slot,(ns||lpad((9100+n)::text,12,'0'))::uuid,offer,category,today+day_offset,
        case when final_status='fulfilled' then 'received'::public.booking_state else 'booked'::public.booking_state end,
        slot_end+interval '30 minutes',a.display_address,'Europe/Paris',case when final_status='fulfilled' then received end,
        case when final_status='fulfilled' then actor end,case when final_status='fulfilled' then 'DEMO SYNTHETIC: received' end,
        case when final_status='fulfilled' then 2 else 1 end,'mvp-domain-v1',booked
      from public.associations a where a.id=tenant;
    insert into public.offer_events(id,offer_id,association_id,offer_revision,from_state,to_state,reason,note,actor_id,effective_at,recorded_at)
      values((ns||lpad((8200+n)::text,12,'0'))::uuid,offer,tenant,3,'approved','approved','booked',
        'DEMO SYNTHETIC: rendez-vous fictif reserve.',actor,booked,booked);
    if final_status<>'fulfilled' then continue; end if;
    insert into public.inventory_movements(id,donation_id,association_id,movement_type,quantity,unit,actor_id,offer_id,booking_id,created_at)
      values((ns||lpad((10000+n)::text,12,'0'))::uuid,item,tenant,'receipt',scenario.quantity,'item',actor,offer,booking,received);
    insert into public.offer_events(id,offer_id,association_id,offer_revision,from_state,to_state,reason,note,actor_id,effective_at,recorded_at)
      values((ns||lpad((8300+n)::text,12,'0'))::uuid,offer,tenant,4,'approved','fulfilled','received',
        'DEMO SYNTHETIC: reception integrale simulee.',actor,received,received);
    insert into public.donation_edits(id,donation_id,actor_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state,created_at)
      values((ns||lpad((6200+n)::text,12,'0'))::uuid,item,actor,3,facts,facts,'transferred','ready','transferred',received);
    if scenario.stage='distributed' then
      insert into public.inventory_movements(id,donation_id,association_id,movement_type,quantity,unit,actor_id,offer_id,booking_id,created_at)
        values((ns||lpad((10100+n)::text,12,'0'))::uuid,item,tenant,'distribution',scenario.quantity,'item',actor,offer,booking,received+interval '2 hours');
    end if;
  end loop;

  if (select count(*) from public.donations where id::text like ns||'%')<>12
    or (select count(*) from public.donation_offers where id::text like ns||'%')<>10
    or (select count(*) from public.bookings where id::text like ns||'%')<>5
    or (select count(*) from public.inventory_movements where id::text like ns||'%')<>4 then
    raise exception 'Unexpected fixture totals; all inserts rolled back';
  end if;
  if exists(select 1 from public.capacity c where c.association_id::text like ns||'%'
      and private.storage_used(c.association_id,c.category,at_time)>c.limit_storage_units)
    or exists(select 1 from public.needs nd where nd.id::text like ns||'%'
      and private.need_used(nd.id,at_time)>nd.target_quantity)
    or exists(select 1 from public.intake_quotas q where q.association_id::text like ns||'%'
      and private.intake_used(q.association_id,q.category,q.service_date,at_time)>q.limit_quantity)
    or exists(select 1 from public.slots s where s.id::text like ns||'%'
      and private.slot_used(s.id,at_time)>s.max_bookings) then
    raise exception 'Fixture exceeds a demand/storage/intake/slot budget; all inserts rolled back';
  end if;
end
$fixture$;
commit;

-- Expected: 2 associations, 10 needs, 16 slots, 12 donations, 10 offers,
-- 5 bookings, 3 receipts, 1 distribution. Existing non-DEMO rows are excluded.
select 'associations' as entity,count(*) as demo_count from public.associations where id::text like 'd0d00000-0000-4000-8000-%'
union all select 'needs',count(*) from public.needs where id::text like 'd0d00000-0000-4000-8000-%'
union all select 'slots',count(*) from public.slots where id::text like 'd0d00000-0000-4000-8000-%'
union all select 'donations',count(*) from public.donations where id::text like 'd0d00000-0000-4000-8000-%'
union all select 'offers',count(*) from public.donation_offers where id::text like 'd0d00000-0000-4000-8000-%'
union all select 'bookings',count(*) from public.bookings where id::text like 'd0d00000-0000-4000-8000-%'
union all select movement_type::text,count(*) from public.inventory_movements where id::text like 'd0d00000-0000-4000-8000-%' group by movement_type;
