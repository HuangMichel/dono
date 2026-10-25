-- Private non-recursive identity helpers. No role claims from user metadata.
grant usage on schema private to authenticated, service_role;
create function private.enabled() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and disabled_at is null)
$$;
create function private.member_of(tenant uuid, admin_only boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select private.enabled() and exists(select 1 from public.association_members m join public.associations a on a.id=m.association_id
 where m.profile_id=(select auth.uid()) and m.association_id=tenant and m.active and a.approval_status='approved' and (not admin_only or m.role='assoc_admin'))
$$;
create function private.platform() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.profiles where id=(select auth.uid()) and disabled_at is null and platform_role='platform_admin')
$$;
create function private.owns(item uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.enabled() and exists(select 1 from public.donations where id=item and donor_id=(select auth.uid()))
$$;
create function private.read_offer(attempt uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.donation_offers o where o.id=attempt and (private.owns(o.donation_id) or private.member_of(o.association_id)))
$$;
create function private.evidence(item uuid, evidence_id uuid, kind text) returns boolean language sql stable security definer set search_path='' as $$
 select private.owns(item) or exists(select 1 from public.donation_offers o where o.donation_id=item and private.member_of(o.association_id) and
 case kind when 'photo' then o.evidence_snapshot->'photos' @> jsonb_build_array(jsonb_build_object('photo_id',evidence_id::text))
 when 'request' then o.evidence_snapshot->'analysis_request_ids' @> jsonb_build_array(evidence_id::text)
 when 'edit' then o.evidence_snapshot->'edit_ids' @> jsonb_build_array(evidence_id::text) else false end)
$$;
create policy profile_owner on public.profiles for select to authenticated using(id=(select auth.uid()) and disabled_at is null);
create policy association_scope on public.associations for select to authenticated using(private.enabled() and ((registered_by=(select auth.uid()) and approval_status='pending') or private.member_of(id) or private.platform()));
create policy membership_scope on public.association_members for select to authenticated using(private.enabled() and (profile_id=(select auth.uid()) or private.member_of(association_id,true)));
create policy membership_history on public.membership_events for select to authenticated using(private.enabled() and (profile_id=(select auth.uid()) or private.member_of(association_id,true)));
create policy donation_owner on public.donations for select to authenticated using(private.enabled() and donor_id=(select auth.uid()));
create policy expiry_owner on public.expiry_info for select to authenticated using(private.owns(donation_id));
create policy offer_scope on public.donation_offers for select to authenticated using(private.owns(donation_id) or private.member_of(association_id));
create policy offer_history on public.offer_events for select to authenticated using(private.read_offer(offer_id));
create policy photo_scope on public.donation_photos for select to authenticated using(private.evidence(donation_id,id,'photo'));
create policy analysis_scope on public.donation_analysis for select to authenticated using(private.evidence(donation_id,request_id,'request'));
create policy indicator_scope on public.donation_indicators for select to authenticated using(exists(select 1 from public.donation_analysis a where a.id=analysis_id));
create policy edit_scope on public.donation_edits for select to authenticated using(private.evidence(donation_id,id,'edit'));
create policy booking_scope on public.bookings for select to authenticated using(private.read_offer(offer_id));
create policy stock_scope on public.inventory_movements for select to authenticated using(private.member_of(association_id));
create policy redirect_scope on public.redirect_points for select to authenticated using(active and private.enabled());
create policy payload_defense on private.photo_contents for select to authenticated using(exists(select 1 from public.donation_photos p where p.id=photo_id and private.evidence(p.donation_id,p.id,'photo')));
create policy capacity_scope on public.capacity for select to authenticated using(private.member_of(association_id));
create policy needs_scope on public.needs for select to authenticated using(private.member_of(association_id));
create policy quota_scope on public.intake_quotas for select to authenticated using(private.member_of(association_id));
create policy slot_scope on public.slots for select to authenticated using(private.member_of(association_id));
-- Every helper explicitly tests the current subject. Only boolean scope predicates are exposed.
revoke all on all functions in schema private from public;
grant execute on function private.enabled(), private.member_of(uuid,boolean), private.platform(), private.owns(uuid), private.read_offer(uuid), private.evidence(uuid,uuid,text) to authenticated;
