-- =============================================================================
-- Nexus MRO · Phase 1 · 0013 Snags (defects)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   The life of a snag (D-040, D-200):
--
--     REPORTED  (pilot or engineer)        → tail shows blue  "Snag open"
--        │ an engineer starts assessing
--     ATTENDED                             → tail shows amber "Snag attended"
--        │ the engineer chooses ONE disposition (0014 to 0017):
--        ├─ Rectify now ─► IN WORK   (work order, Quality + CO approval)
--        ├─ Defer under MEL ─► DEFERRED (on the DDLS automatically)
--        ├─ Defer on DDLS (not MEL) ─► DEFERRED
--        ├─ Defer as NADD ─► DEFERRED
--        └─ No fault found ─► CLOSED   (certifying engineer, PIN)
--     CLOSED when the work order is certified or the deferral is cleared.
--
--   Rules enforced here:
--     * Pilots and engineers can report (D-041), including soft observations.
--     * A pilot can never close anything (D-042). Closing needs a certifying
--       engineer in scope for the type (D-043) and their PIN (D-094).
--     * The paper technical log reference (book, page, item) is recorded
--       (D-164).
--     * Reports made offline carry a client reference, so if the phone sends
--       the same report twice when it reconnects, only one snag is created
--       (D-103).
--     * Snag numbers come from one fleet-wide series (D-213).
--     * Operations users see only the reports they made themselves; Supply
--       and Procurement do not see snags (D-120).
-- =============================================================================

create table public.snag (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  aircraft_id         uuid not null references public.aircraft (id),
  reported_by         uuid not null references public.person (id),
  reporter_kind       text not null check (reporter_kind in ('pilot', 'engineer')),
  is_soft_observation boolean not null default false,
  description         text not null check (length(trim(description)) > 0),
  ata                 text check (ata ~ '^[0-9]{2}(-[0-9]{2}){0,2}$'),
  tlb_book            text,
  tlb_page            text,
  tlb_item            text,
  client_ref          uuid unique,           -- offline de-duplication (D-103)
  status              text not null default 'reported'
                        check (status in ('reported', 'attended', 'in_work', 'deferred', 'closed')),
  disposition         text check (disposition in ('rectify_now', 'mel', 'ddls', 'nadd', 'nff')),
  attended_by         uuid references public.person (id),
  attended_at         timestamptz,
  assessment          text,
  dispositioned_by    uuid references public.person (id),
  dispositioned_at    timestamptz,
  closed_by           uuid references public.person (id),
  closed_at           timestamptz,
  closure_note        text,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz,
  constraint closure_recorded check (status <> 'closed' or (closed_by is not null and closed_at is not null))
);
comment on table public.snag is 'Defect reports (D-040 to D-044). State changes only through the app.* snag functions.';
create index snag_aircraft_open on public.snag (aircraft_id) where status <> 'closed';
select app.apply_standard_rules('public.snag');

-- -----------------------------------------------------------------------------
-- Report a snag. Pilots (Operations) and engineers, for aircraft in scope.
-- Works for offline reports: same client_ref → same snag, never a duplicate.
-- -----------------------------------------------------------------------------
create or replace function app.report_snag(
  p_aircraft uuid, p_description text,
  p_soft_observation boolean default false,
  p_ata text default null,
  p_tlb_book text default null, p_tlb_page text default null, p_tlb_item text default null,
  p_client_ref uuid default null, p_device_time timestamptz default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me   uuid := app.current_person_id();
  v_id   uuid;
  v_kind text;
begin
  if p_client_ref is not null then
    select id into v_id from public.snag where client_ref = p_client_ref;
    if found then
      return v_id;              -- already received (offline re-send)
    end if;
  end if;
  if v_me is null then
    raise exception 'Only an active, signed-in user can report a snag.' using errcode = '42501';
  end if;
  v_kind := case when app.has_department('ENG') then 'engineer'
                 when app.has_department('OPS') then 'pilot' end;
  if v_kind is null then
    raise exception 'Snags are reported by pilots (Operations) and engineers (D-041).' using errcode = '42501';
  end if;
  if not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;

  insert into public.snag (number, aircraft_id, reported_by, reporter_kind, is_soft_observation,
                           description, ata, tlb_book, tlb_page, tlb_item, client_ref, device_time)
  values (app.next_number('snag', 'SNAG-{000000}'), p_aircraft, v_me, v_kind, p_soft_observation,
          p_description, p_ata, p_tlb_book, p_tlb_page, p_tlb_item, p_client_ref, p_device_time)
  returning id into v_id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Helpers used by every disposition.
-- -----------------------------------------------------------------------------
-- Load a snag for an engineer action, with the usual checks.
create or replace function app.snag_for_engineer(p_snag uuid, p_allowed_status text[])
returns public.snag
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.snag;
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can assess or disposition a snag (D-040, D-042).' using errcode = '42501';
  end if;
  select * into s from public.snag where id = p_snag for update;
  if not found then
    raise exception 'Snag not found.' using errcode = 'P0002';
  end if;
  if not app.can_see_aircraft(s.aircraft_id) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if not (s.status = any (p_allowed_status)) then
    raise exception 'Snag % is %; this action needs it to be %.', s.number, s.status, array_to_string(p_allowed_status, ' or ')
      using errcode = 'P0001';
  end if;
  return s;
end;
$$;

-- The signed-in person must be a certifying engineer for this aircraft's type,
-- and must re-enter their PIN (D-043, D-094).
create or replace function app.require_certifying(p_aircraft uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_type text;
begin
  select aircraft_type_code into v_type from public.aircraft where id = p_aircraft;
  if not app.is_certifying(app.current_person_id(), v_type) then
    raise exception 'You do not hold a valid certifying authorization, licence and type rating for the % (D-043).', v_type
      using errcode = '42501';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- An engineer starts the assessment: blue "Snag open" becomes amber
-- "Snag attended" (D-200).
-- -----------------------------------------------------------------------------
create or replace function app.attend_snag(p_snag uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.snag_for_engineer(p_snag, array['reported']);
  update public.snag
     set status = 'attended', attended_by = app.current_person_id(), attended_at = now(),
         assessment = coalesce(p_note, assessment)
   where id = p_snag;
end;
$$;

-- -----------------------------------------------------------------------------
-- No fault found: assessed, nothing found, closed by a certifying engineer
-- with PIN (D-040, D-042). Online only (D-104).
-- -----------------------------------------------------------------------------
create or replace function app.close_snag_no_fault_found(
  p_snag uuid, p_findings text, p_pin text,
  p_tlb_book text default null, p_tlb_page text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  s public.snag;
begin
  s := app.snag_for_engineer(p_snag, array['attended']);
  if length(trim(coalesce(p_findings, ''))) = 0 then
    raise exception 'Record what was checked before closing as no fault found.' using errcode = '23514';
  end if;
  perform app.require_certifying(s.aircraft_id, p_pin);
  update public.snag
     set status = 'closed', disposition = 'nff',
         dispositioned_by = app.current_person_id(), dispositioned_at = now(),
         closed_by = app.current_person_id(), closed_at = now(),
         closure_note = p_findings,
         tlb_book = coalesce(p_tlb_book, tlb_book), tlb_page = coalesce(p_tlb_page, tlb_page)
   where id = p_snag;
end;
$$;

-- -----------------------------------------------------------------------------
-- Security: who sees which snags (D-120, D-121)
--   Engineering, Quality, Command: snags on aircraft in their scope.
--   Operations (pilots): only the reports they made themselves.
--   Supply, Procurement: none.
-- -----------------------------------------------------------------------------
alter table public.snag enable row level security;
create policy read_by_department on public.snag for select to authenticated
  using (app.can_see_aircraft(aircraft_id)
         and (app.has_department('ENG') or app.is_oversight()
              or reported_by = app.current_person_id()));
revoke insert, update, delete, truncate on public.snag from anon, authenticated;
revoke all on public.snag from anon;
