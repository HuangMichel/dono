create function public.dono_reconcile(actor uuid,key uuid,tenant uuid,body jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare r private.api_requests; at_time timestamptz; ids uuid[]; item uuid; offer_ids uuid[]:='{}'; booking_ids uuid[]:='{}'; o public.donation_offers; b public.bookings; maximum int:=coalesce((body->>'limit')::int,50); more boolean;
begin
 if maximum<1 or maximum>100 then raise exception 'validation_error';end if;
 if not exists(select 1 from public.profiles where id=actor and disabled_at is null) then raise exception 'account_disabled';end if;
 r:=private.claim(actor,'reconcile/'||tenant::text,key,body);perform private.require_actor(actor);
 perform 1 from public.associations where id=tenant for update;perform private.staff(actor,tenant);
 if r.state='completed' then return r.result_refs;end if;
 at_time:=clock_timestamp();
 select array_agg(x.donation_id order by x.donation_id) into ids from (
 select o.donation_id from public.donation_offers o left join public.bookings b on b.offer_id=o.id where o.association_id=tenant and
 ((o.status='pending_review' and at_time>=o.review_deadline) or (o.status='approved' and ((b.id is null and at_time>=o.approval_deadline) or (b.status='booked' and at_time>=b.receivable_until)))) order by o.donation_id limit maximum) x;
 perform 1 from public.donations where id=any(coalesce(ids,'{}')) order by id for update;
 at_time:=clock_timestamp();
 foreach item in array coalesce(ids,'{}') loop
  select * into o from public.donation_offers where donation_id=item and association_id=tenant and status in ('pending_review','approved');
  if found then
   select * into b from public.bookings where offer_id=o.id and status='booked';
   perform private.expire_item(item,at_time);
   offer_ids:=array_append(offer_ids,o.id);
   if b.id is not null then booking_ids:=array_append(booking_ids,b.id);end if;
  end if;
 end loop;
 select exists(select 1 from public.donation_offers o left join public.bookings b on b.offer_id=o.id where o.association_id=tenant and ((o.status='pending_review' and at_time>=o.review_deadline) or (o.status='approved' and ((b.id is null and at_time>=o.approval_deadline) or (b.status='booked' and at_time>=b.receivable_until))))) into more;
 update private.api_requests set state='completed',http_status=200,result_refs=jsonb_build_object('offer_ids',offer_ids,'booking_ids',booking_ids,'has_more',more) where id=r.id returning * into r;
 return r.result_refs;
end $$;
revoke all on function public.dono_reconcile(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.dono_reconcile(uuid,uuid,uuid,jsonb) to service_role;
