-- Dono schema baseline. Commands are added separately; clients receive scoped SELECT only.
create schema if not exists private;
revoke all on schema private from public;
create type public.platform_role as enum ('donor', 'platform_admin');
create type public.assoc_role as enum ('assoc_admin', 'assoc_staff');
create type public.association_status as enum ('pending', 'approved');
create type public.membership_action as enum ('bootstrap', 'activate', 'grant', 'role_change', 'revoke', 'transfer', 'recovery');
create type public.redirect_kind as enum ('pharmacy', 'textile_bin', 'repair_cafe');
create type public.donation_category as enum ('clothes', 'shoes', 'food', 'para', 'furniture');
create type public.quantity_unit as enum ('item');
create type public.storage_unit as enum ('item_slot');
create type public.need_season as enum ('spring', 'summer', 'autumn', 'winter');
create type public.donation_state as enum ('draft', 'ready', 'withdrawn', 'transferred');
create type public.facts_origin as enum ('empty', 'human', 'ai_seeded');
create type public.offer_state as enum ('pending_review', 'approved', 'refused', 'withdrawn', 'cancelled', 'expired', 'fulfilled');
create type public.donation_decision as enum ('approved', 'refused');
create type public.booking_state as enum ('booked', 'cancelled', 'no_show', 'received');
create type public.offer_event_reason as enum ('submitted', 'human_approved', 'human_refused', 'booked', 'donor_withdrawal', 'staff_cancellation', 'booking_cancelled', 'review_timeout', 'booking_timeout', 'no_show', 'received');
create type public.donation_change_kind as enum ('created', 'facts_edited', 'published', 'withdrawn', 'restored', 'transferred', 'analysis_seeded');
create type public.photo_kind as enum ('item', 'label');
create type public.analysis_provider as enum ('openai', 'jev', 'hybrid');
create type public.indicator_provider as enum ('openai', 'jev');
create type public.indicator_level as enum ('low', 'medium', 'high');
create type public.expiry_date_type as enum ('DLC', 'DDM', 'expiry', 'PAO');
create type public.date_precision as enum ('day', 'month', 'year', 'unknown');
create type public.date_readability as enum ('readable', 'unreadable', 'unknown');
create type public.movement_kind as enum ('receipt', 'distribution');
create type public.request_state as enum ('in_progress', 'completed', 'failed');
create table public.profiles (
  id uuid not null,
  display_name text,
  platform_role public.platform_role not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz,
  primary key (id),
  check (revision>0)
);
create table public.associations (
  id uuid not null default gen_random_uuid(),
  name text not null,
  registered_by uuid not null,
  rna text,
  siret text,
  approval_status public.association_status not null,
  approved_by uuid,
  approved_at timestamptz,
  display_address text,
  latitude double precision,
  longitude double precision,
  timezone text not null,
  opening_hours jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  check (revision>0)
);
create table public.association_members (
  association_id uuid not null,
  profile_id uuid not null,
  role public.assoc_role not null,
  active boolean not null,
  created_at timestamptz not null default now(),
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (association_id,profile_id),
  check (revision>0)
);
create table public.redirect_points (
  id uuid not null default gen_random_uuid(),
  kind public.redirect_kind not null,
  name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  description text,
  active boolean not null,
  primary key (id)
);
create table public.capacity (
  association_id uuid not null,
  category public.donation_category not null,
  storage_unit public.storage_unit not null,
  limit_storage_units integer not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (association_id,category),
  check (limit_storage_units>=0),
  check (revision>0)
);
create table public.needs (
  id uuid not null default gen_random_uuid(),
  association_id uuid not null,
  category public.donation_category not null,
  attributes jsonb not null default '{}'::jsonb,
  seasons public.need_season[] not null,
  target_quantity numeric(12,3) not null,
  unit public.quantity_unit not null,
  active boolean not null,
  source_text text,
  created_by uuid not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_units_per_item integer not null,
  primary key (id),
  check (target_quantity > 0 and target_quantity=trunc(target_quantity) and target_quantity not in ('NaN','Infinity','-Infinity')),
  check (revision>0),
  check (storage_units_per_item>0)
);
create table public.donations (
  id uuid not null default gen_random_uuid(),
  donor_id uuid not null,
  category public.donation_category,
  attributes jsonb not null default '{}'::jsonb,
  quantity numeric(12,3),
  unit public.quantity_unit,
  basis_analysis_id uuid,
  status public.donation_state not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  facts_revision bigint not null default 1,
  facts_origin public.facts_origin not null,
  primary key (id),
  check (quantity > 0 and quantity=trunc(quantity) and quantity not in ('NaN','Infinity','-Infinity')),
  check (revision>0),
  check (facts_revision>0)
);
create table public.donation_photos (
  id uuid not null default gen_random_uuid(),
  donation_id uuid not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 text not null,
  kind public.photo_kind not null,
  uploaded_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (id),
  check (size_bytes>0)
);
create table public.donation_analysis (
  id uuid not null default gen_random_uuid(),
  donation_id uuid not null,
  provider public.analysis_provider not null,
  model text not null,
  category public.donation_category not null,
  extracted jsonb not null default '{}'::jsonb,
  confidence numeric not null,
  input_photos jsonb not null default '{}'::jsonb,
  input_facts_revision bigint not null,
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  request_id uuid not null,
  primary key (id),
  check (confidence between 0 and 1),
  check (input_facts_revision>0)
);
create table public.donation_indicators (
  analysis_id uuid not null,
  key text not null,
  value text,
  probability numeric,
  level public.indicator_level,
  source_provider public.indicator_provider not null,
  source_model text not null,
  primary key (analysis_id,key),
  check (probability between 0 and 1)
);
create table public.expiry_info (
  donation_id uuid not null,
  expiry_date date,
  date_type public.expiry_date_type,
  pao_months smallint,
  date_precision public.date_precision not null,
  raw_label text,
  readability public.date_readability not null,
  opened_on date,
  edited_by uuid,
  updated_at timestamptz not null default now(),
  primary key (donation_id)
);
create table public.donation_edits (
  id uuid not null default gen_random_uuid(),
  donation_id uuid not null,
  actor_id uuid,
  basis_analysis_id uuid,
  base_revision bigint not null,
  before_facts jsonb not null default '{}'::jsonb,
  after_facts jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  change_kind public.donation_change_kind not null,
  from_state public.donation_state,
  to_state public.donation_state not null,
  primary key (id)
);
create table public.slots (
  id uuid not null default gen_random_uuid(),
  association_id uuid not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  max_bookings integer not null,
  active boolean not null,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id),
  check (max_bookings>0),
  check (revision>0)
);
create table public.bookings (
  id uuid not null default gen_random_uuid(),
  donation_id uuid not null,
  association_id uuid not null,
  slot_id uuid not null,
  qr_nonce uuid not null,
  created_at timestamptz not null default now(),
  offer_id uuid not null,
  category public.donation_category not null,
  quota_date date not null,
  status public.booking_state not null,
  receivable_until timestamptz not null,
  dropoff_address text not null,
  timezone text not null,
  closed_at timestamptz,
  closed_by uuid,
  close_reason text,
  revision bigint not null default 1,
  policy_version text not null,
  primary key (id),
  check (revision>0)
);
create table public.inventory_movements (
  id uuid not null default gen_random_uuid(),
  donation_id uuid not null,
  association_id uuid not null,
  movement_type public.movement_kind not null,
  quantity numeric(12,3) not null,
  unit public.quantity_unit not null,
  actor_id uuid not null,
  created_at timestamptz not null default now(),
  offer_id uuid not null,
  booking_id uuid not null,
  primary key (id),
  check (quantity > 0 and quantity=trunc(quantity) and quantity not in ('NaN','Infinity','-Infinity'))
);
create table private.api_requests (
  id uuid not null default gen_random_uuid(),
  actor_id uuid not null,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  state public.request_state not null,
  attempt_id uuid not null,
  lease_until timestamptz,
  resource_id uuid,
  http_status smallint,
  result_refs jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  failure_code text,
  primary key (id)
);
create table public.membership_events (
  id uuid not null default gen_random_uuid(),
  association_id uuid not null,
  profile_id uuid not null,
  action public.membership_action not null,
  role_before public.assoc_role,
  role_after public.assoc_role not null,
  active_before boolean not null,
  active_after boolean not null,
  actor_id uuid not null,
  reason text,
  created_at timestamptz not null default now(),
  primary key (id)
);
create table public.intake_quotas (
  association_id uuid not null,
  category public.donation_category not null,
  service_date date not null,
  unit public.quantity_unit not null,
  limit_quantity numeric(12,3) not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  primary key (association_id,category,service_date),
  check (limit_quantity >= 0 and limit_quantity=trunc(limit_quantity) and limit_quantity not in ('NaN','Infinity','-Infinity')),
  check (revision>0)
);
create table public.donation_offers (
  id uuid not null default gen_random_uuid(),
  donation_id uuid not null,
  association_id uuid not null,
  need_id uuid not null,
  category public.donation_category not null,
  quantity numeric(12,3) not null,
  unit public.quantity_unit not null,
  facts_revision bigint not null default 1,
  facts_snapshot jsonb not null default '{}'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  basis_analysis_id uuid,
  status public.offer_state not null,
  decision public.donation_decision,
  decided_by uuid,
  decided_at timestamptz,
  intake_checks jsonb default '{}'::jsonb,
  storage_units_per_item integer,
  review_deadline timestamptz not null,
  approval_deadline timestamptz,
  closed_at timestamptz,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  policy_version text not null,
  primary key (id),
  check (quantity > 0 and quantity=trunc(quantity) and quantity not in ('NaN','Infinity','-Infinity')),
  check (facts_revision>0),
  check (storage_units_per_item>0),
  check (revision>0)
);
create table public.offer_events (
  id uuid not null default gen_random_uuid(),
  offer_id uuid not null,
  association_id uuid not null,
  offer_revision bigint not null,
  from_state public.offer_state,
  to_state public.offer_state not null,
  reason public.offer_event_reason not null,
  note text,
  actor_id uuid,
  effective_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  primary key (id),
  check (offer_revision>0)
);
create table private.photo_contents (
  photo_id uuid not null,
  image_base64 text not null,
  primary key (photo_id)
);
alter table public.profiles add foreign key (id) references auth.users (id) on delete restrict on update restrict;
alter table public.associations add foreign key (registered_by) references public.profiles (id) on delete restrict on update restrict;
create index associations_registered_by_fk_idx on public.associations (registered_by);
alter table public.associations add foreign key (approved_by) references public.profiles (id) on delete restrict on update restrict;
create index associations_approved_by_fk_idx on public.associations (approved_by);
alter table public.association_members add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
alter table public.association_members add foreign key (profile_id) references public.profiles (id) on delete restrict on update restrict;
alter table public.capacity add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
alter table public.needs add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index needs_association_id_fk_idx on public.needs (association_id);
alter table public.needs add foreign key (created_by) references public.profiles (id) on delete restrict on update restrict;
create index needs_created_by_fk_idx on public.needs (created_by);
alter table public.donations add foreign key (donor_id) references public.profiles (id) on delete restrict on update restrict;
create index donations_donor_id_fk_idx on public.donations (donor_id);
alter table public.donations add foreign key (basis_analysis_id) references public.donation_analysis (id) on delete restrict on update restrict;
create index donations_basis_analysis_id_fk_idx on public.donations (basis_analysis_id);
alter table public.donation_photos add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
create index donation_photos_donation_id_fk_idx on public.donation_photos (donation_id);
alter table public.donation_photos add foreign key (uploaded_by) references public.profiles (id) on delete restrict on update restrict;
create index donation_photos_uploaded_by_fk_idx on public.donation_photos (uploaded_by);
alter table public.donation_analysis add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
create index donation_analysis_donation_id_fk_idx on public.donation_analysis (donation_id);
alter table public.donation_analysis add foreign key (request_id) references private.api_requests (id) on delete restrict on update restrict;
create index donation_analysis_request_id_fk_idx on public.donation_analysis (request_id);
alter table public.donation_indicators add foreign key (analysis_id) references public.donation_analysis (id) on delete restrict on update restrict;
alter table public.expiry_info add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
alter table public.expiry_info add foreign key (edited_by) references public.profiles (id) on delete restrict on update restrict;
create index expiry_info_edited_by_fk_idx on public.expiry_info (edited_by);
alter table public.donation_edits add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
create index donation_edits_donation_id_fk_idx on public.donation_edits (donation_id);
alter table public.donation_edits add foreign key (actor_id) references public.profiles (id) on delete restrict on update restrict;
create index donation_edits_actor_id_fk_idx on public.donation_edits (actor_id);
alter table public.donation_edits add foreign key (basis_analysis_id) references public.donation_analysis (id) on delete restrict on update restrict;
create index donation_edits_basis_analysis_id_fk_idx on public.donation_edits (basis_analysis_id);
alter table public.slots add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index slots_association_id_fk_idx on public.slots (association_id);
alter table public.bookings add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
create index bookings_donation_id_fk_idx on public.bookings (donation_id);
alter table public.bookings add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index bookings_association_id_fk_idx on public.bookings (association_id);
alter table public.bookings add foreign key (slot_id) references public.slots (id) on delete restrict on update restrict;
create index bookings_slot_id_fk_idx on public.bookings (slot_id);
alter table public.bookings add foreign key (offer_id) references public.donation_offers (id) on delete restrict on update restrict;
create index bookings_offer_id_fk_idx on public.bookings (offer_id);
alter table public.bookings add foreign key (closed_by) references public.profiles (id) on delete restrict on update restrict;
create index bookings_closed_by_fk_idx on public.bookings (closed_by);
alter table public.inventory_movements add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
create index inventory_movements_donation_id_fk_idx on public.inventory_movements (donation_id);
alter table public.inventory_movements add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index inventory_movements_association_id_fk_idx on public.inventory_movements (association_id);
alter table public.inventory_movements add foreign key (actor_id) references public.profiles (id) on delete restrict on update restrict;
create index inventory_movements_actor_id_fk_idx on public.inventory_movements (actor_id);
alter table public.inventory_movements add foreign key (offer_id) references public.donation_offers (id) on delete restrict on update restrict;
create index inventory_movements_offer_id_fk_idx on public.inventory_movements (offer_id);
alter table public.inventory_movements add foreign key (booking_id) references public.bookings (id) on delete restrict on update restrict;
create index inventory_movements_booking_id_fk_idx on public.inventory_movements (booking_id);
alter table private.api_requests add foreign key (actor_id) references public.profiles (id) on delete restrict on update restrict;
create index api_requests_actor_id_fk_idx on private.api_requests (actor_id);
alter table public.membership_events add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index membership_events_association_id_fk_idx on public.membership_events (association_id);
alter table public.membership_events add foreign key (profile_id) references public.profiles (id) on delete restrict on update restrict;
create index membership_events_profile_id_fk_idx on public.membership_events (profile_id);
alter table public.membership_events add foreign key (actor_id) references public.profiles (id) on delete restrict on update restrict;
create index membership_events_actor_id_fk_idx on public.membership_events (actor_id);
alter table public.intake_quotas add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
alter table public.donation_offers add foreign key (donation_id) references public.donations (id) on delete restrict on update restrict;
create index donation_offers_donation_id_fk_idx on public.donation_offers (donation_id);
alter table public.donation_offers add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index donation_offers_association_id_fk_idx on public.donation_offers (association_id);
alter table public.donation_offers add foreign key (need_id) references public.needs (id) on delete restrict on update restrict;
create index donation_offers_need_id_fk_idx on public.donation_offers (need_id);
alter table public.donation_offers add foreign key (basis_analysis_id) references public.donation_analysis (id) on delete restrict on update restrict;
create index donation_offers_basis_analysis_id_fk_idx on public.donation_offers (basis_analysis_id);
alter table public.donation_offers add foreign key (decided_by) references public.profiles (id) on delete restrict on update restrict;
create index donation_offers_decided_by_fk_idx on public.donation_offers (decided_by);
alter table public.offer_events add foreign key (offer_id) references public.donation_offers (id) on delete restrict on update restrict;
create index offer_events_offer_id_fk_idx on public.offer_events (offer_id);
alter table public.offer_events add foreign key (association_id) references public.associations (id) on delete restrict on update restrict;
create index offer_events_association_id_fk_idx on public.offer_events (association_id);
alter table public.offer_events add foreign key (actor_id) references public.profiles (id) on delete restrict on update restrict;
create index offer_events_actor_id_fk_idx on public.offer_events (actor_id);
alter table private.photo_contents add foreign key (photo_id) references public.donation_photos (id) on delete restrict on update restrict;

alter table public.needs add unique(id,association_id);
alter table public.donation_analysis add unique(id,donation_id), add unique(request_id);
alter table public.donation_offers add unique(id,donation_id,association_id), add unique(id,association_id),
 add foreign key(need_id,association_id) references public.needs(id,association_id),
 add foreign key(basis_analysis_id,donation_id) references public.donation_analysis(id,donation_id),
 add check(review_deadline>created_at),
 add check((decision is null)=(decided_by is null) and (decision is null)=(decided_at is null)),
 add check(status not in ('approved','fulfilled') or (decision='approved' and storage_units_per_item>0 and approval_deadline is not null)),
 add check(status<>'refused' or decision='refused'),
 add check((status in ('pending_review','approved'))=(closed_at is null));
alter table public.donations add foreign key(basis_analysis_id,id) references public.donation_analysis(id,donation_id);
alter table public.donation_edits add unique(donation_id,base_revision), add check(base_revision>=0),
 add foreign key(basis_analysis_id,donation_id) references public.donation_analysis(id,donation_id);
alter table public.slots add unique(id,association_id), add check(starts_at<ends_at);
alter table public.bookings add unique(offer_id), add unique(id,offer_id,donation_id,association_id),
 add foreign key(offer_id,donation_id,association_id) references public.donation_offers(id,donation_id,association_id),
 add foreign key(slot_id,association_id) references public.slots(id,association_id),
 add foreign key(association_id,category,quota_date) references public.intake_quotas(association_id,category,service_date),
 add check((status='booked')=(closed_at is null)),
 add check(status='booked' or close_reason is not null),
 add check(status not in ('received','cancelled') or closed_by is not null);
alter table public.inventory_movements
 add foreign key(offer_id,donation_id,association_id) references public.donation_offers(id,donation_id,association_id),
 add foreign key(booking_id,offer_id,donation_id,association_id) references public.bookings(id,offer_id,donation_id,association_id);
alter table public.membership_events add foreign key(association_id,profile_id) references public.association_members(association_id,profile_id);
alter table public.offer_events add foreign key(offer_id,association_id) references public.donation_offers(id,association_id),add unique(offer_id,offer_revision);
alter table private.api_requests add unique(actor_id,operation,idempotency_key), add check(request_hash ~ '^[0-9a-f]{64}$');
alter table public.associations add check(rna is not null or siret is not null),
 add check(rna is null or rna ~ '^W[0-9]{9}$'), add check(siret is null or siret ~ '^[0-9]{14}$'),
 add check((approval_status='pending')=(approved_at is null)),add check((approved_at is null)=(approved_by is null)),
 add check((latitude is null)=(longitude is null)),add check(latitude between -90 and 90),add check(longitude between -180 and 180);
alter table public.expiry_info add check(pao_months between 1 and 120),add check(expiry_date is null or (date_precision='day' and readability='readable'));
alter table public.donation_photos add check(sha256 ~ '^[0-9a-f]{64}$'),add check(size_bytes<=5242880), add check(mime_type in ('image/jpeg','image/png','image/webp'));
alter table private.photo_contents add check(length(image_base64)>0 and length(image_base64)%4=0 and image_base64 ~ '^[A-Za-z0-9+/]*={0,2}$');
create unique index associations_rna_uk on public.associations(rna) where rna is not null;
create unique index associations_siret_uk on public.associations(siret) where siret is not null;
create unique index donation_one_active_offer on public.donation_offers(donation_id) where status in ('pending_review','approved');
create unique index donation_one_receipt on public.inventory_movements(donation_id) where movement_type='receipt';
create unique index donation_one_distribution on public.inventory_movements(donation_id) where movement_type='distribution';
create index slots_tenant_time on public.slots(association_id,starts_at,id);
create index offers_tenant_state on public.donation_offers(association_id,status,created_at desc,id desc);
create index offers_donation_history on public.donation_offers(donation_id,created_at desc,id desc);
create index bookings_quota on public.bookings(association_id,category,quota_date);
create index request_leases on private.api_requests(lease_until) where state='in_progress';

alter table public.profiles enable row level security;
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
alter table public.associations enable row level security;
revoke all on public.associations from anon, authenticated;
grant select on public.associations to authenticated;
alter table public.association_members enable row level security;
revoke all on public.association_members from anon, authenticated;
grant select on public.association_members to authenticated;
alter table public.redirect_points enable row level security;
revoke all on public.redirect_points from anon, authenticated;
grant select on public.redirect_points to authenticated;
alter table public.capacity enable row level security;
revoke all on public.capacity from anon, authenticated;
grant select on public.capacity to authenticated;
alter table public.needs enable row level security;
revoke all on public.needs from anon, authenticated;
grant select on public.needs to authenticated;
alter table public.donations enable row level security;
revoke all on public.donations from anon, authenticated;
grant select on public.donations to authenticated;
alter table public.donation_photos enable row level security;
revoke all on public.donation_photos from anon, authenticated;
grant select on public.donation_photos to authenticated;
alter table public.donation_analysis enable row level security;
revoke all on public.donation_analysis from anon, authenticated;
grant select on public.donation_analysis to authenticated;
alter table public.donation_indicators enable row level security;
revoke all on public.donation_indicators from anon, authenticated;
grant select on public.donation_indicators to authenticated;
alter table public.expiry_info enable row level security;
revoke all on public.expiry_info from anon, authenticated;
grant select on public.expiry_info to authenticated;
alter table public.donation_edits enable row level security;
revoke all on public.donation_edits from anon, authenticated;
grant select on public.donation_edits to authenticated;
alter table public.slots enable row level security;
revoke all on public.slots from anon, authenticated;
grant select on public.slots to authenticated;
alter table public.bookings enable row level security;
revoke all on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;
alter table public.inventory_movements enable row level security;
revoke all on public.inventory_movements from anon, authenticated;
grant select on public.inventory_movements to authenticated;
alter table private.api_requests enable row level security;
revoke all on private.api_requests from anon, authenticated;
alter table public.membership_events enable row level security;
revoke all on public.membership_events from anon, authenticated;
grant select on public.membership_events to authenticated;
alter table public.intake_quotas enable row level security;
revoke all on public.intake_quotas from anon, authenticated;
grant select on public.intake_quotas to authenticated;
alter table public.donation_offers enable row level security;
revoke all on public.donation_offers from anon, authenticated;
grant select on public.donation_offers to authenticated;
alter table public.offer_events enable row level security;
revoke all on public.offer_events from anon, authenticated;
grant select on public.offer_events to authenticated;
alter table private.photo_contents enable row level security;
revoke all on private.photo_contents from anon, authenticated;
create function private.reject_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'immutable_evidence' using errcode='P0001'; end $$;
create trigger immutable_donation_photos before update or delete on public.donation_photos for each row execute function private.reject_mutation();
create trigger immutable_photo_contents before update or delete on private.photo_contents for each row execute function private.reject_mutation();
create trigger immutable_donation_analysis before update or delete on public.donation_analysis for each row execute function private.reject_mutation();
create trigger immutable_donation_indicators before update or delete on public.donation_indicators for each row execute function private.reject_mutation();
create trigger immutable_donation_edits before update or delete on public.donation_edits for each row execute function private.reject_mutation();
create trigger immutable_offer_events before update or delete on public.offer_events for each row execute function private.reject_mutation();
create trigger immutable_membership_events before update or delete on public.membership_events for each row execute function private.reject_mutation();
create trigger immutable_inventory_movements before update or delete on public.inventory_movements for each row execute function private.reject_mutation();
