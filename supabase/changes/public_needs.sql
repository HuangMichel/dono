-- Anonymous HTTP discovery uses this service-only projection. Raw RLS stays intact.
create or replace function public.dono_public_needs(
 filter_category public.donation_category default null,
 origin_latitude double precision default null,
 origin_longitude double precision default null,
 page_limit integer default 10,
 page_offset integer default 0
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 at_time timestamptz := statement_timestamp();
 result jsonb;
begin
 if page_limit is null or page_limit < 1 or page_limit > 50
    or page_offset is null or page_offset < 0
    or (origin_latitude is null) <> (origin_longitude is null)
    or (origin_latitude is not null and not (origin_latitude between -90 and 90))
    or (origin_longitude is not null and not (origin_longitude between -180 and 180)) then
  raise exception 'validation_error';
 end if;
 with candidates as materialized (
  select n.id, a.id as association_id, a.name, a.display_address,
   n.category, n.attributes, n.seasons, n.target_quantity, n.unit,
   n.target_quantity - private.need_used(n.id, at_time) as available_quantity,
   case when origin_latitude is null then null else
    6371.0088 * 2 * asin(sqrt(least(1.0,
     power(sin(radians(a.latitude-origin_latitude)/2),2)
     + cos(radians(origin_latitude))*cos(radians(a.latitude))
     * power(sin(radians(a.longitude-origin_longitude)/2),2)
    ))) end as distance_km
  from public.needs n join public.associations a on a.id=n.association_id
  where n.active and a.approval_status='approved'
   and nullif(btrim(a.display_address),'') is not null
   and a.latitude between -90 and 90 and a.longitude between -180 and 180
   and (filter_category is null or n.category=filter_category)
   and (cardinality(n.seasons)=0 or
    (case extract(month from at_time at time zone a.timezone)::integer
     when 12 then 'winter' when 1 then 'winter' when 2 then 'winter'
     when 3 then 'spring' when 4 then 'spring' when 5 then 'spring'
     when 6 then 'summer' when 7 then 'summer' when 8 then 'summer'
     else 'autumn' end)::public.need_season=any(n.seasons))
 ), bounded as (
  select * from candidates where available_quantity>0
  order by distance_km nulls last,
   case when origin_latitude is null then name end collate "C",
   association_id,id
  limit page_limit+1 offset page_offset
 ), numbered as (
  select *, row_number() over(order by distance_km nulls last,
   case when origin_latitude is null then name end collate "C",
   association_id,id) as position from bounded
 )
 select jsonb_build_object(
  'data',coalesce(jsonb_agg(jsonb_build_object(
   'id',id,
   'association',jsonb_build_object('id',association_id,'name',name,'display_address',display_address),
   'category',category,'attributes',attributes,'seasons',seasons,
   'target_quantity',target_quantity::text,
   'available_quantity',available_quantity::numeric(12,3)::text,
   'unit',unit,'distance_km',distance_km
  ) order by position) filter(where position<=page_limit),'[]'::jsonb),
  'has_more',count(*)>page_limit,'as_of',at_time
 ) into result from numbered;
 return result;
end $$;
-- Hosted postgres is not a superuser. Ownership transfer requires the new owner
-- to have CREATE on the schema; restore its prior permission within this block.
do $$
declare
 had_create boolean := has_schema_privilege('dono_command_owner', 'public', 'CREATE');
begin
 if not had_create then
  grant create on schema public to dono_command_owner;
 end if;
 alter function public.dono_public_needs(public.donation_category,double precision,double precision,integer,integer) owner to dono_command_owner;
 if not had_create then
  revoke create on schema public from dono_command_owner;
 end if;
end $$;
revoke all on function public.dono_public_needs(public.donation_category,double precision,double precision,integer,integer) from public,anon,authenticated;
grant execute on function public.dono_public_needs(public.donation_category,double precision,double precision,integer,integer) to service_role;
