-- =============================================================================
-- Nexus MRO · Migration 0025 · Users and roles: Super Admin account screens
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (D-030, D-033, D-035, D-121 to D-124,
-- D-127, D-206, D-219):
--   * A Super Admin creates an account: the person, their sign-in (username
--     and a TEMPORARY password), home and extra departments, permissions,
--     aircraft scope, stores and Engineering sections. One step, all or nothing.
--   * A Super Admin changes any of those later, approves or refuses a pending
--     request, deactivates or reactivates an account, and resets a forgotten
--     password to a temporary one.
--   * Every change needs a reason and the Super Admin's own PIN, and goes into
--     the account change log (who, what, from, to, why, when). Never edited.
--   * After a temporary password the user must set their own at next sign-in.
--   * Rules checked here, not only on screen (D-125):
--       - only a Super Admin for the person's home department, or the
--         Commander for everyone (D-035);
--       - nobody changes their own account (D-033);
--       - Quality never gets "View cost" (D-127, checked by the grant rules);
--       - accounts are deactivated, never deleted (D-030).
--   * Certifying privileges are NOT given here: Quality issues them and the
--     CO approves (D-032).
--
-- How sign-ins are made: the functions below write Supabase's own sign-in
-- tables (auth.users, auth.identities) directly, exactly as the sample data
-- does. No extra service is needed. If a future Supabase version changes
-- those tables, the "admin" database tests will fail and show it.
-- =============================================================================

-- ------------------------------------------------------------ must change ---
alter table public.user_account
  add column must_change_password boolean not null default false;
comment on column public.user_account.must_change_password is
  'True after a Super Admin sets a temporary password; the user sets their own at next sign-in (D-219).';

insert into public.operator_setting (key, value, reason) values
  ('auth.min_password_length', '8', 'Minimum password length for new and reset passwords (D-219)');

-- ------------------------------------------------------------- change log ---
create table public.account_event (
  id          uuid primary key default gen_random_uuid(),
  person_id   uuid not null references public.person (id),
  what        text not null,
  from_value  text,
  to_value    text,
  reason      text not null check (length(trim(reason)) > 0),
  done_by     uuid not null references public.person (id),
  done_at     timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz
);
comment on table public.account_event is 'Account change log: who, what, from, to, why, when (D-033, D-123). Never edited.';
create trigger a1_no_update before update on public.account_event
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.account_event');

alter table public.account_event enable row level security;
-- The person sees their own log; Super Admins and oversight see all (D-126).
create policy read_own_or_admin on public.account_event for select to authenticated
  using (person_id = app.current_person_id() or app.is_super_admin() or app.is_oversight());
revoke insert, update, delete, truncate on public.account_event from anon, authenticated;
revoke all on public.account_event from anon;

-- --------------------------------------------------------------- helpers ---
-- The department whose Super Admin looks after this person: their home
-- department, or for a pending request the department they asked for.
create or replace function app.person_admin_department(p_person uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select coalesce(
    (select g.department_code from public.access_grant g
      where g.person_id = p_person and g.grant_type = 'department' and g.is_home and g.revoked_at is null
      limit 1),
    (select a.requested_department from public.user_account a where a.person_id = p_person));
$$;

-- Departments the signed-in person is Super Admin for ('*' = all, D-035).
create or replace function app.my_admin_departments()
returns text[]
language sql stable security definer set search_path = ''
as $$
  select case when app.is_global_super_admin() then array['*']
              else coalesce(array_agg(distinct a.department_code) filter (where a.super_admin_scope = 'department'), '{}')
         end
    from app.my_active_appointments() a;
$$;

-- May I administer this person? Raises a plain-English refusal if not.
create or replace function app.admin_check(p_person uuid, p_reason text, p_pin text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me   uuid := app.current_person_id();
  v_dept text;
begin
  if v_me is null or not app.is_super_admin() then
    raise exception 'Only a Super Admin can manage accounts (D-123).' using errcode = '42501';
  end if;
  if p_person = v_me then
    raise exception 'Nobody can change their own account (D-033).' using errcode = '42501';
  end if;
  v_dept := app.person_admin_department(p_person);
  if not (app.is_global_super_admin() or (v_dept is not null and app.is_super_admin(v_dept))) then
    raise exception 'Only a Super Admin for % (or the Commander) can change this account (D-035).',
      coalesce(v_dept, 'this person''s department') using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for the change (D-033).' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28000';
  end if;
  return v_me;
end;
$$;

create or replace function app.check_new_password(p_password text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_min integer := coalesce((app.setting('auth.min_password_length'))::integer, 8);
begin
  if length(coalesce(p_password, '')) < v_min then
    raise exception 'A password needs at least % characters.', v_min using errcode = '22023';
  end if;
end;
$$;

-- One line describing a person's current grants of one kind, for the log
-- and the screens. Categories: departments, permissions, sections, scope, stores.
create or replace function app.access_summary(p_person uuid, p_category text)
returns text
language sql stable security definer set search_path = ''
as $$
  select case p_category
    when 'departments' then (
      select string_agg(d.name || case when g.is_home then ' (home)' else '' end, ', ' order by g.is_home desc, d.name)
        from public.access_grant g join public.department d on d.code = g.department_code
       where g.person_id = p_person and g.grant_type = 'department' and g.revoked_at is null)
    when 'permissions' then (
      select string_agg(p.name, ', ' order by p.name)
        from public.access_grant g join public.permission p on p.code = g.permission_code
       where g.person_id = p_person and g.grant_type = 'permission' and g.revoked_at is null)
    when 'sections' then (
      select string_agg(s.name, ', ' order by s.name)
        from public.access_grant g join public.engineering_section s on s.code = g.section_code
       where g.person_id = p_person and g.grant_type = 'section' and g.revoked_at is null)
    when 'scope' then coalesce(
      (select 'All aircraft' from public.access_grant g
        where g.person_id = p_person and g.grant_type = 'all_aircraft' and g.revoked_at is null limit 1),
      (select string_agg(x, ', ' order by x) from (
         select g.aircraft_type_code || ' (type)' as x from public.access_grant g
          where g.person_id = p_person and g.grant_type = 'aircraft_type' and g.revoked_at is null
         union all
         select a.tail from public.access_grant g join public.aircraft a on a.id = g.aircraft_id
          where g.person_id = p_person and g.grant_type = 'aircraft' and g.revoked_at is null) t))
    when 'stores' then (
      select string_agg(s.name, ', ' order by s.name)
        from public.access_grant g join public.store s on s.code = g.store_code
       where g.person_id = p_person and g.grant_type = 'store' and g.revoked_at is null)
  end;
$$;

-- Make one category of a person's grants match the wanted list: revoke what
-- is no longer wanted, grant what is new. Grants are never edited (D-023).
-- p_values:
--   departments  {"home":"ENG","extra":["OPS"]}
--   permissions  ["VIEW_COST", ...]      sections ["LINE", ...]   stores ["MAIN", ...]
--   scope        {"kind":"all"} | {"kind":"types","types":["G550"]} | {"kind":"tails","tails":["<aircraft id>"]}
create or replace function app.apply_access(p_person uuid, p_category text, p_values jsonb, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me    uuid := app.current_person_id();
  v_home  text;
  v_list  text[];
  v_kind  text;
  r       record;
begin
  if p_category = 'departments' then
    v_home := p_values ->> 'home';
    if v_home is null or not exists (select 1 from public.department where code = v_home) then
      raise exception 'Choose a home department (D-124).' using errcode = '22023';
    end if;
    v_list := array(select distinct x from jsonb_array_elements_text(coalesce(p_values -> 'extra', '[]')) x where x <> v_home);
    -- Revoke grants that no longer match (a home that moves is revoked first).
    update public.access_grant g set revoked_at = now(), revoked_by = v_me, revoke_reason = p_reason
     where g.person_id = p_person and g.grant_type = 'department' and g.revoked_at is null
       and not ((g.is_home and g.department_code = v_home)
                or (not g.is_home and g.department_code = any (v_list)));
    if not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'department'
                    and g.is_home and g.revoked_at is null) then
      insert into public.access_grant (person_id, grant_type, department_code, is_home, reason, granted_by)
      values (p_person, 'department', v_home, true, p_reason, v_me);
    end if;
    insert into public.access_grant (person_id, grant_type, department_code, is_home, reason, granted_by)
    select p_person, 'department', d, false, p_reason, v_me from unnest(v_list) d
     where not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'department'
                        and g.department_code = d and g.revoked_at is null);

  elsif p_category in ('permissions', 'sections', 'stores') then
    v_list := array(select distinct x from jsonb_array_elements_text(coalesce(p_values, '[]')) x);
    if p_category = 'permissions' then
      update public.access_grant g set revoked_at = now(), revoked_by = v_me, revoke_reason = p_reason
       where g.person_id = p_person and g.grant_type = 'permission' and g.revoked_at is null and not g.permission_code = any (v_list);
      insert into public.access_grant (person_id, grant_type, permission_code, reason, granted_by)
      select p_person, 'permission', x, p_reason, v_me from unnest(v_list) x
       where not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'permission'
                          and g.permission_code = x and g.revoked_at is null);
    elsif p_category = 'sections' then
      update public.access_grant g set revoked_at = now(), revoked_by = v_me, revoke_reason = p_reason
       where g.person_id = p_person and g.grant_type = 'section' and g.revoked_at is null and not g.section_code = any (v_list);
      insert into public.access_grant (person_id, grant_type, section_code, reason, granted_by)
      select p_person, 'section', x, p_reason, v_me from unnest(v_list) x
       where not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'section'
                          and g.section_code = x and g.revoked_at is null);
    else
      update public.access_grant g set revoked_at = now(), revoked_by = v_me, revoke_reason = p_reason
       where g.person_id = p_person and g.grant_type = 'store' and g.revoked_at is null and not g.store_code = any (v_list);
      insert into public.access_grant (person_id, grant_type, store_code, reason, granted_by)
      select p_person, 'store', x, p_reason, v_me from unnest(v_list) x
       where not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'store'
                          and g.store_code = x and g.revoked_at is null);
    end if;

  elsif p_category = 'scope' then
    v_kind := coalesce(p_values ->> 'kind', 'none');
    -- Scope is replaced as a whole: revoke every scope grant that differs.
    for r in select g.* from public.access_grant g
              where g.person_id = p_person and g.revoked_at is null
                and g.grant_type in ('all_aircraft', 'aircraft_type', 'aircraft') loop
      if not ((v_kind = 'all' and r.grant_type = 'all_aircraft')
              or (v_kind = 'types' and r.grant_type = 'aircraft_type'
                  and r.aircraft_type_code in (select jsonb_array_elements_text(p_values -> 'types')))
              or (v_kind = 'tails' and r.grant_type = 'aircraft'
                  and r.aircraft_id::text in (select jsonb_array_elements_text(p_values -> 'tails')))) then
        update public.access_grant set revoked_at = now(), revoked_by = v_me, revoke_reason = p_reason where id = r.id;
      end if;
    end loop;
    if v_kind = 'all' then
      insert into public.access_grant (person_id, grant_type, reason, granted_by)
      select p_person, 'all_aircraft', p_reason, v_me
       where not exists (select 1 from public.access_grant g where g.person_id = p_person
                          and g.grant_type = 'all_aircraft' and g.revoked_at is null);
    elsif v_kind = 'types' then
      insert into public.access_grant (person_id, grant_type, aircraft_type_code, reason, granted_by)
      select p_person, 'aircraft_type', t, p_reason, v_me from (select distinct jsonb_array_elements_text(p_values -> 'types') t) x
       where not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'aircraft_type'
                          and g.aircraft_type_code = x.t and g.revoked_at is null);
    elsif v_kind = 'tails' then
      insert into public.access_grant (person_id, grant_type, aircraft_id, reason, granted_by)
      select p_person, 'aircraft', t::uuid, p_reason, v_me from (select distinct jsonb_array_elements_text(p_values -> 'tails') t) x
       where not exists (select 1 from public.access_grant g where g.person_id = p_person and g.grant_type = 'aircraft'
                          and g.aircraft_id = x.t::uuid and g.revoked_at is null);
    elsif v_kind <> 'none' then
      raise exception 'Unknown aircraft scope %.', v_kind using errcode = '22023';
    end if;
  else
    raise exception 'Unknown access category %.', p_category using errcode = '22023';
  end if;
end;
$$;

-- --------------------------------------------------------- create account ---
create or replace function app.admin_create_account(
  p_full_name text, p_rank_or_title text, p_three_letter_code text, p_username text,
  p_temporary_password text, p_access jsonb, p_reason text, p_pin text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me     uuid := app.current_person_id();
  v_home   text := p_access #>> '{departments,home}';
  v_user   uuid := gen_random_uuid();
  v_person uuid;
  v_email  text;
  v_cat    text;
begin
  if v_me is null or not (app.is_global_super_admin() or (v_home is not null and app.is_super_admin(v_home))) then
    raise exception 'Only a Super Admin for % (or the Commander) can create this account (D-035, D-123).',
      coalesce(v_home, 'the home department') using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason (D-033).' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28000';
  end if;
  if lower(coalesce(p_username, '')) !~ '^[a-z0-9][a-z0-9._-]{2,31}$' then
    raise exception 'A username is 3 to 32 letters, numbers, dots, dashes or underscores.' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_account where username = lower(p_username)) then
    raise exception 'The username % is already taken.', lower(p_username) using errcode = '23505';
  end if;
  if exists (select 1 from public.person where three_letter_code = upper(p_three_letter_code)) then
    raise exception 'The 3LC % is already used (D-162).', upper(p_three_letter_code) using errcode = '23505';
  end if;
  perform app.check_new_password(p_temporary_password);

  v_email := lower(p_username) || '@' || coalesce(app.setting('auth.username_email_domain') #>> '{}', 'users.nexus.local');
  if exists (select 1 from auth.users where email = v_email) then
    raise exception 'A sign-in already exists for %.', lower(p_username) using errcode = '23505';
  end if;

  -- The sign-in (same shape as the sample data's sign-ins).
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_user, 'authenticated', 'authenticated', v_email,
          extensions.crypt(p_temporary_password, extensions.gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
  values (gen_random_uuid(), v_user, v_user::text,
          jsonb_build_object('sub', v_user::text, 'email', v_email, 'email_verified', true), 'email', now(), now());

  insert into public.person (full_name, rank_or_title, three_letter_code)
  values (trim(p_full_name), nullif(trim(coalesce(p_rank_or_title, '')), ''), upper(p_three_letter_code))
  returning id into v_person;

  insert into public.user_account (id, person_id, status, username, activated_at, activated_by, must_change_password)
  values (v_user, v_person, 'active', lower(p_username), now(), v_me, true);

  foreach v_cat in array array['departments', 'permissions', 'sections', 'scope', 'stores'] loop
    if p_access ? v_cat then
      perform app.apply_access(v_person, v_cat, p_access -> v_cat, p_reason);
    end if;
  end loop;

  insert into public.account_event (person_id, what, to_value, reason, done_by)
  values (v_person, 'Account created',
          concat_ws(' · ', app.access_summary(v_person, 'departments'), app.access_summary(v_person, 'scope')),
          p_reason, v_me);
  return v_person;
end;
$$;

-- --------------------------------------------------------- change access ---
create or replace function app.admin_set_access(
  p_person uuid, p_category text, p_values jsonb, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me     uuid := app.admin_check(p_person, p_reason, p_pin);
  v_before text := app.access_summary(p_person, p_category);
  v_after  text;
begin
  -- Moving someone's home department to another department needs reach over
  -- the new one too.
  if p_category = 'departments' and not (app.is_global_super_admin() or app.is_super_admin(p_values ->> 'home')) then
    raise exception 'Only a Super Admin for % (or the Commander) can make it the home department (D-035).',
      p_values ->> 'home' using errcode = '42501';
  end if;
  perform app.apply_access(p_person, p_category, p_values, p_reason);
  v_after := app.access_summary(p_person, p_category);
  if v_before is distinct from v_after then
    insert into public.account_event (person_id, what, from_value, to_value, reason, done_by)
    values (p_person, case p_category when 'departments' then 'Departments' when 'permissions' then 'Permissions'
                                      when 'sections' then 'Engineering sections' when 'scope' then 'Aircraft scope'
                                      else 'Store access' end,
            coalesce(v_before, 'None'), coalesce(v_after, 'None'), p_reason, v_me);
  end if;
end;
$$;

-- ---------------------------------------------- approve, refuse, (de)activate
-- p_status: 'active' (approve a request, or reactivate) or 'deactivated'
-- (refuse a request, or deactivate). Approving a request with no home
-- department gives the department the person asked for.
create or replace function app.admin_set_status(p_person uuid, p_status text, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := app.admin_check(p_person, p_reason, p_pin);
  v_acc public.user_account;
begin
  select * into v_acc from public.user_account where person_id = p_person for update;
  if not found then
    raise exception 'This person has no sign-in account.' using errcode = 'P0002';
  end if;
  if p_status not in ('active', 'deactivated') then
    raise exception 'Unknown account status %.', p_status using errcode = '22023';
  end if;
  if v_acc.status = p_status then
    raise exception 'The account is already %.', p_status using errcode = 'P0001';
  end if;
  update public.user_account
     set status = p_status,
         deactivation_reason = case when p_status = 'deactivated' then p_reason else deactivation_reason end
   where person_id = p_person;
  if p_status = 'active' and v_acc.requested_department is not null
     and app.access_summary(p_person, 'departments') is null then
    perform app.apply_access(p_person, 'departments', jsonb_build_object('home', v_acc.requested_department), p_reason);
  end if;
  insert into public.account_event (person_id, what, from_value, to_value, reason, done_by)
  values (p_person,
          case when v_acc.status = 'pending' and p_status = 'active' then 'Request approved'
               when v_acc.status = 'pending' then 'Request refused'
               when p_status = 'active' then 'Account reactivated' else 'Account deactivated' end,
          initcap(v_acc.status), initcap(p_status), p_reason, v_me);
end;
$$;

-- ---------------------------------------------------------- reset password ---
create or replace function app.admin_reset_password(p_person uuid, p_temporary_password text, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := app.admin_check(p_person, p_reason, p_pin);
  v_uid uuid;
begin
  perform app.check_new_password(p_temporary_password);
  select id into v_uid from public.user_account where person_id = p_person;
  if v_uid is null then
    raise exception 'This person has no sign-in account.' using errcode = 'P0002';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_temporary_password, extensions.gen_salt('bf')),
                        updated_at = now()
   where id = v_uid;
  update public.user_account set must_change_password = true where person_id = p_person;
  -- The password itself is never logged.
  insert into public.account_event (person_id, what, to_value, reason, done_by)
  values (p_person, 'Temporary password set', 'Must change at next sign-in', p_reason, v_me);
end;
$$;

-- ------------------------------------------------ the user's own password ---
-- After a temporary password: the user sets their own (D-219).
create or replace function app.set_my_password(p_new_password text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_person uuid := app.current_person_id();
begin
  if v_person is null then
    raise exception 'Only an active, signed-in user can change their password.' using errcode = '42501';
  end if;
  perform app.check_new_password(p_new_password);
  if exists (select 1 from auth.users u where u.id = auth.uid()
              and u.encrypted_password = extensions.crypt(p_new_password, u.encrypted_password)) then
    raise exception 'Choose a password different from the temporary one.' using errcode = '22023';
  end if;
  update auth.users set encrypted_password = extensions.crypt(p_new_password, extensions.gen_salt('bf')),
                        updated_at = now()
   where id = auth.uid();
  update public.user_account set must_change_password = false where id = auth.uid();
  insert into public.account_event (person_id, what, reason, done_by)
  values (v_person, 'Password changed by the user', 'Own password set', v_person);
end;
$$;

-- --------------------------------------------------------------- the list ---
-- People a Super Admin looks after (the Commander: everyone), pending first.
create or replace function app.admin_people()
returns table (
  person_id uuid, full_name text, rank_or_title text, three_letter_code text, username text,
  status text, home_department text, departments text, permissions text, scope text,
  requested_department text, must_change_password boolean, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name, p.rank_or_title, p.three_letter_code, a.username,
         coalesce(a.status, 'no sign-in'), app.person_admin_department(p.id),
         app.access_summary(p.id, 'departments'), app.access_summary(p.id, 'permissions'),
         app.access_summary(p.id, 'scope'), a.requested_department, coalesce(a.must_change_password, false), p.created_at
    from public.person p
    join public.user_account a on a.person_id = p.id
   where app.is_super_admin()
     and (app.is_global_super_admin() or app.is_super_admin(app.person_admin_department(p.id)))
   order by (a.status = 'pending') desc, p.full_name;
$$;

-- Does the signed-in user have to set their own password now?
create or replace function app.my_must_change_password()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select a.must_change_password from public.user_account a where a.id = auth.uid()), false);
$$;

-- Everything a Super Admin can choose from when setting access.
create or replace function app.admin_options()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select case when not app.is_super_admin() then null else jsonb_build_object(
    'departments', (select jsonb_agg(jsonb_build_object('code', d.code, 'name', d.name, 'kind', d.kind) order by d.code) from public.department d),
    'permissions', (select jsonb_agg(jsonb_build_object('code', p.code, 'name', p.name, 'department', p.department_code) order by p.department_code nulls first, p.name) from public.permission p),
    'sections', (select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.code) from public.engineering_section s),
    'types', (select jsonb_agg(jsonb_build_object('code', t.code, 'name', t.name) order by t.code) from public.aircraft_type t),
    'aircraft', (select jsonb_agg(jsonb_build_object('id', a.id, 'tail', a.tail, 'type', a.aircraft_type_code) order by a.tail)
                   from public.aircraft a where a.status = 'active'),
    'stores', (select jsonb_agg(jsonb_build_object('code', s.code, 'name', s.name) order by s.code) from public.store s),
    'mine', to_jsonb(app.my_admin_departments()))
  end;
$$;

-- ---------------------------------------------------------------- access ---
grant execute on function
  app.my_admin_departments(),
  app.admin_options(),
  app.admin_create_account(text, text, text, text, text, jsonb, text, text),
  app.admin_set_access(uuid, text, jsonb, text, text),
  app.admin_set_status(uuid, text, text, text),
  app.admin_reset_password(uuid, text, text, text),
  app.set_my_password(text),
  app.admin_people(),
  app.my_must_change_password()
to authenticated;
-- Internal steps: only reachable through the functions above.
revoke execute on function app.admin_check(uuid, text, text), app.apply_access(uuid, text, jsonb, text),
  app.person_admin_department(uuid), app.check_new_password(text), app.access_summary(uuid, text)
  from public, anon, authenticated;
