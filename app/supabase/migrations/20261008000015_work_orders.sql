-- =============================================================================
-- Nexus MRO · Phase 1 · 0015 Work orders (core)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (D-063 to D-069, D-214):
--
--   Snag ATTENDED ─► engineer requests a work order ─► REQUESTED
--        Quality pre-approves ─► PRE-APPROVED
--        CO (or acting deputy) approves ─► OPEN       ← only now can work be recorded
--        engineer marks the work done ─► WORK COMPLETE
--        required scans attached + certifying engineer signs with PIN ─► CERTIFIED
--        (the snag closes at the same moment)
--   A rejection at any step ─► REJECTED, back to the requester with the reason;
--   the snag returns to ATTENDED so another disposition can be chosen.
--
--   * Work order numbers: one fleet-wide series, never reused (D-064).
--   * Which scans are required (sign-off card, tech log page, aircraft or
--     engine logbook) is the operator setting "work_order.required_scans"
--     (D-065, D-069).
--   * Certifying the work order is NOT setting the tail status. The engineer
--     still sets the status separately (D-046).
--   * Reserving and issuing parts arrives with Supply in Phase 3 (D-068).
-- =============================================================================

create table public.work_order (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null unique,
  aircraft_id         uuid not null references public.aircraft (id),
  snag_id             uuid references public.snag (id),
  scope               text not null check (length(trim(scope)) > 0),
  est_man_hours       numeric(6,1) check (est_man_hours is null or est_man_hours >= 0),
  status              text not null default 'requested' check (status in
                        ('requested', 'pre_approved', 'open', 'work_complete', 'certified', 'rejected', 'cancelled')),
  approval_request_id uuid references public.approval_request (id),
  requested_by        uuid not null references public.person (id),
  work_completed_by   uuid references public.person (id),
  work_completed_at   timestamptz,
  certified_by        uuid references public.person (id),
  certified_at        timestamptz,
  certification_note  text,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz
);
comment on table public.work_order is 'Work orders: Quality then CO approval before any work is recorded (D-063).';
select app.apply_standard_rules('public.work_order');

create table public.work_order_entry (
  id            uuid primary key default gen_random_uuid(),
  work_order_id uuid not null references public.work_order (id),
  entry         text not null check (length(trim(entry)) > 0),
  entered_by    uuid not null references public.person (id),
  created_at    timestamptz not null default now(),
  created_by    uuid,
  device_time   timestamptz
);
comment on table public.work_order_entry is 'Progress entries on an OPEN work order. Append-only.';
create trigger a1_no_update before update on public.work_order_entry
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.work_order_entry');

-- -----------------------------------------------------------------------------
-- Request a work order for an attended snag ("Rectify now").
-- -----------------------------------------------------------------------------
create or replace function app.request_work_order(p_snag uuid, p_scope text, p_est_man_hours numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s     public.snag;
  v_wo  uuid;
  v_num text;
begin
  s := app.snag_for_engineer(p_snag, array['attended']);
  v_num := app.next_number('work_order', 'WO-{000000}');
  insert into public.work_order (number, aircraft_id, snag_id, scope, est_man_hours, requested_by)
  values (v_num, s.aircraft_id, s.id, p_scope, p_est_man_hours, app.current_person_id())
  returning id into v_wo;

  update public.work_order
     set approval_request_id = app.raise_approval('work_order', 'work_order', v_wo,
                                                  v_num || ' · ' || s.number || ' · ' || left(p_scope, 80))
   where id = v_wo;

  update public.snag
     set status = 'in_work', disposition = 'rectify_now',
         dispositioned_by = app.current_person_id(), dispositioned_at = now()
   where id = s.id;
  return v_wo;
end;
$$;

-- -----------------------------------------------------------------------------
-- When the approval moves on, the work order follows (D-063, D-079).
-- -----------------------------------------------------------------------------
create or replace function app.work_order_follow_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wo public.work_order;
begin
  if new.action_type <> 'work_order' then
    return null;
  end if;
  select * into v_wo from public.work_order where id = new.record_id;
  if not found then
    return null;
  end if;
  if new.status = 'approved' then
    update public.work_order set status = 'open' where id = v_wo.id;
  elsif new.status = 'rejected' then
    update public.work_order set status = 'rejected' where id = v_wo.id;
    -- Back to the engineer to choose again (the WO stays on record as rejected).
    update public.snag set status = 'attended', disposition = null,
                           dispositioned_by = null, dispositioned_at = null
     where id = v_wo.snag_id and status = 'in_work';
  elsif new.status = 'pending' and new.current_step > 1 then
    update public.work_order set status = 'pre_approved' where id = v_wo.id;
  end if;
  return null;
end;
$$;
create trigger work_order_follow_approval after update on public.approval_request
  for each row execute function app.work_order_follow_approval();

-- Load a work order for an engineer action, with the usual checks.
create or replace function app.work_order_for_engineer(p_wo uuid, p_allowed_status text[])
returns public.work_order
language plpgsql
security definer
set search_path = ''
as $$
declare
  w public.work_order;
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can work on a work order.' using errcode = '42501';
  end if;
  select * into w from public.work_order where id = p_wo for update;
  if not found then
    raise exception 'Work order not found.' using errcode = 'P0002';
  end if;
  if not app.can_see_aircraft(w.aircraft_id) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if not (w.status = any (p_allowed_status)) then
    if w.status in ('requested', 'pre_approved') then
      raise exception 'Work order % is locked until Quality and the CO approve it (D-063).', w.number
        using errcode = 'P0001';
    end if;
    raise exception 'Work order % is %; this action needs %.', w.number, w.status, array_to_string(p_allowed_status, ' or ')
      using errcode = 'P0001';
  end if;
  return w;
end;
$$;

-- Record progress on an OPEN work order.
create or replace function app.add_work_order_entry(p_wo uuid, p_entry text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform app.work_order_for_engineer(p_wo, array['open']);
  insert into public.work_order_entry (work_order_id, entry, entered_by)
  values (p_wo, p_entry, app.current_person_id())
  returning id into v_id;
  return v_id;
end;
$$;

-- Mark the work done; scans are then attached before certification.
create or replace function app.complete_work_order(p_wo uuid, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform app.work_order_for_engineer(p_wo, array['open']);
  insert into public.work_order_entry (work_order_id, entry, entered_by)
  values (p_wo, 'Work complete: ' || p_note, app.current_person_id());
  update public.work_order
     set status = 'work_complete', work_completed_by = app.current_person_id(), work_completed_at = now()
   where id = p_wo;
end;
$$;

-- Which required scans are still missing on this work order? (D-065)
create or replace function app.work_order_missing_scans(p_wo uuid)
returns text[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(k), '{}')
    from jsonb_array_elements_text(coalesce(app.setting('work_order.required_scans'), '["sign_off_card"]')) k
   where not exists (select 1 from public.attachment a
                      where a.record_table = 'work_order' and a.record_id = p_wo
                        and a.kind = k and a.superseded_by is null);
$$;

-- Certify: required scans attached, certifying engineer in scope, PIN (D-043, D-065).
-- Closes the snag. Does not change the tail status (D-046).
create or replace function app.certify_work_order(p_wo uuid, p_pin text, p_note text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  w         public.work_order;
  v_missing text[];
begin
  w := app.work_order_for_engineer(p_wo, array['work_complete']);
  v_missing := app.work_order_missing_scans(p_wo);
  if cardinality(v_missing) > 0 then
    raise exception 'Attach the required scans first: % (D-065).', array_to_string(v_missing, ', ')
      using errcode = 'P0001';
  end if;
  perform app.require_certifying(w.aircraft_id, p_pin);
  update public.work_order
     set status = 'certified', certified_by = app.current_person_id(), certified_at = now(),
         certification_note = p_note
   where id = p_wo;
  update public.snag
     set status = 'closed', closed_by = app.current_person_id(), closed_at = now(),
         closure_note = 'Rectified under ' || w.number || ': ' || p_note
   where id = w.snag_id;
end;
$$;

alter table public.work_order       enable row level security;
alter table public.work_order_entry enable row level security;
create policy read_eng_or_oversight on public.work_order for select to authenticated
  using (app.can_see_aircraft(aircraft_id) and (app.has_department('ENG') or app.is_oversight()));
create policy read_with_work_order on public.work_order_entry for select to authenticated
  using (exists (select 1 from public.work_order w where w.id = work_order_entry.work_order_id));
revoke insert, update, delete, truncate on public.work_order, public.work_order_entry from anon, authenticated;
revoke all on public.work_order, public.work_order_entry from anon;
