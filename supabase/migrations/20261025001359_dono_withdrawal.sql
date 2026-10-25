create function public.dono_item_withdrawal(actor uuid,key uuid,item uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.donations; o public.donation_offers; r private.api_requests; at_time timestamptz; source jsonb; old_state public.offer_state;
begin
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 if not exists(select 1 from public.donations where id=item and donor_id=actor) then raise exception 'not_found';end if;
 r:=private.claim(actor,'item/withdrawal/'||item::text,key,body);
 perform private.require_actor(actor);
 perform 1 from public.associations where id in(select association_id from public.donation_offers where donation_id=item and status in ('pending_review','approved')) order by id for update;
 select * into d from public.donations where id=item and donor_id=actor for update;
 if not found then raise exception 'not_found';end if;
 if r.state='completed' then return jsonb_build_object('id',item);end if;
 if d.revision<>(body->>'expected_revision')::bigint then raise exception 'stale_revision';end if;
 if d.status<>'ready' then raise exception 'invalid_transition';end if;
 at_time:=clock_timestamp();perform private.expire_item(item,at_time);
 select * into o from public.donation_offers where donation_id=item and status in ('pending_review','approved') for update;
 if found then
  old_state:=o.status;
  update public.bookings set status='cancelled',closed_at=at_time,closed_by=actor,close_reason=coalesce(body->>'reason','donor_withdrawal'),revision=revision+1 where offer_id=o.id and status='booked';
  update public.donation_offers set status='withdrawn',closed_at=at_time,revision=revision+1,updated_at=at_time where id=o.id returning * into o;
  perform private.offer_event(o,old_state,'donor_withdrawal',actor,body->>'reason',at_time);
 end if;
 source:=private.source_facts(item);
 update public.donations set status='withdrawn',revision=revision+1,updated_at=at_time where id=item;
 insert into public.donation_edits(donation_id,actor_id,basis_analysis_id,base_revision,before_facts,after_facts,change_kind,from_state,to_state)
 values(item,actor,d.basis_analysis_id,d.revision,source,source,'withdrawn',d.status,'withdrawn');
 update private.api_requests set state='completed',resource_id=item,http_status=200,result_refs=jsonb_build_object('id',item) where id=r.id;
 return jsonb_build_object('id',item);
end $$;
revoke all on function public.dono_item_withdrawal(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dono_item_withdrawal(uuid,uuid,uuid,jsonb) to service_role;
