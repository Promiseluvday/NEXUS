-- =============================================================================
-- Nexus MRO · Phase 1 · 0012 Tail status
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * The status of an aircraft (SVC, SVC · MEL, U/S, AOG, In check) is a
--     DECISION by an engineer, never by the system (D-020, D-046).
--   * Each time an engineer sets a status, a new status event is recorded:
--     who, when, why, and the expected return to service (D-047). Old events
--     are never changed, so the history is complete.
--   * The current status of a tail is simply its newest event.
--   * Pilot reports do NOT change the status. They show as "Snag open" (blue)
--     and "Snag attended" (amber) next to it (D-045, D-200). See 0013.
-- =============================================================================

create table public.tail_status_event (
  id               uuid primary key default gen_random_uuid(),
  aircraft_id      uuid not null references public.aircraft (id),
  status           text not null check (status in ('SVC', 'SVC_MEL', 'US', 'AOG', 'IN_CHECK')),
  reason           text not null check (length(trim(reason)) > 0),
  expected_rts_on  date,              -- expected return to service, entered by Engineering (D-047)
  set_by           uuid not null references public.person (id),
  set_at           timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz
);
comment on table public.tail_status_event is 'Tail status set by an engineer (D-046). Append-only; newest event is current.';
create index tail_status_event_latest on public.tail_status_event (aircraft_id, set_at desc);
create trigger a1_no_update before update on public.tail_status_event
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.tail_status_event');

-- -----------------------------------------------------------------------------
-- Set a tail's status. Engineers only; online (D-104). The person and time
-- come from the sign-in and the server clock, whatever the screen sends.
-- -----------------------------------------------------------------------------
create or replace function app.set_tail_status(
  p_aircraft uuid, p_status text, p_reason text, p_expected_rts date default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
  v_id uuid;
begin
  if v_me is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can set a tail status (D-046).' using errcode = '42501';
  end if;
  if not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if not exists (select 1 from public.aircraft a where a.id = p_aircraft and a.status = 'active') then
    raise exception 'This aircraft is deactivated (D-015).' using errcode = '22023';
  end if;
  insert into public.tail_status_event (aircraft_id, status, reason, expected_rts_on, set_by)
  values (p_aircraft, p_status, p_reason, p_expected_rts, v_me)
  returning id into v_id;
  return v_id;
end;
$$;

-- The current status of every tail the user may see.
create view public.aircraft_current_status
with (security_invoker = true) as
select distinct on (e.aircraft_id)
       e.aircraft_id, e.status, e.reason, e.expected_rts_on, e.set_by, e.set_at
  from public.tail_status_event e
 order by e.aircraft_id, e.set_at desc;

alter table public.tail_status_event enable row level security;
create policy read_in_scope on public.tail_status_event for select to authenticated
  using (app.can_see_aircraft(aircraft_id));
revoke insert, update, delete, truncate on public.tail_status_event from anon, authenticated;
revoke all on public.tail_status_event from anon;
