-- =============================================================================
-- Nexus MRO · Phase 0 · 0006 Aircraft register and stores
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * aircraft_type: the types the operator flies (e.g. A330-200, G550).
--     The framework stays aircraft-agnostic (D-014).
--   * aircraft: the register. Super Admins add aircraft and enter the tail
--     number (D-015). Aircraft are DEACTIVATED, never deleted; deactivating
--     needs who, when and a reason. (The PIN check happens in the app before
--     the change is sent; the database records the result.)
--   * store: where stock is held: Main Store and Forward Store for PAF
--     (D-141). Exactly one store is the store of record (D-142). The list is
--     a setting, so another operator can have one store or several.
--
-- Tail status (AOG, U/S, SVC...) is NOT here; it comes in Phase 1 with the
-- snag workflow, always set by an engineer (D-046).
-- =============================================================================

create table public.aircraft_type (
  code         text primary key check (code ~ '^[A-Z0-9-]{2,20}$'),
  name         text not null,
  manufacturer text,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  device_time  timestamptz
);
select app.apply_standard_rules('public.aircraft_type');

create table public.aircraft (
  id                       uuid primary key default gen_random_uuid(),
  tail                     text not null unique check (tail ~ '^[A-Z0-9-]{2,12}$'),
  aircraft_type_code       text not null references public.aircraft_type (code),
  msn                      text,                 -- manufacturer serial number
  registration_effective_on date,
  status                   text not null default 'active'
                             check (status in ('active', 'deactivated')),
  deactivated_at           timestamptz,
  deactivated_by           uuid references public.person (id),
  deactivation_reason      text,
  created_at               timestamptz not null default now(),
  created_by               uuid,
  device_time              timestamptz,
  constraint deactivation_recorded check (
    status <> 'deactivated'
    or (deactivated_at is not null and deactivated_by is not null
        and length(trim(coalesce(deactivation_reason, ''))) > 0))
);
comment on table public.aircraft is 'Aircraft register. Super Admins add and deactivate; never deleted (D-015).';
select app.apply_standard_rules('public.aircraft');

create table public.store (
  code               text primary key check (code ~ '^[A-Z]{2,8}$'),
  name               text not null,
  is_store_of_record boolean not null default false,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz
);
comment on table public.store is 'Stock locations (D-141). One store of record (D-142).';
create unique index store_one_of_record on public.store (is_store_of_record) where is_store_of_record;
select app.apply_standard_rules('public.store');
