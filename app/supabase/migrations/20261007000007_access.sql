-- =============================================================================
-- Nexus MRO · Phase 0 · 0007 Access: who may see and do what
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   A person's access is made of GRANTS. Each grant gives one thing:
--     * a department (one is the "home" department, D-124)
--     * a permission inside a department, e.g. "View cost" (D-121)
--     * an Engineering section, e.g. Tire Bay (D-018)
--     * aircraft scope: all aircraft, one type, or one tail (D-121)
--     * a store: Main or Forward (D-152)
--   A user sees only the overlap of what they hold.
--
--   Rules enforced here, in the database:
--     * Only a Super Admin can grant or revoke (D-123), within their reach
--       (a department CO for their department; the Commander for all, D-035).
--     * Nobody can grant anything to themselves (D-033).
--     * Quality never gets "View cost" (D-127).
--     * Only one home department per person (D-124).
--     * Grants are never edited or deleted. They are revoked (who, when, why)
--       and a new grant is made if needed (D-023).
-- =============================================================================

create table public.permission (
  code            text primary key check (code ~ '^[A-Z_]{3,40}$'),
  name            text not null,
  department_code text references public.department (code),
  description     text,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz
);
comment on table public.permission is 'Things a user can be allowed to do inside a department (D-121). The list grows with the build.';
select app.apply_standard_rules('public.permission');

insert into public.permission (code, name, department_code, description) values
  ('VIEW_COST',            'View cost',                    null,  'See prices, invoices and cost reports (D-077, D-121). Never granted to Quality (D-127).'),
  ('ISSUE_PARTS',          'Issue parts',                  'SUP', 'Issue reserved parts from a store.'),
  ('RECEIVE_PARTS',        'Receive and inspect parts',    'SUP', 'Receiving inspection; mark parts available (D-074).'),
  ('RAISE_REQUISITION',    'Raise requisitions',           'SUP', 'Raise a requisition when stock is short.'),
  ('RAISE_PURCHASE_ORDER', 'Raise purchase orders',        'PRO', 'Source and order after approval.'),
  ('MANAGE_OUTSIDE_MRO',   'Manage outside-MRO jobs',      'PRO', 'Quotes, negotiated cost, parts used by outside MROs (D-144).'),
  ('LOAD_MEL',             'Load MEL revisions',           'QUA', 'Load an approved MEL revision (D-050).'),
  ('SCHEDULING_ACCESS',    'Scheduling (need-to-know)',    'OPS', 'See flight requests and missions; classified (O-14). For Phase 6.');

create table public.access_grant (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references public.person (id),
  grant_type         text not null check (grant_type in
                       ('department', 'permission', 'section', 'all_aircraft',
                        'aircraft_type', 'aircraft', 'store')),
  department_code    text references public.department (code),
  is_home            boolean not null default false,
  permission_code    text references public.permission (code),
  section_code       text references public.engineering_section (code),
  aircraft_type_code text references public.aircraft_type (code),
  aircraft_id        uuid references public.aircraft (id),
  store_code         text references public.store (code),
  reason             text not null check (length(trim(reason)) > 0),
  granted_by         uuid not null references public.person (id),
  granted_at         timestamptz not null default now(),
  revoked_at         timestamptz,
  revoked_by         uuid references public.person (id),
  revoke_reason      text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,

  -- Nobody grants to themselves (D-033).
  constraint no_self_grant check (person_id <> granted_by),

  -- A revocation always says who and why.
  constraint revocation_recorded check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null
        and length(trim(coalesce(revoke_reason, ''))) > 0)),

  -- "Home" only makes sense for a department grant.
  constraint home_only_for_department check (not is_home or grant_type = 'department'),

  -- Each grant names exactly the one thing its type says.
  constraint one_target check (
    case grant_type
      when 'department'    then department_code is not null
                                and num_nonnulls(permission_code, section_code, aircraft_type_code, aircraft_id, store_code) = 0
      when 'permission'    then permission_code is not null
                                and num_nonnulls(department_code, section_code, aircraft_type_code, aircraft_id, store_code) = 0
      when 'section'       then section_code is not null
                                and num_nonnulls(department_code, permission_code, aircraft_type_code, aircraft_id, store_code) = 0
      when 'all_aircraft'  then num_nonnulls(department_code, permission_code, section_code, aircraft_type_code, aircraft_id, store_code) = 0
      when 'aircraft_type' then aircraft_type_code is not null
                                and num_nonnulls(department_code, permission_code, section_code, aircraft_id, store_code) = 0
      when 'aircraft'      then aircraft_id is not null
                                and num_nonnulls(department_code, permission_code, section_code, aircraft_type_code, store_code) = 0
      when 'store'         then store_code is not null
                                and num_nonnulls(department_code, permission_code, section_code, aircraft_type_code, aircraft_id) = 0
    end)
);
comment on table public.access_grant is 'Every right a person holds, who granted it and why. Revoked, never deleted (D-023, D-033, D-121).';

-- One home department per person (D-124).
create unique index access_grant_one_home_department
  on public.access_grant (person_id)
  where grant_type = 'department' and is_home and revoked_at is null;

-- -----------------------------------------------------------------------------
-- Does a given person hold a given department right now?
-- (Used by the rules below and by the "Quality never sees cost" check.)
-- -----------------------------------------------------------------------------
create or replace function app.person_has_department(p_person uuid, p_department text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.access_grant g
                  where g.person_id = p_person and g.grant_type = 'department'
                    and g.department_code = p_department and g.revoked_at is null);
$$;

create or replace function app.person_has_permission(p_person uuid, p_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.access_grant g
                  where g.person_id = p_person and g.grant_type = 'permission'
                    and g.permission_code = p_permission and g.revoked_at is null);
$$;

-- -----------------------------------------------------------------------------
-- Checks run before a grant is saved or changed.
-- -----------------------------------------------------------------------------
create or replace function app.check_access_grant()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me          uuid := app.current_person_id();
  v_signed_in   boolean := auth.uid() is not null;
  v_target_dept text;
begin
  -- Which department's Super Admin may grant this?
  v_target_dept := case new.grant_type
    when 'department' then new.department_code
    when 'permission' then (select p.department_code from public.permission p where p.code = new.permission_code)
    when 'section'    then 'ENG'
    else null          -- aircraft and store scope: any Super Admin
  end;

  if tg_op = 'INSERT' then
    -- Signed-in users: the granter is always the signed-in person, whatever
    -- the screen sent, and must be a Super Admin with reach over the target.
    -- (Set-up scripts run by IT have no sign-in; they must name a granter.)
    if v_signed_in then
      if v_me is null then
        raise exception 'Only an active account can grant access.' using errcode = '42501';
      end if;
      new.granted_by := v_me;
      new.granted_at := now();
      if not app.is_super_admin(v_target_dept) then
        raise exception 'Only a Super Admin for % can grant this (D-123, D-035).',
          coalesce(v_target_dept, 'any department') using errcode = '42501';
      end if;
    end if;

    if new.person_id = new.granted_by then
      raise exception 'Nobody can grant privileges to themselves (D-033).' using errcode = '42501';
    end if;

    -- Quality never sees cost (D-127), in either order of granting.
    if new.grant_type = 'permission' and new.permission_code = 'VIEW_COST'
       and app.person_has_department(new.person_id, 'QUA') then
      raise exception 'Quality users cannot be given "View cost" (D-127).' using errcode = '42501';
    end if;
    if new.grant_type = 'department' and new.department_code = 'QUA'
       and app.person_has_permission(new.person_id, 'VIEW_COST') then
      raise exception 'This person holds "View cost". Revoke it before giving the Quality department (D-127).'
        using errcode = '42501';
    end if;

    new.revoked_at := null; new.revoked_by := null; new.revoke_reason := null;
    return new;
  end if;

  -- UPDATE: the only change ever allowed is a revocation.
  if (to_jsonb(new) - array['revoked_at', 'revoked_by', 'revoke_reason', 'created_at', 'created_by'])
     is distinct from
     (to_jsonb(old) - array['revoked_at', 'revoked_by', 'revoke_reason', 'created_at', 'created_by']) then
    raise exception 'Grants are never edited. Revoke it and make a new grant (D-023).' using errcode = 'P0001';
  end if;
  if old.revoked_at is not null then
    raise exception 'This grant is already revoked; revocations cannot be undone or changed (D-023).' using errcode = 'P0001';
  end if;
  if new.revoked_at is null and new.revoke_reason is null then
    return new;  -- nothing changed
  end if;
  if v_signed_in then
    if v_me is null or not app.is_super_admin(v_target_dept) then
      raise exception 'Only a Super Admin for % can revoke this (D-123).',
        coalesce(v_target_dept, 'any department') using errcode = '42501';
    end if;
    new.revoked_by := v_me;
    new.revoked_at := now();
  end if;
  return new;
end;
$$;

create trigger a0_check_grant before insert or update on public.access_grant
  for each row execute function app.check_access_grant();

select app.apply_standard_rules('public.access_grant');

-- -----------------------------------------------------------------------------
-- Questions the rest of Nexus asks about the signed-in person.
-- -----------------------------------------------------------------------------
create or replace function app.has_department(p_department text)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.person_has_department(app.current_person_id(), p_department); $$;

create or replace function app.has_permission(p_permission text)
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.person_has_permission(app.current_person_id(), p_permission); $$;

-- Command or Quality: read-only view across all departments (D-122, D-127).
create or replace function app.is_oversight()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.has_department('CMD') or app.has_department('QUA'); $$;

-- Cost is visible to Command, and to users granted "View cost" (D-077, D-121, D-122, D-127).
create or replace function app.can_view_cost()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.has_department('CMD') or app.has_permission('VIEW_COST'); $$;

-- May the signed-in person see this aircraft? (aircraft scope, D-121)
create or replace function app.can_see_aircraft(p_aircraft uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_oversight()
      or app.is_super_admin()
      or exists (
        select 1
          from public.access_grant g
          join public.aircraft a on a.id = p_aircraft
         where g.person_id = app.current_person_id()
           and g.revoked_at is null
           and (g.grant_type = 'all_aircraft'
                or (g.grant_type = 'aircraft_type' and g.aircraft_type_code = a.aircraft_type_code)
                or (g.grant_type = 'aircraft' and g.aircraft_id = a.id)));
$$;

-- May the signed-in person see this store? (store scope, D-152)
create or replace function app.can_see_store(p_store text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.is_oversight()
      or exists (select 1 from public.access_grant g
                  where g.person_id = app.current_person_id()
                    and g.revoked_at is null
                    and g.grant_type = 'store' and g.store_code = p_store);
$$;

-- May the signed-in person use this Engineering section? (D-018)
create or replace function app.has_section(p_section text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.access_grant g
                  where g.person_id = app.current_person_id()
                    and g.revoked_at is null
                    and g.grant_type = 'section' and g.section_code = p_section);
$$;
