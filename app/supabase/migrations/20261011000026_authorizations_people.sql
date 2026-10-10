-- =============================================================================
-- Nexus MRO · Phase 2 · 0026 People, qualifications and certifying
-- authorizations (screens O1, O2, O3 and the People list)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--
--   The tables already exist (0008): "qualification" (licences, type
--   ratings, medicals) and "certifying_authorization". This file adds the
--   SIGNED ACTIONS that fill them, and the questions the screens ask.
--
--   1. QUALIFICATIONS (D-080 to D-085). Quality records a licence, a type
--      rating or a medical for a person, with the PIN.
--        * A medical holds ONLY its class and expiry date. No diagnoses, no
--          limitations, no reference numbers (D-084).
--        * Nothing is edited. A renewal is a NEW record that "replaces" the
--          old one; the old one is marked superseded, with who, when and why.
--          A record entered in error is "withdrawn" the same way (D-023).
--        * Nobody records their own qualifications (D-033).
--        * Expiry is flagged "Approaching" inside an operator margin and
--          "Reached" once the date has passed (D-028 style). The margin is
--          the setting qualification.approaching_days (default 60 days).
--        * Whether a medical is needed depends on the person's department:
--          setting qualification.medical_required_departments, PAF = flying
--          crew (Operations) only, not engineers (D-081, D-082). The full
--          requirements matrix with Quality-proposes / CO-approves changes
--          (D-083) is a later step.
--
--   2. CERTIFYING AUTHORIZATIONS (D-031, D-032, D-043).
--        * Quality ISSUES one: reference, aircraft type, valid from, expires
--          on. Signed with the PIN.
--        * The CO or ECO APPROVES it (or rejects it with a reason), signed
--          with the PIN. Only then does it count.
--        * The issuer cannot also approve; nobody issues or approves their
--          own (D-033). The Commander / CEO cannot issue one (D-037).
--        * It can be REVOKED (or, while still waiting, WITHDRAWN) by Quality
--          or the CO / ECO, with a reason, who and when. Never deleted.
--        * The approval goes through the existing approval engine (0011): a
--          new chain "certifying_authorization", so it shows in the
--          approver's Approvals inbox. The step holder (e.g. the Engineering
--          CO appointment) is operator set-up (D-076, D-078). If no step is
--          set up yet, the CO / ECO approves directly from the person's page.
--          Either way the database insists the approver holds a post that
--          approves authorizations (0008 trigger, D-032).
--        * An approved authorization is what app.is_certifying() looks for,
--          together with a current licence and type rating, before anyone
--          certifies a work order, clears a DDLS entry or rectifies a NADD
--          (D-043). That is a check of records made by people, never an
--          airworthiness judgment (D-020).
--
--   3. QUESTIONS FOR THE SCREENS: the People list and one person's record.
--      Visible to Quality, Command, Super Admins and the CO / ECO; everyone
--      else sees only their own record (D-122, D-125, D-127).
-- =============================================================================

-- ------------------------------------------------------------- settings -----
insert into public.operator_setting (key, value, reason) values
  ('qualification.approaching_days', '60',
   'Days before a licence, type rating, medical or certifying authorization expires to flag it Approaching (D-028, D-080)'),
  ('qualification.medical_required_departments', '["OPS"]',
   'Departments whose people must hold a medical: flying crew, not engineers (D-081, D-082)');

-- ---------------------------------------------------- approval chain -----
-- The kind of approval. WHO holds the step is operator set-up (sample data:
-- the Engineering CO appointment, seeds/10-people.sql).
insert into public.approval_chain (action_type, name)
values ('certifying_authorization', 'Certifying authorization (D-032)')
on conflict (action_type) do nothing;

-- ------------------------------------------- qualification: extra columns -----
alter table public.qualification
  add column recorded_by       uuid references public.person (id),       -- Quality, who entered it
  add column superseded_reason text,                                      -- why it was replaced or withdrawn
  add column replaced_by       uuid references public.qualification (id); -- the renewal, if any
alter table public.qualification
  add constraint superseded_recorded check (
    superseded_at is null
    or (superseded_by is not null and length(trim(coalesce(superseded_reason, ''))) > 0));
comment on column public.qualification.superseded_reason is 'Why this record was replaced (renewal) or withdrawn (D-023).';

-- Qualifications are never edited (D-023). The only change ever allowed is
-- marking a record superseded, once.
create or replace function app.check_qualification_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (to_jsonb(new) - array['superseded_at','superseded_by','superseded_reason','replaced_by','created_at','created_by'])
     is distinct from
     (to_jsonb(old) - array['superseded_at','superseded_by','superseded_reason','replaced_by','created_at','created_by']) then
    raise exception 'A qualification record is never edited. Record the renewal or correction as a new one (D-023).'
      using errcode = 'P0001';
  end if;
  if old.superseded_at is not null then
    raise exception 'This qualification record is already superseded (D-023).' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger a0_check_qualification before update on public.qualification
  for each row execute function app.check_qualification_change();

-- Writes come only through the signed functions below (PIN, D-094).
-- Reading stays as 0009 set it: own record, oversight, Super Admins.
revoke insert, update on public.qualification from authenticated;

-- --------------------------------------------------------------- helpers -----
-- Today in the operator's time zone (not the server's).
create or replace function app.operator_today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'))::date;
$$;

-- Expiry flag (D-028 style): 'reached' once the date has passed, 'approaching'
-- inside the operator margin, otherwise 'current'. No expiry date: 'current'.
create or replace function app.expiry_flag(p_expires date)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when p_expires is null then 'current'
    when p_expires < app.operator_today() then 'reached'
    when p_expires <= app.operator_today()
         + coalesce((app.setting('qualification.approaching_days') #>> '{}')::integer, 60) then 'approaching'
    else 'current' end;
$$;

-- May the signed-in person look at other people's records? Quality, Command,
-- Super Admins (department COs) and whoever approves authorizations (D-122).
create or replace function app.can_view_people()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.current_person_id() is not null
     and (app.is_oversight() or app.is_super_admin() or app.can_approve_authorizations());
$$;

-- Does this person hold the Commander / CEO post (Super Admin for all)? (D-037)
create or replace function app.person_is_commander(p_person uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.appointment a
      join public.appointment_holder h on h.appointment_id = a.id
     where a.super_admin_scope = 'all' and h.person_id = p_person
       and h.held_from <= now() and (h.held_to is null or h.held_to > now()));
$$;

-- Common checks for Quality's qualification actions. Returns the signed-in person.
create or replace function app.quality_check(p_person uuid, p_pin text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
begin
  if v_me is null or not app.has_department('QUA') then
    raise exception 'Only Quality records licences, type ratings and medicals (D-080).' using errcode = '42501';
  end if;
  if p_person = v_me then
    raise exception 'Nobody records or changes their own qualifications (D-033).' using errcode = '42501';
  end if;
  if not exists (select 1 from public.person where id = p_person) then
    raise exception 'Person not found.' using errcode = 'P0002';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  return v_me;
end;
$$;

-- ------------------------------------------------- 1. record a qualification -----
-- p_kind: 'licence' | 'type_rating' | 'medical'.
-- p_replaces: the record this one renews (same person and kind); it is marked
-- superseded with p_reason. Leave empty for a first record.
create or replace function app.record_qualification(
  p_person uuid, p_kind text, p_pin text,
  p_reference text default null, p_licence_category text default null,
  p_aircraft_type text default null, p_medical_class text default null,
  p_issuing_authority text default null, p_issued_on date default null, p_expires_on date default null,
  p_replaces uuid default null, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := app.quality_check(p_person, p_pin);
  v_old public.qualification;
  v_id  uuid;
  v_ref text := nullif(trim(coalesce(p_reference, '')), '');
  v_cat text := nullif(trim(coalesce(p_licence_category, '')), '');
  v_cls text := nullif(trim(coalesce(p_medical_class, '')), '');
  v_ath text := nullif(trim(coalesce(p_issuing_authority, '')), '');
begin
  if p_kind not in ('licence', 'type_rating', 'medical') then
    raise exception 'A qualification is a licence, a type rating or a medical.' using errcode = '22023';
  end if;

  if p_kind = 'medical' then
    -- Class and expiry only (D-084). Anything else is refused, not dropped,
    -- so nobody thinks it was kept.
    if v_ref is not null or v_cat is not null or p_aircraft_type is not null
       or v_ath is not null or p_issued_on is not null then
      raise exception 'A medical holds only its class and expiry date. No other detail is stored (D-084).'
        using errcode = '22023';
    end if;
    if v_cls is null or p_expires_on is null then
      raise exception 'A medical needs its class and expiry date (D-084).' using errcode = '22023';
    end if;
  else
    if v_cls is not null then
      raise exception 'Medical class belongs on a medical record only.' using errcode = '22023';
    end if;
    if v_ath is null or p_issued_on is null then
      raise exception 'Give the issuing authority and the issue date (D-080).' using errcode = '22023';
    end if;
    if p_kind = 'licence' and v_ref is null then
      raise exception 'Give the licence number.' using errcode = '22023';
    end if;
    if p_kind = 'type_rating' and p_aircraft_type is null then
      raise exception 'A type rating names the aircraft type.' using errcode = '22023';
    end if;
    if p_kind = 'licence' and p_aircraft_type is not null then
      raise exception 'A licence does not name an aircraft type; record a type rating for that.' using errcode = '22023';
    end if;
  end if;
  if p_expires_on is not null and p_issued_on is not null and p_expires_on < p_issued_on then
    raise exception 'The expiry date is before the issue date.' using errcode = '22023';
  end if;

  if p_replaces is not null then
    select * into v_old from public.qualification where id = p_replaces for update;
    if not found or v_old.person_id <> p_person or v_old.kind <> p_kind
       or (p_kind = 'type_rating' and v_old.aircraft_type_code is distinct from p_aircraft_type) then
      raise exception 'The record being replaced must be the same person, kind (and type, for a rating).'
        using errcode = '22023';
    end if;
    if v_old.superseded_at is not null then
      raise exception 'That record is already superseded.' using errcode = 'P0001';
    end if;
    if length(trim(coalesce(p_reason, ''))) = 0 then
      raise exception 'Give a reason for replacing the old record, e.g. "Renewal".' using errcode = '23514';
    end if;
  end if;

  insert into public.qualification (person_id, kind, reference, licence_category, aircraft_type_code,
                                    medical_class, issuing_authority, issued_on, expires_on, recorded_by)
  values (p_person, p_kind,
          case when p_kind = 'medical' then null else v_ref end,
          case when p_kind = 'licence' then v_cat else null end,
          case when p_kind = 'type_rating' then p_aircraft_type else null end,
          v_cls, v_ath, p_issued_on, p_expires_on, v_me)
  returning id into v_id;

  if p_replaces is not null then
    update public.qualification
       set superseded_at = now(), superseded_by = v_me, superseded_reason = trim(p_reason), replaced_by = v_id
     where id = p_replaces;
  end if;
  return v_id;
end;
$$;

-- Withdraw a record (entered in error, suspended, no longer held). It stays
-- in the history, marked superseded with who, when and why (D-023).
create or replace function app.withdraw_qualification(p_qualification uuid, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  q    public.qualification;
  v_me uuid;
begin
  select * into q from public.qualification where id = p_qualification for update;
  if not found then
    raise exception 'Qualification record not found.' using errcode = 'P0002';
  end if;
  v_me := app.quality_check(q.person_id, p_pin);
  if q.superseded_at is not null then
    raise exception 'That record is already superseded.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for withdrawing the record.' using errcode = '23514';
  end if;
  update public.qualification
     set superseded_at = now(), superseded_by = v_me, superseded_reason = trim(p_reason)
   where id = q.id;
end;
$$;

-- ----------------------------------------- 2. certifying authorizations -----
-- Quality issues. Returns the new authorization's id. It waits for the CO or
-- ECO; it does not count until approved (D-032).
create or replace function app.issue_certifying_authorization(
  p_person uuid, p_reference text, p_aircraft_type text,
  p_valid_from date, p_expires_on date, p_pin text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := app.current_person_id();
  v_id  uuid := gen_random_uuid();
  v_ref text := trim(coalesce(p_reference, ''));
  v_who public.person;
begin
  if v_me is null or not app.has_department('QUA') then
    raise exception 'Only Quality can issue a certifying authorization (D-032).' using errcode = '42501';
  end if;
  if app.person_is_commander(v_me) then
    raise exception 'The Commander / CEO cannot issue certifying authorizations (D-037).' using errcode = '42501';
  end if;
  if p_person = v_me then
    raise exception 'Nobody can issue an authorization to themselves (D-033).' using errcode = '42501';
  end if;
  select * into v_who from public.person where id = p_person;
  if not found then
    raise exception 'Person not found.' using errcode = 'P0002';
  end if;
  if app.person_is_commander(p_person) then
    raise exception 'The Commander / CEO cannot certify work, so cannot hold a certifying authorization (D-037).'
      using errcode = '42501';
  end if;
  if length(v_ref) = 0 then
    raise exception 'Give the authorization reference.' using errcode = '22023';
  end if;
  if exists (select 1 from public.certifying_authorization where reference = v_ref) then
    raise exception 'The reference % is already used. References are never reused.', v_ref using errcode = '23505';
  end if;
  if not exists (select 1 from public.aircraft_type where code = p_aircraft_type) then
    raise exception 'Choose the aircraft type the authorization covers (D-032).' using errcode = '22023';
  end if;
  if p_valid_from is null or p_expires_on is null then
    raise exception 'Give the valid-from and expiry dates (D-032).' using errcode = '22023';
  end if;
  if p_expires_on < p_valid_from then
    raise exception 'The expiry date is before the valid-from date.' using errcode = '22023';
  end if;
  if p_expires_on < app.operator_today() then
    raise exception 'The expiry date has already passed.' using errcode = '22023';
  end if;
  if exists (select 1 from public.certifying_authorization c
              where c.person_id = p_person and c.aircraft_type_code = p_aircraft_type
                and c.approved_by is null and c.revoked_at is null) then
    raise exception '% already has a % authorization waiting for approval. Approve, reject or withdraw it first.',
      v_who.three_letter_code, p_aircraft_type using errcode = 'P0001';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;

  -- The 0008 rules stamp the issuer (the signed-in person) and leave it unapproved.
  insert into public.certifying_authorization (id, person_id, reference, aircraft_type_code, valid_from, expires_on, issued_by)
  values (v_id, p_person, v_ref, p_aircraft_type, p_valid_from, p_expires_on, v_me);

  -- Into the approver's inbox, if the operator has set up who approves.
  if exists (select 1 from public.approval_chain_step where action_type = 'certifying_authorization') then
    perform app.raise_approval('certifying_authorization', 'certifying_authorization', v_id,
      format('Certifying authorization %s · %s · for %s %s · valid %s to %s',
             v_ref, p_aircraft_type, v_who.three_letter_code, v_who.full_name,
             to_char(p_valid_from, 'DD Mon YYYY'), to_char(p_expires_on, 'DD Mon YYYY')));
  end if;
  return v_id;
end;
$$;

-- The pending approval request behind an authorization, if any.
create or replace function app.authorization_request(p_authorization uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select r.id from public.approval_request r
   where r.action_type = 'certifying_authorization' and r.record_id = p_authorization
     and r.status = 'pending'
   order by r.raised_at desc limit 1;
$$;

-- When the approval request is decided in the Approvals inbox, the
-- authorization follows: approved -> it counts; rejected -> it is closed with
-- the approver's reason (kept, never deleted).
create or replace function app.authorization_follow_approval()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  a public.certifying_authorization;
  d public.approval_decision;
begin
  if new.action_type <> 'certifying_authorization' or new.status = old.status then
    return null;
  end if;
  select * into a from public.certifying_authorization where id = new.record_id;
  if not found or a.revoked_at is not null then
    return null;
  end if;
  select * into d from public.approval_decision where request_id = new.id order by created_at desc, id desc limit 1;
  if new.status = 'approved' and a.approved_by is null then
    -- The 0008 rules check again that the approver is the CO or ECO (D-032)
    -- and is neither the holder nor the issuer (D-033).
    update public.certifying_authorization set approved_by = d.decided_by, approved_at = now() where id = a.id;
  elsif new.status = 'rejected' and a.approved_by is null then
    update public.certifying_authorization
       set revoked_at = now(), revoked_by = d.decided_by,
           revoke_reason = 'Rejected at approval: ' || coalesce(d.reason, '—')
     where id = a.id;
  end if;
  return null;
end;
$$;
create trigger certifying_authorization_follow_approval after update on public.approval_request
  for each row execute function app.authorization_follow_approval();

-- The CO or ECO approves or rejects, signed with the PIN (D-032, D-094).
-- p_decision: 'approve' | 'reject' (a reject needs a reason, D-079).
-- Returns 'approved', 'rejected', or 'step N' if the operator's chain has more steps.
create or replace function app.decide_certifying_authorization(
  p_authorization uuid, p_decision text, p_pin text, p_reason text default null)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  a      public.certifying_authorization;
  v_me   uuid := app.current_person_id();
  v_req  uuid;
begin
  select * into a from public.certifying_authorization where id = p_authorization for update;
  if not found then
    raise exception 'Authorization not found.' using errcode = 'P0002';
  end if;
  if v_me is null or not app.can_approve_authorizations() then
    raise exception 'Only the CO or ECO can approve or reject a certifying authorization (D-032).' using errcode = '42501';
  end if;
  if a.person_id = v_me then
    raise exception 'Nobody can approve their own authorization (D-033).' using errcode = '42501';
  end if;
  if a.issued_by = v_me then
    raise exception 'Whoever issued an authorization cannot also approve it (D-032, D-033).' using errcode = '42501';
  end if;
  if a.revoked_at is not null then
    raise exception 'This authorization is closed (rejected, withdrawn or revoked).' using errcode = 'P0001';
  end if;
  if a.approved_by is not null then
    raise exception 'This authorization is already approved.' using errcode = 'P0001';
  end if;
  if p_decision not in ('approve', 'reject') then
    raise exception 'Decision must be approve or reject.' using errcode = '22023';
  end if;
  if p_decision = 'reject' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'A rejection needs a reason; Quality sees it (D-079).' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;

  v_req := app.authorization_request(a.id);
  if v_req is not null then
    -- Through the approval engine: step holder, raiser, two-steps rules
    -- (0011). The trigger above then updates the authorization.
    return app.decide_approval_core(v_req, p_decision, nullif(trim(coalesce(p_reason, '')), ''));
  end if;

  -- No approval chain set up: decided directly, the same rules apply.
  if p_decision = 'approve' then
    update public.certifying_authorization set approved_by = v_me, approved_at = now() where id = a.id;
    return 'approved';
  end if;
  update public.certifying_authorization
     set revoked_at = now(), revoked_by = v_me, revoke_reason = 'Rejected at approval: ' || trim(p_reason)
   where id = a.id;
  return 'rejected';
end;
$$;

-- Revoke an approved authorization, or withdraw one still waiting. Quality or
-- the CO / ECO, with a reason and the PIN. Who and when are recorded (D-033).
-- Returns 'revoked' or 'withdrawn'.
create or replace function app.revoke_certifying_authorization(p_authorization uuid, p_reason text, p_pin text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  a    public.certifying_authorization;
  v_me uuid := app.current_person_id();
begin
  select * into a from public.certifying_authorization where id = p_authorization for update;
  if not found then
    raise exception 'Authorization not found.' using errcode = 'P0002';
  end if;
  if v_me is null or not (app.has_department('QUA') or app.can_approve_authorizations()) then
    raise exception 'Only Quality or the CO / ECO can revoke an authorization (D-032).' using errcode = '42501';
  end if;
  if a.person_id = v_me then
    raise exception 'Nobody can change their own authorization (D-033).' using errcode = '42501';
  end if;
  if a.revoked_at is not null then
    raise exception 'This authorization is already closed.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason (D-033).' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;

  -- A request still waiting in someone's inbox is cancelled with it.
  update public.approval_request set status = 'cancelled', decided_at = now()
   where action_type = 'certifying_authorization' and record_id = a.id and status = 'pending';

  update public.certifying_authorization
     set revoked_at = now(), revoked_by = v_me, revoke_reason = trim(p_reason)
   where id = a.id;
  return case when a.approved_by is null then 'withdrawn' else 'revoked' end;
end;
$$;

-- State of an authorization in words the screens show.
--   pending · rejected · withdrawn · revoked · not_yet_valid · expired · approaching · active
create or replace function app.authorization_state(a public.certifying_authorization)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when a.revoked_at is not null and a.approved_by is null and a.revoke_reason like 'Rejected at approval:%' then 'rejected'
    when a.revoked_at is not null and a.approved_by is null then 'withdrawn'
    when a.revoked_at is not null then 'revoked'
    when a.approved_by is null then 'pending'
    when app.operator_today() < a.valid_from then 'not_yet_valid'
    when app.expiry_flag(a.expires_on) = 'reached' then 'expired'
    when app.expiry_flag(a.expires_on) = 'approaching' then 'approaching'
    else 'active' end;
$$;

-- ---------------------------------------------- 3. questions for screens -----
-- Is a medical required for this person? (D-081, D-082: by department, a setting)
create or replace function app.medical_required(p_person uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.access_grant g
     where g.person_id = p_person and g.grant_type = 'department' and g.revoked_at is null
       and g.department_code in (select jsonb_array_elements_text(
             coalesce(app.setting('qualification.medical_required_departments'), '[]'::jsonb))));
$$;

-- Current appointments of a person, as one line ("Engineering CO", "Quality Manager (acting)").
create or replace function app.person_appointments(p_person uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select string_agg(t, ', ' order by t) from (
    select a.title as t from public.appointment a join public.appointment_holder h on h.appointment_id = a.id
     where h.person_id = p_person and h.held_from <= now() and (h.held_to is null or h.held_to > now())
    union
    select a.title || ' (acting)' from public.appointment a join public.appointment_deputy d on d.appointment_id = a.id
     where d.deputy_person_id = p_person and d.revoked_at is null and now() >= d.valid_from and now() < d.valid_to) x;
$$;

-- Worst expiry flag across a person's current records (for the list).
create or replace function app.person_expiry_flag(p_person uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when bool_or(f = 'reached') then 'reached'
    when bool_or(f = 'approaching') then 'approaching'
    else null end
    from (
      select app.expiry_flag(q.expires_on) f from public.qualification q
       where q.person_id = p_person and q.superseded_at is null
      union all
      select app.expiry_flag(c.expires_on) from public.certifying_authorization c
       where c.person_id = p_person and c.approved_by is not null and c.revoked_at is null) x;
$$;

-- The People list. Quality, Command, Super Admins and the CO / ECO see
-- everyone; anyone else sees only their own line (D-122, D-125).
create or replace function app.people_list()
returns table (
  person_id uuid, full_name text, rank_or_title text, three_letter_code text,
  home_department text, departments text, appointments text, account_status text,
  certifying_types text, expiry_flag text, pending_authorizations integer)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.full_name, p.rank_or_title, p.three_letter_code,
         (select d.name from public.access_grant g join public.department d on d.code = g.department_code
           where g.person_id = p.id and g.grant_type = 'department' and g.is_home and g.revoked_at is null limit 1),
         app.access_summary(p.id, 'departments'),
         app.person_appointments(p.id),
         coalesce(a.status, 'no_sign_in'),
         (select string_agg(t.code, ', ' order by t.code) from public.aircraft_type t
           where app.is_certifying(p.id, t.code, app.operator_today())),
         case when app.can_view_people() or p.id = app.current_person_id() then app.person_expiry_flag(p.id) end,
         (select count(*)::integer from public.certifying_authorization c
           where c.person_id = p.id and c.approved_by is null and c.revoked_at is null)
    from public.person p
    left join public.user_account a on a.person_id = p.id
   where app.current_person_id() is not null
     and (app.can_view_people() or p.id = app.current_person_id())
     -- Set-up records with no sign-in and no rights (e.g. "Initial set-up, IT") are not people to manage.
     and (a.id is not null or exists (select 1 from public.access_grant g where g.person_id = p.id))
   order by p.full_name;
$$;

-- One person's record for screens O1, O2 and O3, as one JSON object.
-- Returns null if the signed-in person may not see it.
create or replace function app.person_record(p_person uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me     uuid := app.current_person_id();
  v_self   boolean := p_person = v_me;
  p        public.person;
  v_status text;
  v_quals  boolean;
begin
  if v_me is null or not (v_self or app.can_view_people()) then
    return null;
  end if;
  select * into p from public.person where id = p_person;
  if not found then
    return null;
  end if;
  select ua.status into v_status from public.user_account ua where ua.person_id = p_person;
  -- Qualifications: own, oversight, Super Admins, CO / ECO (0009, D-127).
  v_quals := v_self or app.can_view_people();

  return jsonb_build_object(
    'person', jsonb_build_object('id', p.id, 'full_name', p.full_name, 'rank_or_title', p.rank_or_title,
                                 'three_letter_code', p.three_letter_code, 'service_number', p.service_number,
                                 'created_at', p.created_at),
    'account_status', coalesce(v_status, 'no_sign_in'),
    'home_department', (select d.name from public.access_grant g join public.department d on d.code = g.department_code
                         where g.person_id = p.id and g.grant_type = 'department' and g.is_home and g.revoked_at is null limit 1),
    'admin_department', app.person_admin_department(p.id),
    'departments', app.access_summary(p.id, 'departments'),
    'sections', app.access_summary(p.id, 'sections'),
    'scope', app.access_summary(p.id, 'scope'),
    'appointments', app.person_appointments(p.id),
    'medical_required', app.medical_required(p.id),
    'approaching_days', coalesce((app.setting('qualification.approaching_days') #>> '{}')::integer, 60),
    'today', app.operator_today(),
    'certifying_types', coalesce((select jsonb_agg(t.code order by t.code) from public.aircraft_type t
                                   where app.is_certifying(p.id, t.code, app.operator_today())), '[]'::jsonb),
    'qualifications', case when v_quals then coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', q.id, 'kind', q.kind, 'reference', q.reference, 'licence_category', q.licence_category,
                 'aircraft_type_code', q.aircraft_type_code, 'medical_class', q.medical_class,
                 'issuing_authority', q.issuing_authority, 'issued_on', q.issued_on, 'expires_on', q.expires_on,
                 'flag', case when q.superseded_at is null then app.expiry_flag(q.expires_on) end,
                 'recorded_by', rb.three_letter_code, 'created_at', q.created_at,
                 'superseded_at', q.superseded_at, 'superseded_by', sb.three_letter_code,
                 'superseded_reason', q.superseded_reason, 'replaced_by', q.replaced_by)
               order by q.superseded_at is not null, q.kind, q.aircraft_type_code nulls first, q.created_at desc)
          from public.qualification q
          left join public.person rb on rb.id = q.recorded_by
          left join public.person sb on sb.id = q.superseded_by
         where q.person_id = p.id), '[]'::jsonb) end,
    'authorizations', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'id', c.id, 'reference', c.reference, 'aircraft_type_code', c.aircraft_type_code,
                 'valid_from', c.valid_from, 'expires_on', c.expires_on, 'state', app.authorization_state(c),
                 'issued_by', ib.three_letter_code, 'issued_at', c.issued_at,
                 'approved_by', ab.three_letter_code, 'approved_at', c.approved_at,
                 'revoked_by', xb.three_letter_code, 'revoked_at', c.revoked_at, 'revoke_reason', c.revoke_reason,
                 'request_id', app.authorization_request(c.id),
                 'waiting_step', (select st.name from public.approval_request r
                                    join public.approval_chain_step st on st.action_type = r.action_type and st.step_no = r.current_step
                                   where r.id = app.authorization_request(c.id)))
               order by c.revoked_at is not null, c.issued_at desc)
          from public.certifying_authorization c
          join public.person ib on ib.id = c.issued_by
          left join public.person ab on ab.id = c.approved_by
          left join public.person xb on xb.id = c.revoked_by
         where c.person_id = p.id), '[]'::jsonb),
    -- What the signed-in person may do here (the database checks again).
    'can', jsonb_build_object(
      'record_qualifications', not v_self and app.has_department('QUA'),
      'issue', not v_self and app.has_department('QUA') and not app.person_is_commander(v_me)
               and not app.person_is_commander(p.id),
      'approve', not v_self and app.can_approve_authorizations(),
      'revoke', not v_self and (app.has_department('QUA') or app.can_approve_authorizations()),
      'manage_account', not v_self and v_status is not null and app.is_super_admin()
               and (app.is_global_super_admin() or app.is_super_admin(app.person_admin_department(p.id))),
      'view_people', app.can_view_people()));
end;
$$;

-- Authorizations waiting for a CO / ECO decision (People list banner).
create or replace function app.authorizations_waiting()
returns table (
  id uuid, person_id uuid, full_name text, three_letter_code text, reference text,
  aircraft_type_code text, valid_from date, expires_on date, issued_by text, issued_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select c.id, p.id, p.full_name, p.three_letter_code, c.reference, c.aircraft_type_code,
         c.valid_from, c.expires_on, ib.three_letter_code, c.issued_at
    from public.certifying_authorization c
    join public.person p on p.id = c.person_id
    join public.person ib on ib.id = c.issued_by
   where c.approved_by is null and c.revoked_at is null
     and app.can_view_people()
   order by c.issued_at;
$$;

-- --------------------------------------------------------------- access -----
grant execute on function
  app.record_qualification(uuid, text, text, text, text, text, text, text, date, date, uuid, text),
  app.withdraw_qualification(uuid, text, text),
  app.issue_certifying_authorization(uuid, text, text, date, date, text),
  app.decide_certifying_authorization(uuid, text, text, text),
  app.revoke_certifying_authorization(uuid, text, text),
  app.people_list(),
  app.person_record(uuid),
  app.authorizations_waiting(),
  app.can_view_people(),
  app.expiry_flag(date)
to authenticated;
-- Internal steps: only reachable through the functions above.
revoke execute on function
  app.check_qualification_change(), app.operator_today(), app.person_is_commander(uuid),
  app.quality_check(uuid, text), app.authorization_request(uuid), app.authorization_follow_approval(),
  app.authorization_state(public.certifying_authorization), app.medical_required(uuid),
  app.person_appointments(uuid), app.person_expiry_flag(uuid)
from public, anon, authenticated;

-- ---------------------------------------------- no back door (D-032, D-094) ---
-- Authorizations are issued, approved and revoked ONLY through the signed
-- functions above (each needs the PIN). The direct table route from 0009 is
-- closed so nobody can skip the PIN or the approval step.
drop policy if exists add_quality on public.certifying_authorization;
drop policy if exists edit_issuer_or_approver on public.certifying_authorization;
revoke insert, update, delete, truncate on public.certifying_authorization from anon, authenticated;
