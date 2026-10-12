-- =============================================================================
-- Nexus MRO · Migration 0034 · "Rectified" notices for Quality and the CO
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (Promise, 12 Oct):
--   When a snag's rectification is certified, Quality and the CO are told,
--   and each acknowledges it.
--     * A notice is raised the moment a work order is CERTIFIED (rectified,
--       no fault found, DDLS / MEL cleared; online or offline-signed), or a
--       NADD is rectified directly without a work order (e.g. fixed at
--       another MRO). One certification = one notice.
--     * Who is told: the steps of the work order approval chain at that
--       moment (by default Quality, then the CO), so the people who approved
--       the work see it closed. Only people who may see the aircraft.
--     * Each step acknowledges once: the first Quality person to acknowledge
--       covers Quality; the CO covers the CO. Who and when is kept.
--     * Acknowledging records that it was seen. It approves nothing and
--       blocks nothing: the certifying engineer's signature is the release
--       (D-020, D-063). Append-only (D-023).
-- =============================================================================

create table public.notification (
  id            uuid primary key default gen_random_uuid(),
  kind          text not null check (kind in ('rectified')),
  aircraft_id   uuid not null references public.aircraft (id),
  record_table  text not null check (record_table in ('work_order', 'nadd')),
  record_id     uuid not null,
  snag_id       uuid references public.snag (id),
  title         text not null,
  body          text not null,
  created_at    timestamptz not null default now(),
  created_by    uuid,
  device_time   timestamptz
);
comment on table public.notification is 'Notices that need an acknowledgement (12 Oct: rectification certified). Append-only.';

-- Who must acknowledge: copied from the approval chain when the notice is raised.
create table public.notification_target (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notification (id),
  step_no         integer not null,
  name            text not null,                 -- e.g. "Quality pre-approval"
  department_code text references public.department (code),
  appointment_id  uuid references public.appointment (id),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz,
  check (department_code is not null or appointment_id is not null),
  unique (notification_id, step_no)
);

create table public.notification_ack (
  id              uuid primary key default gen_random_uuid(),
  target_id       uuid not null unique references public.notification_target (id),
  acknowledged_by uuid not null references public.person (id),
  note            text,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz
);

do $$
declare t text;
begin
  foreach t in array array['notification', 'notification_target', 'notification_ack'] loop
    execute format('create trigger a1_no_update before update on public.%I for each row execute function app.forbid_update()', t);
    perform app.apply_standard_rules('public.' || t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Does the signed-in person hold this department or appointment?
create or replace function app.holds_target(p_department text, p_appointment uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select (p_department is not null and app.has_department(p_department))
      or (p_appointment is not null and exists (select 1 from app.my_active_appointments() a where a.id = p_appointment));
$$;

-- Read: the people told, for aircraft they may see. (A function, so the
-- three tables' rules don't loop through each other.)
create or replace function app.can_see_notice(p_notification uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.notification n
     where n.id = p_notification and app.can_see_aircraft(n.aircraft_id)
       and exists (select 1 from public.notification_target t
                    where t.notification_id = n.id and app.holds_target(t.department_code, t.appointment_id)));
$$;
create policy read_mine on public.notification for select to authenticated
  using (app.can_see_notice(id));
create policy read_with_notice on public.notification_target for select to authenticated
  using (app.can_see_notice(notification_id));
create policy read_with_target on public.notification_ack for select to authenticated
  using (exists (select 1 from public.notification_target t where t.id = notification_ack.target_id));

-- ------------------------------------------------------------ raising -----
create or replace function app.raise_rectified_notice(
  p_aircraft uuid, p_table text, p_record uuid, p_snag uuid, p_title text, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.notification (kind, aircraft_id, record_table, record_id, snag_id, title, body)
  values ('rectified', p_aircraft, p_table, p_record, p_snag, p_title, p_body)
  returning id into v_id;
  insert into public.notification_target (notification_id, step_no, name, department_code, appointment_id)
  select v_id, s.step_no, s.name, s.department_code, s.appointment_id
    from public.approval_chain_step s
   where s.action_type = 'work_order'
   order by s.step_no;
  return v_id;
end;
$$;

-- A work order becomes certified.
create or replace function app.notice_on_certify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tail  text;
  v_snag  text;
  v_by    text;
  v_extra text := '';
begin
  if new.status <> 'certified' or old.status = 'certified' then
    return null;
  end if;
  select a.tail into v_tail from public.aircraft a where a.id = new.aircraft_id;
  select s.number into v_snag from public.snag s where s.id = new.snag_id;
  select p.three_letter_code into v_by from public.person p where p.id = new.certified_by;
  -- certify_work_order clears the snag's open DDLS entry / NADD right after
  -- this, with the same signature (D-218).
  if exists (select 1 from public.ddls_entry e where e.snag_id = new.snag_id and e.status = 'open') then
    v_extra := v_extra || ' · DDLS entry cleared';
  end if;
  if exists (select 1 from public.nadd n where n.snag_id = new.snag_id and n.status = 'open') then
    v_extra := v_extra || ' · NADD rectified';
  end if;
  perform app.raise_rectified_notice(
    new.aircraft_id, 'work_order', new.id, new.snag_id,
    v_tail || coalesce(' · ' || v_snag, '') ||
      case when new.certification_note like 'No fault found:%' then ' closed, no fault found' else ' rectified' end,
    app.work_order_label(new.number, new.revision) || ' certified by ' || coalesce(v_by, '?') || ' · '
      || left(coalesce(new.certification_note, ''), 160) || v_extra);
  return null;
end;
$$;
create trigger notice_on_certify after update of status on public.work_order
  for each row execute function app.notice_on_certify();

-- A NADD rectified directly (no work order) raises its own notice.
create or replace function app.notice_on_nadd_rectified()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tail text;
  v_snag text;
  v_by   text;
begin
  if new.status <> 'rectified' or old.status = 'rectified' then
    return null;
  end if;
  -- Rectified by certifying a work order in this same transaction: that
  -- notice already covers it.
  if exists (select 1 from public.work_order w where w.snag_id = new.snag_id and w.status = 'certified'
              and w.certified_at = new.rectified_at) then
    return null;
  end if;
  select a.tail into v_tail from public.aircraft a where a.id = new.aircraft_id;
  select s.number into v_snag from public.snag s where s.id = new.snag_id;
  select p.three_letter_code into v_by from public.person p where p.id = new.rectified_by;
  perform app.raise_rectified_notice(
    new.aircraft_id, 'nadd', new.id, new.snag_id,
    v_tail || ' · ' || new.number || ' rectified',
    new.number || coalesce(' (' || v_snag || ')', '') || ' rectified by ' || coalesce(v_by, '?')
      || ' without a work order · ' || left(coalesce(new.action_taken, ''), 160));
  return null;
end;
$$;
create trigger notice_on_nadd_rectified after update of status on public.nadd
  for each row execute function app.notice_on_nadd_rectified();

-- ------------------------------------------------------------ reading -----
-- Each step of a notice and who acknowledged it.
create or replace function app.notice_steps(p_notification uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'step_no', t.step_no, 'name', t.name,
           'acknowledged_by', p.three_letter_code, 'acknowledged_at', k.created_at, 'note', k.note)
           order by t.step_no), '[]'::jsonb)
    from public.notification_target t
    left join public.notification_ack k on k.target_id = t.id
    left join public.person p on p.id = k.acknowledged_by
   where t.notification_id = p_notification;
$$;

-- My notices: the ones still waiting for a step I hold first, then the
-- acknowledged ones (the most recent p_done_limit).
create or replace function app.my_notices(p_done_limit integer default 20)
returns table (id uuid, kind text, aircraft_id uuid, tail text, record_table text, record_id uuid,
               title text, body text, created_at timestamptz, waiting_for_me boolean, steps jsonb)
language sql
stable
security definer
set search_path = ''
as $$
  with mine as (
    select n.*,
           exists (select 1 from public.notification_target t
                    where t.notification_id = n.id and app.holds_target(t.department_code, t.appointment_id)
                      and not exists (select 1 from public.notification_ack k where k.target_id = t.id)) as waiting
      from public.notification n
     where app.current_person_id() is not null
       and app.can_see_aircraft(n.aircraft_id)
       and exists (select 1 from public.notification_target t
                    where t.notification_id = n.id and app.holds_target(t.department_code, t.appointment_id))),
  ranked as (
    select m.*, row_number() over (partition by m.waiting order by m.created_at desc) as rn from mine m)
  select r.id, r.kind, r.aircraft_id, a.tail, r.record_table, r.record_id, r.title, r.body, r.created_at, r.waiting,
         app.notice_steps(r.id)
    from ranked r join public.aircraft a on a.id = r.aircraft_id
   where r.waiting or r.rn <= greatest(coalesce(p_done_limit, 20), 0)
   order by r.waiting desc, r.created_at desc;
$$;

-- For the work order / NADD page: the acknowledgements of its notice.
create or replace function app.record_notice(p_table text, p_record uuid)
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object('id', n.id, 'created_at', n.created_at, 'steps', app.notice_steps(n.id))
    from public.notification n
   where n.record_table = p_table and n.record_id = p_record
     and app.can_see_aircraft(n.aircraft_id) and (app.has_department('ENG') or app.is_oversight())
   order by n.created_at desc limit 1;
$$;

-- The bell: notices waiting for my acknowledgement.
create or replace function app.my_unacknowledged_count()
returns integer
language sql stable security definer set search_path = ''
as $$ select count(*)::integer from app.my_notices(0) where waiting_for_me; $$;

-- ------------------------------------------------------- acknowledging -----
create or replace function app.acknowledge_notice(p_notification uuid, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me    uuid := app.current_person_id();
  v_count integer;
begin
  if v_me is null or not exists (select 1 from public.notification n
                                  where n.id = p_notification and app.can_see_aircraft(n.aircraft_id)) then
    raise exception 'Notice not found, or not in your view.' using errcode = '42501';
  end if;
  insert into public.notification_ack (target_id, acknowledged_by, note)
  select t.id, v_me, nullif(trim(coalesce(p_note, '')), '')
    from public.notification_target t
   where t.notification_id = p_notification
     and app.holds_target(t.department_code, t.appointment_id)
     and not exists (select 1 from public.notification_ack k where k.target_id = t.id)
  on conflict (target_id) do nothing;
  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'Nothing for you to acknowledge here: it is not addressed to you, or it has already been acknowledged.'
      using errcode = 'P0001';
  end if;
  return v_count;
end;
$$;

grant execute on function
  app.my_notices(integer),
  app.record_notice(text, uuid),
  app.my_unacknowledged_count(),
  app.acknowledge_notice(uuid, text)
to authenticated;
