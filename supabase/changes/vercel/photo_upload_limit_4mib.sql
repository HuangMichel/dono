-- Keep existing photo metadata/content unchanged, including historical 4-5 MiB files.
-- NOT VALID skips old rows but enforces the limit for future inserts/updates.
-- Existing 5 MiB integrity bound remains in place for historical evidence.
alter table public.donation_photos
 add constraint donation_photos_upload_limit_4mib check (size_bytes<=4194304) not valid;

-- CREATE OR REPLACE preserves the restricted owner and EXECUTE ACLs.
create or replace function public.dono_photo(actor uuid, key uuid, item uuid, body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
 if octet_length(raw)>4194304 then raise exception 'upload_too_large';end if;
 if octet_length(raw)<>(body->>'size_bytes')::bigint or encode(sha256(raw),'hex')<>body->>'sha256'
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
