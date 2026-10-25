-- Functions own only application data; no managed Auth mutation or login capability.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='dono_command_owner') then
  create role dono_command_owner nologin noinherit;
 end if;
end $$;
grant dono_command_owner to postgres;
grant usage,create on schema public,private to dono_command_owner;
grant usage on schema auth to dono_command_owner;
grant select(id) on auth.users to dono_command_owner;
create index association_members_profile_fk_idx on public.association_members(profile_id);
alter table public.donation_indicators add check((probability is null)=(level is null));
alter table public.donation_offers add check(status<>'pending_review' or decision is null),add check(approval_deadline is null or decision='approved');
do $$ declare t text; f record; begin
 foreach t in array array['profiles','associations','association_members','membership_events','redirect_points','capacity','needs','intake_quotas','donations','donation_offers','offer_events','donation_photos','donation_analysis','donation_indicators','expiry_info','donation_edits','slots','bookings','inventory_movements'] loop
  execute format('alter table public.%I owner to dono_command_owner',t);
  execute format('revoke all on public.%I from service_role',t);
 end loop;
 alter table private.photo_contents owner to dono_command_owner;
 alter table private.api_requests owner to dono_command_owner;
 revoke all on private.photo_contents,private.api_requests from service_role;
 for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where
  (n.nspname='public' and p.proname like 'dono_%') or
  (n.nspname='private' and p.proname in ('reject_mutation','enabled','member_of','platform','owns','read_offer','evidence','require_actor','live_offer','source_facts','put_source_dates','claim','holds','need_used','storage_used','intake_used','slot_used','offer_event','expire_item','staff','date_fence')) loop
  execute format('alter function %s owner to dono_command_owner',f.signature);
 end loop;
end $$;

revoke create on schema public,private from dono_command_owner;
alter default privileges for role postgres in schema public revoke execute on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema private revoke execute on functions from public,anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated,service_role;
alter default privileges for role postgres in schema private revoke all on tables from anon,authenticated,service_role;
