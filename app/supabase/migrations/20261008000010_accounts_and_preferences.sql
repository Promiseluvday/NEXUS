-- =============================================================================
-- Nexus MRO · Phase 1 · 0010 Accounts and preferences
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * Username sign-in (D-206). Every account can have a username. People who
--     have no email sign in with their username; behind the scenes Supabase
--     stores them as "<username>@<operator domain>", a made-up address that is
--     never emailed. The domain is a setting (auth.username_email_domain).
--     No service number is needed.
--   * Account requests (D-206, D-123). A new person signs up, then asks for an
--     account and a department. It stays PENDING (no rights at all) until a
--     Super Admin approves it. Approving or deactivating automatically records
--     who did it and when.
--   * First sign-in PIN (D-206): the app asks "has this user set a PIN?" and
--     sends them to PIN set-up if not.
--   * User preferences (D-210): each user's saved list columns and filters.
--     Only the user can see or change their own.
-- =============================================================================

alter table public.user_account
  add column username text unique
    check (username ~ '^[a-z0-9][a-z0-9._-]{2,31}$');
comment on column public.user_account.username is 'Sign-in name (D-206). Lower case, 3 to 32 characters.';

-- -----------------------------------------------------------------------------
-- A newly signed-up person asks for an account (D-206, D-123).
-- Creates their person record and a PENDING account. No rights until approved.
-- -----------------------------------------------------------------------------
create or replace function app.request_account(
  p_full_name text, p_username text, p_three_letter_code text,
  p_requested_department text, p_rank_or_title text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_person uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign up first, then request an account.' using errcode = '42501';
  end if;
  if exists (select 1 from public.user_account where id = auth.uid()) then
    raise exception 'An account request already exists for this sign-in.' using errcode = '23505';
  end if;
  if not exists (select 1 from public.department where code = p_requested_department) then
    raise exception 'Unknown department %.', p_requested_department using errcode = '22023';
  end if;

  insert into public.person (full_name, rank_or_title, three_letter_code)
  values (p_full_name, p_rank_or_title, upper(p_three_letter_code))
  returning id into v_person;

  insert into public.user_account (id, person_id, status, username, requested_department)
  values (auth.uid(), v_person, 'pending', lower(p_username), p_requested_department);

  return v_person;
end;
$$;

-- -----------------------------------------------------------------------------
-- Approving, activating and deactivating accounts: the database fills in who
-- and when, and checks the approver may do it (D-030, D-033, D-123).
-- -----------------------------------------------------------------------------
create or replace function app.check_user_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
begin
  if auth.uid() is null or new.status = old.status then
    return new;            -- set-up scripts, or no status change
  end if;
  -- A Super Admin for the requested department, or the Commander (all departments).
  if v_me is null or not app.is_super_admin(old.requested_department) then
    raise exception 'Only a Super Admin can approve or deactivate accounts (D-123).' using errcode = '42501';
  end if;
  if new.person_id = v_me then
    raise exception 'Nobody can approve or deactivate their own account (D-033).' using errcode = '42501';
  end if;
  if new.status = 'active' then
    new.activated_by := v_me;
    new.activated_at := now();
  elsif new.status = 'deactivated' then
    new.deactivated_by := v_me;
    new.deactivated_at := now();
  end if;
  return new;
end;
$$;

create trigger a0_check_account before update on public.user_account
  for each row execute function app.check_user_account();

-- -----------------------------------------------------------------------------
-- Has the signed-in user set a signing PIN yet? (first sign-in, D-206)
-- -----------------------------------------------------------------------------
create or replace function app.my_pin_is_set()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from app.user_pin p where p.user_id = auth.uid());
$$;

-- -----------------------------------------------------------------------------
-- User preferences (D-210). Conveniences, not records, so changing them is
-- allowed; deleting is still refused (D-023).
-- -----------------------------------------------------------------------------
create table public.user_preference (
  user_id    uuid not null references public.user_account (id),
  key        text not null check (key ~ '^[a-z0-9_.:-]{1,80}$'),
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
comment on table public.user_preference is 'Per-user saved columns, filters and views (D-210). Each user sees only their own.';

create trigger zz_no_delete before delete on public.user_preference
  for each row execute function app.forbid_delete();

alter table public.user_preference enable row level security;
create policy own_only_read   on public.user_preference for select to authenticated using (user_id = auth.uid());
create policy own_only_insert on public.user_preference for insert to authenticated with check (user_id = auth.uid());
create policy own_only_update on public.user_preference for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke delete, truncate on public.user_preference from anon, authenticated, service_role;
revoke all on public.user_preference from anon;
