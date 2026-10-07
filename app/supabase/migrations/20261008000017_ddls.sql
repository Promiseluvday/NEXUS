-- =============================================================================
-- Nexus MRO · Phase 1 · 0017 Deferred Defects Log Sheet (DDLS)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English (D-053 to D-057, D-163, D-164):
--   Every tail has a DDLS: the list of deferred defects that DO concern
--   airworthiness.
--   * APPLY MEL: an engineer picks the MEL item (search in 0016). Category,
--     interval, remarks and revision come from the loaded MEL, not the
--     engineer (D-052). The engineer confirms (M) done, (O) passed to
--     Operations and placard fitted (D-053), signs with PIN as a certifying
--     engineer (D-104), and the deferral goes on the DDLS AUTOMATICALLY (D-163).
--   * DEFER ON DDLS (not MEL): for airworthiness-related defects outside the
--     MEL (e.g. damage within manual limits). Days allowed MUST carry a manual
--     reference (AMM, SRM...).
--   * COUNTDOWN (D-054, D-055): calendar-day limits count down to a due time.
--     The counting convention is a setting: whether the day of discovery
--     counts, and the operator's time zone. Flight-hour and cycle limits are
--     shown as written until flight records exist (Phase 2).
--   * EXTENSIONS (D-056, D-163): a separate approval, never an edit of the
--     deferral. MEL items only in the categories the operator allows (PAF:
--     B, C, D; never A).
--   * CLEARING: rectification actions, date, TLB book / page, certifying
--     engineer with PIN. The snag closes with it.
--   * PAGES: entries are numbered page by page per tail (4 per page for PAF,
--     a setting), like the paper sheet.
--   Nexus never grounds an aircraft when a limit passes (D-057): it shows it
--   as expired and the engineer decides.
-- =============================================================================

create table public.ddls_entry (
  id                uuid primary key default gen_random_uuid(),
  aircraft_id       uuid not null references public.aircraft (id),
  snag_id           uuid not null references public.snag (id),
  kind              text not null check (kind in ('mel', 'other')),
  page_no           integer not null,
  entry_no          integer not null,
  -- MEL items: copied from the loaded MEL at the moment of deferral (D-051, D-052)
  mel_item_id       uuid references public.mel_item (id),
  mel_revision_id   uuid references public.mel_revision (id),
  mel_ref           text,
  mel_category      text check (mel_category in ('A', 'B', 'C', 'D')),
  interval_value    numeric(8,1),
  interval_unit     text check (interval_unit in ('calendar_days', 'flight_hours', 'cycles', 'flights', 'as_specified')),
  -- Non-MEL items: days allowed and the manual reference that allows them
  days_allowed      integer check (days_allowed is null or days_allowed > 0),
  manual_reference  text,
  -- Common
  defect_text       text not null,
  m_required        boolean not null default false,
  o_required        boolean not null default false,
  m_done            boolean not null default false,
  o_passed          boolean not null default false,
  placard_fitted    boolean not null default false,
  remarks           text,
  tlb_book          text,
  tlb_page          text,
  tlb_item          text,
  deferred_by       uuid not null references public.person (id),
  deferred_at       timestamptz not null default now(),
  due_at            timestamptz,          -- calendar-day limits only
  limit_text        text,                 -- e.g. "10 flight hours", "As specified in the MEL"
  status            text not null default 'open' check (status in ('open', 'cleared')),
  cleared_by        uuid references public.person (id),
  cleared_at        timestamptz,
  rectification     text,
  rect_tlb_book     text,
  rect_tlb_page     text,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  device_time       timestamptz,
  unique (aircraft_id, page_no, entry_no),
  constraint mel_fields check (kind <> 'mel' or (mel_item_id is not null and mel_category is not null)),
  constraint other_needs_reference check (
    kind <> 'other' or (days_allowed is not null and length(trim(coalesce(manual_reference, ''))) > 0)),
  constraint clearing_recorded check (
    status <> 'cleared' or (cleared_by is not null and cleared_at is not null
                            and length(trim(coalesce(rectification, ''))) > 0))
);
comment on table public.ddls_entry is 'Deferred Defects Log Sheet (D-163). MEL deferrals are added automatically.';
select app.apply_standard_rules('public.ddls_entry');

create table public.ddls_extension (
  id                  uuid primary key default gen_random_uuid(),
  ddls_entry_id       uuid not null references public.ddls_entry (id),
  extra_days          integer not null check (extra_days > 0),
  authority_reference text not null check (length(trim(authority_reference)) > 0),
  reason              text not null check (length(trim(reason)) > 0),
  approval_request_id uuid references public.approval_request (id),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  previous_due_at     timestamptz,
  new_due_at          timestamptz,
  requested_by        uuid not null references public.person (id),
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz
);
comment on table public.ddls_extension is 'Extensions are separate approvals, never edits of the deferral (D-056).';
select app.apply_standard_rules('public.ddls_extension');

-- -----------------------------------------------------------------------------
-- Due time for a calendar-day limit (D-054, D-055). Settings:
--   operator.time_zone            e.g. "Africa/Lagos"
--   mel.discovery_day_counts      true / false (default false)
-- The limit ends at 23:59:59 local time on the last allowed day.
-- -----------------------------------------------------------------------------
create or replace function app.due_from_days(p_start timestamptz, p_days integer)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz     text := coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC');
  v_counts boolean := coalesce((app.setting('mel.discovery_day_counts'))::boolean, false);
  v_day    date := (p_start at time zone v_tz)::date;
  v_last   date;
begin
  v_last := v_day + p_days - case when v_counts then 1 else 0 end;
  return (v_last::timestamp + interval '23 hours 59 minutes 59 seconds') at time zone v_tz;
end;
$$;

-- Next page / entry number on a tail's DDLS.
create or replace function app.next_ddls_slot(p_aircraft uuid, out page_no integer, out entry_no integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_per  integer := coalesce((app.setting('ddls.entries_per_page'))::integer, 4);
  v_seq  bigint;
begin
  insert into app.number_series (series, last_value) values ('ddls:' || p_aircraft::text, 1)
  on conflict (series) do update set last_value = app.number_series.last_value + 1
  returning last_value into v_seq;
  page_no  := ((v_seq - 1) / v_per)::integer + 1;
  entry_no := ((v_seq - 1) % v_per)::integer + 1;
end;
$$;

-- -----------------------------------------------------------------------------
-- APPLY MEL to an attended snag (D-053, D-058, D-104, D-163).
-- -----------------------------------------------------------------------------
create or replace function app.apply_mel(
  p_snag uuid, p_mel_item uuid, p_pin text,
  p_m_done boolean, p_o_passed boolean, p_placard_fitted boolean,
  p_remarks text default null,
  p_tlb_book text default null, p_tlb_page text default null, p_tlb_item text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s      public.snag;
  i      public.mel_item;
  r      public.mel_revision;
  v_slot record;
  v_id   uuid;
begin
  s := app.snag_for_engineer(p_snag, array['attended']);
  select * into i from public.mel_item where id = p_mel_item;
  select * into r from public.mel_revision where id = i.revision_id;
  if r.status is distinct from 'active'
     or r.aircraft_type_code <> (select aircraft_type_code from public.aircraft where id = s.aircraft_id) then
    raise exception 'Use an item from the active MEL revision for this aircraft type (D-050, D-051).' using errcode = 'P0001';
  end if;
  if i.m_procedure and not coalesce(p_m_done, false) then
    raise exception 'Confirm the (M) maintenance procedure is done (D-053).' using errcode = '23514';
  end if;
  if i.o_procedure and not coalesce(p_o_passed, false) then
    raise exception 'Confirm the (O) procedure is passed to Operations (D-053).' using errcode = '23514';
  end if;
  if not coalesce(p_placard_fitted, false) then
    raise exception 'Confirm the placard is fitted (D-053).' using errcode = '23514';
  end if;
  perform app.require_certifying(s.aircraft_id, p_pin);

  select * into v_slot from app.next_ddls_slot(s.aircraft_id);
  insert into public.ddls_entry (
      aircraft_id, snag_id, kind, page_no, entry_no,
      mel_item_id, mel_revision_id, mel_ref, mel_category, interval_value, interval_unit,
      defect_text, m_required, o_required, m_done, o_passed, placard_fitted, remarks,
      tlb_book, tlb_page, tlb_item, deferred_by, due_at, limit_text)
  values (
      s.aircraft_id, s.id, 'mel', v_slot.page_no, v_slot.entry_no,
      i.id, r.id, i.item_number, i.category, i.interval_value, i.interval_unit,
      s.description, i.m_procedure, i.o_procedure, coalesce(p_m_done, false), coalesce(p_o_passed, false), true, p_remarks,
      coalesce(p_tlb_book, s.tlb_book), coalesce(p_tlb_page, s.tlb_page), coalesce(p_tlb_item, s.tlb_item),
      app.current_person_id(),
      case when i.interval_unit = 'calendar_days' then app.due_from_days(now(), i.interval_value::integer) end,
      case i.interval_unit
        when 'calendar_days' then null
        when 'flight_hours'  then i.interval_value::text || ' flight hours (counted from flight records, Phase 2)'
        when 'cycles'        then i.interval_value::text || ' cycles (counted from flight records, Phase 2)'
        when 'flights'       then i.interval_value::text || ' flights (counted from flight records, Phase 2)'
        else 'As specified in the MEL item'
      end)
  returning id into v_id;

  update public.snag
     set status = 'deferred', disposition = 'mel',
         dispositioned_by = app.current_person_id(), dispositioned_at = now()
   where id = s.id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- DEFER ON DDLS, not MEL (D-163): days allowed with a manual reference.
-- -----------------------------------------------------------------------------
create or replace function app.defer_on_ddls(
  p_snag uuid, p_days_allowed integer, p_manual_reference text, p_pin text,
  p_m_required boolean default false, p_o_required boolean default false,
  p_remarks text default null,
  p_tlb_book text default null, p_tlb_page text default null, p_tlb_item text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s      public.snag;
  v_slot record;
  v_id   uuid;
begin
  s := app.snag_for_engineer(p_snag, array['attended']);
  if length(trim(coalesce(p_manual_reference, ''))) = 0 then
    raise exception 'Days allowed must carry a manual reference (AMM, SRM...) (D-163).' using errcode = '23514';
  end if;
  perform app.require_certifying(s.aircraft_id, p_pin);
  select * into v_slot from app.next_ddls_slot(s.aircraft_id);
  insert into public.ddls_entry (
      aircraft_id, snag_id, kind, page_no, entry_no, days_allowed, manual_reference,
      defect_text, m_required, o_required, remarks, tlb_book, tlb_page, tlb_item,
      deferred_by, due_at)
  values (
      s.aircraft_id, s.id, 'other', v_slot.page_no, v_slot.entry_no, p_days_allowed, p_manual_reference,
      s.description, p_m_required, p_o_required, p_remarks,
      coalesce(p_tlb_book, s.tlb_book), coalesce(p_tlb_page, s.tlb_page), coalesce(p_tlb_item, s.tlb_item),
      app.current_person_id(), app.due_from_days(now(), p_days_allowed))
  returning id into v_id;
  update public.snag
     set status = 'deferred', disposition = 'ddls',
         dispositioned_by = app.current_person_id(), dispositioned_at = now()
   where id = s.id;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- CLEAR a DDLS entry: rectified, signed by a certifying engineer. Closes the snag.
-- -----------------------------------------------------------------------------
create or replace function app.clear_ddls_entry(
  p_entry uuid, p_rectification text, p_pin text,
  p_rect_tlb_book text default null, p_rect_tlb_page text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  e public.ddls_entry;
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can clear a DDLS entry.' using errcode = '42501';
  end if;
  select * into e from public.ddls_entry where id = p_entry for update;
  if not found or e.status <> 'open' then
    raise exception 'This DDLS entry is not open.' using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_rectification, ''))) = 0 then
    raise exception 'Describe the rectification actions.' using errcode = '23514';
  end if;
  perform app.require_certifying(e.aircraft_id, p_pin);
  update public.ddls_entry
     set status = 'cleared', cleared_by = app.current_person_id(), cleared_at = now(),
         rectification = p_rectification, rect_tlb_book = p_rect_tlb_book, rect_tlb_page = p_rect_tlb_page
   where id = p_entry;
  update public.snag
     set status = 'closed', closed_by = app.current_person_id(), closed_at = now(),
         closure_note = 'DDLS page ' || e.page_no || ' entry ' || e.entry_no || ' cleared: ' || p_rectification
   where id = e.snag_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- EXTENSION (D-056, D-163): a separate approval. MEL items only in the
-- categories the operator allows (setting ddls.extension_categories).
-- -----------------------------------------------------------------------------
create or replace function app.request_ddls_extension(
  p_entry uuid, p_extra_days integer, p_authority_reference text, p_reason text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  e    public.ddls_entry;
  v_id uuid;
begin
  if app.current_person_id() is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can request an extension.' using errcode = '42501';
  end if;
  select * into e from public.ddls_entry where id = p_entry;
  if not found or e.status <> 'open' then
    raise exception 'This DDLS entry is not open.' using errcode = 'P0001';
  end if;
  if e.kind = 'mel' and not (coalesce(app.setting('ddls.extension_categories'), '["B","C","D"]') ? e.mel_category) then
    raise exception 'MEL category % items cannot be extended (D-163).', e.mel_category using errcode = '42501';
  end if;
  if e.due_at is null then
    raise exception 'Only calendar-day limits can be extended here.' using errcode = 'P0001';
  end if;
  insert into public.ddls_extension (ddls_entry_id, extra_days, authority_reference, reason, requested_by)
  values (p_entry, p_extra_days, p_authority_reference, p_reason, app.current_person_id())
  returning id into v_id;
  update public.ddls_extension
     set approval_request_id = app.raise_approval('ddls_extension', 'ddls_entry', p_entry,
           'DDLS extension +' || p_extra_days || ' days · ' || coalesce(e.mel_ref, e.manual_reference))
   where id = v_id;
  return v_id;
end;
$$;

create or replace function app.ddls_extension_follow_approval()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  x public.ddls_extension;
  e public.ddls_entry;
begin
  if new.action_type <> 'ddls_extension' or new.status not in ('approved', 'rejected') then
    return null;
  end if;
  select * into x from public.ddls_extension where approval_request_id = new.id;
  if not found then
    return null;
  end if;
  if new.status = 'rejected' then
    update public.ddls_extension set status = 'rejected' where id = x.id;
    return null;
  end if;
  select * into e from public.ddls_entry where id = x.ddls_entry_id for update;
  update public.ddls_extension
     set status = 'approved', previous_due_at = e.due_at, new_due_at = e.due_at + make_interval(days => x.extra_days)
   where id = x.id;
  update public.ddls_entry set due_at = e.due_at + make_interval(days => x.extra_days) where id = e.id;
  return null;
end;
$$;
create trigger ddls_extension_follow_approval after update on public.approval_request
  for each row execute function app.ddls_extension_follow_approval();

-- -----------------------------------------------------------------------------
-- Security: Engineering, Operations (needs the MEL and (O) items, D-120) and
-- oversight, for aircraft in scope. Changes only through the functions above.
-- -----------------------------------------------------------------------------
alter table public.ddls_entry     enable row level security;
alter table public.ddls_extension enable row level security;
create policy read_in_scope on public.ddls_entry for select to authenticated
  using (app.can_see_aircraft(aircraft_id)
         and (app.has_department('ENG') or app.has_department('OPS') or app.is_oversight()));
create policy read_with_entry on public.ddls_extension for select to authenticated
  using (exists (select 1 from public.ddls_entry e where e.id = ddls_extension.ddls_entry_id));
revoke insert, update, delete, truncate on public.ddls_entry, public.ddls_extension from anon, authenticated;
revoke all on public.ddls_entry, public.ddls_extension from anon;
