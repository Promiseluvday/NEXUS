-- =============================================================================
-- Nexus MRO · Phase 0 · 0004 People and accounts
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * person: ONE record per human being, shared by every department (D-085).
--     Each person has a unique three-letter code, the 3LC (D-162).
--   * user_account: the sign-in account linked to that person. Accounts are
--     DEACTIVATED, never deleted, so records stay attached to the person's
--     name (D-030). A self sign-up starts as "pending" with a requested
--     department; a Super Admin confirms it (D-123).
--   * Signing PIN (D-094): stored only as a one-way hash in a private table
--     nobody can read through the API. Nexus can check a PIN, never show it.
-- =============================================================================

create table public.person (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null check (length(trim(full_name)) > 0),
  rank_or_title     text,
  service_number    text unique,
  three_letter_code text not null unique check (three_letter_code ~ '^[A-Z]{3}$'),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  device_time       timestamptz
);
comment on table public.person is 'One record per person across all departments (D-085). 3LC unique (D-162).';
comment on column public.person.three_letter_code is 'Three-letter code printed on sheets (NADDS, DDLS). Three capital letters.';

select app.apply_standard_rules('public.person');

create table public.user_account (
  id                   uuid primary key references auth.users (id),  -- sign-in id
  person_id            uuid not null unique references public.person (id),
  status               text not null default 'pending'
                         check (status in ('pending', 'active', 'deactivated')),
  requested_department text,            -- what the person asked for at sign-up (D-123)
  activated_at         timestamptz,
  activated_by         uuid references public.person (id),
  deactivated_at       timestamptz,
  deactivated_by       uuid references public.person (id),
  deactivation_reason  text,
  created_at           timestamptz not null default now(),
  created_by           uuid,
  device_time          timestamptz,
  -- A deactivated account must say who did it, when and why (D-030).
  constraint deactivation_recorded check (
    status <> 'deactivated'
    or (deactivated_at is not null and deactivated_by is not null
        and length(trim(coalesce(deactivation_reason, ''))) > 0)),
  -- An active account must say who activated it (D-123).
  constraint activation_recorded check (
    status <> 'active' or (activated_at is not null and activated_by is not null)),
  -- Nobody activates or deactivates their own account (D-033).
  constraint not_self_activated   check (activated_by   is null or activated_by   <> person_id),
  constraint not_self_deactivated check (deactivated_by is null or deactivated_by <> person_id)
);
comment on table public.user_account is 'Sign-in account linked to a person. Deactivated, never deleted (D-030).';

select app.apply_standard_rules('public.user_account');

-- -----------------------------------------------------------------------------
-- Who is signed in? Returns the person id for the current sign-in, or null.
-- Only ACTIVE accounts count: a pending or deactivated account has no rights.
-- -----------------------------------------------------------------------------
create or replace function app.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select ua.person_id
    from public.user_account ua
   where ua.id = auth.uid()
     and ua.status = 'active';
$$;

-- -----------------------------------------------------------------------------
-- Signing PIN (D-094). Private table in the "app" schema, not reachable by API.
-- -----------------------------------------------------------------------------
create table app.user_pin (
  user_id  uuid primary key references public.user_account (id),
  pin_hash text not null,
  set_at   timestamptz not null default now()
);
revoke all on app.user_pin from anon, authenticated;

create trigger zz_no_delete before delete on app.user_pin
  for each row execute function app.forbid_delete();

-- Set or change your own PIN: 4 to 8 digits.
create or replace function app.set_my_pin(p_pin text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if app.current_person_id() is null then
    raise exception 'Only an active, signed-in user can set a PIN.' using errcode = '42501';
  end if;
  if p_pin !~ '^[0-9]{4,8}$' then
    raise exception 'A PIN is 4 to 8 digits.' using errcode = '22023';
  end if;
  insert into app.user_pin (user_id, pin_hash, set_at)
  values (auth.uid(), extensions.crypt(p_pin, extensions.gen_salt('bf')), now())
  on conflict (user_id) do update
    set pin_hash = excluded.pin_hash, set_at = now();
end;
$$;

-- Check your own PIN before signing. True or false; never reveals the PIN.
-- (Lock-out after repeated failures is a Phase 4 hardening item.)
create or replace function app.check_my_pin(p_pin text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.pin_hash = extensions.crypt(p_pin, p.pin_hash)
       from app.user_pin p
      where p.user_id = auth.uid()
        and app.current_person_id() is not null),
    false);
$$;
