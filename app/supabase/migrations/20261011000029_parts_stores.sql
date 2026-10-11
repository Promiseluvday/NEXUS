-- =============================================================================
-- Nexus MRO · Phase 2 · Migration 0029 · Parts and stores (core slice)
-- Proprietary to Liebetag. All rights reserved.
--
-- What this file does, in plain English:
--
--   PART CATALOGUE  public.part
--     Part number, description, class (component or consumable), unit, and
--     whether shelf life and serial numbers are tracked. Supply catalogues.
--
--   STOCK  public.stock_lot  +  public.stock_movement (the ledger)
--     A "lot" is one batch (consumables) or one serial number (components) in
--     one store (D-141). It carries its certificate status, shelf-life expiry
--     and condition: serviceable, quarantine or unserviceable (D-072, D-148).
--     EVERY change of quantity or condition is a line in the ledger
--     (receipt, reserve, unreserve, issue, return, transfer out / in,
--     quarantine, release, U/S return). Ledger lines are never edited or
--     deleted (D-023). The quantity shown on a lot is simply the running
--     total of its ledger lines, kept up to date by the database itself.
--
--   PART REQUESTS  public.part_request  +  public.part_request_line
--     Engineering asks for a part (D-143):
--       * aircraft part: needs a tail AND a work order;
--       * consumable: needs a work order OR a stated purpose ("General use").
--     Stock is reserved by the SERVER the moment the request arrives, so two
--     engineers can never both take the last unit (D-071, D-145). A request
--     made offline waits on the tablet as "Queued, not reserved" until then.
--     Reserving is allowed before the work order is approved; ISSUING only
--     after Quality and the CO approved it (D-068).
--     If there is not enough stock the line is split: what is in stock is
--     reserved, the rest is marked "needs requisition" for Supply and
--     Procurement (D-073, D-145).
--     AOG priority: any engineer may ask for it. It is confirmed only when the
--     tail's current status (set by an engineer) is U/S or AOG, or a
--     certifying engineer confirms it with PIN (D-147).
--
--   ISSUE  (Supply, permission "Issue parts")
--     Expired or uncertified stock can never be issued (D-148). Every issue
--     gets an issue voucher number from the server (D-064 style series).
--
--   RECEIVING INSPECTION  public.stock_receipt  (Supply, "Receive parts")
--     Release documents (certificate + serviceable tag, as Quality configured
--     per part class) must be attached before acceptance (D-153). Only Supply
--     marks a part available (D-074). The accepted certificate type, from
--     Quality's list, is recorded (D-148). Rejected → quarantine.
--     A part received straight at the Forward Store counts as stock only
--     after the Main Store acknowledges it (D-142, D-150).
--
--   TRANSFERS  public.stock_transfer
--     Main → Forward: in transit → received by Forward → acknowledged by
--     Main. Returns Forward → Main use the same kind of record, reversed, and
--     point back at the original transfer (D-142, D-151).
--
--   U/S RETURNS  public.us_return
--     Removed unserviceable parts the engineer sends back; Supply receives
--     and tags them into quarantine (workflows/part-request.md §8).
--
--   No robbery / cannibalisation flow exists (D-140). Cost is NOT here: the
--   procurement migration adds requisitions, purchase orders, cost and
--   invoices on top of these tables (see "Extension points" at the end).
--
--   Nexus records; people decide (D-020). Nothing here judges whether a part
--   is airworthy or interchangeable. It records what the receiving inspector
--   and the engineers recorded, and enforces the stores controls agreed in
--   D-148 (a person set the date and the certificate status; the system
--   applies them).
-- =============================================================================

-- ------------------------------------------------------------- settings -----
-- Quality owns the first two (D-148, D-153): see app.set_stores_setting below.
insert into public.operator_setting (key, value, reason) values
  ('stores.accepted_certificate_types',
   '["EASA Form 1", "FAA Form 8130-3", "Manufacturer CofC"]',
   'Initial set-up: release certificate types Quality accepts at receiving (D-148)'),
  ('stores.required_release_documents',
   '{"component": ["release_certificate", "serviceable_tag"], "consumable": ["release_certificate", "serviceable_tag"]}',
   'Initial set-up: documents required before a part is accepted, per part class (D-153)'),
  ('stores.shelf_life_caution_days', '30',
   'Initial set-up: show "Caution" this many days before a recorded shelf-life end (D-072)'),
  ('stores.us_return_days', '7',
   'Initial set-up: days allowed to bring a removed U/S part to stores'),
  ('part_request.number_format',  '"PR-{000000}"',  'Initial set-up (D-149: labels and numbers are settings)'),
  ('issue_voucher.number_format', '"IV-{000000}"',  'Initial set-up (D-149)'),
  ('stock_receipt.number_format', '"RCV-{000000}"', 'Initial set-up (D-149)'),
  ('stock_transfer.number_format','"TRF-{000000}"', 'Initial set-up (D-149)'),
  ('us_return.number_format',     '"USR-{000000}"', 'Initial set-up (D-149)');

-- ============================================================== tables =====

-- ------------------------------------------------------------ catalogue -----
create table public.part (
  id                 uuid primary key default gen_random_uuid(),
  part_number        text not null check (length(trim(part_number)) between 1 and 60),
  description        text not null check (length(trim(description)) > 0),
  part_class         text not null check (part_class in ('component', 'consumable')),
  unit               text not null default 'EA' check (unit ~ '^[A-Za-z]{1,10}$'),
  shelf_life_tracked boolean not null default false,
  serialised         boolean not null default false,
  status             text not null default 'active' check (status in ('active', 'inactive')),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz
);
comment on table public.part is 'Stores catalogue. Supply adds parts; never deleted (D-023).';
create unique index part_number_unique on public.part (upper(trim(part_number)));
select app.apply_standard_rules('public.part');

-- ---------------------------------------------------------- stock lots -----
create table public.stock_lot (
  id                    uuid primary key default gen_random_uuid(),
  part_id               uuid not null references public.part (id),
  store_code            text not null references public.store (code),
  serial_no             text,
  batch_no              text,
  bin                   text,
  qty_on_hand           numeric(12,3) not null default 0 check (qty_on_hand >= 0),
  qty_reserved          numeric(12,3) not null default 0 check (qty_reserved >= 0),
  condition             text not null default 'serviceable'
                          check (condition in ('serviceable', 'quarantine', 'unserviceable')),
  condition_reason      text,
  condition_set_by      uuid references public.person (id),
  condition_set_at      timestamptz,
  certificate_status    text not null default 'missing' check (certificate_status in ('valid', 'missing')),
  certificate_type      text,
  certificate_ref       text,
  shelf_life_expires_on date,
  source                text not null check (source in
                          ('opening_balance', 'receipt', 'transfer', 'return', 'us_return')),
  receipt_id            uuid,   -- foreign key added after stock_receipt exists
  transfer_id           uuid,   -- foreign key added after stock_transfer exists
  created_at            timestamptz not null default now(),
  created_by            uuid,
  device_time           timestamptz,
  -- Reserved can never exceed what is on the shelf: the last guard against
  -- two people taking the last unit (D-071).
  constraint reserved_within_on_hand check (qty_reserved <= qty_on_hand),
  -- One serial number is one unit.
  constraint serial_is_one check (serial_no is null or qty_on_hand <= 1)
);
comment on table public.stock_lot is
  'One batch or one serial number in one store (D-141). Quantities are the running total of stock_movement; changed only by the ledger.';
create index stock_lot_part_store on public.stock_lot (part_id, store_code);
select app.apply_standard_rules('public.stock_lot');

-- --------------------------------------------------------- part requests -----
create table public.part_request (
  id                 uuid primary key default gen_random_uuid(),
  number             text not null unique,
  request_type       text not null check (request_type in ('aircraft_part', 'consumable')),
  aircraft_id        uuid references public.aircraft (id),
  work_order_id      uuid references public.work_order (id),
  purpose            text,
  store_code         text not null references public.store (code),
  priority           text not null default 'ROUTINE' check (priority in ('AOG', 'URGENT', 'ROUTINE')),
  aog_confirmed_at   timestamptz,
  aog_confirmed_by   uuid references public.person (id),
  aog_confirmed_how  text check (aog_confirmed_how in ('tail_status', 'certifying_engineer')),
  required_by        timestamptz,
  remarks            text,
  status             text not null default 'open' check (status in ('open', 'closed', 'cancelled')),
  requested_by       uuid not null references public.person (id),
  client_ref         uuid unique,   -- the tablet's id for the request, so a re-sent queue item is not doubled
  cancelled_at       timestamptz,
  cancelled_by       uuid references public.person (id),
  cancel_reason      text,
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,
  -- D-143: an aircraft part needs a tail and a work order.
  constraint aircraft_part_needs_tail_and_wo check (
    request_type <> 'aircraft_part' or (aircraft_id is not null and work_order_id is not null)),
  -- D-143: a consumable needs a work order or a stated purpose.
  constraint consumable_needs_wo_or_purpose check (
    request_type <> 'consumable' or work_order_id is not null or length(trim(coalesce(purpose, ''))) > 0),
  -- AOG is about an aircraft on the ground (D-147).
  constraint aog_needs_tail check (priority <> 'AOG' or aircraft_id is not null),
  constraint cancel_recorded check (
    status <> 'cancelled' or (cancelled_at is not null and cancelled_by is not null
                              and length(trim(coalesce(cancel_reason, ''))) > 0))
);
comment on table public.part_request is 'Engineering''s request for a part (D-143, D-145). Lines carry the parts and their state.';
create index part_request_aircraft on public.part_request (aircraft_id);
create index part_request_work_order on public.part_request (work_order_id);
select app.apply_standard_rules('public.part_request');

create table public.part_request_line (
  id                 uuid primary key default gen_random_uuid(),
  request_id         uuid not null references public.part_request (id),
  line_no            integer not null,
  part_id            uuid references public.part (id),
  part_number_text   text,             -- not catalogued yet: free text, Supply catalogues it
  qty                numeric(12,3) not null check (qty > 0),
  store_code         text not null references public.store (code),
  position           text,             -- e.g. "No. 2 engine", "L/H MLG"
  ipc_ref            text,             -- entered by the engineer; Nexus never decides interchangeability (D-020)
  removed_part       text not null default 'not_applicable'
                       check (removed_part in ('serviceable', 'unserviceable', 'not_applicable')),
  state              text not null default 'submitted' check (state in (
                       'submitted',          -- waiting for Supply
                       'reserved',           -- held for this request (D-071)
                       'needs_requisition',  -- not enough stock: Supply raises a requisition (D-073)
                       'on_order',           -- set by the procurement slice when a requisition exists
                       'issued',             -- with the engineer
                       'returning',          -- engineer is returning it unused
                       'fitted',             -- closed: fitted / used
                       'returned',           -- closed: returned unused
                       'cancelled')),
  state_since        timestamptz not null default now(),
  state_reason       text,
  lot_id             uuid references public.stock_lot (id),
  split_from         uuid references public.part_request_line (id),
  requisition_id     uuid,             -- EXTENSION POINT: procurement adds the foreign key (D-145: one line = one requisition line)
  reserved_at        timestamptz,
  issued_at          timestamptz,
  issued_by          uuid references public.person (id),
  issue_voucher      text unique,
  fitted_at          timestamptz,
  fitted_by          uuid references public.person (id),
  fit_note           text,
  returned_at        timestamptz,
  return_reason      text,
  return_condition   text check (return_condition in ('serviceable', 'quarantine')),
  return_accepted_by uuid references public.person (id),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,
  unique (request_id, line_no),
  constraint part_known check (part_id is not null or length(trim(coalesce(part_number_text, ''))) > 0),
  constraint held_has_lot check (
    state not in ('reserved', 'issued', 'returning', 'fitted', 'returned') or lot_id is not null)
);
comment on table public.part_request_line is
  'One part on a request. Partial stock splits a line: what is in stock is reserved, the rest needs a requisition.';
create index part_request_line_lot on public.part_request_line (lot_id);
create index part_request_line_state on public.part_request_line (state);
select app.apply_standard_rules('public.part_request_line');

-- ------------------------------------------------------- receiving -----
create table public.stock_receipt (
  id                    uuid primary key default gen_random_uuid(),
  number                text not null unique,
  store_code            text not null references public.store (code),
  part_id               uuid not null references public.part (id),
  qty                   numeric(12,3) not null check (qty > 0),
  serial_no             text,
  batch_no              text,
  bin                   text,
  shelf_life_expires_on date,
  delivered_against     text,          -- PO number, delivery note, supplier reference (free text for now)
  purchase_order_id     uuid,          -- EXTENSION POINT: procurement adds the foreign key
  for_request_line_id   uuid references public.part_request_line (id),
  status                text not null default 'inspecting'
                          check (status in ('inspecting', 'awaiting_ack', 'accepted', 'quarantined')),
  pn_sn_match           boolean,
  condition_ok          boolean,
  certificate_type      text,
  certificate_ref       text,
  quarantine_reason     text,
  opened_by             uuid not null references public.person (id),
  inspected_by          uuid references public.person (id),
  inspected_at          timestamptz,
  acknowledged_by       uuid references public.person (id),
  acknowledged_at       timestamptz,
  lot_id                uuid references public.stock_lot (id),
  created_at            timestamptz not null default now(),
  created_by            uuid,
  device_time           timestamptz,
  constraint serial_is_one check (serial_no is null or qty = 1),
  constraint quarantine_has_reason check (
    status <> 'quarantined' or length(trim(coalesce(quarantine_reason, ''))) > 0)
);
comment on table public.stock_receipt is
  'Receiving inspection and part registration (D-074, D-148, D-153). Release documents are attachments on this record.';
select app.apply_standard_rules('public.stock_receipt');
alter table public.stock_lot add constraint stock_lot_receipt_fk
  foreign key (receipt_id) references public.stock_receipt (id);

-- ------------------------------------------------------- transfers -----
create table public.stock_transfer (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique,
  part_id         uuid not null references public.part (id),
  from_store      text not null references public.store (code),
  to_store        text not null references public.store (code),
  qty             numeric(12,3) not null check (qty > 0),
  from_lot_id     uuid not null references public.stock_lot (id),
  to_lot_id       uuid references public.stock_lot (id),
  status          text not null default 'in_transit' check (status in ('in_transit', 'received', 'acknowledged')),
  return_of       uuid references public.stock_transfer (id),  -- D-151: a return points at the transfer it reverses
  note            text,
  raised_by       uuid not null references public.person (id),
  raised_at       timestamptz not null default now(),
  received_by     uuid references public.person (id),
  received_at     timestamptz,
  acknowledged_by uuid references public.person (id),
  acknowledged_at timestamptz,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz,
  constraint different_stores check (from_store <> to_store)
);
comment on table public.stock_transfer is
  'Stock moved between stores: raised and in transit, received, acknowledged by the store of record (D-142, D-151).';
select app.apply_standard_rules('public.stock_transfer');
alter table public.stock_lot add constraint stock_lot_transfer_fk
  foreign key (transfer_id) references public.stock_transfer (id);

-- ------------------------------------------------------- U/S returns -----
create table public.us_return (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  aircraft_id      uuid not null references public.aircraft (id),
  work_order_id    uuid references public.work_order (id),
  request_line_id  uuid references public.part_request_line (id),
  part_id          uuid references public.part (id),
  part_number_text text,
  serial_no        text,
  reason           text not null check (length(trim(reason)) > 0),
  store_code       text not null references public.store (code),
  removed_by       uuid not null references public.person (id),
  removed_at       timestamptz not null default now(),
  return_due_on    date,
  status           text not null default 'expected' check (status in ('expected', 'received')),
  received_by      uuid references public.person (id),
  received_at      timestamptz,
  tag_ref          text,
  receive_note     text,
  lot_id           uuid references public.stock_lot (id),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz,
  constraint part_known check (part_id is not null or length(trim(coalesce(part_number_text, ''))) > 0)
);
comment on table public.us_return is 'Unserviceable parts removed from aircraft, on their way to stores quarantine.';
select app.apply_standard_rules('public.us_return');

-- ------------------------------------------------------- the ledger -----
create table public.stock_movement (
  id              uuid primary key default gen_random_uuid(),
  seq             bigint generated always as identity,
  lot_id          uuid not null references public.stock_lot (id),
  part_id         uuid not null references public.part (id),
  store_code      text not null references public.store (code),
  kind            text not null check (kind in (
                    'opening_balance', 'receipt', 'reserve', 'unreserve', 'issue', 'return',
                    'transfer_out', 'transfer_in', 'quarantine', 'release', 'us_return')),
  qty             numeric(12,3) not null check (qty >= 0),
  on_hand_change  numeric(12,3) not null default 0,
  reserved_change numeric(12,3) not null default 0,
  request_line_id uuid references public.part_request_line (id),
  receipt_id      uuid references public.stock_receipt (id),
  transfer_id     uuid references public.stock_transfer (id),
  us_return_id    uuid references public.us_return (id),
  voucher         text,
  reason          text,
  done_by         uuid not null references public.person (id),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz
);
comment on table public.stock_movement is
  'Stock ledger: every receipt, reservation, issue, return, transfer and quarantine. Append-only (D-023).';
create index stock_movement_lot on public.stock_movement (lot_id, seq);
create trigger a1_no_update before update on public.stock_movement
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.stock_movement');

-- The ledger keeps the lot's quantities. Part and store are copied from the
-- lot so the ledger can be read on its own.
create or replace function app.stock_movement_fill()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  select l.part_id, l.store_code into new.part_id, new.store_code
    from public.stock_lot l where l.id = new.lot_id;
  return new;
end;
$$;
create trigger a0_fill before insert on public.stock_movement
  for each row execute function app.stock_movement_fill();

create or replace function app.stock_movement_apply()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.on_hand_change <> 0 or new.reserved_change <> 0 then
    update public.stock_lot
       set qty_on_hand  = qty_on_hand + new.on_hand_change,
           qty_reserved = qty_reserved + new.reserved_change
     where id = new.lot_id;
  end if;
  return null;
end;
$$;
create trigger b0_apply after insert on public.stock_movement
  for each row execute function app.stock_movement_apply();

-- ============================================================= helpers =====

-- Today in the operator's time zone (shelf-life dates are calendar dates).
create or replace function app.today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'))::date;
$$;

-- The store of record (Main Store, D-142).
create or replace function app.store_of_record()
returns text
language sql stable security definer set search_path = ''
as $$ select s.code from public.store s where s.is_store_of_record limit 1; $$;

-- Does the signed-in person hold this store by an explicit grant? (D-152)
-- Unlike app.can_see_store, oversight read access does not count: acting in
-- a store needs the store itself.
create or replace function app.holds_store(p_store text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.access_grant g
                  where g.person_id = app.current_person_id() and g.revoked_at is null
                    and g.grant_type = 'store' and g.store_code = p_store);
$$;

-- Supply action check: Supply department, one of the permissions, and the
-- store itself. Returns the person. Plain-English refusals.
create or replace function app.supply_check(p_store text, p_permissions text[])
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me   uuid := app.current_person_id();
  v_name text;
begin
  if v_me is null or not app.has_department('SUP') then
    raise exception 'Only Supply can do this (D-074).' using errcode = '42501';
  end if;
  if not exists (select 1 from unnest(p_permissions) p where app.has_permission(p)) then
    raise exception 'You need the "%" permission for this (D-121).',
      (select string_agg(pm.name, '" or "') from public.permission pm where pm.code = any (p_permissions))
      using errcode = '42501';
  end if;
  if not app.holds_store(p_store) then
    select name into v_name from public.store where code = p_store;
    raise exception 'You do not hold the % (D-152).', coalesce(v_name, p_store) using errcode = '42501';
  end if;
  return v_me;
end;
$$;

-- Why a lot cannot be issued or transferred, or null if it can (D-148).
create or replace function app.lot_problem(p_lot public.stock_lot)
returns text
language sql stable security definer set search_path = ''
as $$
  select case
    when p_lot.condition = 'quarantine'    then 'it is in quarantine'
    when p_lot.condition = 'unserviceable' then 'it is unserviceable'
    when p_lot.certificate_status <> 'valid' then 'it has no accepted release certificate'
    when p_lot.shelf_life_expires_on is not null and p_lot.shelf_life_expires_on < app.today()
      then 'its shelf life ended on ' || to_char(p_lot.shelf_life_expires_on, 'DD Mon YYYY')
    else null end;
$$;

-- One ledger line. Every stock change goes through here.
create or replace function app.stock_move(
  p_lot uuid, p_kind text, p_qty numeric, p_on_hand numeric, p_reserved numeric,
  p_reason text default null, p_line uuid default null, p_receipt uuid default null,
  p_transfer uuid default null, p_us_return uuid default null, p_voucher text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  insert into public.stock_movement (lot_id, part_id, store_code, kind, qty, on_hand_change, reserved_change,
                                     request_line_id, receipt_id, transfer_id, us_return_id, voucher, reason, done_by)
  select l.id, l.part_id, l.store_code, p_kind, p_qty, p_on_hand, p_reserved,
         p_line, p_receipt, p_transfer, p_us_return, p_voucher, p_reason, app.current_person_id()
    from public.stock_lot l where l.id = p_lot
  returning id into v_id;
  return v_id;
end;
$$;

-- Change a request line's state, stamping when (for "held for").
create or replace function app.set_line_state(p_line uuid, p_state text, p_reason text default null)
returns void
language sql security definer set search_path = ''
as $$
  update public.part_request_line
     set state = p_state, state_since = now(), state_reason = p_reason
   where id = p_line;
$$;

-- Close a request once every line is finished.
create or replace function app.close_request_if_done(p_request uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.part_request r set status = 'closed'
   where r.id = p_request and r.status = 'open'
     and not exists (select 1 from public.part_request_line l
                      where l.request_id = r.id and l.state not in ('fitted', 'returned', 'cancelled'));
$$;

-- -----------------------------------------------------------------------------
-- Reserve stock for a line, at server time (D-071, D-145).
-- Takes lots that can be issued (serviceable, certified, in date), soonest
-- shelf-life end first. Each lot it touches is LOCKED until this transaction
-- ends, so a second request for the same unit waits, then sees it is gone.
-- If one lot is not enough the line is split per lot; if stock runs out the
-- remainder becomes a new line marked "needs requisition".
-- Returns the quantity reserved.
-- -----------------------------------------------------------------------------
create or replace function app.allocate_line(p_line uuid)
returns numeric
language plpgsql security definer set search_path = ''
as $$
declare
  l        public.part_request_line;
  v_lot    public.stock_lot;
  v_take   numeric;
  v_new    uuid;
  v_total  numeric := 0;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if l.part_id is null then
    perform app.set_line_state(l.id, 'needs_requisition', 'Part not catalogued');
    return 0;
  end if;

  loop
    select * into v_lot from public.stock_lot s
     where s.part_id = l.part_id and s.store_code = l.store_code
       and s.condition = 'serviceable' and s.certificate_status = 'valid'
       and (s.shelf_life_expires_on is null or s.shelf_life_expires_on >= app.today())
       and s.qty_on_hand - s.qty_reserved > 0
     order by s.shelf_life_expires_on nulls last, s.created_at, s.id
     limit 1
     for update;

    if not found then
      perform app.set_line_state(l.id, 'needs_requisition', 'Not enough serviceable stock in this store');
      return v_total;
    end if;

    v_take := least(l.qty, v_lot.qty_on_hand - v_lot.qty_reserved);
    if v_take < l.qty then
      -- Split: the rest goes on a new line that keeps looking.
      insert into public.part_request_line (request_id, line_no, part_id, part_number_text, qty, store_code,
                                            position, ipc_ref, removed_part, split_from, device_time)
      values (l.request_id,
              (select max(x.line_no) + 1 from public.part_request_line x where x.request_id = l.request_id),
              l.part_id, l.part_number_text, l.qty - v_take, l.store_code,
              l.position, l.ipc_ref, l.removed_part, l.id, l.device_time)
      returning id into v_new;
      update public.part_request_line set qty = v_take where id = l.id;
    else
      v_new := null;
    end if;

    perform app.stock_move(v_lot.id, 'reserve', v_take, 0, v_take, null, l.id);
    update public.part_request_line
       set lot_id = v_lot.id, reserved_at = now(), state = 'reserved', state_since = now(), state_reason = null
     where id = l.id;
    v_total := v_total + v_take;

    exit when v_new is null;
    select * into l from public.part_request_line where id = v_new for update;
  end loop;
  return v_total;
end;
$$;

-- Move a line to a new state, giving any reservation back to the shelf
-- first (cancel, release, quarantine).
create or replace function app.unreserve_line(p_line uuid, p_reason text, p_new_state text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  l public.part_request_line;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if l.state = 'reserved' then
    perform app.stock_move(l.lot_id, 'unreserve', l.qty, 0, -l.qty, p_reason, l.id);
  end if;
  update public.part_request_line
     set lot_id = case when l.state = 'reserved' then null else lot_id end,
         reserved_at = case when l.state = 'reserved' then null else reserved_at end,
         state = p_new_state, state_since = now(), state_reason = p_reason
   where id = l.id;
end;
$$;

-- ======================================================= visibility =====

-- Who may see a part request (D-121, D-125, D-152):
--   the requester; Command and Quality (read-only, D-122/D-127: part requests
--   are Engineering records); engineers for tails in their scope (or requests
--   with no tail); Supply for requests on a store they hold.
-- Procurement gets its own rule in the procurement migration.
create or replace function app.can_see_part_request(p_requested_by uuid, p_aircraft uuid, p_store text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_requested_by = app.current_person_id()
      or app.is_oversight()
      or (app.has_department('ENG') and (p_aircraft is null or app.can_see_aircraft(p_aircraft)))
      or (app.has_department('SUP') and app.can_see_store(p_store));
$$;

-- ============================================================ actions =====

-- ----------------------------------------------------------- catalogue -----
create or replace function app.add_part(
  p_part_number text, p_description text, p_class text, p_unit text default 'EA',
  p_shelf_life_tracked boolean default false, p_serialised boolean default false)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
begin
  if app.current_person_id() is null or not app.has_department('SUP')
     or not (app.has_permission('RECEIVE_PARTS') or app.has_permission('ISSUE_PARTS')) then
    raise exception 'Only Supply can add parts to the catalogue.' using errcode = '42501';
  end if;
  if exists (select 1 from public.part where upper(trim(part_number)) = upper(trim(p_part_number))) then
    raise exception 'Part number % is already in the catalogue.', trim(p_part_number) using errcode = '23505';
  end if;
  insert into public.part (part_number, description, part_class, unit, shelf_life_tracked, serialised)
  values (trim(p_part_number), trim(p_description), p_class, coalesce(nullif(trim(p_unit), ''), 'EA'),
          coalesce(p_shelf_life_tracked, false), coalesce(p_serialised, false))
  returning id into v_id;
  return v_id;
end;
$$;

-- -------------------------------------------------------- stores search -----
-- Live quantity per store, only for stores the person may see (D-070,
-- D-141, D-152). Expired and uncertified stock is counted separately and
-- flagged (D-072). Quantities "available" exclude reserved, quarantined,
-- unserviceable, expired and uncertified stock.
create or replace function app.search_stores(p_text text default null, p_limit integer default 100)
returns table (
  part_id uuid, part_number text, description text, part_class text, unit text,
  shelf_life_tracked boolean, serialised boolean,
  stores jsonb, available numeric, reserved numeric, on_hand numeric,
  expired_qty numeric, uncertified_qty numeric, quarantine_qty numeric,
  next_expiry date, certificate text)
language sql stable security definer set search_path = ''
as $$
  with visible as (
    select s.code, s.name, s.is_store_of_record from public.store s where app.can_see_store(s.code)
  ),
  lots as (
    select l.*, app.lot_problem(l) as problem
      from public.stock_lot l join visible v on v.code = l.store_code
     where l.qty_on_hand > 0
  )
  select p.id, p.part_number, p.description, p.part_class, p.unit, p.shelf_life_tracked, p.serialised,
         coalesce((select jsonb_agg(jsonb_build_object(
                     'store', v.code, 'name', v.name,
                     'available', coalesce((select sum(l.qty_on_hand - l.qty_reserved) from lots l
                                             where l.part_id = p.id and l.store_code = v.code and l.problem is null), 0),
                     'reserved', coalesce((select sum(l.qty_reserved) from lots l
                                            where l.part_id = p.id and l.store_code = v.code), 0))
                     order by v.is_store_of_record desc, v.code)
                     from visible v), '[]'::jsonb),
         coalesce((select sum(l.qty_on_hand - l.qty_reserved) from lots l where l.part_id = p.id and l.problem is null), 0),
         coalesce((select sum(l.qty_reserved) from lots l where l.part_id = p.id), 0),
         coalesce((select sum(l.qty_on_hand) from lots l where l.part_id = p.id), 0),
         coalesce((select sum(l.qty_on_hand) from lots l where l.part_id = p.id and l.condition = 'serviceable'
                     and l.shelf_life_expires_on < app.today()), 0),
         coalesce((select sum(l.qty_on_hand) from lots l where l.part_id = p.id and l.certificate_status <> 'valid'), 0),
         coalesce((select sum(l.qty_on_hand) from lots l where l.part_id = p.id and l.condition <> 'serviceable'), 0),
         (select min(l.shelf_life_expires_on) from lots l where l.part_id = p.id and l.condition = 'serviceable'),
         case
           when not exists (select 1 from lots l where l.part_id = p.id) then 'none'
           when not exists (select 1 from lots l where l.part_id = p.id and l.certificate_status <> 'valid') then 'valid'
           when not exists (select 1 from lots l where l.part_id = p.id and l.certificate_status = 'valid') then 'missing'
           else 'mixed' end
    from public.part p
   where app.current_person_id() is not null
     and p.status = 'active'
     and (coalesce(trim(p_text), '') = ''
          or p.part_number ilike '%' || trim(p_text) || '%'
          or p.description ilike '%' || trim(p_text) || '%')
   order by p.part_number
   limit greatest(1, least(coalesce(p_limit, 100), 500));
$$;

-- Shelf-life and certificate alerts for the stores the person may see
-- (Supply board, D-072, D-148). Dates compared, nothing predicted (D-020).
create or replace function app.stock_alerts()
returns table (
  lot_id uuid, part_id uuid, part_number text, description text, store_code text,
  qty numeric, alert text, level text, expires_on date, condition text)
language sql stable security definer set search_path = ''
as $$
  select l.id, p.id, p.part_number, p.description, l.store_code, l.qty_on_hand,
         case
           when l.condition = 'serviceable' and l.shelf_life_expires_on < app.today() then 'expired'
           when l.condition = 'serviceable' and l.certificate_status <> 'valid' then 'uncertified'
           when l.condition = 'serviceable' then 'expiring'
           else 'quarantine_no_certificate' end,
         case
           when l.condition = 'serviceable' and (l.shelf_life_expires_on < app.today() or l.certificate_status <> 'valid')
             then 'stop' else 'caution' end,
         l.shelf_life_expires_on, l.condition
    from public.stock_lot l join public.part p on p.id = l.part_id
   where app.current_person_id() is not null
     and app.can_see_store(l.store_code)
     and l.qty_on_hand > 0
     and ((l.condition = 'serviceable' and (
             l.certificate_status <> 'valid'
             or l.shelf_life_expires_on <= app.today()
                  + coalesce((app.setting('stores.shelf_life_caution_days'))::integer, 30)))
          or (l.condition = 'quarantine' and l.certificate_status <> 'valid'))
   order by 9 nulls last, p.part_number;
$$;

-- ------------------------------------------------------- part request -----
create or replace function app.request_part(
  p_request_type   text,
  p_store          text,
  p_qty            numeric,
  p_part           uuid default null,
  p_part_number_text text default null,
  p_aircraft       uuid default null,
  p_work_order     uuid default null,
  p_purpose        text default null,
  p_priority       text default 'ROUTINE',
  p_required_by    timestamptz default null,
  p_position       text default null,
  p_ipc_ref        text default null,
  p_removed_part   text default 'not_applicable',
  p_remarks        text default null,
  p_client_ref     uuid default null,
  p_device_time    timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me       uuid := app.current_person_id();
  v_part     public.part;
  v_wo       public.work_order;
  v_aircraft uuid := p_aircraft;
  v_req      uuid;
  v_line     uuid;
  v_num      text;
  v_status   text;
  v_reserved numeric;
  v_existing public.part_request;
begin
  if v_me is null or not app.has_department('ENG') then
    raise exception 'Only an engineer can request parts (D-143).' using errcode = '42501';
  end if;

  -- A queued request sent twice is only made once.
  if p_client_ref is not null then
    select * into v_existing from public.part_request where client_ref = p_client_ref;
    if found then
      return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'repeat', true);
    end if;
  end if;

  if p_request_type not in ('aircraft_part', 'consumable') then
    raise exception 'Choose aircraft part or consumable.' using errcode = '22023';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Enter a quantity above zero.' using errcode = '23514';
  end if;
  if not exists (select 1 from public.store where code = p_store) then
    raise exception 'Unknown store.' using errcode = '22023';
  end if;
  if not app.can_see_store(p_store) then
    raise exception 'You do not hold the % (D-152).', (select name from public.store where code = p_store)
      using errcode = '42501';
  end if;
  if coalesce(p_priority, 'ROUTINE') not in ('AOG', 'URGENT', 'ROUTINE') then
    raise exception 'Priority is AOG, Urgent or Routine.' using errcode = '22023';
  end if;
  if coalesce(p_removed_part, 'not_applicable') not in ('serviceable', 'unserviceable', 'not_applicable') then
    raise exception 'Removed part is serviceable, unserviceable or not applicable.' using errcode = '22023';
  end if;

  -- The part: from the catalogue, or free text if not catalogued yet.
  if p_part is not null then
    select * into v_part from public.part where id = p_part and status = 'active';
    if not found then
      raise exception 'Part not found in the catalogue.' using errcode = 'P0002';
    end if;
    if v_part.serialised and p_qty <> trunc(p_qty) then
      raise exception 'Serialised parts are requested in whole units.' using errcode = '22023';
    end if;
  elsif length(trim(coalesce(p_part_number_text, ''))) = 0 then
    raise exception 'Choose a part from the catalogue or type its part number.' using errcode = '23514';
  end if;

  -- The work order, and the tail it belongs to.
  if p_work_order is not null then
    select * into v_wo from public.work_order where id = p_work_order;
    if not found then
      raise exception 'Work order not found.' using errcode = 'P0002';
    end if;
    if v_wo.status in ('rejected', 'cancelled', 'certified') then
      raise exception 'Work order % is %; parts cannot be requested against it.', v_wo.number, v_wo.status
        using errcode = 'P0001';
    end if;
    if v_aircraft is null then
      v_aircraft := v_wo.aircraft_id;
    elsif v_aircraft <> v_wo.aircraft_id then
      raise exception 'Work order % is for another aircraft.', v_wo.number using errcode = '22023';
    end if;
  end if;

  if v_aircraft is not null then
    if not app.can_see_aircraft(v_aircraft) then
      raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
    end if;
    if not exists (select 1 from public.aircraft where id = v_aircraft and status = 'active') then
      raise exception 'This aircraft is deactivated (D-015).' using errcode = '22023';
    end if;
  end if;

  -- D-143
  if p_request_type = 'aircraft_part' and (v_aircraft is null or p_work_order is null) then
    raise exception 'An aircraft part needs a tail and a work order (D-143).' using errcode = '23514';
  end if;
  if p_request_type = 'consumable' and p_work_order is null and length(trim(coalesce(p_purpose, ''))) = 0 then
    raise exception 'A consumable needs a work order, or "General use" with a stated purpose (D-143).'
      using errcode = '23514';
  end if;
  if p_priority = 'AOG' and v_aircraft is null then
    raise exception 'AOG priority needs a tail (D-147).' using errcode = '23514';
  end if;

  v_num := app.next_number('part_request', 'PR-{000000}');
  insert into public.part_request (number, request_type, aircraft_id, work_order_id, purpose, store_code,
                                   priority, required_by, remarks, requested_by, client_ref, device_time)
  values (v_num, p_request_type, v_aircraft, p_work_order, nullif(trim(coalesce(p_purpose, '')), ''), p_store,
          coalesce(p_priority, 'ROUTINE'), p_required_by, nullif(trim(coalesce(p_remarks, '')), ''),
          v_me, p_client_ref, p_device_time)
  returning id into v_req;

  -- D-147: AOG is confirmed straight away only if an engineer has set the
  -- tail U/S or AOG. Otherwise it waits for a certifying engineer.
  if p_priority = 'AOG' then
    select e.status into v_status from public.tail_status_event e
     where e.aircraft_id = v_aircraft order by e.set_at desc limit 1;
    if v_status in ('US', 'AOG') then
      update public.part_request
         set aog_confirmed_at = now(), aog_confirmed_how = 'tail_status'
       where id = v_req;
    end if;
  end if;

  insert into public.part_request_line (request_id, line_no, part_id, part_number_text, qty, store_code,
                                        position, ipc_ref, removed_part, device_time)
  values (v_req, 1, p_part, case when p_part is null then trim(p_part_number_text) end, p_qty, p_store,
          nullif(trim(coalesce(p_position, '')), ''), nullif(trim(coalesce(p_ipc_ref, '')), ''),
          coalesce(p_removed_part, 'not_applicable'), p_device_time)
  returning id into v_line;

  -- Reserve now, at server time (D-071, D-145).
  v_reserved := app.allocate_line(v_line);

  return jsonb_build_object(
    'id', v_req, 'number', v_num, 'reserved', v_reserved,
    'lines', (select jsonb_agg(jsonb_build_object('id', l.id, 'line_no', l.line_no, 'qty', l.qty, 'state', l.state)
                                order by l.line_no)
                from public.part_request_line l where l.request_id = v_req));
end;
$$;

-- D-147: a certifying engineer confirms AOG priority with PIN. Not the
-- person who asked for it (proposed: keeps the confirmation independent).
create or replace function app.confirm_aog_priority(p_request uuid, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.part_request;
begin
  select * into r from public.part_request where id = p_request for update;
  if not found or not app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code) then
    raise exception 'Part request not found.' using errcode = 'P0002';
  end if;
  if r.priority <> 'AOG' then
    raise exception 'Request % is not marked AOG.', r.number using errcode = 'P0001';
  end if;
  if r.aog_confirmed_at is not null then
    raise exception 'AOG priority on % is already confirmed.', r.number using errcode = 'P0001';
  end if;
  if r.requested_by = app.current_person_id() then
    raise exception 'AOG priority is confirmed by another certifying engineer, not the requester (D-147).'
      using errcode = '42501';
  end if;
  perform app.require_certifying(r.aircraft_id, p_pin);
  update public.part_request
     set aog_confirmed_at = now(), aog_confirmed_by = app.current_person_id(), aog_confirmed_how = 'certifying_engineer'
   where id = r.id;
end;
$$;

-- Try again to reserve a waiting line (after stock arrives, or after a
-- reservation was released). Supply holding the store, or an engineer who
-- can see the request.
create or replace function app.reserve_line(p_line uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  l public.part_request_line;
  r public.part_request;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if not found then
    raise exception 'Request line not found.' using errcode = 'P0002';
  end if;
  select * into r from public.part_request where id = l.request_id;
  if not ((app.has_department('SUP') and app.holds_store(l.store_code))
          or (app.has_department('ENG') and app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code))) then
    raise exception 'Only Supply for this store or an engineer on this request can reserve it.' using errcode = '42501';
  end if;
  if l.state not in ('submitted', 'needs_requisition') or r.status <> 'open' then
    raise exception 'This line is % and cannot be reserved again.', l.state using errcode = 'P0001';
  end if;
  perform app.allocate_line(l.id);
  return (select state from public.part_request_line where id = l.id);
end;
$$;

-- Supply releases a reservation by hand, with a reason (part-request.md §8.3:
-- never released automatically, an AOG request could lose its part silently).
create or replace function app.release_reservation(p_line uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  l public.part_request_line;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if not found then
    raise exception 'Request line not found.' using errcode = 'P0002';
  end if;
  perform app.supply_check(l.store_code, array['ISSUE_PARTS']);
  if l.state <> 'reserved' then
    raise exception 'This line is %, not reserved.', l.state using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for releasing the reservation.' using errcode = '23514';
  end if;
  perform app.unreserve_line(l.id, 'Reservation released by Supply: ' || trim(p_reason), 'submitted');
end;
$$;

-- --------------------------------------------------------------- issue -----
-- Supply issues a reserved line (D-068, D-148). PIN-signed (D-094).
create or replace function app.issue_part(p_line uuid, p_pin text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  l         public.part_request_line;
  r         public.part_request;
  v_lot     public.stock_lot;
  v_wo      public.work_order;
  v_problem text;
  v_voucher text;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if not found then
    raise exception 'Request line not found.' using errcode = 'P0002';
  end if;
  perform app.supply_check(l.store_code, array['ISSUE_PARTS']);
  select * into r from public.part_request where id = l.request_id;
  if l.state <> 'reserved' then
    raise exception 'Only a reserved line can be issued; this one is %.', l.state using errcode = 'P0001';
  end if;

  -- D-068: reserved before approval is fine; issued only after approval.
  if r.work_order_id is not null then
    select * into v_wo from public.work_order where id = r.work_order_id;
    if v_wo.status not in ('open', 'work_complete') then
      raise exception 'Work order % is not approved (%). Parts can be reserved but are issued only after Quality and the CO approve it (D-068).',
        v_wo.number, v_wo.status using errcode = 'P0001';
    end if;
  end if;

  -- D-148: never issue expired or uncertified stock.
  select * into v_lot from public.stock_lot where id = l.lot_id for update;
  v_problem := app.lot_problem(v_lot);
  if v_problem is not null then
    raise exception 'This stock cannot be issued: % (D-148). Move it to quarantine and reserve again.', v_problem
      using errcode = 'P0001';
  end if;

  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;

  v_voucher := app.next_number('issue_voucher', 'IV-{000000}');
  perform app.stock_move(v_lot.id, 'issue', l.qty, -l.qty, -l.qty, null, l.id, p_voucher => v_voucher);
  update public.part_request_line
     set issued_at = now(), issued_by = app.current_person_id(), issue_voucher = v_voucher
   where id = l.id;
  perform app.set_line_state(l.id, 'issued');
  return v_voucher;
end;
$$;

-- ---------------------------------------------- fitted / returned unused -----
-- The engineer records the issued part as fitted (or used). If the request
-- said the removed part is unserviceable, a U/S return is expected at stores.
create or replace function app.record_part_fitted(p_line uuid, p_note text default null, p_removed_serial text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  l    public.part_request_line;
  r    public.part_request;
  v_us uuid;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if not found then
    raise exception 'Request line not found.' using errcode = 'P0002';
  end if;
  select * into r from public.part_request where id = l.request_id;
  if not app.has_department('ENG') or not app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code)
     or (r.aircraft_id is not null and not app.can_see_aircraft(r.aircraft_id)) then
    raise exception 'Only an engineer on this aircraft can record the part fitted.' using errcode = '42501';
  end if;
  if l.state <> 'issued' then
    raise exception 'Only an issued part can be recorded as fitted; this line is %.', l.state using errcode = 'P0001';
  end if;
  update public.part_request_line
     set fitted_at = now(), fitted_by = app.current_person_id(), fit_note = nullif(trim(coalesce(p_note, '')), '')
   where id = l.id;
  perform app.set_line_state(l.id, 'fitted');

  if l.removed_part = 'unserviceable' and r.aircraft_id is not null then
    v_us := app.record_us_removal(r.aircraft_id, l.part_id, l.part_number_text, p_removed_serial,
                                  'Removed U/S, replaced under ' || r.number, l.store_code, r.work_order_id, l.id);
  end if;
  perform app.close_request_if_done(r.id);
  return v_us;
end;
$$;

-- The engineer brings an issued part back unused; Supply then takes it in.
create or replace function app.return_unused_part(p_line uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  l public.part_request_line;
  r public.part_request;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if not found then
    raise exception 'Request line not found.' using errcode = 'P0002';
  end if;
  select * into r from public.part_request where id = l.request_id;
  if not app.has_department('ENG') or not app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code) then
    raise exception 'Only an engineer on this request can return the part.' using errcode = '42501';
  end if;
  if l.state <> 'issued' then
    raise exception 'Only an issued part can be returned; this line is %.', l.state using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why the part is being returned.' using errcode = '23514';
  end if;
  update public.part_request_line set return_reason = trim(p_reason) where id = l.id;
  perform app.set_line_state(l.id, 'returning', trim(p_reason));
end;
$$;

-- Supply takes the returned part in: back into its lot if serviceable, or
-- into a new quarantine lot. Only Supply marks stock available (D-074).
create or replace function app.accept_returned_part(p_line uuid, p_condition text, p_reason text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  l       public.part_request_line;
  v_lot   public.stock_lot;
  v_new   uuid;
  v_me    uuid;
begin
  select * into l from public.part_request_line where id = p_line for update;
  if not found then
    raise exception 'Request line not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(l.store_code, array['ISSUE_PARTS', 'RECEIVE_PARTS']);
  if l.state <> 'returning' then
    raise exception 'This line is %, not being returned.', l.state using errcode = 'P0001';
  end if;
  if p_condition not in ('serviceable', 'quarantine') then
    raise exception 'Returned stock goes back as serviceable or into quarantine.' using errcode = '22023';
  end if;
  if p_condition = 'quarantine' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for quarantine.' using errcode = '23514';
  end if;
  select * into v_lot from public.stock_lot where id = l.lot_id for update;

  if p_condition = 'serviceable' and v_lot.condition = 'serviceable'
     and (v_lot.serial_no is null or v_lot.qty_on_hand = 0) then
    perform app.stock_move(v_lot.id, 'return', l.qty, l.qty, 0, p_reason, l.id);
    v_new := v_lot.id;
  else
    insert into public.stock_lot (part_id, store_code, serial_no, batch_no, bin, condition, condition_reason,
                                  condition_set_by, condition_set_at, certificate_status, certificate_type,
                                  certificate_ref, shelf_life_expires_on, source, receipt_id)
    values (v_lot.part_id, v_lot.store_code, v_lot.serial_no, v_lot.batch_no, v_lot.bin,
            case when p_condition = 'serviceable' then v_lot.condition else 'quarantine' end,
            case when p_condition = 'quarantine' then trim(p_reason) else v_lot.condition_reason end,
            v_me, now(), v_lot.certificate_status, v_lot.certificate_type, v_lot.certificate_ref,
            v_lot.shelf_life_expires_on, 'return', v_lot.receipt_id)
    returning id into v_new;
    perform app.stock_move(v_new, 'return', l.qty, l.qty, 0, p_reason, l.id);
    if p_condition = 'quarantine' then
      perform app.stock_move(v_new, 'quarantine', l.qty, 0, 0, p_reason, l.id);
    end if;
  end if;

  update public.part_request_line
     set returned_at = now(), return_condition = p_condition, return_accepted_by = v_me
   where id = l.id;
  perform app.set_line_state(l.id, 'returned', p_reason);
  perform app.close_request_if_done(l.request_id);
  return v_new;
end;
$$;

-- Cancel a request (soft: who, when, why, D-023). Releases reservations.
-- Not once a part is issued: return it first.
create or replace function app.cancel_part_request(p_request uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.part_request;
  l public.part_request_line;
begin
  select * into r from public.part_request where id = p_request for update;
  if not found or not app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code) then
    raise exception 'Part request not found.' using errcode = 'P0002';
  end if;
  if not (r.requested_by = app.current_person_id() or app.has_department('ENG')) then
    raise exception 'Only the requester or an engineer can cancel a part request.' using errcode = '42501';
  end if;
  if r.status <> 'open' then
    raise exception 'Request % is already %.', r.number, r.status using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for cancelling.' using errcode = '23514';
  end if;
  if exists (select 1 from public.part_request_line x where x.request_id = r.id and x.state in ('issued', 'returning')) then
    raise exception 'A part on % has been issued. Return it to stores first.', r.number using errcode = 'P0001';
  end if;
  for l in select * from public.part_request_line x
            where x.request_id = r.id and x.state in ('submitted', 'reserved', 'needs_requisition', 'on_order') loop
    perform app.unreserve_line(l.id, 'Request cancelled: ' || trim(p_reason), 'cancelled');
  end loop;
  update public.part_request
     set status = 'cancelled', cancelled_at = now(), cancelled_by = app.current_person_id(), cancel_reason = trim(p_reason)
   where id = r.id;
end;
$$;

-- --------------------------------------------------------- receiving -----
-- Start a receiving inspection. Documents are then attached to the receipt
-- (attachments, record "stock_receipt"), then it is accepted or quarantined.
create or replace function app.open_receipt(
  p_store text, p_part uuid, p_qty numeric,
  p_serial text default null, p_batch text default null, p_expiry date default null, p_bin text default null,
  p_delivered_against text default null, p_for_request_line uuid default null, p_purchase_order uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me   uuid;
  v_part public.part;
  v_id   uuid;
begin
  v_me := app.supply_check(p_store, array['RECEIVE_PARTS']);
  select * into v_part from public.part where id = p_part and status = 'active';
  if not found then
    raise exception 'Part not found in the catalogue. Register it first.' using errcode = 'P0002';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Enter a quantity above zero.' using errcode = '23514';
  end if;
  if v_part.serialised and (length(trim(coalesce(p_serial, ''))) = 0 or p_qty <> 1) then
    raise exception 'A serialised part is received one at a time, with its serial number.' using errcode = '23514';
  end if;
  insert into public.stock_receipt (number, store_code, part_id, qty, serial_no, batch_no, shelf_life_expires_on, bin,
                                    delivered_against, purchase_order_id, for_request_line_id, opened_by)
  values (app.next_number('stock_receipt', 'RCV-{000000}'), p_store, p_part, p_qty,
          nullif(trim(coalesce(p_serial, '')), ''), nullif(trim(coalesce(p_batch, '')), ''), p_expiry,
          nullif(trim(coalesce(p_bin, '')), ''), nullif(trim(coalesce(p_delivered_against, '')), ''),
          p_purchase_order, p_for_request_line, v_me)
  returning id into v_id;
  return v_id;
end;
$$;

-- Which release documents are still missing on a receipt (D-153), per the
-- part class setting Quality owns (D-148).
create or replace function app.receipt_missing_documents(p_receipt uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(k.kind order by k.kind), '{}')
    from public.stock_receipt r
    join public.part p on p.id = r.part_id
    cross join lateral jsonb_array_elements_text(
      coalesce(app.setting('stores.required_release_documents') -> p.part_class,
               '["release_certificate", "serviceable_tag"]'::jsonb)) as k(kind)
   where r.id = p_receipt
     and not exists (select 1 from public.attachment a
                      where a.record_table = 'stock_receipt' and a.record_id = r.id
                        and a.kind = k.kind and a.superseded_by is null);
$$;

-- Put a received lot into stock (internal): creates the lot and its ledger
-- line, then reserves it for the request it was bought for, if still waiting.
create or replace function app.stock_receipt_into_lot(p_receipt uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r      public.stock_receipt;
  v_lot  uuid;
  v_line public.part_request_line;
begin
  select * into r from public.stock_receipt where id = p_receipt for update;
  insert into public.stock_lot (part_id, store_code, serial_no, batch_no, bin, condition, certificate_status,
                                certificate_type, certificate_ref, shelf_life_expires_on, source, receipt_id)
  values (r.part_id, r.store_code, r.serial_no, r.batch_no, r.bin, 'serviceable', 'valid',
          r.certificate_type, r.certificate_ref, r.shelf_life_expires_on, 'receipt', r.id)
  returning id into v_lot;
  perform app.stock_move(v_lot, 'receipt', r.qty, r.qty, 0, r.number, p_receipt => r.id);
  update public.stock_receipt set lot_id = v_lot, status = 'accepted' where id = r.id;

  if r.for_request_line_id is not null then
    select * into v_line from public.part_request_line where id = r.for_request_line_id;
    if v_line.state in ('submitted', 'needs_requisition', 'on_order') and v_line.store_code = r.store_code then
      perform app.allocate_line(v_line.id);
    end if;
  end if;
  return v_lot;
end;
$$;

-- Accept to stock (D-074, D-148, D-153). PIN-signed (D-094).
create or replace function app.accept_receipt(
  p_receipt uuid, p_certificate_type text, p_certificate_ref text,
  p_pn_sn_match boolean, p_condition_ok boolean, p_pin text)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  r         public.stock_receipt;
  v_part    public.part;
  v_me      uuid;
  v_missing text[];
begin
  select * into r from public.stock_receipt where id = p_receipt for update;
  if not found then
    raise exception 'Receipt not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(r.store_code, array['RECEIVE_PARTS']);
  if r.status <> 'inspecting' then
    raise exception 'Receipt % is already %.', r.number, r.status using errcode = 'P0001';
  end if;
  select * into v_part from public.part where id = r.part_id;
  if not coalesce(p_pn_sn_match, false) or not coalesce(p_condition_ok, false) then
    raise exception 'Part number / serial and condition must both be checked to accept. Otherwise send it to quarantine.'
      using errcode = '23514';
  end if;
  if not exists (select 1 from jsonb_array_elements_text(coalesce(app.setting('stores.accepted_certificate_types'), '[]'::jsonb)) t
                  where t = p_certificate_type) then
    raise exception '"%" is not on Quality''s list of accepted release certificates (D-148).', coalesce(p_certificate_type, '')
      using errcode = '22023';
  end if;
  if length(trim(coalesce(p_certificate_ref, ''))) = 0 then
    raise exception 'Enter the release certificate reference.' using errcode = '23514';
  end if;
  v_missing := app.receipt_missing_documents(r.id);
  if cardinality(v_missing) > 0 then
    raise exception 'Attach the release documents before accepting (D-153). Missing: %.',
      replace(replace(array_to_string(v_missing, ', '), 'release_certificate', 'release certificate'),
              'serviceable_tag', 'serviceable tag')
      using errcode = 'P0001';
  end if;
  if v_part.shelf_life_tracked and r.shelf_life_expires_on is null then
    raise exception 'This part has a shelf life: enter its expiry date on the receipt.' using errcode = '23514';
  end if;
  if r.shelf_life_expires_on is not null and r.shelf_life_expires_on < app.today() then
    raise exception 'Shelf life ended on %. Expired stock cannot be accepted; send it to quarantine (D-148).',
      to_char(r.shelf_life_expires_on, 'DD Mon YYYY') using errcode = 'P0001';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;

  update public.stock_receipt
     set pn_sn_match = true, condition_ok = true, certificate_type = p_certificate_type,
         certificate_ref = trim(p_certificate_ref), inspected_by = v_me, inspected_at = now()
   where id = r.id;

  -- D-142 / D-150: received anywhere but the store of record, it counts only
  -- after the store of record acknowledges it.
  if r.store_code <> app.store_of_record() then
    update public.stock_receipt set status = 'awaiting_ack' where id = r.id;
    return 'awaiting_ack';
  end if;
  perform app.stock_receipt_into_lot(r.id);
  return 'accepted';
end;
$$;

-- Main Store acknowledges a receipt made at another store (D-142, D-150).
create or replace function app.acknowledge_receipt(p_receipt uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r    public.stock_receipt;
  v_me uuid;
begin
  select * into r from public.stock_receipt where id = p_receipt for update;
  if not found then
    raise exception 'Receipt not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(app.store_of_record(), array['RECEIVE_PARTS', 'ISSUE_PARTS']);
  if r.status <> 'awaiting_ack' then
    raise exception 'Receipt % is %, not waiting for acknowledgement.', r.number, r.status using errcode = 'P0001';
  end if;
  update public.stock_receipt set acknowledged_by = v_me, acknowledged_at = now() where id = r.id;
  return app.stock_receipt_into_lot(r.id);
end;
$$;

-- Reject at receiving: the part goes to quarantine with the reason.
create or replace function app.quarantine_receipt(p_receipt uuid, p_reason text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  r     public.stock_receipt;
  v_me  uuid;
  v_lot uuid;
begin
  select * into r from public.stock_receipt where id = p_receipt for update;
  if not found then
    raise exception 'Receipt not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(r.store_code, array['RECEIVE_PARTS']);
  if r.status <> 'inspecting' then
    raise exception 'Receipt % is already %.', r.number, r.status using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for quarantine.' using errcode = '23514';
  end if;
  insert into public.stock_lot (part_id, store_code, serial_no, batch_no, bin, condition, condition_reason,
                                condition_set_by, condition_set_at, certificate_status, shelf_life_expires_on,
                                source, receipt_id)
  values (r.part_id, r.store_code, r.serial_no, r.batch_no, r.bin, 'quarantine', trim(p_reason),
          v_me, now(), 'missing', r.shelf_life_expires_on, 'receipt', r.id)
  returning id into v_lot;
  perform app.stock_move(v_lot, 'receipt', r.qty, r.qty, 0, r.number, p_receipt => r.id);
  perform app.stock_move(v_lot, 'quarantine', r.qty, 0, 0, trim(p_reason), p_receipt => r.id);
  update public.stock_receipt
     set status = 'quarantined', quarantine_reason = trim(p_reason), inspected_by = v_me, inspected_at = now(),
         lot_id = v_lot
   where id = r.id;
  return v_lot;
end;
$$;

-- -------------------------------------------------------- quarantine -----
-- Supply moves stock to quarantine (e.g. expired or uncertified, D-148).
-- Any reservations on it are released and their lines wait for Supply again.
create or replace function app.quarantine_lot(p_lot uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_lot public.stock_lot;
  v_me  uuid;
  l     public.part_request_line;
begin
  select * into v_lot from public.stock_lot where id = p_lot for update;
  if not found then
    raise exception 'Stock not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(v_lot.store_code, array['ISSUE_PARTS', 'RECEIVE_PARTS']);
  if v_lot.condition <> 'serviceable' then
    raise exception 'This stock is already %.', v_lot.condition using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for quarantine.' using errcode = '23514';
  end if;
  for l in select * from public.part_request_line x where x.lot_id = v_lot.id and x.state = 'reserved' loop
    perform app.unreserve_line(l.id, 'Reserved stock moved to quarantine: ' || trim(p_reason), 'submitted');
  end loop;
  update public.stock_lot
     set condition = 'quarantine', condition_reason = trim(p_reason), condition_set_by = v_me, condition_set_at = now()
   where id = v_lot.id;
  perform app.stock_move(v_lot.id, 'quarantine', v_lot.qty_on_hand, 0, 0, trim(p_reason));
end;
$$;

-- Release from quarantine back to stock (D-074, D-148, D-153): Supply with
-- "Receive parts", an accepted certificate type and reference, documents on
-- the original receipt, shelf life in date. PIN-signed. U/S parts are not
-- released here (repair comes with procurement).
create or replace function app.release_from_quarantine(
  p_lot uuid, p_reason text, p_certificate_type text, p_certificate_ref text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_lot  public.stock_lot;
  v_part public.part;
  v_me   uuid;
  v_missing text[];
begin
  select * into v_lot from public.stock_lot where id = p_lot for update;
  if not found then
    raise exception 'Stock not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(v_lot.store_code, array['RECEIVE_PARTS']);
  if v_lot.condition <> 'quarantine' then
    raise exception 'Only quarantined stock can be released; this is %.', v_lot.condition using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give the reason for release.' using errcode = '23514';
  end if;
  if not exists (select 1 from jsonb_array_elements_text(coalesce(app.setting('stores.accepted_certificate_types'), '[]'::jsonb)) t
                  where t = p_certificate_type) then
    raise exception '"%" is not on Quality''s list of accepted release certificates (D-148).', coalesce(p_certificate_type, '')
      using errcode = '22023';
  end if;
  if length(trim(coalesce(p_certificate_ref, ''))) = 0 then
    raise exception 'Enter the release certificate reference.' using errcode = '23514';
  end if;
  if v_lot.receipt_id is not null then
    v_missing := app.receipt_missing_documents(v_lot.receipt_id);
    if cardinality(v_missing) > 0 then
      raise exception 'Attach the release documents to receipt % first (D-153). Missing: %.',
        (select number from public.stock_receipt where id = v_lot.receipt_id),
        replace(replace(array_to_string(v_missing, ', '), 'release_certificate', 'release certificate'),
                'serviceable_tag', 'serviceable tag')
        using errcode = 'P0001';
    end if;
  end if;
  select * into v_part from public.part where id = v_lot.part_id;
  if v_lot.shelf_life_expires_on is not null and v_lot.shelf_life_expires_on < app.today() then
    raise exception 'Shelf life ended on %; expired stock stays in quarantine (D-148).',
      to_char(v_lot.shelf_life_expires_on, 'DD Mon YYYY') using errcode = 'P0001';
  end if;
  if v_part.shelf_life_tracked and v_lot.shelf_life_expires_on is null then
    raise exception 'This part has a shelf life but no expiry date is recorded.' using errcode = 'P0001';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  update public.stock_lot
     set condition = 'serviceable', condition_reason = trim(p_reason), condition_set_by = v_me, condition_set_at = now(),
         certificate_status = 'valid', certificate_type = p_certificate_type, certificate_ref = trim(p_certificate_ref)
   where id = v_lot.id;
  perform app.stock_move(v_lot.id, 'release', v_lot.qty_on_hand, 0, 0, trim(p_reason));
end;
$$;

-- --------------------------------------------------------- transfers -----
-- Raise a transfer: the stock leaves the sending store at once (in transit).
-- One end must be the store of record (D-142). A return Forward → Main
-- names the transfer it reverses (D-151).
create or replace function app.raise_transfer(
  p_part uuid, p_from text, p_to text, p_qty numeric,
  p_lot uuid default null, p_return_of uuid default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me    uuid;
  v_lot   public.stock_lot;
  v_orig  public.stock_transfer;
  v_id    uuid;
  v_problem text;
begin
  v_me := app.supply_check(p_from, array['ISSUE_PARTS']);
  if p_from = p_to then
    raise exception 'Choose two different stores.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.store where code = p_to) then
    raise exception 'Unknown store.' using errcode = '22023';
  end if;
  if app.store_of_record() not in (p_from, p_to) then
    raise exception 'Transfers go to or from the store of record (D-142).' using errcode = 'P0001';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Enter a quantity above zero.' using errcode = '23514';
  end if;
  if p_return_of is not null then
    select * into v_orig from public.stock_transfer where id = p_return_of;
    if not found or v_orig.status <> 'acknowledged' or v_orig.from_store <> p_to or v_orig.to_store <> p_from
       or v_orig.part_id <> p_part then
      raise exception 'A return must reverse a completed transfer of the same part between the same stores (D-151).'
        using errcode = 'P0001';
    end if;
  end if;

  if p_lot is not null then
    select * into v_lot from public.stock_lot where id = p_lot for update;
    if not found or v_lot.store_code <> p_from or v_lot.part_id <> p_part then
      raise exception 'That stock is not this part in the %.', (select name from public.store where code = p_from)
        using errcode = '22023';
    end if;
  else
    select * into v_lot from public.stock_lot s
     where s.part_id = p_part and s.store_code = p_from
       and s.condition = 'serviceable' and s.certificate_status = 'valid'
       and (s.shelf_life_expires_on is null or s.shelf_life_expires_on >= app.today())
       and s.qty_on_hand - s.qty_reserved >= p_qty
     order by s.shelf_life_expires_on nulls last, s.created_at
     limit 1
     for update;
    if not found then
      raise exception 'No single batch in the % has % unreserved, serviceable and in date.',
        (select name from public.store where code = p_from), p_qty using errcode = 'P0001';
    end if;
  end if;
  v_problem := app.lot_problem(v_lot);
  if v_problem is not null then
    raise exception 'This stock cannot be transferred: % (D-148).', v_problem using errcode = 'P0001';
  end if;
  if v_lot.qty_on_hand - v_lot.qty_reserved < p_qty then
    raise exception 'Only % of this batch is unreserved.', v_lot.qty_on_hand - v_lot.qty_reserved using errcode = 'P0001';
  end if;

  insert into public.stock_transfer (number, part_id, from_store, to_store, qty, from_lot_id, return_of, note, raised_by)
  values (app.next_number('stock_transfer', 'TRF-{000000}'), p_part, p_from, p_to, p_qty, v_lot.id, p_return_of,
          nullif(trim(coalesce(p_note, '')), ''), v_me)
  returning id into v_id;
  perform app.stock_move(v_lot.id, 'transfer_out', p_qty, -p_qty, 0, null, p_transfer => v_id);
  return v_id;
end;
$$;

-- Put a transfer into the receiving store's stock (internal).
create or replace function app.transfer_into_lot(p_transfer uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t     public.stock_transfer;
  f     public.stock_lot;
  v_lot uuid;
begin
  select * into t from public.stock_transfer where id = p_transfer for update;
  select * into f from public.stock_lot where id = t.from_lot_id;
  insert into public.stock_lot (part_id, store_code, serial_no, batch_no, condition, certificate_status,
                                certificate_type, certificate_ref, shelf_life_expires_on, source, receipt_id, transfer_id)
  values (t.part_id, t.to_store, f.serial_no, f.batch_no, 'serviceable', f.certificate_status,
          f.certificate_type, f.certificate_ref, f.shelf_life_expires_on, 'transfer', f.receipt_id, t.id)
  returning id into v_lot;
  perform app.stock_move(v_lot, 'transfer_in', t.qty, t.qty, 0, null, p_transfer => t.id);
  update public.stock_transfer set to_lot_id = v_lot, status = 'acknowledged' where id = t.id;
  return v_lot;
end;
$$;

-- The receiving store confirms the parts arrived. Into the store of record
-- that completes it; into any other store, the store of record then
-- acknowledges before it counts (D-142).
create or replace function app.receive_transfer(p_transfer uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  t    public.stock_transfer;
  v_me uuid;
begin
  select * into t from public.stock_transfer where id = p_transfer for update;
  if not found then
    raise exception 'Transfer not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(t.to_store, array['RECEIVE_PARTS', 'ISSUE_PARTS']);
  if t.status <> 'in_transit' then
    raise exception 'Transfer % is %, not in transit.', t.number, t.status using errcode = 'P0001';
  end if;
  update public.stock_transfer set status = 'received', received_by = v_me, received_at = now() where id = t.id;
  if t.to_store = app.store_of_record() then
    update public.stock_transfer set acknowledged_by = v_me, acknowledged_at = now() where id = t.id;
    perform app.transfer_into_lot(t.id);
    return 'acknowledged';
  end if;
  return 'received';
end;
$$;

create or replace function app.acknowledge_transfer(p_transfer uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  t    public.stock_transfer;
  v_me uuid;
begin
  select * into t from public.stock_transfer where id = p_transfer for update;
  if not found then
    raise exception 'Transfer not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(app.store_of_record(), array['RECEIVE_PARTS', 'ISSUE_PARTS']);
  if t.status <> 'received' then
    raise exception 'Transfer % is %; it is acknowledged after the receiving store confirms receipt.', t.number, t.status
      using errcode = 'P0001';
  end if;
  update public.stock_transfer set acknowledged_by = v_me, acknowledged_at = now() where id = t.id;
  return app.transfer_into_lot(t.id);
end;
$$;

-- ------------------------------------------------------- U/S returns -----
-- An engineer records a removed unserviceable part on its way to stores.
create or replace function app.record_us_removal(
  p_aircraft uuid, p_part uuid, p_part_number_text text, p_serial text, p_reason text, p_store text,
  p_work_order uuid default null, p_request_line uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
  v_id uuid;
begin
  if v_me is null or not app.has_department('ENG') then
    raise exception 'Only an engineer records a removed part.' using errcode = '42501';
  end if;
  if not app.can_see_aircraft(p_aircraft) then
    raise exception 'This aircraft is outside your aircraft scope (D-121).' using errcode = '42501';
  end if;
  if not exists (select 1 from public.store where code = p_store) then
    raise exception 'Unknown store.' using errcode = '22023';
  end if;
  if p_part is null and length(trim(coalesce(p_part_number_text, ''))) = 0 then
    raise exception 'Choose the part or type its part number.' using errcode = '23514';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Say why the part was removed.' using errcode = '23514';
  end if;
  insert into public.us_return (number, aircraft_id, work_order_id, request_line_id, part_id, part_number_text,
                                serial_no, reason, store_code, removed_by, return_due_on)
  values (app.next_number('us_return', 'USR-{000000}'), p_aircraft, p_work_order, p_request_line, p_part,
          case when p_part is null then trim(p_part_number_text) end, nullif(trim(coalesce(p_serial, '')), ''),
          trim(p_reason), p_store, v_me,
          app.today() + coalesce((app.setting('stores.us_return_days'))::integer, 7))
  returning id into v_id;
  return v_id;
end;
$$;

-- Supply receives and tags the U/S part into quarantine (unserviceable).
create or replace function app.receive_us_return(
  p_return uuid, p_tag_ref text, p_note text default null, p_part uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  u      public.us_return;
  v_me   uuid;
  v_part uuid;
  v_lot  uuid;
begin
  select * into u from public.us_return where id = p_return for update;
  if not found then
    raise exception 'U/S return not found.' using errcode = 'P0002';
  end if;
  v_me := app.supply_check(u.store_code, array['RECEIVE_PARTS', 'ISSUE_PARTS']);
  if u.status <> 'expected' then
    raise exception 'U/S return % is already received.', u.number using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_tag_ref, ''))) = 0 then
    raise exception 'Enter the unserviceable tag reference.' using errcode = '23514';
  end if;
  v_part := coalesce(u.part_id, p_part);
  if v_part is null then
    raise exception 'Catalogue the part (%), then choose it here.', u.part_number_text using errcode = '23514';
  end if;
  insert into public.stock_lot (part_id, store_code, serial_no, condition, condition_reason, condition_set_by,
                                condition_set_at, certificate_status, source)
  values (v_part, u.store_code, u.serial_no, 'unserviceable', u.reason, v_me, now(), 'missing', 'us_return')
  returning id into v_lot;
  perform app.stock_move(v_lot, 'us_return', 1, 1, 0, u.reason, p_us_return => u.id);
  update public.us_return
     set status = 'received', received_by = v_me, received_at = now(), tag_ref = trim(p_tag_ref),
         receive_note = nullif(trim(coalesce(p_note, '')), ''), lot_id = v_lot, part_id = v_part
   where id = u.id;
  return v_lot;
end;
$$;

-- ------------------------------------------------------ Quality settings -----
-- Quality owns the accepted certificate types and the documents required per
-- part class (D-148, D-153). A new version of the setting; history kept (D-023).
create or replace function app.set_stores_setting(p_key text, p_value jsonb, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if app.current_person_id() is null or not app.has_department('QUA') then
    raise exception 'Only Quality sets the accepted certificates and required release documents (D-148).'
      using errcode = '42501';
  end if;
  if p_key = 'stores.accepted_certificate_types' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0
       or exists (select 1 from jsonb_array_elements(p_value) e where jsonb_typeof(e) <> 'string') then
      raise exception 'Give a list of certificate names.' using errcode = '22023';
    end if;
  elsif p_key = 'stores.required_release_documents' then
    if jsonb_typeof(p_value) <> 'object'
       or exists (select 1 from jsonb_each(p_value) e
                   where e.key not in ('component', 'consumable') or jsonb_typeof(e.value) <> 'array'
                      or exists (select 1 from jsonb_array_elements_text(e.value) d
                                  where d not in ('release_certificate', 'serviceable_tag'))) then
      raise exception 'Give, for component and consumable, a list of release_certificate and/or serviceable_tag.'
        using errcode = '22023';
    end if;
  else
    raise exception 'Quality sets only the stores certificate settings here.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for the change.' using errcode = '23514';
  end if;
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
  insert into public.operator_setting (key, value, reason) values (p_key, p_value, trim(p_reason));
end;
$$;

-- --------------------------------------------------------- reports -----
-- D-147: priority use per person, for Quality and Command.
create or replace function app.priority_use_report(p_since date default null)
returns table (person_id uuid, three_letter_code text, full_name text,
               aog_requested bigint, aog_confirmed bigint, aog_unconfirmed bigint,
               urgent bigint, routine bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if app.current_person_id() is null or not (app.has_department('QUA') or app.has_department('CMD')) then
    raise exception 'The priority-use report is for Quality and Command (D-147).' using errcode = '42501';
  end if;
  return query
    select p.id, p.three_letter_code, p.full_name,
           count(*) filter (where r.priority = 'AOG'),
           count(*) filter (where r.priority = 'AOG' and r.aog_confirmed_at is not null),
           count(*) filter (where r.priority = 'AOG' and r.aog_confirmed_at is null),
           count(*) filter (where r.priority = 'URGENT'),
           count(*) filter (where r.priority = 'ROUTINE')
      from public.part_request r join public.person p on p.id = r.requested_by
     where p_since is null or r.created_at >= p_since
     group by p.id, p.three_letter_code, p.full_name
     order by 4 desc, 2;
end;
$$;

-- ---------------------------------------------------- request list -----
-- Part request lines for the screens, with who holds each one and since
-- when ("Blocked by", D-006, D-094). Visibility is the same rule as the
-- table's (app.can_see_part_request). Supply sees the work order's number
-- and state only, not its content.
create or replace function app.part_request_lines(
  p_aircraft uuid default null, p_work_order uuid default null, p_request uuid default null,
  p_open_only boolean default true)
returns table (
  line_id uuid, request_id uuid, request_number text, line_no integer, request_type text,
  aircraft_id uuid, tail text, work_order_id uuid, work_order_number text, work_order_status text,
  purpose text, store_code text, store_name text, part_id uuid, part_number text, description text, unit text,
  qty numeric, priority text, aog_confirmed boolean, request_status text,
  state text, state_reason text, holder text, held_since timestamptz,
  lot_id uuid, bin text, serial_no text, batch_no text, lot_problem text, issue_voucher text,
  requested_by_code text, requested_at timestamptz, required_by timestamptz,
  fit_position text, ipc_ref text, removed_part text, remarks text, split_from uuid, requisition_id uuid)
language sql stable security definer set search_path = ''
as $$
  select l.id, r.id, r.number, l.line_no, r.request_type,
         r.aircraft_id, a.tail, r.work_order_id, w.number, w.status,
         r.purpose, l.store_code, s.name, l.part_id, coalesce(p.part_number, l.part_number_text), p.description, p.unit,
         l.qty, r.priority, r.aog_confirmed_at is not null, r.status,
         l.state, l.state_reason,
         case l.state
           when 'submitted' then 'Supply'
           when 'reserved' then case w.status when 'requested' then 'Quality' when 'pre_approved' then 'CO' else 'Supply' end
           when 'needs_requisition' then 'Supply'
           when 'on_order' then 'Procurement'
           when 'issued' then 'Engineering'
           when 'returning' then 'Supply'
           else null end,
         l.state_since,
         l.lot_id, lot.bin, lot.serial_no, lot.batch_no, case when lot.id is not null and l.state = 'reserved' then app.lot_problem(lot) end,
         l.issue_voucher,
         rp.three_letter_code, r.created_at, r.required_by,
         l.position, l.ipc_ref, l.removed_part, r.remarks, l.split_from, l.requisition_id
    from public.part_request_line l
    join public.part_request r on r.id = l.request_id
    join public.store s on s.code = l.store_code
    join public.person rp on rp.id = r.requested_by
    left join public.part p on p.id = l.part_id
    left join public.aircraft a on a.id = r.aircraft_id
    left join public.work_order w on w.id = r.work_order_id
    left join public.stock_lot lot on lot.id = l.lot_id
   where app.current_person_id() is not null
     and app.can_see_part_request(r.requested_by, r.aircraft_id, r.store_code)
     and (p_aircraft is null or r.aircraft_id = p_aircraft)
     and (p_work_order is null or r.work_order_id = p_work_order)
     and (p_request is null or r.id = p_request)
     and (not coalesce(p_open_only, true) or l.state not in ('fitted', 'returned', 'cancelled'))
   order by case r.priority when 'AOG' then 0 when 'URGENT' then 1 else 2 end, r.created_at, r.number, l.line_no;
$$;

-- ======================================================= attachments =====
-- Release documents are attachments on the receipt ("stock_receipt"), PDF or
-- images only (D-026), never deleted (D-023). The attachment rules from 0014
-- are EXTENDED here, keeping whatever other migrations already allow:
--   * the record list and the kinds list gain the stores entries;
--   * "can the user see this record?" learns about receipts and hands every
--     other table to the version that was in force before this migration;
--   * uploads into the stock_receipt folder get their own file-store rule.
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.attachment'::regclass and conname = 'attachment_record_table_check';
  if v_def is null then
    raise exception 'attachment_record_table_check not found; check migration 0014.';
  end if;
  if v_def not like '%''stock_receipt''%' then
    alter table public.attachment drop constraint attachment_record_table_check;
    execute 'alter table public.attachment add constraint attachment_record_table_check '
            || replace(v_def, 'ARRAY[', 'ARRAY[''stock_receipt''::text, ');
  end if;

  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.attachment'::regclass and conname = 'attachment_kind_check';
  if v_def is null then
    raise exception 'attachment_kind_check not found; check migration 0014.';
  end if;
  if v_def not like '%''release_certificate''%' then
    alter table public.attachment drop constraint attachment_kind_check;
    execute 'alter table public.attachment add constraint attachment_kind_check '
            || replace(v_def, 'ARRAY[', 'ARRAY[''release_certificate''::text, ''serviceable_tag''::text, ');
  end if;

  -- Keep the current "can see record" as app.can_see_record_before_stores.
  if to_regprocedure('app.can_see_record_before_stores(text, uuid)') is null then
    v_def := pg_get_functiondef('app.can_see_record(text, uuid)'::regprocedure);
    execute replace(v_def, 'FUNCTION app.can_see_record(', 'FUNCTION app.can_see_record_before_stores(');
  end if;
end;
$$;

create or replace function app.can_see_record(p_table text, p_id uuid)
returns boolean
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_ok boolean;
begin
  -- Runs with the user's own rights: the receipt's own visibility rule decides.
  if p_table = 'stock_receipt' then
    if p_id is null then
      return false;
    end if;
    select exists (select 1 from public.stock_receipt where id = p_id) into v_ok;
    return v_ok;
  end if;
  return app.can_see_record_before_stores(p_table, p_id);
end;
$$;

create policy nexus_attachments_upload_stores on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and app.current_person_id() is not null
              and (storage.foldername(name))[1] = 'stock_receipt'
              and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
              and app.can_see_record('stock_receipt', ((storage.foldername(name))[2])::uuid));

-- ========================================================== security =====
alter table public.part              enable row level security;
alter table public.stock_lot         enable row level security;
alter table public.stock_movement    enable row level security;
alter table public.part_request      enable row level security;
alter table public.part_request_line enable row level security;
alter table public.stock_receipt     enable row level security;
alter table public.stock_transfer    enable row level security;
alter table public.us_return         enable row level security;

-- The catalogue (part numbers and descriptions, no stock) is open to all
-- signed-in users so anyone can name a part.
create policy read_signed_in on public.part for select to authenticated
  using (app.current_person_id() is not null);

-- Stock and its ledger: only stores you may see (D-152).
create policy read_store on public.stock_lot for select to authenticated
  using (app.can_see_store(store_code));
create policy read_store on public.stock_movement for select to authenticated
  using (app.can_see_store(store_code));

create policy read_visible on public.part_request for select to authenticated
  using (app.can_see_part_request(requested_by, aircraft_id, store_code));
create policy read_with_request on public.part_request_line for select to authenticated
  using (exists (select 1 from public.part_request r where r.id = part_request_line.request_id));

-- Receipts: the receiving store; the store of record also sees receipts it
-- must acknowledge or has acknowledged (D-142).
create policy read_store on public.stock_receipt for select to authenticated
  using (app.can_see_store(store_code)
         or ((status = 'awaiting_ack' or acknowledged_at is not null) and app.can_see_store(app.store_of_record())));

create policy read_store on public.stock_transfer for select to authenticated
  using (app.can_see_store(from_store) or app.can_see_store(to_store));

create policy read_visible on public.us_return for select to authenticated
  using (app.is_oversight()
         or (app.has_department('ENG') and app.can_see_aircraft(aircraft_id))
         or app.can_see_store(store_code));

-- No direct writes: every change goes through the functions above.
revoke insert, update, delete, truncate on
  public.part, public.stock_lot, public.stock_movement, public.part_request, public.part_request_line,
  public.stock_receipt, public.stock_transfer, public.us_return
  from anon, authenticated;
revoke all on
  public.part, public.stock_lot, public.stock_movement, public.part_request, public.part_request_line,
  public.stock_receipt, public.stock_transfer, public.us_return
  from anon;

-- Functions are locked by default (0021). Questions used by the rules:
grant execute on function
  app.can_see_part_request(uuid, uuid, text),
  app.can_see_record_before_stores(text, uuid),
  app.store_of_record(),
  app.holds_store(text)
to authenticated;

-- Actions and questions the screens call:
grant execute on function
  app.add_part(text, text, text, text, boolean, boolean),
  app.search_stores(text, integer),
  app.stock_alerts(),
  app.request_part(text, text, numeric, uuid, text, uuid, uuid, text, text, timestamptz, text, text, text, text, uuid, timestamptz),
  app.confirm_aog_priority(uuid, text),
  app.reserve_line(uuid),
  app.release_reservation(uuid, text),
  app.issue_part(uuid, text),
  app.record_part_fitted(uuid, text, text),
  app.return_unused_part(uuid, text),
  app.accept_returned_part(uuid, text, text),
  app.cancel_part_request(uuid, text),
  app.open_receipt(text, uuid, numeric, text, text, date, text, text, uuid, uuid),
  app.receipt_missing_documents(uuid),
  app.accept_receipt(uuid, text, text, boolean, boolean, text),
  app.acknowledge_receipt(uuid),
  app.quarantine_receipt(uuid, text),
  app.quarantine_lot(uuid, text),
  app.release_from_quarantine(uuid, text, text, text, text),
  app.raise_transfer(uuid, text, text, numeric, uuid, uuid, text),
  app.receive_transfer(uuid),
  app.acknowledge_transfer(uuid),
  app.record_us_removal(uuid, uuid, text, text, text, text, uuid, uuid),
  app.receive_us_return(uuid, text, text, uuid),
  app.set_stores_setting(text, jsonb, text, text),
  app.priority_use_report(date),
  app.part_request_lines(uuid, uuid, uuid, boolean)
to authenticated;

-- =================================================== extension points =====
-- For the procurement migration (requisitions, approvals by value, POs,
-- clearing, cost, invoices), built on top of this one:
--   * part_request_line.requisition_id  → add the foreign key to the
--     requisition table; set the line to state 'on_order' (with
--     app.set_line_state) when the requisition is raised (D-145: one request
--     line = one requisition line). Lines waiting for it are those in state
--     'needs_requisition'.
--   * stock_receipt.purchase_order_id   → add the foreign key to the
--     purchase order; check buyer ≠ receiver (D-075) in a trigger or wrapper
--     around app.accept_receipt.
--   * stock_receipt.for_request_line_id → set it when receiving against a
--     PO raised for a request: on acceptance the stock is reserved for that
--     line automatically (app.stock_receipt_into_lot).
--   * Cost: put prices on the PO / invoice tables behind app.can_view_cost();
--     nothing here holds cost (D-077, D-121, D-127).
--   * Visibility: add a policy on part_request (and lines) for Procurement;
--     policies add up, so nothing here needs changing.
--   * U/S returns "Raise repair requisition": us_return is ready to be
--     linked from a repair requisition.
-- =============================================================================
