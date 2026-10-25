create function public.dono_photo(actor uuid, key uuid, item uuid, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.donations; r private.api_requests; photo uuid; source jsonb; raw bytea;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 select * into d from public.donations where id=item and donor_id=actor;
 if not found then raise exception 'not_found';end if;
 r:=private.claim(actor,'photo/'||item::text,key,body-'image_base64');
 perform private.require_actor(actor);
 select * into d from public.donations where id=item and donor_id=actor for update;
 if not found then raise exception 'not_found';end if;
 if r.state='completed' then return jsonb_build_object('id',r.resource_id,'replay',true);end if;
 if d.status='transferred' or private.live_offer(item,clock_timestamp()) then raise exception 'invalid_transition';end if;
 if (select count(*) from public.donation_photos where donation_id=item)>=3 then raise exception 'photo_limit_reached';end if;
 raw:=decode(body->>'image_base64','base64');
 if octet_length(raw)<>(body->>'size_bytes')::bigint or octet_length(raw)>5242880 or encode(sha256(raw),'hex')<>body->>'sha256'
 or replace(encode(raw,'base64'),E'\n','')<>body->>'image_base64' then raise exception 'photo_integrity_error';end if;
 source:=private.source_facts(item);
 insert into public.donation_photos(donation_id,mime_type,size_bytes,sha256,kind,uploaded_by)
 values(item,body->>'mime_type',octet_length(raw),body->>'sha256',(body->>'kind')::public.photo_kind,actor) returning id into photo;
 insert into private.photo_contents values(photo,body->>'image_base64');
 update public.donations set revision=revision+1,facts_revision=facts_revision+1,updated_at=clock_timestamp() where id=item;
 insert into public.donation_edits(donation_id,actor_id,basis_analysis_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state)
 values(item,actor,d.basis_analysis_id,d.revision,source,source,'facts_edited',d.status,d.status);
 update private.api_requests set state='completed',resource_id=photo,http_status=201,result_refs=jsonb_build_object('id',photo) where id=r.id;
 return jsonb_build_object('id',photo,'replay',false);
end $$;
create function public.dono_photo_content(actor uuid, photo uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.donation_photos; content text;
begin
 perform private.require_actor(actor);
 -- Set the verified subject only inside this isolated transaction, for shared evidence predicates.
 perform set_config('request.jwt.claim.sub',actor::text,true);
 select * into p from public.donation_photos where id=photo;
 if p.id is null or not private.evidence(p.donation_id,photo,'photo') then raise exception 'not_found';end if;
 select image_base64 into content from private.photo_contents where photo_id=photo;
 if content is null then raise exception 'photo_integrity_error';end if;
 return jsonb_build_object('photo',to_jsonb(p),'image_base64',content);
end $$;
create function public.dono_analysis_start(actor uuid, key uuid, item uuid, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.api_requests; d public.donations; photos jsonb; now_at timestamptz;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 select * into d from public.donations where id=item and donor_id=actor;
 if not found then raise exception 'not_found';end if;
 r:=private.claim(actor,'analysis/'||item::text,key,body);
 perform private.require_actor(actor);
 select * into d from public.donations where id=item and donor_id=actor for update;
 if not found then raise exception 'not_found';end if;
 now_at:=clock_timestamp();
 if r.state='completed' then return r.result_refs||jsonb_build_object('id',r.id,'resource_id',r.resource_id,'replay',true);end if;
 if r.lease_until>now_at then raise exception 'request_in_progress';end if;
 if r.lease_until is null then
  if d.status='transferred' or private.live_offer(item,now_at) then raise exception 'invalid_transition';end if;
  select jsonb_agg(jsonb_build_object('photo_id',p.id,'sha256',p.sha256) order by p.id) into photos from public.donation_photos p
  where p.donation_id=item and body->'photo_ids' @> jsonb_build_array(p.id::text);
  if photos is null or jsonb_array_length(photos)<>jsonb_array_length(body->'photo_ids') or jsonb_array_length(photos)>3 then raise exception 'not_found';end if;
  update private.api_requests set context=jsonb_build_object('donation_id',item,'facts_revision',d.facts_revision,'photos',photos,'category_hint',body->'category_hint') where id=r.id;
 end if;
 update private.api_requests set state='in_progress',attempt_id=gen_random_uuid(),lease_until=now_at+interval '120 seconds' where id=r.id returning * into r;
 return jsonb_build_object('id',r.id,'attempt_id',r.attempt_id,'context',r.context,'replay',false);
end $$;
create function public.dono_analysis_finish(actor uuid, request uuid, attempt uuid, body jsonb, model text, conflict boolean) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.api_requests; d public.donations; original uuid; ind jsonb; attached boolean:=false; seeded boolean:=false; before_source jsonb;
begin
 select * into r from private.api_requests where id=request and actor_id=actor for update;
 if not found then raise exception 'not_found';end if;
 perform private.require_actor(actor);
 if r.attempt_id<>attempt or r.state<>'in_progress' then raise exception 'request_in_progress';end if;
 select * into d from public.donations where id=(r.context->>'donation_id')::uuid and donor_id=actor for update;
 if not found then raise exception 'not_found';end if;
 if body ? 'failure_code' then
  update private.api_requests set state='failed',failure_code=body->>'failure_code',http_status=503 where id=request;
  return jsonb_build_object('failed',true);
 end if;
 before_source:=private.source_facts(d.id);
 insert into public.donation_analysis(donation_id,provider,model,category,extracted,confidence,input_photos,input_facts_revision,provenance,request_id)
 values(d.id,'openai',model,(body->>'category')::public.donation_category,body->'extracted',(body->>'confidence')::numeric,r.context->'photos',(r.context->>'facts_revision')::bigint,jsonb_build_object('schema_version','analysis-v1','level_policy','analysis-v1'),request) returning id into original;
 for ind in select * from jsonb_array_elements(body->'indicators') loop
  insert into public.donation_indicators(analysis_id,key,value,probability,level,source_provider,source_model)
  values(original,ind->>'key',ind->>'value',(ind->>'probability')::numeric,(ind->>'level')::public.indicator_level,'openai',model);
 end loop;
 if d.basis_analysis_id is null then
  update public.donations set basis_analysis_id=original where id=d.id;attached:=true;
 end if;
 if d.facts_origin='empty' and d.facts_revision=(r.context->>'facts_revision')::bigint and not private.live_offer(d.id,clock_timestamp()) and (body->>'confidence')::numeric>=0.8 and not conflict then
  update public.donations set category=(body->>'category')::public.donation_category,attributes=body->'extracted'->'attributes',facts_origin='ai_seeded',facts_revision=facts_revision+1,revision=revision+1,updated_at=clock_timestamp() where id=d.id;
  perform private.put_source_dates(d.id,null,body->'extracted'->'dates');
  insert into public.donation_edits(donation_id,actor_id,basis_analysis_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state)
  values(d.id,null,original,d.revision,before_source,private.source_facts(d.id),'analysis_seeded',d.status,d.status);seeded:=true;
 end if;
 update private.api_requests set state='completed',resource_id=original,http_status=201,result_refs=jsonb_build_object('id',original,'basis_attached',attached,'facts_seeded',seeded) where id=request;
 return jsonb_build_object('id',original,'basis_attached',attached,'facts_seeded',seeded);
end $$;
revoke all on function public.dono_photo(uuid,uuid,uuid,jsonb),public.dono_photo_content(uuid,uuid),public.dono_analysis_start(uuid,uuid,uuid,jsonb),public.dono_analysis_finish(uuid,uuid,uuid,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.dono_photo(uuid,uuid,uuid,jsonb),public.dono_photo_content(uuid,uuid),public.dono_analysis_start(uuid,uuid,uuid,jsonb),public.dono_analysis_finish(uuid,uuid,uuid,jsonb,text,boolean) to service_role;
