-- =============================================================================
-- Nexus MRO · Migration 0032 · Promise's answers of 11 Oct 2026
-- Proprietary to Liebetag. All rights reserved.
--
--   1. AOG priority: a certifying engineer may confirm AOG on their own part
--      request (still needs a valid certifying authorization and the PIN).
--   2. Licence, rating and medical expiry warning: 90 days (was 60).
--   3. Correcting a FLIGHT record: any engineer, no reason and no PIN
--      needed; the new version records the engineer's 3LC and the time
--      (server and device). The original stays in history (D-023, D-024).
--      Brought-forward totals (baseline) still need a reason and the PIN,
--      because they set the starting figures for the whole aircraft.
--   (Authorizations stay scoped by aircraft type only, no ATA limits; flight
--    hours stay counted from the flight hours log: no change needed.)
-- =============================================================================

-- 1. ------------------------------------------------- AOG self-confirmation
create or replace function app.confirm_aog_priority(p_request uuid, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.part_request;
begin
  select * into r from public.part_request where id = p_request for update;
  if not found or not app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code) then
    raise exception 'Part request not found.' using errcode = 'P0002';
  end if;
  if r.priority <> 'AOG' then
    raise exception 'Request % is not marked AOG.', r.number using errcode = 'P0001';
  end if;
  if r.aog_confirmed_at is not null then
    raise exception 'AOG priority on % is already confirmed.', r.number using errcode = 'P0001';
  end if;
  -- Any certifying engineer for the type, including the requester (11 Oct).
  perform app.require_certifying(r.aircraft_id, p_pin);
  update public.part_request
     set aog_confirmed_at = now(), aog_confirmed_by = app.current_person_id(), aog_confirmed_how = 'certifying_engineer'
   where id = r.id;
end;
$$;

-- 2. ------------------------------------------------- 90-day expiry warning
insert into public.operator_setting (key, value, reason) values
  ('qualification.approaching_days', '90', 'Promise 11 Oct 2026: warn 90 days before a licence, rating or medical expires');

-- 3. ------------------------------------------ flight corrections: 3LC + time
-- The table rule now asks for a reason only on baselines.
alter table public.flight_record drop constraint reason_given;
alter table public.flight_record add constraint reason_given
  check (kind = 'flight' or length(trim(coalesce(reason, ''))) > 0);

create or replace function app.correct_flight_record(
  p_record uuid, p_flight_date date,
  p_hours numeric, p_cycles integer, p_landings integer,
  p_reason text, p_pin text,
  p_from text default null, p_to text default null, p_log_ref text default null,
  p_apu_hours numeric default null, p_apu_cycles integer default null,
  p_void boolean default false, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  o    public.flight_record;
  v_id uuid := gen_random_uuid();
  v_by text;
  v_n  integer;
begin
  select * into o from public.flight_record where id = p_record for update;
  if not found then
    raise exception 'Flight record not found.' using errcode = 'P0002';
  end if;
  if o.kind = 'baseline' then
    perform app.check_engineer_for_flights(o.aircraft_id, p_reason, p_pin);
  else
    -- A flight correction: any engineer for a tail in scope; the new
    -- version records who (3LC) and when. No reason or PIN (11 Oct).
    if app.current_person_id() is null or not app.has_department('ENG') then
      raise exception 'Only Engineering can correct flight records (D-027).' using errcode = '42501';
    end if;
    if not app.can_see_aircraft(o.aircraft_id) then
      raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
    end if;
  end if;
  if exists (select 1 from public.flight_record n where n.supersedes = o.id) then
    select p.three_letter_code into v_by from public.flight_record n join public.person p on p.id = n.entered_by
     where n.supersedes = o.id;
    raise exception 'This version was already corrected by %. Open the newest version and correct that (D-105).', v_by
      using errcode = 'P0001';
  end if;
  perform app.check_flight_figures(o.kind, p_flight_date, p_hours, p_cycles, p_landings,
                                   p_apu_hours, p_apu_cycles, coalesce(p_void, false));
  if o.kind = 'flight' and not coalesce(p_void, false) then
    perform app.check_after_baseline(o.aircraft_id, p_flight_date);
  end if;
  if o.kind = 'baseline' and not coalesce(p_void, false) then
    select count(*) into v_n from public.flight_record_current f
     where f.aircraft_id = o.aircraft_id and f.kind = 'flight' and not f.is_void and f.flight_date <= p_flight_date;
    if v_n > 0 then
      raise exception '% flight record(s) on this tail are dated on or before %. Choose an "as at" date before the first logged flight.', v_n, p_flight_date
        using errcode = '23514';
    end if;
  end if;

  insert into public.flight_record (id, record_id, version, supersedes, kind, aircraft_id, flight_date,
                                    from_place, to_place, hours, hours_basis, cycles, landings,
                                    apu_hours, apu_cycles, log_ref, reason, is_void, entered_by, device_time)
  values (v_id, o.record_id, o.version + 1, o.id, o.kind, o.aircraft_id, p_flight_date,
          nullif(trim(p_from), ''), nullif(trim(p_to), ''), p_hours, o.hours_basis, p_cycles, p_landings,
          p_apu_hours, p_apu_cycles, nullif(trim(p_log_ref), ''), nullif(trim(coalesce(p_reason, '')), ''), coalesce(p_void, false),
          app.current_person_id(), p_device_time);
  return v_id;
end;
$$;

