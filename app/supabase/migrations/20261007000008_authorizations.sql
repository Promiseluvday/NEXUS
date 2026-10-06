-- =============================================================================
-- Nexus MRO · Phase 0 · 0008 Qualifications and certifying authorizations
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   * qualification: licences, type ratings and medicals, each with issue
--     date, expiry and issuing authority (D-080). Medicals hold ONLY class and
--     expiry, never diagnoses (D-084).
--   * certifying_authorization: the company authorization to certify work
--     (D-031, D-032). Quality ISSUES it; the CO or ECO APPROVES it. It is
--     scoped to an aircraft type and has an expiry. Nobody issues or approves
--     their own, and the issuer and approver must be different people.
--   * app.is_certifying(person, type): answers "may this person certify on
--     this type today?" by checking the authorization, licence and type rating
--     are all valid (D-043). This is a check of RECORDS made by people. It is
--     not an airworthiness judgment (D-020).
-- =============================================================================

create table public.qualification (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references public.person (id),
  kind               text not null check (kind in ('licence', 'type_rating', 'medical')),
  reference          text,                 -- licence number, rating reference
  licence_category   text,                 -- e.g. AMEL category, as written on the licence
  aircraft_type_code text references public.aircraft_type (code),
  medical_class      text,
  issuing_authority  text,
  issued_on          date,
  expires_on         date,
  superseded_at      timestamptz,          -- set when replaced by a renewal (never deleted)
  superseded_by      uuid references public.person (id),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,
  constraint type_rating_names_type check (kind <> 'type_rating' or aircraft_type_code is not null),
  -- Medicals: class and expiry only (D-084).
  constraint medical_minimal check (
    kind <> 'medical' or (reference is null and licence_category is null and aircraft_type_code is null)),
  constraint dates_in_order check (expires_on is null or issued_on is null or expires_on >= issued_on)
);
comment on table public.qualification is 'Licences, type ratings and medicals (D-080). Medical: class and expiry only (D-084).';
select app.apply_standard_rules('public.qualification');

create table public.certifying_authorization (
  id                 uuid primary key default gen_random_uuid(),
  person_id          uuid not null references public.person (id),
  reference          text not null unique,      -- e.g. QA/AUTH/[REF]
  aircraft_type_code text not null references public.aircraft_type (code),
  valid_from         date not null,
  expires_on         date not null,
  issued_by          uuid not null references public.person (id),   -- Quality
  issued_at          timestamptz not null default now(),
  approved_by        uuid references public.person (id),            -- CO or ECO
  approved_at        timestamptz,
  revoked_at         timestamptz,
  revoked_by         uuid references public.person (id),
  revoke_reason      text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,
  constraint validity check (expires_on >= valid_from),
  constraint not_self_issued   check (issued_by <> person_id),                          -- D-033
  constraint not_self_approved check (approved_by is null or approved_by <> person_id), -- D-033
  constraint two_people        check (approved_by is null or approved_by <> issued_by),
  constraint approval_recorded check ((approved_by is null) = (approved_at is null)),
  constraint revocation_recorded check (
    (revoked_at is null and revoked_by is null and revoke_reason is null)
    or (revoked_at is not null and revoked_by is not null
        and length(trim(coalesce(revoke_reason, ''))) > 0))
);
comment on table public.certifying_authorization is 'Company certifying authorization: Quality issues, CO/ECO approves (D-032).';

-- -----------------------------------------------------------------------------
-- Rules on issuing, approving and revoking.
-- -----------------------------------------------------------------------------
create or replace function app.check_certifying_authorization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me        uuid := app.current_person_id();
  v_signed_in boolean := auth.uid() is not null;
begin
  if tg_op = 'INSERT' then
    if v_signed_in then
      if v_me is null or not app.has_department('QUA') then
        raise exception 'Only Quality can issue a certifying authorization (D-032).' using errcode = '42501';
      end if;
      new.issued_by := v_me;
      new.issued_at := now();
    end if;
    if new.person_id = new.issued_by then
      raise exception 'Nobody can issue an authorization to themselves (D-033).' using errcode = '42501';
    end if;
    new.approved_by := null; new.approved_at := null;   -- approval is a separate step
    new.revoked_at := null; new.revoked_by := null; new.revoke_reason := null;
    return new;
  end if;

  -- UPDATE: only two changes are ever allowed: approval (once) and revocation (once).
  if (to_jsonb(new) - array['approved_by','approved_at','revoked_at','revoked_by','revoke_reason','created_at','created_by'])
     is distinct from
     (to_jsonb(old) - array['approved_by','approved_at','revoked_at','revoked_by','revoke_reason','created_at','created_by']) then
    raise exception 'An authorization is never edited. Revoke it and issue a new one (D-023).' using errcode = 'P0001';
  end if;

  if new.approved_by is distinct from old.approved_by or new.approved_at is distinct from old.approved_at then
    if old.approved_by is not null then
      raise exception 'This authorization is already approved.' using errcode = 'P0001';
    end if;
    if old.revoked_at is not null then
      raise exception 'A revoked authorization cannot be approved.' using errcode = 'P0001';
    end if;
    if v_signed_in then
      if v_me is null or not app.can_approve_authorizations() then
        raise exception 'Only the CO or ECO can approve a certifying authorization (D-032).' using errcode = '42501';
      end if;
      new.approved_by := v_me;
      new.approved_at := now();
    end if;
    if new.approved_by = new.person_id then
      raise exception 'Nobody can approve their own authorization (D-033).' using errcode = '42501';
    end if;
  end if;

  if new.revoked_at is distinct from old.revoked_at or new.revoked_by is distinct from old.revoked_by
     or new.revoke_reason is distinct from old.revoke_reason then
    if old.revoked_at is not null then
      raise exception 'This authorization is already revoked.' using errcode = 'P0001';
    end if;
    if v_signed_in then
      if v_me is null or not (app.has_department('QUA') or app.can_approve_authorizations()) then
        raise exception 'Only Quality or the CO / ECO can revoke an authorization.' using errcode = '42501';
      end if;
      new.revoked_by := v_me;
      new.revoked_at := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger a0_check_authorization before insert or update on public.certifying_authorization
  for each row execute function app.check_certifying_authorization();

select app.apply_standard_rules('public.certifying_authorization');

-- -----------------------------------------------------------------------------
-- May this person certify on this aircraft type on this date? (D-043)
-- All of these must be true:
--   * an approved, unrevoked certifying authorization for the type, in date
--   * a current licence (not superseded, not expired)
--   * a current type rating for the type
-- -----------------------------------------------------------------------------
create or replace function app.is_certifying(
  p_person uuid, p_aircraft_type text, p_on date default current_date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.certifying_authorization c
            where c.person_id = p_person
              and c.aircraft_type_code = p_aircraft_type
              and c.approved_by is not null
              and c.revoked_at is null
              and p_on between c.valid_from and c.expires_on)
     and exists (
           select 1 from public.qualification q
            where q.person_id = p_person and q.kind = 'licence'
              and q.superseded_at is null
              and (q.expires_on is null or q.expires_on >= p_on))
     and exists (
           select 1 from public.qualification q
            where q.person_id = p_person and q.kind = 'type_rating'
              and q.aircraft_type_code = p_aircraft_type
              and q.superseded_at is null
              and (q.expires_on is null or q.expires_on >= p_on));
$$;
