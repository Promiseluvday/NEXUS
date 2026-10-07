-- =============================================================================
-- Nexus MRO · Phase 1 · 0018 NADD (Non-Airworthiness Deferred Defects) and
-- cabin items
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (D-048, D-049, D-160 to D-166, D-209):
--   * A NADD is a convenience defect that does NOT affect airworthiness (a
--     reading light, a sticking drawer). It is deferred outside the MEL with a
--     countdown: 120 days by default (setting nadd.default_limit_days), counted
--     from the REPORT date (D-160, D-166).
--   * Pilots and cabin crew PROPOSE a NADD, e.g. by tapping a zone on the
--     cabin map (D-209). It shows as "proposed" until a certifying engineer
--     CONFIRMS it with PIN and the declaration "not covered by the MEL, no
--     airworthiness effect" (D-160). An engineer can log and confirm at once.
--   * Engineering may instead REJECT it (with a reason the reporter sees) or
--     RECLASSIFY it as a snag, which then follows the full snag workflow.
--   * Zones marked as emergency equipment (exits, oxygen, emergency lighting)
--     can NEVER become a NADD; they must be reported as snags (D-209).
--   * Extensions are separate approvals (Quality by default, D-160).
--   * Open NADDs never block an A-check; they are flagged (D-166, Phase 2).
--   * A NADD never changes the tail status (D-048).
-- =============================================================================

create table public.cabin_zone (
  aircraft_type_code     text not null references public.aircraft_type (code),
  code                   text not null check (code ~ '^[A-Z0-9-]{1,12}$'),
  name                   text not null,
  is_emergency_equipment boolean not null default false,
  created_at             timestamptz not null default now(),
  created_by             uuid,
  device_time            timestamptz,
  primary key (aircraft_type_code, code)
);
comment on table public.cabin_zone is 'Cabin map zones per aircraft type, set by the operator (D-209).';
select app.apply_standard_rules('public.cabin_zone');

create table public.nadd (
  id                       uuid primary key default gen_random_uuid(),
  number                   text not null unique,
  aircraft_id              uuid not null references public.aircraft (id),
  snag_id                  uuid references public.snag (id),            -- when deferred from a snag
  status                   text not null default 'proposed'
                             check (status in ('proposed', 'open', 'rectified', 'reclassified', 'rejected')),
  reported_by              uuid not null references public.person (id),
  reported_at              timestamptz not null default now(),          -- countdown starts here (D-160)
  zone_code                text,
  location                 text,
  description              text not null check (length(trim(description)) > 0),
  ata                      text check (ata ~ '^[0-9]{2}(-[0-9]{2}){0,2}$'),
  tlb_book                 text,
  tlb_page                 text,
  tlb_item                 text,
  client_ref               uuid unique,                                 -- offline de-duplication (D-103)
  limit_days               integer check (limit_days is null or limit_days > 0),
  due_at                   timestamptz,
  confirmed_by             uuid references public.person (id),
  confirmed_at             timestamptz,
  declaration              boolean not null default false,
  rectified_by             uuid references public.person (id),
  rectified_at             timestamptz,
  action_taken             text,
  rect_tlb_book            text,
  rect_tlb_page            text,
  reclassified_snag_id     uuid references public.snag (id),
  rejected_by              uuid references public.person (id),
  rejected_at              timestamptz,
  reject_reason            text,
  created_at               timestamptz not null default now(),
  created_by               uuid,
  device_time              timestamptz,
  constraint confirmation_recorded check (
    status not in ('open', 'rectified') or (confirmed_by is not null and declaration and due_at is not null)),
  constraint rejection_recorded check (
    status <> 'rejected' or length(trim(coalesce(reject_reason, ''))) > 0)
);
comment on table public.nadd is 'Non-airworthiness deferred defects (D-048, D-160). Never change the tail status.';
select app.apply_standard_rules('public.nadd');

create table public.nadd_extension (
  id                  uuid primary key default gen_random_uuid(),
  nadd_id             uuid not null references public.nadd (id),
  extra_days          integer not null check (extra_days > 0),
  reason              text not null check (length(trim(reason)) > 0),
  approval_request_id uuid references public.approval_request (id),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  previous_due_at     timestamptz,
  new_due_at          timestamptz,
  requested_by        uuid not null references public.person (id),
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz
);
select app.apply_standard_rules('public.nadd_extension');

-- Refuse emergency-equipment zones (D-209).
create or replace function app.refuse_emergency_zone(p_aircraft uuid, p_zone text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_zone is not null and exists (
       select 1 from public.cabin_zone z join public.aircraft a on a.aircraft_type_code = z.aircraft_type_code
        where a.id = p_aircraft and z.code = p_zone and z.is_emergency_equipment) then
    raise exception 'Emergency equipment, exits, oxygen and emergency lighting are never NADDs. Report it as a snag (D-209).'
      using errcode = '42501';
  end if;
end;
$$;

-- Fill in the countdown when a NADD is confirmed (D-160, D-166).
create or replace function app.confirm_nadd_fields(p_nadd uuid, p_limit_days integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_default integer := coalesce((app.setting('nadd.default_limit_days'))::integer, 120);
  v_limit   integer := coalesce(p_limit_days, v_default);
begin
  if v_limit > v_default then
    raise exception 'A NADD limit can be shorter than % days, never longer. Longer needs an extension (D-160).', v_default
      using errcode = '23514';
  end if;
  update public.nadd
     set status = 'open', confirmed_by = app.current_person_id(), confirmed_at = now(), declaration = true,
         limit_days = v_limit, due_at = app.due_from_days(reported_at, v_limit)
   where id = p_nadd;
end;
$$;

-- -----------------------------------------------------------------------------
-- PROPOSE a NADD (pilots, cabin crew, engineers). Works offline (client_ref).
-- -----------------------------------------------------------------------------
create or replace function app.propose_nadd(
  p_aircraft uuid, p_description text, p_zone text default null, p_location text default null,
  p_ata text default null, p_tlb_book text default null, p_tlb_page text default null, p_tlb_item text default null,
  p_client_ref uuid default null, p_device_time timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_client_ref is not null then
    select id into v_id from public.nadd where client_ref = p_client_ref;
    if found then return v_id; end if;
  end if;
  if app.current_person_id() is null or not (app.has_department('OPS') or app.has_department('ENG')) then
    raise exception 'NADDs are proposed by crew (Operations) and engineers.' using errcode = '42501';
  end if;
  if not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  perform app.refuse_emergency_zone(p_aircraft, p_zone);
  insert into public.nadd (number, aircraft_id, reported_by, zone_code, location, description, ata,
                           tlb_book, tlb_page, tlb_item, client_ref, device_time)
  values (app.next_number('nadd', 'NADD-{000000}'), p_aircraft, app.current_person_id(), p_zone, p_location,
          p_description, p_ata, p_tlb_book, p_tlb_page, p_tlb_item, p_client_ref, p_device_time)
  returning id into v_id;
  return v_id;
end;
$$;

-- Load a NADD for an engineer action.
create or replace function app.nadd_for_engineer(p_nadd uuid, p_allowed_status text[])
returns public.nadd
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.nadd;
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can act on a NADD.' using errcode = '42501';
  end if;
  select * into n from public.nadd where id = p_nadd for update;
  if not found then
    raise exception 'NADD not found.' using errcode = 'P0002';
  end if;
  if not app.can_see_aircraft(n.aircraft_id) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if not (n.status = any (p_allowed_status)) then
    raise exception 'NADD % is %.', n.number, n.status using errcode = 'P0001';
  end if;
  return n;
end;
$$;

-- CONFIRM a proposed NADD: certifying engineer, PIN, declaration (D-160).
create or replace function app.confirm_nadd(p_nadd uuid, p_pin text, p_declaration boolean, p_limit_days integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.nadd;
begin
  n := app.nadd_for_engineer(p_nadd, array['proposed']);
  if not coalesce(p_declaration, false) then
    raise exception 'Confirm the item is not covered by the MEL and has no airworthiness effect (D-160).'
      using errcode = '23514';
  end if;
  perform app.refuse_emergency_zone(n.aircraft_id, n.zone_code);
  perform app.require_certifying(n.aircraft_id, p_pin);
  perform app.confirm_nadd_fields(p_nadd, p_limit_days);
end;
$$;

-- REJECT a proposed NADD, with a reason the reporter sees (D-209).
create or replace function app.reject_nadd(p_nadd uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.nadd_for_engineer(p_nadd, array['proposed']);
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A rejection needs a reason the reporter will see (D-209).' using errcode = '23514';
  end if;
  update public.nadd
     set status = 'rejected', rejected_by = app.current_person_id(), rejected_at = now(), reject_reason = p_reason
   where id = p_nadd;
end;
$$;

-- RECLASSIFY as a snag (D-209): the snag then follows the full workflow.
create or replace function app.reclassify_nadd_as_snag(p_nadd uuid, p_note text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n      public.nadd;
  v_snag uuid;
begin
  n := app.nadd_for_engineer(p_nadd, array['proposed', 'open']);
  insert into public.snag (number, aircraft_id, reported_by, reporter_kind, description, ata,
                           tlb_book, tlb_page, tlb_item, status, attended_by, attended_at, assessment)
  values (app.next_number('snag', 'SNAG-{000000}'), n.aircraft_id, n.reported_by,
          case when app.person_has_department(n.reported_by, 'ENG') then 'engineer' else 'pilot' end,
          n.description, n.ata, n.tlb_book, n.tlb_page, n.tlb_item,
          'attended', app.current_person_id(), now(),
          'Reclassified from ' || n.number || ': ' || coalesce(p_note, ''))
  returning id into v_snag;
  update public.nadd set status = 'reclassified', reclassified_snag_id = v_snag where id = p_nadd;
  return v_snag;
end;
$$;

-- DEFER AS NADD from the snag workflow: log and confirm in one step.
create or replace function app.defer_as_nadd(
  p_snag uuid, p_pin text, p_declaration boolean,
  p_zone text default null, p_location text default null, p_limit_days integer default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s    public.snag;
  v_id uuid;
begin
  s := app.snag_for_engineer(p_snag, array['attended']);
  if not coalesce(p_declaration, false) then
    raise exception 'Confirm the item is not covered by the MEL and has no airworthiness effect (D-160).'
      using errcode = '23514';
  end if;
  perform app.refuse_emergency_zone(s.aircraft_id, p_zone);
  perform app.require_certifying(s.aircraft_id, p_pin);
  insert into public.nadd (number, aircraft_id, snag_id, reported_by, reported_at, zone_code, location,
                           description, ata, tlb_book, tlb_page, tlb_item)
  values (app.next_number('nadd', 'NADD-{000000}'), s.aircraft_id, s.id, s.reported_by, s.created_at,
          p_zone, p_location, s.description, s.ata, s.tlb_book, s.tlb_page, s.tlb_item)
  returning id into v_id;
  perform app.confirm_nadd_fields(v_id, p_limit_days);
  update public.snag
     set status = 'deferred', disposition = 'nadd',
         dispositioned_by = app.current_person_id(), dispositioned_at = now()
   where id = s.id;
  return v_id;
end;
$$;

-- RECTIFY an open NADD: certifying engineer with PIN. Closes its snag if any.
create or replace function app.rectify_nadd(
  p_nadd uuid, p_action_taken text, p_pin text,
  p_rect_tlb_book text default null, p_rect_tlb_page text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  n public.nadd;
begin
  n := app.nadd_for_engineer(p_nadd, array['open']);
  if length(trim(coalesce(p_action_taken, ''))) = 0 then
    raise exception 'Describe the action taken.' using errcode = '23514';
  end if;
  perform app.require_certifying(n.aircraft_id, p_pin);
  update public.nadd
     set status = 'rectified', rectified_by = app.current_person_id(), rectified_at = now(),
         action_taken = p_action_taken, rect_tlb_book = p_rect_tlb_book, rect_tlb_page = p_rect_tlb_page
   where id = p_nadd;
  if n.snag_id is not null then
    update public.snag
       set status = 'closed', closed_by = app.current_person_id(), closed_at = now(),
           closure_note = n.number || ' rectified: ' || p_action_taken
     where id = n.snag_id;
  end if;
end;
$$;

-- EXTENSION request: approved by the chain "nadd_extension" (Quality by default).
create or replace function app.request_nadd_extension(p_nadd uuid, p_extra_days integer, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  n    public.nadd;
  v_id uuid;
begin
  n := app.nadd_for_engineer(p_nadd, array['open']);
  insert into public.nadd_extension (nadd_id, extra_days, reason, requested_by)
  values (p_nadd, p_extra_days, p_reason, app.current_person_id())
  returning id into v_id;
  update public.nadd_extension
     set approval_request_id = app.raise_approval('nadd_extension', 'nadd', p_nadd,
           n.number || ' extension +' || p_extra_days || ' days')
   where id = v_id;
  return v_id;
end;
$$;

create or replace function app.nadd_extension_follow_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.nadd_extension;
  n public.nadd;
begin
  if new.action_type <> 'nadd_extension' or new.status not in ('approved', 'rejected') then
    return null;
  end if;
  select * into x from public.nadd_extension where approval_request_id = new.id;
  if not found then return null; end if;
  if new.status = 'rejected' then
    update public.nadd_extension set status = 'rejected' where id = x.id;
    return null;
  end if;
  select * into n from public.nadd where id = x.nadd_id for update;
  update public.nadd_extension
     set status = 'approved', previous_due_at = n.due_at, new_due_at = n.due_at + make_interval(days => x.extra_days)
   where id = x.id;
  update public.nadd set due_at = n.due_at + make_interval(days => x.extra_days) where id = n.id;
  return null;
end;
$$;
create trigger nadd_extension_follow_approval after update on public.approval_request
  for each row execute function app.nadd_extension_follow_approval();

-- -----------------------------------------------------------------------------
-- Security: Engineering, Operations (crew see what is inoperative, D-120) and
-- oversight, for aircraft in scope. Cabin zones are reference data.
-- -----------------------------------------------------------------------------
alter table public.cabin_zone     enable row level security;
alter table public.nadd           enable row level security;
alter table public.nadd_extension enable row level security;
create policy read_signed_in on public.cabin_zone for select to authenticated using (true);
create policy write_super_admin on public.cabin_zone for insert to authenticated with check (app.is_super_admin());
create policy read_in_scope on public.nadd for select to authenticated
  using (app.can_see_aircraft(aircraft_id)
         and (app.has_department('ENG') or app.has_department('OPS') or app.is_oversight()));
create policy read_with_nadd on public.nadd_extension for select to authenticated
  using (exists (select 1 from public.nadd n where n.id = nadd_extension.nadd_id));
revoke insert, update, delete, truncate on public.nadd, public.nadd_extension from anon, authenticated;
revoke update, delete, truncate on public.cabin_zone from anon, authenticated;
revoke all on public.cabin_zone, public.nadd, public.nadd_extension from anon;
