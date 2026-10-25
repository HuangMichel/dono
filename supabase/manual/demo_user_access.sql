-- Manual setup for the explicitly requested demo account. Never run at startup.
-- Target: Dono wivxerqtkeiflfoyanpp, through a trusted database operator.
-- First create demo@example.com in Supabase Auth with a confirmed email.
-- Grants staff access only to the two existing synthetic DEMO associations.
begin;
do $demo$
declare
  demo_id uuid;
  tenant public.associations;
  member public.association_members;
begin
  perform pg_advisory_xact_lock(20261025, 27402);
  select id into strict demo_id from auth.users
    where email = 'demo@example.com' and email_confirmed_at is not null;

  insert into public.profiles(id, display_name, platform_role)
    values(demo_id, 'Dono Demo', 'donor') on conflict (id) do nothing;
  if not exists(select 1 from public.profiles
    where id = demo_id and platform_role = 'donor' and disabled_at is null) then
    raise exception 'Expected an active donor profile; no access changed';
  end if;

  if (select count(*) from public.associations where id in (
    'd0d00000-0000-4000-8000-000000000101',
    'd0d00000-0000-4000-8000-000000000102'
  ) and name like 'DEMO %' and approval_status = 'approved') <> 2 then
    raise exception 'Expected both approved DEMO associations; no access changed';
  end if;

  for tenant in select * from public.associations where id in (
    'd0d00000-0000-4000-8000-000000000101',
    'd0d00000-0000-4000-8000-000000000102'
  ) order by id loop
    select * into member from public.association_members
      where association_id = tenant.id and profile_id = demo_id;
    if found then
      if member.role <> 'assoc_staff' or not member.active then
        raise exception 'Existing demo membership differs; review before changing it';
      end if;
    else
      -- Reuse the guarded command, including its admin checks and audit event.
      perform public.dono_association(
        tenant.registered_by, gen_random_uuid(), 'grant', tenant.id,
        jsonb_build_object('profile_id', demo_id, 'role', 'assoc_staff')
      );
    end if;
  end loop;
end
$demo$;

select a.name, m.role, m.active, p.platform_role
from public.association_members m
join public.associations a on a.id = m.association_id
join public.profiles p on p.id = m.profile_id
join auth.users u on u.id = p.id
where u.email = 'demo@example.com'
order by a.name;
commit;
