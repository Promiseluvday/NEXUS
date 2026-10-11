-- =============================================================================
-- Nexus MRO · Migration 0033 · Operator numbering, work order revisions and the
-- "In work" chip (D-064, D-220, D-200)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--   1. Document numbers follow the operator's own style (D-220). Each kind of
--      document has a format setting, e.g. "{ORG}/{YYYY}/WO/{0000}", which
--      gives SMP/2026/WO/0001. Placeholders:
--        {ORG}   the operator's short code (setting operator.code)
--        {UNIT}  the unit or station code (setting operator.unit_code)
--        {YYYY} {YY} {MM}   year and month, in the operator's time zone
--        {TAIL}  the tail (work orders only)
--        {0000}  the running number; the number of digits sets the width.
--                Typing {0035} means "4 digits, continue from 35".
--      A format with a year starts the running number again at 1 each
--      January. Changing a format only affects new documents: numbers
--      already issued never change (D-023). Nexus never issues a number that
--      is already taken.
--      Super Admins and Quality change formats, with a reason and their PIN.
--   2. A work order can be corrected (revised) before the work is complete.
--      Each correction is kept and the number shows its revision, e.g.
--      "WO-000002 R1" (format setting work_order.revision_format). A revised
--      work order goes back to Quality and the CO: work stops until the
--      revision is approved (D-063).
--   3. The fleet board gives the open work order for each tail, for the
--      amber "In work · WO-…" chip beside the status (option B, 11 Oct).
--      Only Engineering and oversight get it: pilots don't see work orders
--      (D-120).
-- =============================================================================

-- ------------------------------------------------------------ settings -----
-- Sample values only (D-112). Each operator sets its own on the Numbering screen.
insert into public.operator_setting (key, value, reason) values
  ('operator.code',               '"SMP"',             'Initial set-up (D-220): operator code for document numbers'),
  ('operator.unit_code',          '"9XT01"',           'Initial set-up (D-220): unit or station code for document numbers'),
  ('work_order.revision_format',  '"{NUMBER} R{REV}"', 'Initial set-up (D-220): how a corrected work order shows its revision');

-- The documents Nexus numbers, and where each number is kept (to avoid
-- ever issuing one that is already taken).
create or replace function app.numbered_documents()
returns table (series text, label text, code text, default_format text, tbl text, col text)
language sql immutable set search_path = ''
as $$
  values
    ('work_order',      'Work orders',        'WO',   'WO-{000000}',   'work_order',        'number'),
    ('snag',            'Snags',              'SNAG', 'SNAG-{000000}', 'snag',              'number'),
    ('nadd',            'NADDs',              'NADD', 'NADD-{000000}', 'nadd',              'number'),
    ('technical_query', 'Technical queries',  'TQ',   'TQ-{000000}',   'technical_query',   'number'),
    ('part_request',    'Part requests',      'PR',   'PR-{000000}',   'part_request',      'number'),
    ('issue_voucher',   'Issue vouchers',     'IV',   'IV-{000000}',   'part_request_line', 'issue_voucher'),
    ('stock_receipt',   'Stock receipts',     'RCV',  'RCV-{000000}',  'stock_receipt',     'number'),
    ('stock_transfer',  'Stock transfers',    'TRF',  'TRF-{000000}',  'stock_transfer',    'number'),
    ('us_return',       'U/S returns',        'USR',  'USR-{000000}',  'us_return',         'number'),
    ('requisition',     'Requisitions',       'REQ',  'REQ-{000000}',  'requisition',       'number'),
    ('purchase_order',  'Purchase orders',    'PO',   'PO-{000000}',   'purchase_order',    'number'),
    ('outside_mro_job', 'Outside-MRO jobs',   'MRO',  'MRO-{000000}',  'outside_mro_job',   'number')
$$;

create or replace function app.operator_local_time(p_at timestamptz)
returns timestamp
language sql stable security definer set search_path = ''
as $$ select p_at at time zone coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'); $$;

-- Fill a format in: placeholders, then the running number.
create or replace function app.format_number(p_format text, p_n bigint, p_at timestamptz, p_tail text)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  v       text := p_format;
  v_local timestamp := app.operator_local_time(p_at);
  v_token text;
  v_width int;
begin
  v := replace(v, '{ORG}',  coalesce(app.setting('operator.code') #>> '{}', ''));
  v := replace(v, '{UNIT}', coalesce(app.setting('operator.unit_code') #>> '{}', ''));
  v := replace(v, '{YYYY}', to_char(v_local, 'YYYY'));
  v := replace(v, '{YY}',   to_char(v_local, 'YY'));
  v := replace(v, '{MM}',   to_char(v_local, 'MM'));
  v := replace(v, '{TAIL}', coalesce(p_tail, ''));
  v_token := substring(v from '\{[0-9]+\}');
  if v_token is null then
    return v || p_n::text;
  end if;
  v_width := length(v_token) - 2;
  -- Past the width, the number simply grows (WO99 → WO100), never cut short.
  return replace(v, v_token, case when length(p_n::text) >= v_width then p_n::text
                                  else lpad(p_n::text, v_width, '0') end);
end;
$$;

-- Which counter a format uses: one for ever, or one per year if the format
-- shows the year (the running number starts again each January).
create or replace function app.number_counter(p_series text, p_format text, p_at timestamptz)
returns text
language sql stable security definer set search_path = ''
as $$
  select p_series || case when p_format ~ '\{YY(YY)?\}'
                          then ':' || to_char(app.operator_local_time(p_at), 'YYYY') else '' end;
$$;

-- Hand out the next number. Replaces the 0011 version: same name, plus the
-- tail for {TAIL}, year counters, and never a number already in use.
create or replace function app.next_number(p_series text, p_default_format text, p_tail text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_format text := coalesce(app.setting(p_series || '.number_format') #>> '{}', p_default_format);
  v_key    text := app.number_counter(p_series, v_format, now());
  d        record;
  v_n      bigint;
  v_num    text;
  v_taken  boolean;
  v_tries  int := 0;
begin
  select * into d from app.numbered_documents() nd where nd.series = p_series;
  loop
    insert into app.number_series (series, last_value) values (v_key, 1)
    on conflict (series) do update set last_value = app.number_series.last_value + 1
    returning last_value into v_n;
    v_num := app.format_number(v_format, v_n, now(), p_tail);
    exit when d.tbl is null;
    execute format('select exists (select 1 from public.%I where %I = $1)', d.tbl, d.col) into v_taken using v_num;
    exit when not v_taken;
    v_tries := v_tries + 1;
    if v_tries >= 1000 then
      raise exception 'No free % number with the format "%". Ask a Super Admin or Quality to change it (D-220).',
        d.label, v_format using errcode = 'P0001';
    end if;
  end loop;
  return v_num;
end;
$$;

create or replace function app.next_number(p_series text, p_default_format text)
returns text
language sql
security definer
set search_path = ''
as $$ select app.next_number(p_series, p_default_format, null); $$;

-- Check a format a person typed. Returns it with the running number as
-- zeros, and the number to continue from ({0035} → 35), or 0.
create or replace function app.check_number_format(p_series text, p_format text, out format text, out start_at bigint)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v       text := trim(coalesce(p_format, ''));
  v_token text;
begin
  if length(v) = 0 or length(v) > 40 then
    raise exception 'A number format is 1 to 40 characters.' using errcode = '22023';
  end if;
  if regexp_replace(v, '\{(ORG|UNIT|YYYY|YY|MM|TAIL|[0-9]+)\}', '', 'g') !~ '^[A-Za-z0-9/._-]*$' then
    raise exception 'Use letters, digits, / - . _ and the placeholders {ORG} {UNIT} {YYYY} {YY} {MM}%{0000} only.',
      case when p_series = 'work_order' then ' {TAIL} ' else ' ' end using errcode = '22023';
  end if;
  if (select count(*) from regexp_matches(v, '\{[0-9]+\}', 'g')) <> 1 then
    raise exception 'The format needs the running number once, e.g. {0000}.' using errcode = '22023';
  end if;
  v_token := substring(v from '\{([0-9]+)\}');
  if length(v_token) not between 2 and 10 then
    raise exception 'The running number has 2 to 10 digits, e.g. {00} or {0000}.' using errcode = '22023';
  end if;
  if v ~ '\{TAIL\}' and p_series <> 'work_order' then
    raise exception '{TAIL} is for work orders only.' using errcode = '22023';
  end if;
  if v ~ '\{MM\}' and v !~ '\{YY(YY)?\}' then
    raise exception 'A format with the month {MM} also needs the year {YY} or {YYYY}.' using errcode = '22023';
  end if;
  start_at := v_token::bigint;
  format := replace(v, '{' || v_token || '}', '{' || repeat('0', length(v_token)) || '}');
end;
$$;

-- The next number a format would give, without using it up.
create or replace function app.preview_number(p_series text, p_format text default null)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  d       record;
  f       record;
  v_key   text;
  v_last  bigint;
begin
  select * into d from app.numbered_documents() nd where nd.series = p_series;
  if not found then
    raise exception 'Unknown document type %.', p_series using errcode = '22023';
  end if;
  select * into f from app.check_number_format(p_series,
         coalesce(p_format, app.setting(p_series || '.number_format') #>> '{}', d.default_format));
  v_key := app.number_counter(p_series, f.format, now());
  select last_value into v_last from app.number_series where series = v_key;
  return app.format_number(f.format, greatest(coalesce(v_last, 0) + 1, f.start_at), now(),
                           (select a.tail from public.aircraft a where a.status = 'active' order by a.tail limit 1));
end;
$$;

create or replace function app.can_manage_numbering()
returns boolean
language sql stable security definer set search_path = ''
as $$ select app.current_person_id() is not null and (app.is_super_admin() or app.has_department('QUA')); $$;

-- The Numbering screen: each document, its format and the next number.
create or replace function app.numbering_settings()
returns table (series text, label text, code text, format text, next_number text,
               version integer, changed_by text, changed_at timestamptz, reason text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app.can_manage_numbering() then
    raise exception 'Numbering is set by Super Admins and Quality (D-220).' using errcode = '42501';
  end if;
  return query
    select d.series, d.label, d.code,
           coalesce(s.value #>> '{}', d.default_format),
           app.preview_number(d.series),
           s.version, p.three_letter_code, s.created_at, s.reason
      from app.numbered_documents() d
      left join lateral (select o.* from public.operator_setting o
                          where o.key = d.series || '.number_format' and o.effective_from <= now()
                          order by o.version desc limit 1) s on true
      left join public.person p on p.id = s.created_by;
end;
$$;

-- Change a number format, the operator / unit code, or the revision format.
create or replace function app.set_numbering_setting(p_key text, p_value text, p_reason text, p_pin text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_series text;
  v_value  text := trim(coalesce(p_value, ''));
  f        record;
  v_key    text;
begin
  if not app.can_manage_numbering() then
    raise exception 'Numbering is set by Super Admins and Quality (D-220).' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for the change.' using errcode = '23514';
  end if;

  if p_key in ('operator.code', 'operator.unit_code') then
    v_value := upper(v_value);
    if v_value !~ '^[A-Z0-9]{1,10}$' then
      raise exception 'A code is 1 to 10 letters or digits, no spaces or symbols.' using errcode = '22023';
    end if;
  elsif p_key = 'work_order.revision_format' then
    if v_value !~ '\{NUMBER\}' or v_value !~ '\{REV\}' or length(v_value) > 30
       or regexp_replace(v_value, '\{(NUMBER|REV)\}', '', 'g') !~ '^[A-Za-z0-9/._ ()-]*$' then
      raise exception 'The revision format needs {NUMBER} and {REV}, e.g. "{NUMBER} R{REV}".' using errcode = '22023';
    end if;
  elsif p_key ~ '\.number_format$' then
    v_series := regexp_replace(p_key, '\.number_format$', '');
    if not exists (select 1 from app.numbered_documents() d where d.series = v_series) then
      raise exception 'Unknown document type %.', v_series using errcode = '22023';
    end if;
    select * into f from app.check_number_format(v_series, v_value);
    v_value := f.format;
  else
    raise exception 'Only numbering settings are changed here.' using errcode = '22023';
  end if;

  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  insert into public.operator_setting (key, value, reason) values (p_key, to_jsonb(v_value), trim(p_reason));

  -- {0035}: carry on from 35 (e.g. after a paper system). Never goes back.
  if v_series is not null then
    if f.start_at > 1 then
      v_key := app.number_counter(v_series, f.format, now());
      insert into app.number_series (series, last_value) values (v_key, f.start_at - 1)
      on conflict (series) do update set last_value = greatest(app.number_series.last_value, excluded.last_value);
    end if;
  end if;
  return case when v_series is not null then app.preview_number(v_series) else v_value end;
end;
$$;

-- ------------------------------------------------------ work order revisions -----
alter table public.work_order add column revision integer not null default 0 check (revision >= 0);

create table public.work_order_revision (
  id                     uuid primary key default gen_random_uuid(),
  work_order_id          uuid not null references public.work_order (id),
  revision               integer not null check (revision >= 1),
  previous_scope         text not null,
  scope                  text not null check (length(trim(scope)) > 0),
  previous_est_man_hours numeric(6,1),
  est_man_hours          numeric(6,1) check (est_man_hours is null or est_man_hours >= 0),
  previous_status        text not null,
  reason                 text not null check (length(trim(reason)) > 0),
  revised_by             uuid not null references public.person (id),
  created_at             timestamptz not null default now(),
  created_by             uuid,
  device_time            timestamptz,
  unique (work_order_id, revision)
);
comment on table public.work_order_revision is 'Corrections to a work order (R1, R2 …). Append-only (D-023, D-220).';
create trigger a1_no_update before update on public.work_order_revision
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.work_order_revision');
alter table public.work_order_revision enable row level security;
create policy read_with_work_order on public.work_order_revision for select to authenticated
  using (exists (select 1 from public.work_order w where w.id = work_order_revision.work_order_id));
revoke insert, update, delete, truncate on public.work_order_revision from anon, authenticated;
revoke all on public.work_order_revision from anon;

-- A work order's number as shown: "WO-000002", or "WO-000002 R1" once revised.
create or replace function app.work_order_label(p_number text, p_revision integer)
returns text
language sql stable security definer set search_path = ''
as $$
  select case when coalesce(p_revision, 0) = 0 then p_number
              else replace(replace(coalesce(app.setting('work_order.revision_format') #>> '{}', '{NUMBER} R{REV}'),
                                   '{NUMBER}', p_number), '{REV}', p_revision::text) end;
$$;

-- Correct a work order's scope or estimate, before the work is complete.
-- It goes back to Quality and the CO; work stops until they approve.
create or replace function app.revise_work_order(p_wo uuid, p_scope text, p_est_man_hours numeric,
                                                 p_reason text, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  w       public.work_order;
  v_rev   integer;
  v_scope text := trim(coalesce(p_scope, ''));
  v_label text;
  v_snag  text;
begin
  w := app.work_order_for_engineer(p_wo, array['requested', 'pre_approved', 'open']);
  if length(v_scope) = 0 then
    raise exception 'Give the scope of work.' using errcode = '23514';
  end if;
  if p_est_man_hours is not null and p_est_man_hours < 0 then
    raise exception 'Estimated man-hours cannot be negative.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for the correction.' using errcode = '23514';
  end if;
  if v_scope = w.scope and p_est_man_hours is not distinct from w.est_man_hours then
    raise exception 'Nothing has changed: correct the scope or the estimate.' using errcode = '22023';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;

  v_rev := w.revision + 1;
  insert into public.work_order_revision (work_order_id, revision, previous_scope, scope, previous_est_man_hours,
                                          est_man_hours, previous_status, reason, revised_by)
  values (w.id, v_rev, w.scope, v_scope, w.est_man_hours, p_est_man_hours, w.status, trim(p_reason),
          app.current_person_id());

  -- The approval of the old wording no longer counts.
  update public.approval_request set status = 'cancelled', decided_at = now()
   where id = w.approval_request_id and status = 'pending';

  v_label := app.work_order_label(w.number, v_rev);
  select s.number into v_snag from public.snag s where s.id = w.snag_id;
  update public.work_order
     set scope = v_scope, est_man_hours = p_est_man_hours, revision = v_rev, status = 'requested'
   where id = w.id;
  update public.work_order
     set approval_request_id = app.raise_approval('work_order', 'work_order', w.id,
           v_label || coalesce(' · ' || v_snag, '') || ' · ' || left(v_scope, 80))
   where id = w.id;
  return jsonb_build_object('revision', v_rev, 'label', v_label);
end;
$$;

-- ------------------------------------------------ request: tail in the number -----
create or replace function app.request_work_order(p_snag uuid, p_scope text, p_est_man_hours numeric default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  s     public.snag;
  v_wo  uuid;
  v_num text;
  v_open text;
begin
  s := app.snag_for_engineer(p_snag, array['attended', 'deferred']);
  select number into v_open from public.work_order
   where snag_id = s.id and status in ('requested', 'pre_approved', 'open', 'work_complete') limit 1;
  if v_open is not null then
    raise exception 'Snag % already has work order % in progress.', s.number, v_open using errcode = 'P0001';
  end if;
  v_num := app.next_number('work_order', 'WO-{000000}',
                           (select a.tail from public.aircraft a where a.id = s.aircraft_id));
  insert into public.work_order (number, aircraft_id, snag_id, scope, est_man_hours, requested_by)
  values (v_num, s.aircraft_id, s.id, p_scope, p_est_man_hours, app.current_person_id())
  returning id into v_wo;

  update public.work_order
     set approval_request_id = app.raise_approval('work_order', 'work_order', v_wo,
                                                  v_num || ' · ' || s.number || ' · ' || left(p_scope, 80))
   where id = v_wo;

  if s.status = 'attended' then
    update public.snag
       set status = 'in_work', disposition = 'rectify_now',
           dispositioned_by = app.current_person_id(), dispositioned_at = now()
     where id = s.id;
  end if;
  return v_wo;
end;
$$;

-- --------------------------------------------------- fleet board: In work -----
-- Same as 0020, plus in_work_ref: the oldest work order still open on the
-- tail (requested to awaiting certification), "+N" if there are more.
drop function app.fleet_board();
create function app.fleet_board()
returns table (
  aircraft_id       uuid,
  tail              text,
  aircraft_type     text,
  status            text,
  status_set_by     text,
  status_set_at     timestamptz,
  expected_rts_on   date,
  snag_display      text,
  open_snags        integer,
  open_ddls         integer,
  next_ddls_due     timestamptz,
  open_nadds        integer,
  next_nadd_due     timestamptz,
  blocked_by        text,
  blocked_ref       text,
  blocked_holder    text,
  blocked_since     timestamptz,
  in_work_ref       text)      -- e.g. "WO-000002" or "WO-000002 R1 +1"; null for pilots (D-120)
language sql
stable
security definer
set search_path = ''
as $$
  with visible as (
    select a.* from public.aircraft a
     where a.status = 'active' and app.can_see_aircraft(a.id)),
  cur as (
    select distinct on (e.aircraft_id) e.aircraft_id, e.status, e.set_at, e.expected_rts_on, p.three_letter_code
      from public.tail_status_event e join public.person p on p.id = e.set_by
     order by e.aircraft_id, e.set_at desc),
  holds as (
    select s.aircraft_id, 'Snag open, awaiting engineer' as what, s.number as ref,
           'Engineering' as holder, s.created_at as since
      from public.snag s where s.status = 'reported'
    union all
    select s.aircraft_id, 'Snag attended, disposition pending', s.number, 'Engineering', s.attended_at
      from public.snag s where s.status = 'attended'
    union all
    select w.aircraft_id,
           'Work order awaiting ' || st.name, app.work_order_label(w.number, w.revision),
           coalesce(ap.title, d.name), coalesce(
             (select max(dd.created_at) from public.approval_decision dd where dd.request_id = r.id), r.raised_at)
      from public.work_order w
      join public.approval_request r on r.id = w.approval_request_id and r.status = 'pending'
      join public.approval_chain_step st on st.action_type = r.action_type and st.step_no = r.current_step
      left join public.appointment ap on ap.id = st.appointment_id
      left join public.department d on d.code = st.department_code
    union all
    select w.aircraft_id, 'Work order in progress', app.work_order_label(w.number, w.revision), 'Engineering', r.decided_at
      from public.work_order w join public.approval_request r on r.id = w.approval_request_id
     where w.status = 'open'
    union all
    select w.aircraft_id, 'Work order awaiting certification', app.work_order_label(w.number, w.revision),
           'Engineering', w.work_completed_at
      from public.work_order w where w.status = 'work_complete'),
  sees_wo as (select app.has_department('ENG') or app.is_oversight() as yes)
  select v.id, v.tail, v.aircraft_type_code,
         c.status, c.three_letter_code, c.set_at, c.expected_rts_on,
         case when exists (select 1 from public.snag s where s.aircraft_id = v.id and s.status = 'reported') then 'snag_open'
              when exists (select 1 from public.snag s where s.aircraft_id = v.id and s.status = 'attended') then 'snag_attended'
         end,
         (select count(*)::integer from public.snag s where s.aircraft_id = v.id and s.status <> 'closed'),
         (select count(*)::integer from public.ddls_entry e where e.aircraft_id = v.id and e.status = 'open'),
         (select min(e.due_at) from public.ddls_entry e where e.aircraft_id = v.id and e.status = 'open'),
         (select count(*)::integer from public.nadd n where n.aircraft_id = v.id and n.status = 'open'),
         (select min(n.due_at) from public.nadd n where n.aircraft_id = v.id and n.status = 'open'),
         b.what, b.ref, b.holder, b.since,
         (select app.work_order_label(x.number, x.revision) || case when x.n > 1 then ' +' || (x.n - 1) else '' end
            from (select w.number, w.revision, count(*) over () as n
                    from public.work_order w
                   where w.aircraft_id = v.id and w.status in ('requested', 'pre_approved', 'open', 'work_complete')
                   order by w.created_at, w.number limit 1) x
           where (select yes from sees_wo))
    from visible v
    left join cur c on c.aircraft_id = v.id
    left join lateral (select h.* from holds h where h.aircraft_id = v.id order by h.since asc limit 1) b on true
   order by v.tail;
$$;
comment on function app.fleet_board() is 'Fleet board rows for the signed-in user (D-006, D-046, D-120, D-200, D-220).';

-- ------------------------------------------------------------------ access -----
grant execute on function
  app.fleet_board(),
  app.revise_work_order(uuid, text, numeric, text, text),
  app.numbering_settings(),
  app.preview_number(text, text),
  app.set_numbering_setting(text, text, text, text)
to authenticated;
