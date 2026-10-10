-- =============================================================================
-- Nexus MRO · Phase 2 · 0028 ADs and SBs compliance register
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (D-016, D-020, D-021, D-023, D-024,
-- D-028, D-121, D-125, D-127):
--
--   1. THE REGISTER of Airworthiness Directives (AD) and Service Bulletins
--      (SB): type, reference, title, issuing authority, the aircraft type it
--      applies to, revision. An engineer types it in; nothing is imported.
--
--   2. ONE COMPLIANCE ENTRY per aircraft and document, written by an
--      engineer and signed with their PIN:
--        applicability    applicable / not applicable (with the reason)
--        compliance method e.g. modification embodied, repetitive inspection
--        status           open, recurring, complied, not applicable
--        last complied    date and/or hours / cycles, as entered
--        NEXT DUE         date and/or hours / cycles / words, AS ENTERED.
--      Nexus never decides applicability and never calculates next due
--      (D-016, D-020, D-021). It stores what the engineer wrote.
--
--   3. QUALITY VERIFIES each entry (countersign with PIN) or rejects it with
--      a reason. Until then the entry shows "Awaiting verification". The
--      person who entered it cannot verify it.
--
--   4. CORRECTIONS are new versions with a reason (D-023). The old version
--      stays in history with its verification. A new version needs Quality
--      again. Nothing is ever deleted or edited in place.
--
--   5. FLAGS (D-028): amber "Approaching" inside the operator's margin,
--      red "Reached" at the entered figure. No projections.
--        * Date next-due: compared with today's date (operator time zone).
--        * Hours / cycles next-due: compared with the aircraft totals (the sum
--          of entered flight records, D-022) ONLY if the flight-records
--          function app.aircraft_totals(uuid) exists. It is built separately;
--          until it exists, hours / cycles figures are shown as entered, with
--          no flag. Nothing here needs changing when it arrives.
--      Margins are settings (D-025):
--        adsb.approaching_days    (falls back to attention.approaching_days, then 30)
--        adsb.approaching_hours   (default 50)
--        adsb.approaching_cycles  (default 25)
--
-- Who sees what (D-120, D-121, D-125, D-127): Engineering and oversight
-- (Command, Quality) see the register; entries only for tails in their
-- aircraft scope. Operations, Supply and Procurement do not see it.
-- =============================================================================

-- ------------------------------------------------------------ the register ---
-- Every version of a document is a row. document_key is the same for all
-- versions of one document; the newest version (no row supersedes it) is the
-- one in force.
create table public.adsb_document (
  id                 uuid primary key default gen_random_uuid(),
  document_key       uuid not null default gen_random_uuid(),
  version            integer not null default 1 check (version >= 1),
  supersedes_id      uuid unique references public.adsb_document (id),
  doc_type           text not null check (doc_type in ('AD', 'SB')),
  reference          text not null check (length(trim(reference)) > 0),
  title              text not null check (length(trim(title)) > 0),
  issuing_authority  text not null check (length(trim(issuing_authority)) > 0),
  aircraft_type_code text not null references public.aircraft_type (code),
  applies_to_note    text,          -- e.g. engine model, part number, serial range, as written
  revision           text,
  effective_on       date,
  correction_reason  text,
  entered_by         uuid not null references public.person (id),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,
  unique (document_key, version),
  constraint document_correction_has_reason check (
    version = 1 or (supersedes_id is not null and length(trim(coalesce(correction_reason, ''))) > 0))
);
comment on table public.adsb_document is 'AD / SB register (D-016). Engineer-entered; corrections are new versions (D-023).';
create trigger a1_no_update before update on public.adsb_document
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.adsb_document');

-- ------------------------------------------------------ compliance entries ---
-- Same versioning: entry_key is the same for every version of one aircraft's
-- entry for one document; the newest version is the one in force.
create table public.adsb_compliance (
  id                    uuid primary key default gen_random_uuid(),
  entry_key             uuid not null default gen_random_uuid(),
  version               integer not null default 1 check (version >= 1),
  supersedes_id         uuid unique references public.adsb_compliance (id),
  aircraft_id           uuid not null references public.aircraft (id),
  document_key          uuid not null,
  document_id           uuid not null references public.adsb_document (id), -- the exact revision assessed
  applicability         text not null check (applicability in ('applicable', 'not_applicable')),
  not_applicable_reason text,
  compliance_method     text,
  status                text not null check (status in ('open', 'recurring', 'complied', 'not_applicable')),
  last_complied_on      date,
  last_complied_hours   numeric(10,1) check (last_complied_hours is null or last_complied_hours >= 0),
  last_complied_cycles  integer       check (last_complied_cycles is null or last_complied_cycles >= 0),
  -- NEXT DUE, exactly as the engineer entered it. Never calculated (D-021).
  next_due_on           date,
  next_due_hours        numeric(10,1) check (next_due_hours is null or next_due_hours >= 0),
  next_due_cycles       integer       check (next_due_cycles is null or next_due_cycles >= 0),
  next_due_text         text,          -- the limit in words, e.g. "19,000 FH or 12 months, whichever first"
  compliance_reference  text,          -- work order, logbook entry, as entered
  remarks               text,
  correction_reason     text,
  entered_by            uuid not null references public.person (id),
  entered_at            timestamptz not null default now(),
  created_at            timestamptz not null default now(),
  created_by            uuid,
  device_time           timestamptz,
  unique (entry_key, version),
  constraint na_matches_status check ((applicability = 'not_applicable') = (status = 'not_applicable')),
  constraint na_has_reason check (
    applicability <> 'not_applicable' or length(trim(coalesce(not_applicable_reason, ''))) > 0),
  constraint method_when_complied_or_recurring check (
    status not in ('complied', 'recurring') or length(trim(coalesce(compliance_method, ''))) > 0),
  constraint complied_has_last check (
    status <> 'complied' or last_complied_on is not null or last_complied_hours is not null or last_complied_cycles is not null),
  constraint recurring_has_next check (
    status <> 'recurring' or next_due_on is not null or next_due_hours is not null or next_due_cycles is not null
    or length(trim(coalesce(next_due_text, ''))) > 0),
  constraint closed_has_no_next check (
    status not in ('complied', 'not_applicable')
    or (next_due_on is null and next_due_hours is null and next_due_cycles is null and next_due_text is null)),
  constraint compliance_correction_has_reason check (
    version = 1 or (supersedes_id is not null and length(trim(coalesce(correction_reason, ''))) > 0))
);
comment on table public.adsb_compliance is 'Per-aircraft AD / SB compliance entries (D-016). Next due as entered, never calculated (D-021).';
-- One chain of entries per aircraft and document.
create unique index adsb_compliance_one_per_tail on public.adsb_compliance (aircraft_id, document_key) where version = 1;
create index adsb_compliance_aircraft on public.adsb_compliance (aircraft_id);
create trigger a1_no_update before update on public.adsb_compliance
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.adsb_compliance');

-- ------------------------------------------------------ Quality's decision ---
-- One decision per entry version: verified (countersigned) or rejected with
-- a reason. The first valid decision wins (D-105).
create table public.adsb_verification (
  id            uuid primary key default gen_random_uuid(),
  compliance_id uuid not null unique references public.adsb_compliance (id),
  decision      text not null check (decision in ('verified', 'rejected')),
  note          text,
  decided_by    uuid not null references public.person (id),
  decided_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  created_by    uuid,
  device_time   timestamptz,
  constraint rejection_has_reason check (decision <> 'rejected' or length(trim(coalesce(note, ''))) > 0)
);
comment on table public.adsb_verification is 'Quality verification of AD / SB entries, signed with PIN (D-016). Never edited.';
create trigger a1_no_update before update on public.adsb_verification
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.adsb_verification');

-- ------------------------------------------------------------------ flags ---
-- Today's date in the operator's time zone (D-055 setting).
create or replace function app.adsb_today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'))::date;
$$;

-- The D-028 rule for one figure: "reached" at or past the entered figure,
-- "approaching" inside the margin, otherwise nothing.
create or replace function app.adsb_figure_flag(p_current numeric, p_due numeric, p_margin numeric)
returns text
language sql immutable set search_path = ''
as $$
  select case
    when p_current is null or p_due is null then null
    when p_current >= p_due then 'reached'
    when p_current >= p_due - coalesce(p_margin, 0) then 'approaching'
  end;
$$;

-- The aircraft's current totals, IF the flight-records area has built
-- app.aircraft_totals(uuid). Looked up by name each time, so this works
-- before and after that function exists. Whatever shape it returns (a row
-- or a JSON object), hours and cycles are read from common column names.
-- Any problem → "not available", never an error and never a guess.
create or replace function app.adsb_aircraft_totals(
  p_aircraft uuid, out hours numeric, out cycles numeric, out available boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  j jsonb;
begin
  available := false;
  if to_regprocedure('app.aircraft_totals(uuid)') is null then
    return;
  end if;
  begin
    execute 'select to_jsonb(t) from app.aircraft_totals($1) as t limit 1' into j using p_aircraft;
    if j is null then
      return;
    end if;
    hours  := coalesce(j ->> 'total_hours', j ->> 'hours', j ->> 'flight_hours', j ->> 'airframe_hours',
                       j ->> 'total_fh', j ->> 'fh')::numeric;
    cycles := coalesce(j ->> 'total_cycles', j ->> 'cycles', j ->> 'flight_cycles', j ->> 'total_fc',
                       j ->> 'fc')::numeric;
    available := hours is not null or cycles is not null;
  exception when others then
    hours := null; cycles := null; available := false;
  end;
end;
$$;

-- All flags for one entry. Only open and recurring entries are flagged.
create or replace function app.adsb_due_flags(
  p_aircraft uuid, p_status text, p_next_on date, p_next_hours numeric, p_next_cycles numeric,
  out date_flag text, out hours_flag text, out cycles_flag text, out due_flag text,
  out current_hours numeric, out current_cycles numeric, out totals_available boolean)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_days   numeric := coalesce((app.setting('adsb.approaching_days'))::numeric,
                               (app.setting('attention.approaching_days'))::numeric, 30);
  v_hours  numeric := coalesce((app.setting('adsb.approaching_hours'))::numeric, 50);
  v_cycles numeric := coalesce((app.setting('adsb.approaching_cycles'))::numeric, 25);
  v_today  date := app.adsb_today();
  t        record;
begin
  totals_available := false;
  if p_status not in ('open', 'recurring') then
    return;
  end if;
  if p_next_on is not null then
    -- Days are compared as whole calendar days (today vs the entered date).
    date_flag := app.adsb_figure_flag(v_today - date '2000-01-01', p_next_on - date '2000-01-01', v_days);
  end if;
  if p_next_hours is not null or p_next_cycles is not null then
    select * into t from app.adsb_aircraft_totals(p_aircraft);
    totals_available := t.available;
    current_hours := t.hours;
    current_cycles := t.cycles;
    hours_flag  := app.adsb_figure_flag(t.hours, p_next_hours, v_hours);
    cycles_flag := app.adsb_figure_flag(t.cycles, p_next_cycles, v_cycles);
  end if;
  due_flag := case
    when 'reached' in (date_flag, hours_flag, cycles_flag) then 'reached'
    when 'approaching' in (date_flag, hours_flag, cycles_flag) then 'approaching'
  end;
end;
$$;

-- ------------------------------------------------------------------ views ---
-- The documents in force (newest version of each).
create view public.adsb_document_current
with (security_invoker = true) as
select d.id, d.document_key, d.version, d.doc_type, d.reference, d.title, d.issuing_authority,
       d.aircraft_type_code, d.applies_to_note, d.revision, d.effective_on, d.correction_reason,
       d.entered_by, p.three_letter_code as entered_by_tlc, d.created_at
  from public.adsb_document d
  left join public.person p on p.id = d.entered_by
 where not exists (select 1 from public.adsb_document n where n.supersedes_id = d.id);

-- The entries in force, with their document, who entered them, Quality's
-- decision ("awaiting" until there is one) and the D-028 flags.
create view public.adsb_compliance_current
with (security_invoker = true) as
select c.id, c.entry_key, c.version, c.aircraft_id, a.tail, a.aircraft_type_code,
       c.document_key, c.document_id, d.doc_type, d.reference, d.title, d.issuing_authority,
       d.revision as assessed_revision, dc.revision as current_revision,
       (dc.id is distinct from c.document_id) as document_revised,
       c.applicability, c.not_applicable_reason, c.compliance_method, c.status,
       c.last_complied_on, c.last_complied_hours, c.last_complied_cycles,
       c.next_due_on, c.next_due_hours, c.next_due_cycles, c.next_due_text,
       c.compliance_reference, c.remarks, c.correction_reason,
       c.entered_by, pe.three_letter_code as entered_by_tlc, c.entered_at,
       coalesce(v.decision, 'awaiting') as verification_state,
       v.note as verification_note, v.decided_at as verified_at, pv.three_letter_code as verified_by_tlc,
       f.date_flag, f.hours_flag, f.cycles_flag, f.due_flag, f.current_hours, f.current_cycles, f.totals_available
  from public.adsb_compliance c
  join public.aircraft a on a.id = c.aircraft_id
  join public.adsb_document d on d.id = c.document_id
  left join public.adsb_document_current dc on dc.document_key = c.document_key
  left join public.person pe on pe.id = c.entered_by
  left join public.adsb_verification v on v.compliance_id = c.id
  left join public.person pv on pv.id = v.decided_by
  cross join lateral app.adsb_due_flags(c.aircraft_id, c.status, c.next_due_on, c.next_due_hours,
                                        c.next_due_cycles::numeric) f
 where not exists (select 1 from public.adsb_compliance n where n.supersedes_id = c.id);

-- ---------------------------------------------------------------- helpers ---
-- Engineer in scope for this aircraft (D-016, D-121).
create or replace function app.adsb_require_engineer(p_aircraft uuid default null)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
begin
  if v_me is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can enter ADs and SBs (D-016).' using errcode = '42501';
  end if;
  if p_aircraft is not null and not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  return v_me;
end;
$$;

-- A trimmed text field from the form, or null when empty.
create or replace function app.adsb_text(p jsonb, p_key text)
returns text
language sql immutable set search_path = ''
as $$ select nullif(trim(p ->> p_key), ''); $$;

-- Check a document's fields and give plain-English refusals.
create or replace function app.adsb_check_document(p jsonb)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if coalesce(app.adsb_text(p, 'doc_type'), '') not in ('AD', 'SB') then
    raise exception 'Choose AD or SB.' using errcode = '23514';
  end if;
  if app.adsb_text(p, 'reference') is null then
    raise exception 'Enter the reference as printed on the document.' using errcode = '23514';
  end if;
  if app.adsb_text(p, 'title') is null then
    raise exception 'Enter the title.' using errcode = '23514';
  end if;
  if app.adsb_text(p, 'issuing_authority') is null then
    raise exception 'Enter the issuing authority (or the manufacturer for an SB).' using errcode = '23514';
  end if;
  if not exists (select 1 from public.aircraft_type t where t.code = app.adsb_text(p, 'aircraft_type_code')) then
    raise exception 'Choose the aircraft type the document applies to.' using errcode = '23514';
  end if;
end;
$$;

-- Same reference twice for the same type would split the record (one in force).
create or replace function app.adsb_check_unique_reference(p jsonb, p_except_key uuid)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext('adsb_doc:' || upper(app.adsb_text(p, 'reference'))));
  if exists (select 1 from public.adsb_document_current d
              where d.doc_type = app.adsb_text(p, 'doc_type')
                and upper(d.reference) = upper(app.adsb_text(p, 'reference'))
                and d.aircraft_type_code = app.adsb_text(p, 'aircraft_type_code')
                and d.document_key is distinct from p_except_key) then
    raise exception '% % is already in the register for the %. Correct that record instead (D-023).',
      app.adsb_text(p, 'doc_type'), app.adsb_text(p, 'reference'), app.adsb_text(p, 'aircraft_type_code')
      using errcode = '23505';
  end if;
end;
$$;

-- ---------------------------------------------------- register a document ---
-- p_fields: doc_type, reference, title, issuing_authority, aircraft_type_code,
--           applies_to_note, revision, effective_on (YYYY-MM-DD)
-- Returns the document_key.
create or replace function app.register_adsb_document(p_fields jsonb, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := app.adsb_require_engineer();
  v_key uuid := gen_random_uuid();   -- version 1's id is also the lasting key
begin
  perform app.adsb_check_document(p_fields);
  perform app.adsb_check_unique_reference(p_fields, null);
  insert into public.adsb_document (id, document_key, doc_type, reference, title, issuing_authority, aircraft_type_code,
                                    applies_to_note, revision, effective_on, entered_by, device_time)
  values (v_key, v_key, app.adsb_text(p_fields, 'doc_type'), app.adsb_text(p_fields, 'reference'), app.adsb_text(p_fields, 'title'),
          app.adsb_text(p_fields, 'issuing_authority'), app.adsb_text(p_fields, 'aircraft_type_code'),
          app.adsb_text(p_fields, 'applies_to_note'), app.adsb_text(p_fields, 'revision'),
          app.adsb_text(p_fields, 'effective_on')::date, v_me, p_device_time);
  return v_key;
end;
$$;

-- Correct a document (or record a new revision): a new version with a reason.
-- Returns the new version's id.
create or replace function app.correct_adsb_document(
  p_document_key uuid, p_fields jsonb, p_reason text, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid := app.adsb_require_engineer();
  cur   public.adsb_document;
  v_id  uuid;
begin
  select d.* into cur from public.adsb_document d
   where d.document_key = p_document_key
     and not exists (select 1 from public.adsb_document n where n.supersedes_id = d.id)
   for update;
  if not found then
    raise exception 'AD / SB not found.' using errcode = 'P0002';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for the correction (D-023).' using errcode = '23514';
  end if;
  perform app.adsb_check_document(p_fields);
  if app.adsb_text(p_fields, 'aircraft_type_code') <> cur.aircraft_type_code
     and exists (select 1 from public.adsb_compliance c where c.document_key = p_document_key) then
    raise exception 'Aircraft already have entries against this document for the %; the type cannot change. Register a separate record for the other type.',
      cur.aircraft_type_code using errcode = '23514';
  end if;
  perform app.adsb_check_unique_reference(p_fields, p_document_key);
  insert into public.adsb_document (document_key, version, supersedes_id, doc_type, reference, title,
                                    issuing_authority, aircraft_type_code, applies_to_note, revision,
                                    effective_on, correction_reason, entered_by, device_time)
  values (cur.document_key, cur.version + 1, cur.id, app.adsb_text(p_fields, 'doc_type'),
          app.adsb_text(p_fields, 'reference'), app.adsb_text(p_fields, 'title'),
          app.adsb_text(p_fields, 'issuing_authority'), app.adsb_text(p_fields, 'aircraft_type_code'),
          app.adsb_text(p_fields, 'applies_to_note'), app.adsb_text(p_fields, 'revision'),
          app.adsb_text(p_fields, 'effective_on')::date, trim(p_reason), v_me, p_device_time)
  returning id into v_id;
  return v_id;
end;
$$;

-- ------------------------------------------------------- write an entry ---
-- Checks the engineer's figures and writes one version. Shared by "enter"
-- and "correct". Every figure is stored as typed; nothing is worked out.
-- p_fields: applicability, not_applicable_reason, compliance_method, status,
--           last_complied_on, last_complied_hours, last_complied_cycles,
--           next_due_on, next_due_hours, next_due_cycles, next_due_text,
--           compliance_reference, remarks
create or replace function app.adsb_write_entry(
  p_aircraft uuid, p_document_key uuid, p_fields jsonb,
  p_entry_key uuid, p_version integer, p_supersedes uuid, p_reason text, p_device_time timestamptz)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me      uuid := app.current_person_id();
  v_doc     public.adsb_document;
  v_type    text;
  v_tail    text;
  v_app     text := app.adsb_text(p_fields, 'applicability');
  v_status  text := app.adsb_text(p_fields, 'status');
  v_method  text := app.adsb_text(p_fields, 'compliance_method');
  v_na      text := app.adsb_text(p_fields, 'not_applicable_reason');
  v_last_on date := app.adsb_text(p_fields, 'last_complied_on')::date;
  v_last_h  numeric := app.adsb_text(p_fields, 'last_complied_hours')::numeric;
  v_last_c  integer := app.adsb_text(p_fields, 'last_complied_cycles')::integer;
  v_next_on date := app.adsb_text(p_fields, 'next_due_on')::date;
  v_next_h  numeric := app.adsb_text(p_fields, 'next_due_hours')::numeric;
  v_next_c  integer := app.adsb_text(p_fields, 'next_due_cycles')::integer;
  v_next_t  text := app.adsb_text(p_fields, 'next_due_text');
  v_has_next boolean;
  v_id      uuid := gen_random_uuid();
begin
  select d.* into v_doc from public.adsb_document d
   where d.document_key = p_document_key
     and not exists (select 1 from public.adsb_document n where n.supersedes_id = d.id);
  if not found then
    raise exception 'AD / SB not found in the register.' using errcode = 'P0002';
  end if;
  select a.aircraft_type_code, a.tail into v_type, v_tail from public.aircraft a where a.id = p_aircraft;
  if v_doc.aircraft_type_code <> v_type then
    raise exception '% % is registered for the %; % is a %.', v_doc.doc_type, v_doc.reference,
      v_doc.aircraft_type_code, v_tail, v_type using errcode = '23514';
  end if;

  if coalesce(v_app, '') not in ('applicable', 'not_applicable') then
    raise exception 'Record whether the % applies to % (the engineer decides, D-016).', v_doc.doc_type, v_tail
      using errcode = '23514';
  end if;
  if coalesce(v_status, '') not in ('open', 'recurring', 'complied', 'not_applicable') then
    raise exception 'Choose a status: open, recurring, complied or not applicable.' using errcode = '23514';
  end if;
  if v_app = 'not_applicable' and v_status <> 'not_applicable' or v_app = 'applicable' and v_status = 'not_applicable' then
    raise exception 'Status "not applicable" goes with applicability "not applicable", and only with it.' using errcode = '23514';
  end if;
  if v_app = 'not_applicable' and v_na is null then
    raise exception 'Give the reason it does not apply (e.g. serial number outside the effectivity).' using errcode = '23514';
  end if;
  if v_status in ('complied', 'recurring') and v_method is null then
    raise exception 'Enter the compliance method (e.g. modification embodied, repetitive inspection).' using errcode = '23514';
  end if;
  if v_status = 'complied' and v_last_on is null and v_last_h is null and v_last_c is null then
    raise exception 'Enter when it was complied with (date and/or hours or cycles).' using errcode = '23514';
  end if;
  if v_last_on is not null and v_last_on > app.adsb_today() then
    raise exception 'The last-complied date cannot be in the future.' using errcode = '23514';
  end if;
  v_has_next := v_next_on is not null or v_next_h is not null or v_next_c is not null or v_next_t is not null;
  if v_status = 'recurring' and not v_has_next then
    raise exception 'A recurring item needs its next due as you work it out from the document: a date, hours, cycles or the limit in words. Nexus does not calculate it (D-021).'
      using errcode = '23514';
  end if;
  if v_status in ('complied', 'not_applicable') and v_has_next then
    raise exception 'A % entry has no next due. If it repeats, choose "recurring".',
      case v_status when 'complied' then 'complied' else 'not-applicable' end using errcode = '23514';
  end if;

  -- The first version's id is also the entry's lasting key (entry_key).
  insert into public.adsb_compliance (
    id, entry_key, version, supersedes_id, aircraft_id, document_key, document_id,
    applicability, not_applicable_reason, compliance_method, status,
    last_complied_on, last_complied_hours, last_complied_cycles,
    next_due_on, next_due_hours, next_due_cycles, next_due_text,
    compliance_reference, remarks, correction_reason, entered_by, device_time)
  values (
    v_id, coalesce(p_entry_key, v_id), p_version, p_supersedes, p_aircraft, p_document_key, v_doc.id,
    v_app, case when v_app = 'not_applicable' then v_na end, v_method, v_status,
    v_last_on, v_last_h, v_last_c,
    v_next_on, v_next_h, v_next_c, v_next_t,
    app.adsb_text(p_fields, 'compliance_reference'), app.adsb_text(p_fields, 'remarks'),
    nullif(trim(coalesce(p_reason, '')), ''), v_me, p_device_time);
  return v_id;
end;
$$;

-- An engineer records the first entry for this aircraft and document,
-- signed with PIN (D-016, D-094). Returns the entry's id.
create or replace function app.enter_adsb_compliance(
  p_aircraft uuid, p_document_key uuid, p_fields jsonb, p_pin text, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
begin
  perform app.adsb_require_engineer(p_aircraft);
  perform pg_advisory_xact_lock(hashtext('adsb:' || p_aircraft::text || ':' || p_document_key::text));
  if exists (select 1 from public.adsb_compliance c
              where c.aircraft_id = p_aircraft and c.document_key = p_document_key) then
    raise exception 'This aircraft already has an entry for this AD / SB. Correct it instead; the old version stays in history (D-023).'
      using errcode = '23505';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  return app.adsb_write_entry(p_aircraft, p_document_key, p_fields, null, 1, null, null, p_device_time);
end;
$$;

-- An engineer corrects the entry in force: a new version with a reason,
-- signed with PIN. The new version needs Quality's verification again.
create or replace function app.correct_adsb_compliance(
  p_entry uuid, p_fields jsonb, p_reason text, p_pin text, p_device_time timestamptz default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  cur public.adsb_compliance;
begin
  select * into cur from public.adsb_compliance where id = p_entry for update;
  if not found then
    raise exception 'AD / SB entry not found.' using errcode = 'P0002';
  end if;
  perform app.adsb_require_engineer(cur.aircraft_id);
  if exists (select 1 from public.adsb_compliance n where n.supersedes_id = cur.id) then
    raise exception 'This entry was corrected meanwhile. Review the newest version before correcting it (D-105).'
      using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for the correction (D-023).' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  return app.adsb_write_entry(cur.aircraft_id, cur.document_key, p_fields, cur.entry_key,
                              cur.version + 1, cur.id, p_reason, p_device_time);
end;
$$;

-- -------------------------------------------------- Quality verification ---
create or replace function app.adsb_decide(p_entry uuid, p_decision text, p_note text, p_pin text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
  cur  public.adsb_compliance;
  v_id uuid;
begin
  if v_me is null or not app.has_department('QUA') then
    raise exception 'Only Quality verifies AD and SB entries (D-016).' using errcode = '42501';
  end if;
  select * into cur from public.adsb_compliance where id = p_entry for update;
  if not found or not app.can_see_aircraft(cur.aircraft_id) then
    raise exception 'AD / SB entry not found.' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.adsb_compliance n where n.supersedes_id = cur.id) then
    raise exception 'This entry was corrected meanwhile. Review the newest version (D-105).' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.adsb_verification v where v.compliance_id = cur.id) then
    raise exception 'Quality has already decided on this version (D-105).' using errcode = 'P0001';
  end if;
  if cur.entered_by = v_me then
    raise exception 'You entered this record; another Quality person must verify it (separation of duties).'
      using errcode = '42501';
  end if;
  if p_decision = 'rejected' and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Give the reason for rejecting, so the engineer can correct it.' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  insert into public.adsb_verification (compliance_id, decision, note, decided_by)
  values (cur.id, p_decision, nullif(trim(coalesce(p_note, '')), ''), v_me)
  returning id into v_id;
  return v_id;
end;
$$;

-- Quality countersigns the entry with PIN.
create or replace function app.verify_adsb_compliance(p_entry uuid, p_pin text, p_note text default null)
returns uuid
language sql security definer set search_path = ''
as $$ select app.adsb_decide(p_entry, 'verified', p_note, p_pin); $$;

-- Quality rejects the entry with a reason; the engineer corrects it.
create or replace function app.reject_adsb_compliance(p_entry uuid, p_reason text, p_pin text)
returns uuid
language sql security definer set search_path = ''
as $$ select app.adsb_decide(p_entry, 'rejected', p_reason, p_pin); $$;

-- ---------------------------------------------------------------- security ---
-- Engineering and oversight see the register; entries for tails in scope
-- (D-120, D-121, D-125). Writes only through the functions above.
alter table public.adsb_document     enable row level security;
alter table public.adsb_compliance   enable row level security;
alter table public.adsb_verification enable row level security;

create policy read_eng_or_oversight on public.adsb_document for select to authenticated
  using (app.has_department('ENG') or app.is_oversight());
create policy read_in_scope on public.adsb_compliance for select to authenticated
  using (app.can_see_aircraft(aircraft_id) and (app.has_department('ENG') or app.is_oversight()));
create policy read_with_entry on public.adsb_verification for select to authenticated
  using (exists (select 1 from public.adsb_compliance c where c.id = compliance_id));

revoke insert, update, delete, truncate on public.adsb_document, public.adsb_compliance,
  public.adsb_verification from anon, authenticated;
revoke all on public.adsb_document, public.adsb_compliance, public.adsb_verification,
  public.adsb_document_current, public.adsb_compliance_current from anon;
revoke insert, update, delete, truncate on public.adsb_document_current, public.adsb_compliance_current
  from authenticated;
grant select on public.adsb_document, public.adsb_compliance, public.adsb_verification,
  public.adsb_document_current, public.adsb_compliance_current to authenticated;

-- Functions the screens call (0021: everything else stays locked).
grant execute on function
  app.register_adsb_document(jsonb, timestamptz),
  app.correct_adsb_document(uuid, jsonb, text, timestamptz),
  app.enter_adsb_compliance(uuid, uuid, jsonb, text, timestamptz),
  app.correct_adsb_compliance(uuid, jsonb, text, text, timestamptz),
  app.verify_adsb_compliance(uuid, text, text),
  app.reject_adsb_compliance(uuid, text, text),
  -- used by the adsb_compliance_current view, which runs with the user's rights
  app.adsb_due_flags(uuid, text, date, numeric, numeric)
to authenticated;
revoke execute on function
  app.adsb_decide(uuid, text, text, text),
  app.adsb_write_entry(uuid, uuid, jsonb, uuid, integer, uuid, text, timestamptz),
  app.adsb_require_engineer(uuid),
  app.adsb_check_document(jsonb),
  app.adsb_check_unique_reference(jsonb, uuid),
  app.adsb_aircraft_totals(uuid),
  app.adsb_figure_flag(numeric, numeric, numeric),
  app.adsb_text(jsonb, text),
  app.adsb_today()
from public, anon, authenticated;
