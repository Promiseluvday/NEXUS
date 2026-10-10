-- =============================================================================
-- Nexus MRO · Phase 2 · 0027 Flight records (hours, cycles, landings)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * A FLIGHT RECORD is what a pilot or engineer writes after flying: the tail,
--     the date, optional from / to, the hours (block or flight hours, whichever
--     the operator uses: setting flight.hours_basis, D-025), cycles, landings,
--     optional APU hours and cycles, and the flight / tech log reference.
--     Entered by Pilots (Operations) and Engineering only (D-027), for tails in
--     their aircraft scope (D-121). Every entry carries the person's name and
--     both the device time and the server time; server time counts (D-024).
--   * A BROUGHT-FORWARD BASELINE per aircraft: the totals "as at" a date, from
--     the paper records, entered once by Engineering with a reason and PIN, so
--     the totals start from the real figures. Flights on or before that date
--     are already inside it, so they are refused (no double counting).
--   * CORRECTIONS: Engineering only. A correction is a NEW VERSION of the
--     record with a reason (and the engineer's PIN); the original is kept and
--     stays visible in the version history (D-023, D-027). Nothing is ever
--     edited or deleted. A record entered on the wrong tail is corrected as
--     "entered in error" (it then counts for nothing) and logged again on the
--     right tail.
--   * TOTALS: hours, cycles, landings (and APU, when entered) are the plain
--     SUM of the newest version of every human-entered record (D-022), plus
--     "last record entered by X at time". Nexus never forecasts, projects or
--     works out anything due from them (D-020, D-021).
--   * Offline: log_flight carries a one-off reference (client_ref), so a phone
--     that re-sends the same flight after the signal drops creates one record
--     only (D-103). Baselines and corrections need a connection (PIN, D-104).
-- =============================================================================

-- --------------------------------------------------------------- settings ---
insert into public.operator_setting (key, value, reason) values
  ('flight.hours_basis', '"flight"',
   'Hours recorded on flight records: "flight" (airborne) or "block" (chocks off to chocks on) (D-025, D-027)');

-- ------------------------------------------------------------------ table ---
create table public.flight_record (
  id            uuid primary key default gen_random_uuid(),
  -- All versions of one record share record_id (the id of version 1).
  record_id     uuid not null,
  version       integer not null default 1 check (version >= 1),
  supersedes    uuid references public.flight_record (id),   -- the version this one corrects
  kind          text not null check (kind in ('flight', 'baseline')),
  aircraft_id   uuid not null references public.aircraft (id),
  flight_date   date not null,          -- baseline: the "as at" date of the brought-forward figures
  from_place    text,
  to_place      text,
  hours         numeric(9,1) not null check (hours >= 0),
  hours_basis   text not null check (hours_basis in ('flight', 'block')),  -- the setting when entered
  cycles        integer not null check (cycles >= 0),
  landings      integer not null check (landings >= 0),
  apu_hours     numeric(9,1) check (apu_hours is null or apu_hours >= 0),
  apu_cycles    integer check (apu_cycles is null or apu_cycles >= 0),
  log_ref       text,                   -- flight / tech log reference (paper)
  reason        text,                   -- baseline source, or why it was corrected
  is_void       boolean not null default false,   -- "entered in error": counts for nothing
  entered_by    uuid not null references public.person (id),
  entered_at    timestamptz not null default now(),   -- server time (D-024)
  client_ref    uuid unique,            -- offline de-duplication (D-103)
  created_at    timestamptz not null default now(),
  created_by    uuid,
  device_time   timestamptz,
  -- Version 1 starts a record; later versions say which version they correct.
  constraint version_chain check ((version = 1) = (supersedes is null)),
  constraint version_one_is_record check (version > 1 or record_id = id),
  -- A baseline and every correction carry a reason (D-027).
  constraint reason_given check ((kind = 'flight' and version = 1) or length(trim(coalesce(reason, ''))) > 0),
  -- One flight entry is at most a day's flying.
  constraint one_flight_size check (kind = 'baseline' or hours <= 24)
);
comment on table public.flight_record is
  'Flight records and brought-forward baselines (D-022, D-027). Append-only: a correction is a new version (D-023).';
-- Each version can be corrected once only: the first correction wins, a second
-- one made at the same time is refused (D-105).
create unique index flight_record_one_successor on public.flight_record (supersedes) where supersedes is not null;
-- One baseline per aircraft (it is corrected by new versions, not re-entered).
create unique index flight_record_one_baseline on public.flight_record (aircraft_id) where kind = 'baseline' and version = 1;
create index flight_record_by_tail on public.flight_record (aircraft_id, flight_date desc);
create index flight_record_versions on public.flight_record (record_id, version);
create trigger a1_no_update before update on public.flight_record
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.flight_record');

-- The newest version of every record (what the totals add up).
create view public.flight_record_current
with (security_invoker = true) as
select f.* from public.flight_record f
 where not exists (select 1 from public.flight_record n where n.supersedes = f.id);

-- ------------------------------------------------------------ helpers ---
create or replace function app.flight_hours_basis()
returns text
language sql stable security definer set search_path = ''
as $$
  select case when app.setting('flight.hours_basis') #>> '{}' = 'block' then 'block' else 'flight' end;
$$;

-- Today on the operator's clock (setting operator.time_zone).
create or replace function app.flight_today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'))::date;
$$;

-- The figures every entry must pass, whoever enters them.
create or replace function app.check_flight_figures(
  p_kind text, p_date date, p_hours numeric, p_cycles integer, p_landings integer,
  p_apu_hours numeric, p_apu_cycles integer, p_void boolean default false)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if p_date is null then
    raise exception 'Enter the date.' using errcode = '23514';
  end if;
  if p_date > app.flight_today() then
    raise exception 'The date % is in the future. Flight records are entered after flying.', p_date using errcode = '23514';
  end if;
  if p_hours is null or p_cycles is null or p_landings is null then
    raise exception 'Enter hours, cycles and landings (0 if none).' using errcode = '23514';
  end if;
  if p_hours < 0 or p_cycles < 0 or p_landings < 0
     or coalesce(p_apu_hours, 0) < 0 or coalesce(p_apu_cycles, 0) < 0 then
    raise exception 'Hours, cycles and landings cannot be negative.' using errcode = '23514';
  end if;
  if p_kind = 'flight' and p_hours > 24 then
    raise exception 'One flight entry cannot be more than 24 hours.' using errcode = '23514';
  end if;
  if p_kind = 'flight' and not p_void and p_hours = 0 and p_cycles = 0 and p_landings = 0 then
    raise exception 'Enter the hours, cycles or landings flown.' using errcode = '23514';
  end if;
end;
$$;

-- Flights on or before the brought-forward date are already inside the
-- baseline; refuse them so nothing is counted twice.
create or replace function app.check_after_baseline(p_aircraft uuid, p_date date)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_as_at date;
begin
  select b.flight_date into v_as_at from public.flight_record_current b
   where b.aircraft_id = p_aircraft and b.kind = 'baseline' and not b.is_void;
  if v_as_at is not null and p_date <= v_as_at then
    raise exception 'The brought-forward totals are as at %; flights on or before that date are already in them.', v_as_at
      using errcode = '23514';
  end if;
end;
$$;

-- Who may enter flight records on this tail (D-027, D-121).
create or replace function app.check_may_log_flight(p_aircraft uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if app.current_person_id() is null or not (app.has_department('OPS') or app.has_department('ENG')) then
    raise exception 'Flight records are entered by pilots (Operations) and Engineering (D-027).' using errcode = '42501';
  end if;
  if not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if not exists (select 1 from public.aircraft a where a.id = p_aircraft and a.status = 'active') then
    raise exception 'This aircraft is deactivated (D-015).' using errcode = '22023';
  end if;
end;
$$;

-- Engineering-only actions (baseline, corrections) need the engineer's PIN (D-094).
create or replace function app.check_engineer_for_flights(p_aircraft uuid, p_reason text, p_pin text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only Engineering can correct flight records or enter brought-forward totals (D-027).' using errcode = '42501';
  end if;
  if not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason (D-027).' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28000';
  end if;
end;
$$;

-- ------------------------------------------------------------- actions ---
-- LOG A FLIGHT. Pilots and engineers, tails in scope. Works offline: the same
-- client_ref sent twice gives back the first record (D-103).
create or replace function app.log_flight(
  p_aircraft uuid, p_flight_date date,
  p_hours numeric, p_cycles integer, p_landings integer,
  p_from text default null, p_to text default null, p_log_ref text default null,
  p_apu_hours numeric default null, p_apu_cycles integer default null,
  p_client_ref uuid default null, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
begin
  if p_client_ref is not null then
    select f.id into v_id from public.flight_record f where f.client_ref = p_client_ref;
    if found then
      return v_id;            -- already received (offline re-send)
    end if;
    v_id := gen_random_uuid();
  end if;
  perform app.check_may_log_flight(p_aircraft);
  perform app.check_flight_figures('flight', p_flight_date, p_hours, p_cycles, p_landings, p_apu_hours, p_apu_cycles);
  perform app.check_after_baseline(p_aircraft, p_flight_date);

  insert into public.flight_record (id, record_id, kind, aircraft_id, flight_date, from_place, to_place,
                                    hours, hours_basis, cycles, landings, apu_hours, apu_cycles, log_ref,
                                    entered_by, client_ref, device_time)
  values (v_id, v_id, 'flight', p_aircraft, p_flight_date, nullif(trim(p_from), ''), nullif(trim(p_to), ''),
          p_hours, app.flight_hours_basis(), p_cycles, p_landings, p_apu_hours, p_apu_cycles,
          nullif(trim(p_log_ref), ''), app.current_person_id(), p_client_ref, p_device_time);
  return v_id;
end;
$$;

-- ENTER THE BROUGHT-FORWARD TOTALS for a tail. Engineering, once per tail,
-- reason and PIN. To change it later, correct it (new version).
create or replace function app.set_flight_baseline(
  p_aircraft uuid, p_as_at date,
  p_hours numeric, p_cycles integer, p_landings integer,
  p_reason text, p_pin text,
  p_apu_hours numeric default null, p_apu_cycles integer default null,
  p_log_ref text default null, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid := gen_random_uuid();
  v_n  integer;
begin
  perform app.check_engineer_for_flights(p_aircraft, p_reason, p_pin);
  if not exists (select 1 from public.aircraft a where a.id = p_aircraft and a.status = 'active') then
    raise exception 'This aircraft is deactivated (D-015).' using errcode = '22023';
  end if;
  if exists (select 1 from public.flight_record f where f.aircraft_id = p_aircraft and f.kind = 'baseline') then
    raise exception 'This tail already has brought-forward totals. Correct them instead (new version, D-023).'
      using errcode = '23505';
  end if;
  perform app.check_flight_figures('baseline', p_as_at, p_hours, p_cycles, p_landings, p_apu_hours, p_apu_cycles);
  select count(*) into v_n from public.flight_record_current f
   where f.aircraft_id = p_aircraft and f.kind = 'flight' and not f.is_void and f.flight_date <= p_as_at;
  if v_n > 0 then
    raise exception '% flight record(s) on this tail are dated on or before %. Choose an "as at" date before the first logged flight.', v_n, p_as_at
      using errcode = '23514';
  end if;

  insert into public.flight_record (id, record_id, kind, aircraft_id, flight_date, hours, hours_basis,
                                    cycles, landings, apu_hours, apu_cycles, log_ref, reason,
                                    entered_by, device_time)
  values (v_id, v_id, 'baseline', p_aircraft, p_as_at, p_hours, app.flight_hours_basis(),
          p_cycles, p_landings, p_apu_hours, p_apu_cycles, nullif(trim(p_log_ref), ''), trim(p_reason),
          app.current_person_id(), p_device_time);
  return v_id;
end;
$$;

-- CORRECT A RECORD (flight or baseline). Engineering only, reason and PIN.
-- Adds a new version; the corrected one stays in history (D-023, D-027).
-- p_record is the version being corrected: it must still be the newest, so
-- two engineers correcting at once cannot both win (D-105).
-- p_void = true marks it "entered in error" (e.g. wrong tail): it then counts
-- for nothing, but is still shown in the history.
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
  perform app.check_engineer_for_flights(o.aircraft_id, p_reason, p_pin);
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
          p_apu_hours, p_apu_cycles, nullif(trim(p_log_ref), ''), trim(p_reason), coalesce(p_void, false),
          app.current_person_id(), p_device_time);
  return v_id;
end;
$$;

-- -------------------------------------------------------------- totals ---
-- Totals for every tail the user may see: plain sums of the newest version of
-- every human-entered record (baseline + flights), never forecast (D-020 to
-- D-022). Any department may see totals for tails in its scope (they appear
-- on every department's fleet board, D-120); the records behind them follow
-- the table rules below.
--   apu_hours / apu_cycles are null until someone has entered an APU figure.
--   last_entered_*: the newest entry or correction on the tail.
create or replace function app.fleet_totals()
returns table (
  aircraft_id        uuid,
  tail               text,
  hours              numeric,
  cycles             bigint,
  landings           bigint,
  apu_hours          numeric,
  apu_cycles         bigint,
  hours_basis        text,       -- 'flight' | 'block' (setting flight.hours_basis)
  has_baseline       boolean,
  baseline_as_at     date,
  flights            bigint,     -- flight records counted (not the baseline)
  last_flight_date   date,
  last_entered_by    text,       -- 3LC
  last_entered_name  text,
  last_entered_at    timestamptz)
language sql stable security definer set search_path = ''
as $$
  with visible as (
    select a.id, a.tail from public.aircraft a
     where a.status = 'active' and app.can_see_aircraft(a.id)),
  cur as (
    select f.* from public.flight_record f
     where f.aircraft_id in (select id from visible)
       and not f.is_void
       and not exists (select 1 from public.flight_record n where n.supersedes = f.id))
  select v.id, v.tail,
         coalesce(sum(c.hours), 0),
         coalesce(sum(c.cycles), 0)::bigint,
         coalesce(sum(c.landings), 0)::bigint,
         sum(c.apu_hours),
         sum(c.apu_cycles)::bigint,
         app.flight_hours_basis(),
         bool_or(c.kind = 'baseline') is true,
         max(c.flight_date) filter (where c.kind = 'baseline'),
         count(c.id) filter (where c.kind = 'flight'),
         max(c.flight_date) filter (where c.kind = 'flight'),
         l.three_letter_code, l.full_name, l.entered_at
    from visible v
    left join cur c on c.aircraft_id = v.id
    left join lateral (
      select p.three_letter_code, p.full_name, f.entered_at
        from public.flight_record f join public.person p on p.id = f.entered_by
       where f.aircraft_id = v.id
       order by f.entered_at desc, f.version desc limit 1) l on true
   group by v.id, v.tail, l.three_letter_code, l.full_name, l.entered_at
   order by v.tail;
$$;
comment on function app.fleet_totals() is 'Hours, cycles and landings per tail: sums of entered flight records (D-022). Never forecast.';

-- One tail's totals (the aircraft page Totals panel). No row if out of scope.
create or replace function app.aircraft_totals(p_aircraft uuid)
returns table (
  aircraft_id uuid, tail text, hours numeric, cycles bigint, landings bigint,
  apu_hours numeric, apu_cycles bigint, hours_basis text, has_baseline boolean, baseline_as_at date,
  flights bigint, last_flight_date date, last_entered_by text, last_entered_name text, last_entered_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select t.* from app.fleet_totals() t where t.aircraft_id = p_aircraft;
$$;
comment on function app.aircraft_totals(uuid) is 'One tail''s totals from entered flight records (D-022).';

-- ------------------------------------------------------------ security ---
-- Who reads flight records: Engineering and Operations (they enter them) and
-- Command / Quality (oversight, D-122), for tails in scope (D-121, D-125).
-- Supply and Procurement see only the totals (fleet_totals).
alter table public.flight_record enable row level security;
create policy read_in_scope on public.flight_record for select to authenticated
  using (app.can_see_aircraft(aircraft_id)
         and (app.has_department('ENG') or app.has_department('OPS') or app.is_oversight()));
revoke insert, update, delete, truncate on public.flight_record from anon, authenticated;
revoke all on public.flight_record from anon;
revoke all on public.flight_record_current from anon;

grant execute on function
  app.log_flight(uuid, date, numeric, integer, integer, text, text, text, numeric, integer, uuid, timestamptz),
  app.set_flight_baseline(uuid, date, numeric, integer, integer, text, text, numeric, integer, text, timestamptz),
  app.correct_flight_record(uuid, date, numeric, integer, integer, text, text, text, text, text, numeric, integer, boolean, timestamptz),
  app.fleet_totals(),
  app.aircraft_totals(uuid),
  app.flight_hours_basis()
to authenticated;
-- Internal steps: only reachable through the actions above.
revoke execute on function
  app.flight_today(),
  app.check_flight_figures(text, date, numeric, integer, integer, numeric, integer, boolean),
  app.check_after_baseline(uuid, date),
  app.check_may_log_flight(uuid),
  app.check_engineer_for_flights(uuid, text, text)
from public, anon, authenticated;
