-- =============================================================================
-- Nexus MRO · Phase 0 · 0005 Organisation
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * department: Engineering, Operations, Supply, Procurement (the four
--     working departments, D-010) plus Quality and Command (oversight).
--   * engineering_section: Line, Base, Tire Bay, Battery Workshop, AGE (D-018).
--   * appointment: a post such as "Commander" or "Engineering CO". Super Admin
--     rights belong to the APPOINTMENT, not the person (D-036), so when the
--     post changes hands, the rights move with it.
--   * appointment_holder: who holds the post, from when to when (handover is
--     recorded).
--   * appointment_deputy: an acting deputy with time-limited authority (D-036).
--
-- Names shown on screen can be changed by the operator (D-025); the short
-- codes (ENG, OPS, ...) stay fixed because the rules use them.
-- =============================================================================

create table public.department (
  code        text primary key check (code ~ '^[A-Z]{3}$'),
  name        text not null,
  kind        text not null check (kind in ('department', 'oversight')),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz
);
select app.apply_standard_rules('public.department');

insert into public.department (code, name, kind) values
  ('ENG', 'Engineering', 'department'),
  ('OPS', 'Operations',  'department'),
  ('SUP', 'Supply',      'department'),
  ('PRO', 'Procurement', 'department'),
  ('QUA', 'Quality',     'oversight'),
  ('CMD', 'Command',     'oversight');

create table public.engineering_section (
  code        text primary key check (code ~ '^[A-Z]{3,4}$'),
  name        text not null,
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz
);
select app.apply_standard_rules('public.engineering_section');

insert into public.engineering_section (code, name) values
  ('LINE', 'Line maintenance'),
  ('BASE', 'Base maintenance'),
  ('TIRE', 'Tire Bay'),
  ('BATT', 'Battery Workshop'),
  ('AGE',  'Aerospace Ground Equipment');

create table public.appointment (
  id                          uuid primary key default gen_random_uuid(),
  title                       text not null unique,
  department_code             text references public.department (code),
  -- Super Admin reach (D-035): none, own department, or all departments.
  super_admin_scope           text not null default 'none'
                                check (super_admin_scope in ('none', 'department', 'all')),
  -- CO / ECO approve certifying authorizations (D-032).
  can_approve_authorizations  boolean not null default false,
  created_at                  timestamptz not null default now(),
  created_by                  uuid,
  device_time                 timestamptz,
  constraint dept_scope_needs_department check (
    super_admin_scope <> 'department' or department_code is not null)
);
comment on table public.appointment is 'A post. Super Admin rights attach to the post, not the person (D-036).';
select app.apply_standard_rules('public.appointment');

create table public.appointment_holder (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references public.appointment (id),
  person_id        uuid not null references public.person (id),
  held_from        timestamptz not null default now(),
  held_to          timestamptz,                -- null = holds it now
  handed_over_by   uuid references public.person (id),
  reason           text not null check (length(trim(reason)) > 0),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz,
  constraint holding_period check (held_to is null or held_to > held_from)
);
comment on table public.appointment_holder is 'Who holds each appointment, with handover recorded (D-036).';
-- Only one current holder per appointment.
create unique index appointment_one_current_holder
  on public.appointment_holder (appointment_id) where held_to is null;
select app.apply_standard_rules('public.appointment_holder');

create table public.appointment_deputy (
  id                uuid primary key default gen_random_uuid(),
  appointment_id    uuid not null references public.appointment (id),
  deputy_person_id  uuid not null references public.person (id),
  valid_from        timestamptz not null,
  valid_to          timestamptz not null,
  granted_by        uuid not null references public.person (id),
  reason            text not null check (length(trim(reason)) > 0),
  revoked_at        timestamptz,
  revoked_by        uuid references public.person (id),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  device_time       timestamptz,
  constraint deputy_period check (valid_to > valid_from),
  constraint deputy_not_self_granted check (deputy_person_id <> granted_by)   -- D-033
);
comment on table public.appointment_deputy is 'Acting deputy with time-limited authority (D-036).';
select app.apply_standard_rules('public.appointment_deputy');

-- -----------------------------------------------------------------------------
-- The appointments the signed-in person holds right now, either as holder or
-- as an acting deputy inside the deputy period.
-- -----------------------------------------------------------------------------
create or replace function app.my_active_appointments()
returns setof public.appointment
language sql
stable
security definer
set search_path = ''
as $$
  select a.*
    from public.appointment a
   where exists (select 1 from public.appointment_holder h
                  where h.appointment_id = a.id
                    and h.person_id = app.current_person_id()
                    and h.held_from <= now()
                    and (h.held_to is null or h.held_to > now()))
      or exists (select 1 from public.appointment_deputy d
                  where d.appointment_id = a.id
                    and d.deputy_person_id = app.current_person_id()
                    and d.revoked_at is null
                    and now() >= d.valid_from and now() < d.valid_to);
$$;

-- Is the signed-in person a Super Admin for this department? (D-035)
-- With no department given: are they a Super Admin for any department?
create or replace function app.is_super_admin(p_department text default null)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from app.my_active_appointments() a
     where a.super_admin_scope = 'all'
        or (a.super_admin_scope = 'department'
            and (p_department is null or a.department_code = p_department)));
$$;

-- Super Admin across all departments (the Commander / CEO, D-035).
create or replace function app.is_global_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from app.my_active_appointments() a
                  where a.super_admin_scope = 'all');
$$;

-- Holds a post that approves certifying authorizations (CO / ECO, D-032).
create or replace function app.can_approve_authorizations()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from app.my_active_appointments() a
                  where a.can_approve_authorizations);
$$;
