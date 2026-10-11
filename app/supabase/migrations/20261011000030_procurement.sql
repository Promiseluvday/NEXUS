-- =============================================================================
-- Nexus MRO · Phase 2 · Migration 0030 · Procurement
-- Proprietary to Liebetag. All rights reserved.
--
-- Built ON TOP of 0029 (parts and stores), using its extension points.
-- What this file does, in plain English:
--
--   APPROVED SUPPLIERS  public.supplier
--     Quality owns the approved supplier list as configuration (D-148):
--     only Quality adds suppliers or changes their status, signed with PIN.
--     Procurement can order only from a supplier that is "approved".
--
--   REQUISITIONS  public.requisition  (+ public.requisition_estimate, cost)
--     Supply asks for something to be bought (D-073). Three kinds:
--       * for a part request line that is "not in stock" (one request line =
--         one requisition line, D-145). The line moves to "on order";
--       * a REPAIR requisition for a U/S part received at stores;
--       * stock REPLENISHMENT, with a stated purpose (part-request.md R-1).
--     Priority is Routine or AOG. AOG only for a part request whose AOG
--     priority is confirmed (D-147).
--     The estimated value is COST: it sits in its own table that only people
--     who may see cost can read (D-077, D-121, D-127).
--
--   APPROVAL CHAIN (the existing engine, 0011 + 0022)
--     The chain used depends on PRIORITY and VALUE BAND. The bands and their
--     thresholds are the operator setting "requisition.approval_bands"
--     (D-076, D-146); the steps of each chain are operator set-up. The engine
--     already enforces: the raiser approves no step; nobody approves two
--     steps; a rejection needs a reason; the PIN signs (D-079, D-094, D-146).
--     Added here: the engineer who asked for the part cannot approve its
--     purchase either (D-075). The requisition follows its approval: approved
--     → Procurement sources it; rejected → back to the raiser with the reason,
--     who may resubmit as a NEW VERSION (D-079, D-023).
--
--   PURCHASE ORDERS  public.purchase_order, _line, _event (+ _line_price, cost)
--     Procurement (permission "Raise purchase orders") puts approved
--     requisitions on a PO to an approved supplier, agrees a price (cost),
--     and signs the order with PIN. States:
--       draft → ordered → shipped → IN CLEARING (customs, D-149) → delivered
--       → closed (everything received)          · or cancelled (with reason)
--     DELIVERY is a Supply action: the storekeeper registers the arrival,
--     which opens a receiving inspection (stock_receipt) linked to the PO and
--     to the part request line, so acceptance reserves the part for that
--     request automatically (0029). Only Supply makes stock available (D-074).
--     SEPARATION OF DUTIES (D-075): the buyer who raised or placed the PO can
--     never open, inspect, accept or acknowledge its receipt.
--
--   COST AND INVOICES  public.supplier_invoice, price history
--     Invoices (supplier's number, date, amount; the PDF/image as an
--     attachment, D-026) on a PO or an outside-MRO job. Price history per
--     part from agreed PO prices. Visible ONLY with app.can_view_cost():
--     Command, or a user granted "View cost". Quality never (D-127);
--     engineers not by default (D-121, D-149). Enforced by row-level security
--     and in the functions, and the audit log hides cost rows from people
--     who may not see cost.
--
--   OUTSIDE-MRO JOBS  public.outside_mro_job (+ _quote, _part, cost)
--     Procurement's commercial oversight of work sent to an outside MRO
--     (D-144): quotes and negotiation, the agreed cost (PIN), parts the MRO
--     used with their cost, invoices. TECHNICAL ACCEPTANCE stays with
--     Engineering and Quality (D-020): Nexus shows the linked work order and
--     records the note an engineer or Quality person signs; Procurement
--     cannot.
--
--   LABELS AND NUMBERS  (D-149, D-025)
--     Requisition, PO and outside-MRO job numbers come from the server in the
--     operator's format; document names are the setting "labels.documents".
--     The currency is the setting "procurement.currency".
--
--   Nexus records; people decide (D-020). Nothing here decides what to buy,
--   from whom or at what price; it records what people decided and enforces
--   the agreed controls.
-- =============================================================================

-- ------------------------------------------------------------- settings -----
insert into public.operator_setting (key, value, reason) values
  ('requisition.number_format',     '"REQ-{000000}"', 'Initial set-up (D-149: labels and numbers are settings)'),
  ('purchase_order.number_format',  '"PO-{000000}"',  'Initial set-up (D-149)'),
  ('outside_mro_job.number_format', '"MRO-{000000}"', 'Initial set-up (D-149)'),
  -- The currency every price is recorded in. "XXX" is the ISO code for "no
  -- currency": the operator sets its own at set-up (D-025).
  ('procurement.currency', '{"code": "XXX", "symbol": "", "decimals": 2}',
   'Initial set-up: operator sets its currency (D-025)'),
  -- Document names in the operator's own terms (D-149, part-request.md Q-10).
  ('labels.documents',
   '{"part_request": "Part request", "requisition": "Requisition", "purchase_order": "Purchase order", "issue_voucher": "Issue voucher", "stock_receipt": "Receiving record", "outside_mro_job": "Outside-MRO job", "supplier_invoice": "Invoice"}',
   'Initial set-up (D-149)'),
  -- Which approval chain a requisition goes to. Rules are read in order; the
  -- first that matches wins. "priority" and "max_value" are optional. A
  -- requisition with no estimate never matches a rule with "max_value", so it
  -- goes to the strictest band (D-146). Thresholds are set per operator.
  ('requisition.approval_bands',
   '[{"priority": "AOG", "chain": "requisition_aog"}, {"chain": "requisition"}]',
   'Initial set-up: value bands to be set by the operator (D-076, D-146)'),
  -- Same part requisitioned again within this many days is flagged (R-3,
  -- split purchases); price this much above the last price is flagged (R-4).
  ('procurement.split_window_days', '30', 'Initial set-up (part-request.md R-3)'),
  ('procurement.price_flag_percent', '25', 'Initial set-up (part-request.md R-4)');

-- ------------------------------------------------------- approval chains -----
-- The kinds of approval. WHO holds each step is operator set-up (sample data:
-- seeds/50-procurement.sql).
insert into public.approval_chain (action_type, name) values
  ('requisition',      'Requisition (D-076, D-146)'),
  ('requisition_high', 'Requisition above threshold (D-146)'),
  ('requisition_aog',  'Requisition, AOG (D-146, D-147)')
on conflict (action_type) do nothing;

-- ============================================================== tables =====

-- ------------------------------------------------------------ suppliers -----
create table public.supplier (
  id             uuid primary key default gen_random_uuid(),
  code           text not null check (code ~ '^[A-Z0-9-]{2,20}$'),
  name           text not null check (length(trim(name)) > 0),
  kind           text not null default 'parts' check (kind in ('parts', 'mro', 'both')),
  country        text,
  contact        text,
  approval_ref   text,          -- Quality's reference for the approval (audit, certificate...)
  scope_note     text,          -- what they are approved for
  status         text not null default 'approved' check (status in ('approved', 'suspended', 'withdrawn')),
  status_reason  text,
  status_set_by  uuid references public.person (id),
  status_set_at  timestamptz,
  added_by       uuid not null references public.person (id),
  created_at     timestamptz not null default now(),
  created_by     uuid,
  device_time    timestamptz
);
comment on table public.supplier is 'Approved supplier list, owned by Quality as configuration (D-148). Never deleted (D-023).';
create unique index supplier_code_unique on public.supplier (code);
select app.apply_standard_rules('public.supplier');

-- ---------------------------------------------------------- requisitions -----
create table public.requisition (
  id                  uuid primary key default gen_random_uuid(),
  number              text not null,
  version             integer not null default 1 check (version >= 1),
  supersedes          uuid references public.requisition (id),
  superseded_by       uuid references public.requisition (id),
  kind                text not null check (kind in ('part_request', 'repair', 'replenishment')),
  request_line_id     uuid references public.part_request_line (id),
  us_return_id        uuid references public.us_return (id),
  part_id             uuid references public.part (id),
  part_number_text    text,
  qty                 numeric(12,3) not null check (qty > 0),
  store_code          text not null references public.store (code),
  priority            text not null default 'ROUTINE' check (priority in ('ROUTINE', 'AOG')),
  required_by         timestamptz,
  purpose             text,
  remarks             text,
  action_type         text not null references public.approval_chain (action_type),
  approval_request_id uuid references public.approval_request (id),
  status              text not null default 'in_approval' check (status in
                        ('in_approval', 'approved', 'ordered', 'received', 'rejected', 'cancelled')),
  status_since        timestamptz not null default now(),
  rejected_reason     text,
  raised_by           uuid not null references public.person (id),
  raised_at           timestamptz not null default now(),
  cancelled_at        timestamptz,
  cancelled_by        uuid references public.person (id),
  cancel_reason       text,
  created_at          timestamptz not null default now(),
  created_by          uuid,
  device_time         timestamptz,
  unique (number, version),
  constraint part_known check (part_id is not null or length(trim(coalesce(part_number_text, ''))) > 0),
  constraint kind_link check (case kind
    when 'part_request'  then request_line_id is not null
    when 'repair'        then us_return_id is not null
    when 'replenishment' then length(trim(coalesce(purpose, ''))) > 0 end),
  constraint cancel_recorded check (
    status <> 'cancelled' or (cancelled_at is not null and cancelled_by is not null
                              and length(trim(coalesce(cancel_reason, ''))) > 0)),
  constraint reject_recorded check (status <> 'rejected' or length(trim(coalesce(rejected_reason, ''))) > 0)
);
comment on table public.requisition is
  'Supply''s request to buy or repair (D-073, D-145). Rejected ones are resubmitted as a new version (D-079).';
-- D-145: one live requisition per request line (and per U/S return).
create unique index requisition_one_per_line on public.requisition (request_line_id)
  where request_line_id is not null and status not in ('rejected', 'cancelled');
create unique index requisition_one_per_us_return on public.requisition (us_return_id)
  where us_return_id is not null and status not in ('rejected', 'cancelled');
create index requisition_status on public.requisition (status);
select app.apply_standard_rules('public.requisition');

-- COST: the estimate, readable only with "View cost" (D-077, D-121, D-127).
create table public.requisition_estimate (
  requisition_id  uuid primary key references public.requisition (id),
  estimated_value numeric(14,2) not null check (estimated_value >= 0),
  currency        text not null,
  entered_by      uuid not null references public.person (id),
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz
);
comment on table public.requisition_estimate is 'Estimated value of a requisition. COST: View cost only (D-077, D-127).';
create trigger a1_no_update before update on public.requisition_estimate
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.requisition_estimate');

-- ------------------------------------------------------ purchase orders -----
create table public.purchase_order (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique,
  supplier_id     uuid not null references public.supplier (id),
  status          text not null default 'draft' check (status in
                    ('draft', 'ordered', 'shipped', 'in_clearing', 'delivered', 'closed', 'cancelled')),
  status_since    timestamptz not null default now(),
  currency        text not null,
  supplier_ref    text,          -- supplier's quote / order acknowledgement
  eta             date,          -- entered by Procurement; nothing is predicted (D-020)
  shipment_ref    text,          -- air waybill / tracking
  clearing_ref    text,          -- customs entry / clearing agent (D-149)
  note            text,
  raised_by       uuid not null references public.person (id),   -- the buyer (D-075)
  ordered_by      uuid references public.person (id),
  ordered_at      timestamptz,
  cancelled_at    timestamptz,
  cancelled_by    uuid references public.person (id),
  cancel_reason   text,
  created_at      timestamptz not null default now(),
  created_by      uuid,
  device_time     timestamptz,
  constraint cancel_recorded check (
    status <> 'cancelled' or (cancelled_at is not null and cancelled_by is not null
                              and length(trim(coalesce(cancel_reason, ''))) > 0))
);
comment on table public.purchase_order is 'Purchase orders (D-073). In clearing = customs (D-149). The buyer never receives it (D-075).';
select app.apply_standard_rules('public.purchase_order');

create table public.purchase_order_line (
  id               uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_order (id),
  line_no          integer not null,
  requisition_id   uuid not null references public.requisition (id),
  part_id          uuid references public.part (id),
  part_number_text text,
  qty              numeric(12,3) not null check (qty > 0),
  status           text not null default 'open' check (status in ('open', 'received', 'cancelled')),
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz,
  unique (purchase_order_id, line_no),
  constraint cancel_reason_given check (status <> 'cancelled' or length(trim(coalesce(cancel_reason, ''))) > 0)
);
comment on table public.purchase_order_line is 'One approved requisition on a PO.';
-- A requisition is on one live PO line at a time.
create unique index po_line_one_per_requisition on public.purchase_order_line (requisition_id)
  where status <> 'cancelled';
select app.apply_standard_rules('public.purchase_order_line');

-- COST: agreed unit price, append-only versions (a renegotiation adds one).
create table public.purchase_order_line_price (
  id           uuid primary key default gen_random_uuid(),
  po_line_id   uuid not null references public.purchase_order_line (id),
  unit_price   numeric(14,2) not null check (unit_price >= 0),
  currency     text not null,
  reason       text,
  entered_by   uuid not null references public.person (id),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  device_time  timestamptz
);
comment on table public.purchase_order_line_price is 'Agreed price per PO line, newest is in force. COST: View cost only (D-077, D-127).';
create index po_line_price_line on public.purchase_order_line_price (po_line_id, created_at desc);
create trigger a1_no_update before update on public.purchase_order_line_price
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.purchase_order_line_price');

-- The PO's timeline: every state change, ETA change and receiving event.
create table public.purchase_order_event (
  id                uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_order (id),
  event             text not null,
  note              text,
  eta               date,
  done_by           uuid references public.person (id),
  created_at        timestamptz not null default now(),
  created_by        uuid,
  device_time       timestamptz
);
comment on table public.purchase_order_event is 'PO timeline. Append-only (D-023).';
create index po_event_po on public.purchase_order_event (purchase_order_id, created_at);
create trigger a1_no_update before update on public.purchase_order_event
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.purchase_order_event');

-- ---------------------------------------------------- outside-MRO jobs -----
create table public.outside_mro_job (
  id               uuid primary key default gen_random_uuid(),
  number           text not null unique,
  supplier_id      uuid not null references public.supplier (id),
  title            text not null check (length(trim(title)) > 0),
  scope            text,
  aircraft_id      uuid references public.aircraft (id),
  work_order_id    uuid references public.work_order (id),     -- Engineering's record of the work (D-020)
  us_return_id     uuid references public.us_return (id),      -- a component sent for repair
  part_id          uuid references public.part (id),
  serial_no        text,
  status           text not null default 'quoting' check (status in
                     ('quoting', 'agreed', 'in_work', 'returned', 'closed', 'cancelled')),
  status_since     timestamptz not null default now(),
  sent_on          date,
  expected_back    date,
  returned_on      date,
  -- Technical acceptance is recorded by Engineering or Quality, never
  -- Procurement (D-020, D-144).
  acceptance_note  text,
  accepted_by      uuid references public.person (id),
  accepted_at      timestamptz,
  raised_by        uuid not null references public.person (id),
  cancel_reason    text,
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz,
  constraint cancel_reason_given check (status <> 'cancelled' or length(trim(coalesce(cancel_reason, ''))) > 0)
);
comment on table public.outside_mro_job is 'Work sent to an outside MRO: commercial oversight by Procurement (D-144).';
select app.apply_standard_rules('public.outside_mro_job');

-- COST: quotes and the negotiation log; "agreed" is the agreed cost.
create table public.outside_mro_quote (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references public.outside_mro_job (id),
  entry       text not null check (entry in ('quote', 'counter_offer', 'revised_quote', 'agreed')),
  amount      numeric(14,2) not null check (amount >= 0),
  currency    text not null,
  note        text,
  entered_by  uuid not null references public.person (id),
  created_at  timestamptz not null default now(),
  created_by  uuid,
  device_time timestamptz
);
comment on table public.outside_mro_quote is 'Quotes and negotiation for an outside-MRO job. COST: View cost only (D-144, D-127).';
create trigger a1_no_update before update on public.outside_mro_quote
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.outside_mro_quote');

-- COST: parts the outside MRO used, with their cost (D-144).
create table public.outside_mro_part (
  id               uuid primary key default gen_random_uuid(),
  job_id           uuid not null references public.outside_mro_job (id),
  part_id          uuid references public.part (id),
  part_number_text text,
  description      text,
  qty              numeric(12,3) not null check (qty > 0),
  unit_cost        numeric(14,2) not null check (unit_cost >= 0),
  currency         text not null,
  entered_by       uuid not null references public.person (id),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  device_time      timestamptz,
  constraint part_known check (part_id is not null or length(trim(coalesce(part_number_text, ''))) > 0)
);
comment on table public.outside_mro_part is 'Parts used by an outside MRO, with cost. COST: View cost only (D-144, D-127).';
create trigger a1_no_update before update on public.outside_mro_part
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.outside_mro_part');

-- ------------------------------------------------------------- invoices -----
-- COST: the whole invoice record. The file itself is an attachment
-- ("supplier_invoice", kind "invoice"), PDF or image only (D-026).
create table public.supplier_invoice (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid references public.purchase_order (id),
  outside_mro_job_id uuid references public.outside_mro_job (id),
  supplier_id        uuid not null references public.supplier (id),
  invoice_no         text not null check (length(trim(invoice_no)) > 0),
  invoice_date       date not null,
  amount             numeric(14,2) not null check (amount >= 0),
  currency           text not null,
  note               text,
  recorded_by        uuid not null references public.person (id),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  device_time        timestamptz,
  constraint one_record check (num_nonnulls(purchase_order_id, outside_mro_job_id) = 1)
);
comment on table public.supplier_invoice is 'Supplier invoices on a PO or outside-MRO job. COST: View cost only (D-077, D-127).';
create trigger a1_no_update before update on public.supplier_invoice
  for each row execute function app.forbid_update();
select app.apply_standard_rules('public.supplier_invoice');

-- ---------------------------------------------- extension points of 0029 -----
-- D-145: a request line points at its requisition.
alter table public.part_request_line
  add constraint part_request_line_requisition_fk foreign key (requisition_id) references public.requisition (id);
-- A receipt points at its PO, and at the PO line it delivers.
alter table public.stock_receipt
  add constraint stock_receipt_purchase_order_fk foreign key (purchase_order_id) references public.purchase_order (id);
alter table public.stock_receipt
  add column purchase_order_line_id uuid references public.purchase_order_line (id);
create index stock_receipt_po_line on public.stock_receipt (purchase_order_line_id);

-- ============================================================= helpers =====

-- The operator's currency code (D-025).
create or replace function app.currency_code()
returns text
language sql stable security definer set search_path = ''
as $$ select coalesce(app.setting('procurement.currency') ->> 'code', 'XXX'); $$;

-- Procurement action check: Procurement department and the permission.
create or replace function app.procurement_check(p_permission text)
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
begin
  if v_me is null or not app.has_department('PRO') then
    raise exception 'Only Procurement can do this (D-073).' using errcode = '42501';
  end if;
  if not app.has_permission(p_permission) then
    raise exception 'You need the "%" permission for this (D-121).',
      (select name from public.permission where code = p_permission) using errcode = '42501';
  end if;
  return v_me;
end;
$$;

-- Prices need "View cost" even to enter (D-077, D-121, D-127).
create or replace function app.cost_check()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not app.can_view_cost() then
    raise exception 'Prices and invoices need the "View cost" permission (D-077, D-121).' using errcode = '42501';
  end if;
end;
$$;

-- Signs with the person's PIN (D-094).
create or replace function app.require_pin(p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not app.check_my_pin(p_pin) then
    raise exception 'PIN not accepted (D-094).' using errcode = '28P01';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Who may see a requisition (D-125). Not Quality by default (D-127).
--   the raiser; Procurement; Command; Supply for a store they can see;
--   whoever holds a step of its chain (approvers); an engineer who can see
--   the part request it was raised for (no cost: that is separate).
-- -----------------------------------------------------------------------------
create or replace function app.can_see_requisition(p_raised_by uuid, p_store text, p_line uuid, p_action text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.current_person_id() is not null and (
         p_raised_by = app.current_person_id()
      or app.has_department('PRO')
      or app.has_department('CMD')
      or (app.has_department('SUP') and app.can_see_store(p_store))
      or exists (select 1 from public.approval_chain_step s
                  where s.action_type = p_action and app.holds_step(s.action_type, s.step_no))
      or (p_line is not null and app.has_department('ENG') and exists (
            select 1 from public.part_request_line l join public.part_request r on r.id = l.request_id
             where l.id = p_line
               and (r.requested_by = app.current_person_id() or r.aircraft_id is null
                    or app.can_see_aircraft(r.aircraft_id)))));
$$;

-- Purchase orders: Procurement, Supply (they receive them), Command.
create or replace function app.can_see_purchase_orders()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.current_person_id() is not null
     and (app.has_department('PRO') or app.has_department('SUP') or app.has_department('CMD'));
$$;

-- Outside-MRO jobs: Procurement, Command; Engineering and Quality for
-- technical acceptance (D-144), engineers within their aircraft scope.
create or replace function app.can_see_outside_mro(p_aircraft uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select app.current_person_id() is not null
     and (app.has_department('PRO') or app.has_department('CMD') or app.has_department('QUA')
          or (app.has_department('ENG') and (p_aircraft is null or app.can_see_aircraft(p_aircraft))));
$$;

-- Which chain a requisition goes to, from the operator's bands (D-146).
create or replace function app.requisition_chain_for(p_priority text, p_value numeric)
returns text
language plpgsql stable security definer set search_path = ''
as $$
declare
  r       jsonb;
  v_chain text;
begin
  for r in select e from jsonb_array_elements(coalesce(app.setting('requisition.approval_bands'), '[]'::jsonb)) e loop
    if (r ->> 'priority' is null or r ->> 'priority' = p_priority)
       and (r ->> 'max_value' is null or (p_value is not null and p_value <= (r ->> 'max_value')::numeric)) then
      v_chain := r ->> 'chain';
      exit;
    end if;
  end loop;
  if v_chain is null then
    raise exception 'No approval band matches this requisition. The operator must set "requisition.approval_bands" (D-146).'
      using errcode = '22023';
  end if;
  return v_chain;
end;
$$;

-- Keep the engineer's request line telling the story ("on order: PO-... in
-- clearing"), so the engineer follows progress without seeing cost (D-145).
create or replace function app.requisition_line_note(p_req uuid, p_note text)
returns void
language sql security definer set search_path = ''
as $$
  update public.part_request_line l
     set state_reason = p_note
    from public.requisition q
   where q.id = p_req and l.id = q.request_line_id and l.state = 'on_order';
$$;

create or replace function app.po_event(p_po uuid, p_event text, p_note text default null, p_eta date default null)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.purchase_order_event (purchase_order_id, event, note, eta, done_by)
  values (p_po, p_event, p_note, p_eta, app.current_person_id());
$$;

-- Words for a PO state, for request lines and the screens.
create or replace function app.po_state_words(p_status text)
returns text
language sql immutable set search_path = ''
as $$
  select case p_status
    when 'draft'       then 'PO being prepared'
    when 'ordered'     then 'ordered from supplier'
    when 'shipped'     then 'shipped, in transit'
    when 'in_clearing' then 'in clearing (customs)'
    when 'delivered'   then 'arrived, receiving inspection'
    when 'closed'      then 'received'
    when 'cancelled'   then 'PO cancelled'
    else p_status end;
$$;

-- First letter capital, the rest as written ("In clearing (customs)").
create or replace function app.sentence(p_text text)
returns text
language sql immutable set search_path = ''
as $$ select upper(left(p_text, 1)) || substr(p_text, 2); $$;

-- Tell every request line on a PO where it stands.
create or replace function app.po_touch_lines(p_po uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p  public.purchase_order;
  pl public.purchase_order_line;
begin
  select * into p from public.purchase_order where id = p_po;
  for pl in select * from public.purchase_order_line where purchase_order_id = p_po and status = 'open' loop
    perform app.requisition_line_note(pl.requisition_id,
      format('%s %s%s', p.number, app.po_state_words(p.status),
             case when p.eta is not null and p.status in ('ordered', 'shipped', 'in_clearing')
                  then ' · ETA ' || to_char(p.eta, 'DD Mon YYYY') else '' end));
  end loop;
end;
$$;

-- ============================================================ actions =====

-- ----------------------------------------------------- approved suppliers -----
-- Quality adds a supplier to its approved list (D-148), signed with PIN.
create or replace function app.add_supplier(
  p_code text, p_name text, p_kind text, p_pin text,
  p_country text default null, p_contact text default null,
  p_approval_ref text default null, p_scope_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me uuid := app.current_person_id();
  v_id uuid;
begin
  if v_me is null or not app.has_department('QUA') then
    raise exception 'Only Quality keeps the approved supplier list (D-148).' using errcode = '42501';
  end if;
  if upper(trim(coalesce(p_code, ''))) !~ '^[A-Z0-9-]{2,20}$' then
    raise exception 'Supplier code: 2 to 20 letters, digits or dashes.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_name, ''))) = 0 then
    raise exception 'Enter the supplier''s name.' using errcode = '23514';
  end if;
  if coalesce(p_kind, '') not in ('parts', 'mro', 'both') then
    raise exception 'A supplier supplies parts, MRO services, or both.' using errcode = '22023';
  end if;
  if exists (select 1 from public.supplier where code = upper(trim(p_code))) then
    raise exception 'Supplier code % is already on the list.', upper(trim(p_code)) using errcode = '23505';
  end if;
  perform app.require_pin(p_pin);
  insert into public.supplier (code, name, kind, country, contact, approval_ref, scope_note, added_by,
                               status_set_by, status_set_at, status_reason)
  values (upper(trim(p_code)), trim(p_name), p_kind, nullif(trim(coalesce(p_country, '')), ''),
          nullif(trim(coalesce(p_contact, '')), ''), nullif(trim(coalesce(p_approval_ref, '')), ''),
          nullif(trim(coalesce(p_scope_note, '')), ''), v_me, v_me, now(), 'Added to the approved list')
  returning id into v_id;
  return v_id;
end;
$$;

-- Quality suspends, withdraws or re-approves a supplier, with a reason.
create or replace function app.set_supplier_status(p_supplier uuid, p_status text, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  s public.supplier;
begin
  if app.current_person_id() is null or not app.has_department('QUA') then
    raise exception 'Only Quality keeps the approved supplier list (D-148).' using errcode = '42501';
  end if;
  select * into s from public.supplier where id = p_supplier for update;
  if not found then
    raise exception 'Supplier not found.' using errcode = 'P0002';
  end if;
  if coalesce(p_status, '') not in ('approved', 'suspended', 'withdrawn') then
    raise exception 'Status is approved, suspended or withdrawn.' using errcode = '22023';
  end if;
  if s.status = p_status then
    raise exception '% is already %.', s.name, p_status using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for the change.' using errcode = '23514';
  end if;
  perform app.require_pin(p_pin);
  update public.supplier
     set status = p_status, status_reason = trim(p_reason), status_set_by = app.current_person_id(), status_set_at = now()
   where id = s.id;
end;
$$;

-- ------------------------------------------------------- requisitions -----
-- Supply raises a requisition (D-073, D-145, D-146). Returns its number and
-- the approval chain it went to.
create or replace function app.raise_requisition(
  p_kind             text,
  p_request_line     uuid    default null,
  p_us_return        uuid    default null,
  p_part             uuid    default null,
  p_part_number_text text    default null,
  p_store            text    default null,
  p_qty              numeric default null,
  p_purpose          text    default null,
  p_priority         text    default 'ROUTINE',
  p_estimated_value  numeric default null,
  p_required_by      timestamptz default null,
  p_remarks          text    default null,
  p_device_time      timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me     uuid;
  l        public.part_request_line;
  r        public.part_request;
  u        public.us_return;
  v_part   uuid := p_part;
  v_pntext text := nullif(trim(coalesce(p_part_number_text, '')), '');
  v_store  text := p_store;
  v_qty    numeric := p_qty;
  v_purpose text := nullif(trim(coalesce(p_purpose, '')), '');
  v_tail   text;
  v_chain  text;
  v_num    text;
  v_id     uuid;
  v_prio   text := upper(coalesce(p_priority, 'ROUTINE'));
begin
  if p_kind not in ('part_request', 'repair', 'replenishment') then
    raise exception 'A requisition is for a part request, a repair or stock replenishment.' using errcode = '22023';
  end if;
  if v_prio not in ('ROUTINE', 'AOG') then
    raise exception 'Priority is Routine or AOG.' using errcode = '22023';
  end if;
  if p_estimated_value is not null and p_estimated_value < 0 then
    raise exception 'The estimated value cannot be negative.' using errcode = '23514';
  end if;

  if p_kind = 'part_request' then
    select * into l from public.part_request_line where id = p_request_line for update;
    if not found then
      raise exception 'Request line not found.' using errcode = 'P0002';
    end if;
    select * into r from public.part_request where id = l.request_id;
    v_store := l.store_code; v_qty := l.qty; v_part := l.part_id; v_pntext := l.part_number_text;
    v_me := app.supply_check(v_store, array['RAISE_REQUISITION']);
    -- D-145: only a line Supply found short, and only once.
    if l.state <> 'needs_requisition' or r.status <> 'open' then
      raise exception 'Line % of % is "%"; a requisition is raised only for a line not in stock.',
        l.line_no, r.number, l.state using errcode = 'P0001';
    end if;
    if exists (select 1 from public.requisition q where q.request_line_id = l.id and q.status not in ('rejected', 'cancelled')) then
      raise exception 'This request line already has a requisition (D-145: one line, one requisition).' using errcode = 'P0001';
    end if;
    -- D-147: AOG only when the request's AOG priority is confirmed.
    if v_prio = 'AOG' and (r.priority <> 'AOG' or r.aog_confirmed_at is null) then
      raise exception 'AOG priority needs a part request whose AOG priority is confirmed (D-147).' using errcode = 'P0001';
    end if;
    v_purpose := coalesce(v_purpose, 'For ' || r.number || coalesce(' · ' || r.purpose, ''));
    select a.tail into v_tail from public.aircraft a where a.id = r.aircraft_id;

  elsif p_kind = 'repair' then
    select * into u from public.us_return where id = p_us_return for update;
    if not found then
      raise exception 'U/S return not found.' using errcode = 'P0002';
    end if;
    v_store := u.store_code; v_qty := 1; v_part := u.part_id; v_pntext := u.part_number_text;
    v_me := app.supply_check(v_store, array['RAISE_REQUISITION']);
    if u.status <> 'received' then
      raise exception 'Receive and tag the U/S part first; then raise its repair requisition.' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.requisition q where q.us_return_id = u.id and q.status not in ('rejected', 'cancelled')) then
      raise exception 'U/S return % already has a repair requisition.', u.number using errcode = 'P0001';
    end if;
    if v_prio = 'AOG' then
      raise exception 'AOG priority comes from a confirmed AOG part request (D-147).' using errcode = 'P0001';
    end if;
    v_purpose := coalesce(v_purpose, format('Repair of U/S part%s (%s)', coalesce(' S/N ' || u.serial_no, ''), u.number));
    select a.tail into v_tail from public.aircraft a where a.id = u.aircraft_id;

  else  -- replenishment
    if v_store is null or not exists (select 1 from public.store where code = v_store) then
      raise exception 'Choose the store to replenish.' using errcode = '22023';
    end if;
    v_me := app.supply_check(v_store, array['RAISE_REQUISITION']);
    if coalesce(v_qty, 0) <= 0 then
      raise exception 'Enter a quantity above zero.' using errcode = '23514';
    end if;
    if v_part is null and v_pntext is null then
      raise exception 'Choose a part from the catalogue or type its part number.' using errcode = '23514';
    end if;
    if v_part is not null and not exists (select 1 from public.part where id = v_part and status = 'active') then
      raise exception 'Part not found in the catalogue.' using errcode = 'P0002';
    end if;
    if v_purpose is null then
      raise exception 'Stock replenishment needs a stated purpose (part-request.md R-1).' using errcode = '23514';
    end if;
    if v_prio = 'AOG' then
      raise exception 'AOG priority comes from a confirmed AOG part request (D-147).' using errcode = 'P0001';
    end if;
  end if;

  v_chain := app.requisition_chain_for(v_prio, p_estimated_value);
  v_num := app.next_number('requisition', 'REQ-{000000}');
  insert into public.requisition (number, kind, request_line_id, us_return_id, part_id, part_number_text, qty, store_code,
                                  priority, required_by, purpose, remarks, action_type, raised_by, device_time)
  values (v_num, p_kind, case when p_kind = 'part_request' then l.id end, case when p_kind = 'repair' then u.id end,
          v_part, case when v_part is null then v_pntext end, v_qty, v_store, v_prio, p_required_by, v_purpose,
          nullif(trim(coalesce(p_remarks, '')), ''), v_chain, v_me, p_device_time)
  returning id into v_id;

  if p_estimated_value is not null then
    insert into public.requisition_estimate (requisition_id, estimated_value, currency, entered_by)
    values (v_id, p_estimated_value, app.currency_code(), v_me);
  end if;

  update public.requisition
     set approval_request_id = app.raise_approval(v_chain, 'requisition', v_id,
           app.requisition_summary(v_id, v_tail))
   where id = v_id;

  if p_kind = 'part_request' then
    update public.part_request_line set requisition_id = v_id where id = l.id;
    perform app.set_line_state(l.id, 'on_order', v_num || ' in approval');
  end if;

  return jsonb_build_object('id', v_id, 'number', v_num, 'chain', v_chain,
                            'chain_name', (select name from public.approval_chain where action_type = v_chain));
end;
$$;

-- What the approvers' inbox says. No cost in it: the inbox is not behind
-- "View cost" (D-127).
create or replace function app.requisition_summary(p_req uuid, p_tail text)
returns text
language sql stable security definer set search_path = ''
as $$
  select format('%s%s · %s × %s%s%s',
                q.number, case when q.version > 1 then ' v' || q.version else '' end,
                rtrim(to_char(q.qty, 'FM999999990.###'), '.'),
                coalesce(p.description || ' ' || p.part_number, q.part_number_text),
                coalesce(' · ' || p_tail, ''),
                case q.priority when 'AOG' then ' · AOG' else '' end)
    from public.requisition q left join public.part p on p.id = q.part_id
   where q.id = p_req;
$$;

-- The requisition follows its approval (D-079), as work orders do (0015).
create or replace function app.requisition_follow_approval()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  q       public.requisition;
  v_reason text;
  v_steps integer;
begin
  if new.record_table <> 'requisition' or new.status is not distinct from old.status
     and new.current_step is not distinct from old.current_step then
    return null;
  end if;
  select * into q from public.requisition where id = new.record_id;
  if not found or q.approval_request_id is distinct from new.id or q.status <> 'in_approval' then
    return null;
  end if;
  select max(step_no) into v_steps from public.approval_chain_step where action_type = new.action_type;

  if new.status = 'approved' then
    update public.requisition set status = 'approved', status_since = now() where id = q.id;
    perform app.requisition_line_note(q.id, q.number || ' approved · Procurement sourcing');
  elsif new.status = 'rejected' then
    select d.reason into v_reason from public.approval_decision d
     where d.request_id = new.id and d.decision = 'reject' order by d.created_at desc limit 1;
    update public.requisition set status = 'rejected', status_since = now(), rejected_reason = v_reason where id = q.id;
    -- Back to Supply: the line needs a requisition again (D-079).
    update public.part_request_line
       set state = 'needs_requisition', state_since = now(),
           state_reason = q.number || ' rejected: ' || v_reason
     where id = q.request_line_id and state = 'on_order';
  elsif new.status = 'pending' then
    perform app.requisition_line_note(q.id,
      format('%s in approval · step %s of %s', q.number, new.current_step, v_steps));
  end if;
  return null;
end;
$$;
create trigger requisition_follow_approval after update on public.approval_request
  for each row execute function app.requisition_follow_approval();

-- D-075: the engineer who asked for the part cannot approve buying it.
-- (The raiser and "two steps" rules are already in the engine, D-146.)
create or replace function app.requisition_decision_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.approval_request ar
               join public.requisition q on q.id = ar.record_id
               join public.part_request_line l on l.id = q.request_line_id
               join public.part_request r on r.id = l.request_id
              where ar.id = new.request_id and ar.record_table = 'requisition'
                and r.requested_by = new.decided_by) then
    raise exception 'You asked for this part, so you cannot approve its purchase (D-075).' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a2_requisition_separation before insert on public.approval_decision
  for each row execute function app.requisition_decision_check();

-- Who may change a requisition: its raiser, or Supply who may raise
-- requisitions for that store.
create or replace function app.requisition_for_supply(p_req uuid)
returns public.requisition
language plpgsql security definer set search_path = ''
as $$
declare
  q public.requisition;
begin
  select * into q from public.requisition where id = p_req for update;
  if not found or not app.can_see_requisition(q.raised_by, q.store_code, q.request_line_id, q.action_type) then
    raise exception 'Requisition not found.' using errcode = 'P0002';
  end if;
  if q.raised_by <> app.current_person_id() then
    perform app.supply_check(q.store_code, array['RAISE_REQUISITION']);
  end if;
  return q;
end;
$$;

-- Resubmit a rejected requisition as a NEW VERSION (D-079, D-023). The
-- rejected one stays on record. The chain is chosen again.
create or replace function app.resubmit_requisition(
  p_req uuid, p_estimated_value numeric default null, p_priority text default null,
  p_qty numeric default null, p_required_by timestamptz default null, p_remarks text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  q       public.requisition;
  l       public.part_request_line;
  r       public.part_request;
  v_prio  text;
  v_qty   numeric;
  v_chain text;
  v_id    uuid;
  v_tail  text;
begin
  q := app.requisition_for_supply(p_req);
  if q.status <> 'rejected' or q.superseded_by is not null then
    raise exception 'Only a rejected requisition (latest version) can be resubmitted.' using errcode = 'P0001';
  end if;
  v_prio := upper(coalesce(p_priority, q.priority));
  v_qty := coalesce(p_qty, q.qty);
  if v_prio not in ('ROUTINE', 'AOG') then
    raise exception 'Priority is Routine or AOG.' using errcode = '22023';
  end if;
  if p_estimated_value is not null and p_estimated_value < 0 then
    raise exception 'The estimated value cannot be negative.' using errcode = '23514';
  end if;
  if q.kind = 'part_request' then
    select * into l from public.part_request_line where id = q.request_line_id for update;
    select * into r from public.part_request where id = l.request_id;
    if l.state <> 'needs_requisition' or r.status <> 'open' then
      raise exception 'The part request line is now "%"; nothing to resubmit.', l.state using errcode = 'P0001';
    end if;
    v_qty := l.qty;   -- D-145: the requisition is the line
    if v_prio = 'AOG' and (r.priority <> 'AOG' or r.aog_confirmed_at is null) then
      raise exception 'AOG priority needs a part request whose AOG priority is confirmed (D-147).' using errcode = 'P0001';
    end if;
    select a.tail into v_tail from public.aircraft a where a.id = r.aircraft_id;
  elsif v_prio = 'AOG' then
    raise exception 'AOG priority comes from a confirmed AOG part request (D-147).' using errcode = 'P0001';
  end if;
  if v_qty <= 0 then
    raise exception 'Enter a quantity above zero.' using errcode = '23514';
  end if;

  v_chain := app.requisition_chain_for(v_prio, p_estimated_value);
  insert into public.requisition (number, version, supersedes, kind, request_line_id, us_return_id, part_id,
                                  part_number_text, qty, store_code, priority, required_by, purpose, remarks,
                                  action_type, raised_by)
  values (q.number, q.version + 1, q.id, q.kind, q.request_line_id, q.us_return_id, q.part_id, q.part_number_text,
          v_qty, q.store_code, v_prio, coalesce(p_required_by, q.required_by), q.purpose,
          coalesce(nullif(trim(coalesce(p_remarks, '')), ''), q.remarks), v_chain, app.current_person_id())
  returning id into v_id;
  update public.requisition set superseded_by = v_id where id = q.id;
  if p_estimated_value is not null then
    insert into public.requisition_estimate (requisition_id, estimated_value, currency, entered_by)
    values (v_id, p_estimated_value, app.currency_code(), app.current_person_id());
  end if;
  update public.requisition
     set approval_request_id = app.raise_approval(v_chain, 'requisition', v_id, app.requisition_summary(v_id, v_tail))
   where id = v_id;
  if q.kind = 'part_request' then
    update public.part_request_line set requisition_id = v_id where id = l.id;
    perform app.set_line_state(l.id, 'on_order', format('%s v%s in approval', q.number, q.version + 1));
  end if;
  return jsonb_build_object('id', v_id, 'number', q.number, 'version', q.version + 1, 'chain', v_chain);
end;
$$;

-- Cancel a requisition (who, when, why, D-023) before it is on a PO.
create or replace function app.cancel_requisition(p_req uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  q public.requisition;
begin
  q := app.requisition_for_supply(p_req);
  if q.status not in ('in_approval', 'approved', 'rejected') or q.superseded_by is not null then
    raise exception 'Requisition % is %; it cannot be cancelled here.', q.number, q.status using errcode = 'P0001';
  end if;
  if exists (select 1 from public.purchase_order_line pl where pl.requisition_id = q.id and pl.status <> 'cancelled') then
    raise exception 'Requisition % is on a purchase order. Procurement removes it from the PO first.', q.number
      using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for cancelling.' using errcode = '23514';
  end if;
  update public.requisition
     set status = 'cancelled', status_since = now(), cancelled_at = now(),
         cancelled_by = app.current_person_id(), cancel_reason = trim(p_reason)
   where id = q.id;
  update public.approval_request set status = 'cancelled', decided_at = now()
   where id = q.approval_request_id and status = 'pending';
  update public.part_request_line
     set state = 'needs_requisition', state_since = now(), state_reason = q.number || ' cancelled: ' || trim(p_reason)
   where id = q.request_line_id and state = 'on_order';
end;
$$;

-- -------------------------------------------------- purchase orders -----
-- Load a PO for a Procurement action.
create or replace function app.po_for_buyer(p_po uuid, p_allowed text[])
returns public.purchase_order
language plpgsql security definer set search_path = ''
as $$
declare
  p public.purchase_order;
begin
  perform app.procurement_check('RAISE_PURCHASE_ORDER');
  select * into p from public.purchase_order where id = p_po for update;
  if not found then
    raise exception 'Purchase order not found.' using errcode = 'P0002';
  end if;
  if not (p.status = any (p_allowed)) then
    raise exception 'Purchase order % is "%"; this needs %.', p.number, app.po_state_words(p.status),
      array_to_string(p_allowed, ' or ') using errcode = 'P0001';
  end if;
  return p;
end;
$$;

-- Put one approved requisition on a draft PO.
create or replace function app.po_add_requisition(p_po uuid, p_req uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  q    public.requisition;
  v_id uuid;
begin
  select * into q from public.requisition where id = p_req for update;
  if not found then
    raise exception 'Requisition not found.' using errcode = 'P0002';
  end if;
  -- D-076: nothing is bought without the full approval chain.
  if q.status <> 'approved' then
    raise exception 'Requisition % is "%"; only an approved requisition can be ordered (D-076).',
      q.number, replace(q.status, '_', ' ') using errcode = 'P0001';
  end if;
  if exists (select 1 from public.purchase_order_line pl where pl.requisition_id = q.id and pl.status <> 'cancelled') then
    raise exception 'Requisition % is already on a purchase order.', q.number using errcode = 'P0001';
  end if;
  insert into public.purchase_order_line (purchase_order_id, line_no, requisition_id, part_id, part_number_text, qty)
  values (p_po, coalesce((select max(line_no) from public.purchase_order_line where purchase_order_id = p_po), 0) + 1,
          q.id, q.part_id, q.part_number_text, q.qty)
  returning id into v_id;
  perform app.requisition_line_note(q.id, q.number || ' approved · PO being prepared');
  return v_id;
end;
$$;

-- Procurement raises a PO (draft) for approved requisitions, to an approved
-- supplier (D-148).
create or replace function app.create_purchase_order(
  p_supplier uuid, p_requisitions uuid[], p_supplier_ref text default null,
  p_eta date default null, p_note text default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid;
  s     public.supplier;
  v_id  uuid;
  v_num text;
  v_req uuid;
begin
  v_me := app.procurement_check('RAISE_PURCHASE_ORDER');
  select * into s from public.supplier where id = p_supplier;
  if not found then
    raise exception 'Supplier not found.' using errcode = 'P0002';
  end if;
  if s.status <> 'approved' or s.kind = 'mro' then
    raise exception '% is not on Quality''s approved list for parts (%) (D-148).', s.name, s.status using errcode = 'P0001';
  end if;
  if coalesce(cardinality(p_requisitions), 0) = 0 then
    raise exception 'Choose at least one approved requisition.' using errcode = '23514';
  end if;
  v_num := app.next_number('purchase_order', 'PO-{000000}');
  insert into public.purchase_order (number, supplier_id, currency, supplier_ref, eta, note, raised_by)
  values (v_num, s.id, app.currency_code(), nullif(trim(coalesce(p_supplier_ref, '')), ''), p_eta,
          nullif(trim(coalesce(p_note, '')), ''), v_me)
  returning id into v_id;
  foreach v_req in array p_requisitions loop
    perform app.po_add_requisition(v_id, v_req);
  end loop;
  perform app.po_event(v_id, 'PO raised (draft) for ' || s.name, null, p_eta);
  return jsonb_build_object('id', v_id, 'number', v_num);
end;
$$;

create or replace function app.add_po_line(p_po uuid, p_req uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  p public.purchase_order;
begin
  p := app.po_for_buyer(p_po, array['draft']);
  return app.po_add_requisition(p.id, p_req);
end;
$$;

-- Take a requisition off a draft PO (it goes back to "approved").
create or replace function app.remove_po_line(p_line uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pl public.purchase_order_line;
  q  public.requisition;
begin
  select * into pl from public.purchase_order_line where id = p_line for update;
  if not found then
    raise exception 'PO line not found.' using errcode = 'P0002';
  end if;
  perform app.po_for_buyer(pl.purchase_order_id, array['draft']);
  if pl.status <> 'open' then
    raise exception 'This line is already %.', pl.status using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason.' using errcode = '23514';
  end if;
  update public.purchase_order_line set status = 'cancelled', cancel_reason = trim(p_reason) where id = pl.id;
  select * into q from public.requisition where id = pl.requisition_id;
  perform app.requisition_line_note(q.id, q.number || ' approved · Procurement sourcing');
end;
$$;

-- The agreed unit price (COST). Any change after ordering needs a reason
-- (renegotiation); every version is kept (D-023).
create or replace function app.set_po_line_price(p_line uuid, p_unit_price numeric, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  pl public.purchase_order_line;
  p  public.purchase_order;
begin
  select * into pl from public.purchase_order_line where id = p_line;
  if not found then
    raise exception 'PO line not found.' using errcode = 'P0002';
  end if;
  p := app.po_for_buyer(pl.purchase_order_id, array['draft', 'ordered', 'shipped', 'in_clearing', 'delivered']);
  perform app.cost_check();
  if pl.status = 'cancelled' then
    raise exception 'This line is cancelled.' using errcode = 'P0001';
  end if;
  if p_unit_price is null or p_unit_price < 0 then
    raise exception 'Enter the agreed unit price.' using errcode = '23514';
  end if;
  if p.status <> 'draft' and length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'The order is placed: give the reason the price changed.' using errcode = '23514';
  end if;
  insert into public.purchase_order_line_price (po_line_id, unit_price, currency, reason, entered_by)
  values (pl.id, p_unit_price, p.currency, nullif(trim(coalesce(p_reason, '')), ''), app.current_person_id());
  if p.status <> 'draft' then
    perform app.po_event(p.id, 'Price changed on line ' || pl.line_no, 'Reason: ' || trim(p_reason));
  end if;
end;
$$;

-- Place the order: lines priced, supplier still approved, signed with PIN.
create or replace function app.place_purchase_order(p_po uuid, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.purchase_order;
  s public.supplier;
begin
  p := app.po_for_buyer(p_po, array['draft']);
  if not exists (select 1 from public.purchase_order_line where purchase_order_id = p.id and status = 'open') then
    raise exception 'The purchase order has no lines.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.purchase_order_line pl
              where pl.purchase_order_id = p.id and pl.status = 'open'
                and not exists (select 1 from public.purchase_order_line_price x where x.po_line_id = pl.id)) then
    raise exception 'Enter the agreed price on every line before ordering (D-077).' using errcode = 'P0001';
  end if;
  select * into s from public.supplier where id = p.supplier_id;
  if s.status <> 'approved' then
    raise exception '% is % on Quality''s list; it cannot be ordered from (D-148).', s.name, s.status using errcode = 'P0001';
  end if;
  perform app.require_pin(p_pin);
  update public.purchase_order
     set status = 'ordered', status_since = now(), ordered_by = app.current_person_id(), ordered_at = now()
   where id = p.id;
  update public.requisition q set status = 'ordered', status_since = now()
    from public.purchase_order_line pl
   where pl.purchase_order_id = p.id and pl.status = 'open' and q.id = pl.requisition_id;
  perform app.po_event(p.id, 'Ordered from ' || s.name, null, p.eta);
  perform app.po_touch_lines(p.id);
end;
$$;

-- Shipping and customs progress, and the ETA (entered, never predicted,
-- D-020). Moves only forward: ordered → shipped → in clearing (D-149).
create or replace function app.update_purchase_order(
  p_po uuid, p_status text default null, p_eta date default null,
  p_shipment_ref text default null, p_clearing_ref text default null, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p      public.purchase_order;
  v_rank jsonb := '{"ordered": 1, "shipped": 2, "in_clearing": 3}';
begin
  p := app.po_for_buyer(p_po, array['ordered', 'shipped', 'in_clearing']);
  if p_status is not null then
    if p_status not in ('shipped', 'in_clearing') then
      raise exception 'Procurement moves an order to shipped or in clearing; Supply registers the arrival.'
        using errcode = '22023';
    end if;
    if (v_rank ->> p_status)::integer <= (v_rank ->> p.status)::integer then
      raise exception 'Purchase order % is already %; it moves only forward.', p.number, app.po_state_words(p.status)
        using errcode = 'P0001';
    end if;
  end if;
  if p_status is null and p_eta is null and p_shipment_ref is null and p_clearing_ref is null
     and length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'Nothing to update.' using errcode = '23514';
  end if;
  update public.purchase_order
     set status = coalesce(p_status, status),
         status_since = case when p_status is not null then now() else status_since end,
         eta = coalesce(p_eta, eta),
         shipment_ref = coalesce(nullif(trim(coalesce(p_shipment_ref, '')), ''), shipment_ref),
         clearing_ref = coalesce(nullif(trim(coalesce(p_clearing_ref, '')), ''), clearing_ref)
   where id = p.id;
  perform app.po_event(p.id,
    case when p_status is not null then app.sentence(app.po_state_words(p_status))
         when p_eta is not null then 'ETA updated' else 'Note' end,
    nullif(trim(concat_ws(' · ',
      case when nullif(trim(coalesce(p_shipment_ref, '')), '') is not null then 'Shipment ' || trim(p_shipment_ref) end,
      case when nullif(trim(coalesce(p_clearing_ref, '')), '') is not null then 'Clearing ' || trim(p_clearing_ref) end,
      nullif(trim(coalesce(p_note, '')), ''))), ''),
    p_eta);
  perform app.po_touch_lines(p.id);
end;
$$;

-- Cancel a PO before anything was received; its requisitions go back to
-- "approved" so they can be re-sourced (part-request.md §8.5).
create or replace function app.cancel_purchase_order(p_po uuid, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  p public.purchase_order;
begin
  p := app.po_for_buyer(p_po, array['draft', 'ordered', 'shipped', 'in_clearing']);
  if exists (select 1 from public.stock_receipt r where r.purchase_order_id = p.id) then
    raise exception 'Goods on % have reached receiving; it cannot be cancelled.', p.number using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for cancelling.' using errcode = '23514';
  end if;
  perform app.require_pin(p_pin);
  update public.requisition q set status = 'approved', status_since = now()
    from public.purchase_order_line pl
   where pl.purchase_order_id = p.id and pl.status = 'open' and q.id = pl.requisition_id;
  perform app.requisition_line_note(pl.requisition_id, p.number || ' cancelled · Procurement re-sourcing')
     from public.purchase_order_line pl where pl.purchase_order_id = p.id and pl.status = 'open';
  update public.purchase_order_line set status = 'cancelled', cancel_reason = 'PO cancelled: ' || trim(p_reason)
   where purchase_order_id = p.id and status = 'open';
  update public.purchase_order
     set status = 'cancelled', status_since = now(), cancelled_at = now(), cancelled_by = app.current_person_id(),
         cancel_reason = trim(p_reason)
   where id = p.id;
  perform app.po_event(p.id, 'Cancelled', trim(p_reason));
end;
$$;

-- -------------------------------------------------------------- delivery -----
-- SUPPLY registers the arrival of a PO line: this opens the receiving
-- inspection (0029) linked to the PO and to the part request line, so
-- acceptance reserves the part for that request (D-074, D-145). The buyer
-- can never do this (D-075, checked on the receipt itself below).
create or replace function app.receive_po_delivery(
  p_line uuid, p_qty numeric default null, p_serial text default null, p_batch text default null,
  p_expiry date default null, p_bin text default null, p_part uuid default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  pl      public.purchase_order_line;
  p       public.purchase_order;
  q       public.requisition;
  v_qty   numeric;
  v_open  numeric;
  v_part  uuid;
  v_rcpt  uuid;
begin
  select * into pl from public.purchase_order_line where id = p_line for update;
  if not found then
    raise exception 'PO line not found.' using errcode = 'P0002';
  end if;
  select * into p from public.purchase_order where id = pl.purchase_order_id for update;
  select * into q from public.requisition where id = pl.requisition_id;
  perform app.supply_check(q.store_code, array['RECEIVE_PARTS']);
  if p.status not in ('ordered', 'shipped', 'in_clearing', 'delivered') or pl.status <> 'open' then
    raise exception 'Purchase order % is "%"; there is nothing to receive on this line.', p.number,
      app.po_state_words(p.status) using errcode = 'P0001';
  end if;
  v_part := coalesce(pl.part_id, p_part);
  if v_part is null then
    raise exception 'Catalogue % first (Receiving › register part), then choose it here.', pl.part_number_text
      using errcode = '23514';
  end if;
  if pl.part_id is not null and p_part is not null and p_part <> pl.part_id then
    raise exception 'This PO line is for another part.' using errcode = '22023';
  end if;
  -- Not more than was ordered (quarantined deliveries do not count: a
  -- replacement may follow, workflow RQ-9).
  select pl.qty - coalesce(sum(r.qty), 0) into v_open
    from public.stock_receipt r where r.purchase_order_line_id = pl.id and r.status <> 'quarantined';
  v_qty := coalesce(p_qty, v_open);
  if v_qty <= 0 or v_qty > v_open then
    raise exception 'Only % still to receive on this line.', rtrim(to_char(v_open, 'FM999999990.###'), '.')
      using errcode = '23514';
  end if;

  v_rcpt := app.open_receipt(q.store_code, v_part, v_qty, p_serial, p_batch, p_expiry, p_bin,
                             p.number || ' line ' || pl.line_no, q.request_line_id, p.id);
  update public.stock_receipt set purchase_order_line_id = pl.id where id = v_rcpt;
  if pl.part_id is null then
    update public.purchase_order_line set part_id = v_part where id = pl.id;
  end if;
  if p.status <> 'delivered' then
    update public.purchase_order set status = 'delivered', status_since = now() where id = p.id;
  end if;
  perform app.po_event(p.id, format('Arrived at stores · line %s · receiving %s', pl.line_no,
                                    (select number from public.stock_receipt where id = v_rcpt)));
  perform app.requisition_line_note(q.id, format('%s arrived · receiving inspection', p.number));
  return v_rcpt;
end;
$$;

-- D-075 SEPARATION OF DUTIES: the buyer (who raised or placed the PO) never
-- opens, inspects, accepts or acknowledges its receipt. Checked on the
-- receipt row itself, so it holds whichever stores function is used
-- (open_receipt, accept_receipt, quarantine_receipt, acknowledge_receipt).
create or replace function app.receipt_buyer_check()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  p public.purchase_order;
begin
  if new.purchase_order_id is null then
    return new;
  end if;
  select * into p from public.purchase_order where id = new.purchase_order_id;
  if new.opened_by in (p.raised_by, p.ordered_by)
     or new.inspected_by in (p.raised_by, p.ordered_by)
     or new.acknowledged_by in (p.raised_by, p.ordered_by) then
    raise exception 'You bought this on %, so you cannot receive it into stock (D-075).', p.number
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger a2_buyer_is_not_receiver before insert or update on public.stock_receipt
  for each row execute function app.receipt_buyer_check();

-- When a receipt on a PO is accepted (or quarantined), the PO, its line
-- and the requisition follow.
create or replace function app.receipt_follow_po()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  pl     public.purchase_order_line;
  v_done numeric;
begin
  if new.purchase_order_line_id is null or new.status is not distinct from old.status then
    return null;
  end if;
  select * into pl from public.purchase_order_line where id = new.purchase_order_line_id;
  if new.status = 'accepted' then
    select coalesce(sum(r.qty), 0) into v_done from public.stock_receipt r
     where r.purchase_order_line_id = pl.id and r.status = 'accepted';
    perform app.po_event(pl.purchase_order_id, format('Accepted to stock · line %s · %s', pl.line_no, new.number));
    if v_done >= pl.qty and pl.status = 'open' then
      update public.purchase_order_line set status = 'received' where id = pl.id;
      update public.requisition set status = 'received', status_since = now() where id = pl.requisition_id;
    end if;
    if not exists (select 1 from public.purchase_order_line x
                    where x.purchase_order_id = pl.purchase_order_id and x.status = 'open') then
      update public.purchase_order set status = 'closed', status_since = now() where id = pl.purchase_order_id;
      perform app.po_event(pl.purchase_order_id, 'Closed · everything received');
    end if;
  elsif new.status = 'quarantined' then
    perform app.po_event(pl.purchase_order_id,
      format('Quarantined at receiving · line %s · %s', pl.line_no, new.number), new.quarantine_reason);
    perform app.requisition_line_note(pl.requisition_id,
      (select number from public.purchase_order where id = pl.purchase_order_id)
      || ' delivery quarantined · Procurement to replace');
  elsif new.status = 'awaiting_ack' then
    perform app.po_event(pl.purchase_order_id,
      format('Accepted at %s · line %s · waiting for Main Store acknowledgement', new.store_code, pl.line_no));
  end if;
  return null;
end;
$$;
create trigger receipt_follow_po after update on public.stock_receipt
  for each row execute function app.receipt_follow_po();

-- ------------------------------------------------------------- invoices -----
-- Record a supplier invoice (COST) on a PO or an outside-MRO job. The scan is
-- then attached to it (attachment "supplier_invoice", kind "invoice").
create or replace function app.record_invoice(
  p_invoice_no text, p_invoice_date date, p_amount numeric,
  p_purchase_order uuid default null, p_outside_mro_job uuid default null, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_me       uuid := app.current_person_id();
  v_supplier uuid;
  v_currency text;
  v_id       uuid;
begin
  if v_me is null or not app.has_department('PRO')
     or not (app.has_permission('RAISE_PURCHASE_ORDER') or app.has_permission('MANAGE_OUTSIDE_MRO')) then
    raise exception 'Only Procurement records invoices (D-077).' using errcode = '42501';
  end if;
  perform app.cost_check();
  if num_nonnulls(p_purchase_order, p_outside_mro_job) <> 1 then
    raise exception 'An invoice belongs to one purchase order or one outside-MRO job.' using errcode = '22023';
  end if;
  if p_purchase_order is not null then
    select supplier_id, currency into v_supplier, v_currency from public.purchase_order
     where id = p_purchase_order and status not in ('draft', 'cancelled');
    if not found then
      raise exception 'Invoices are recorded on a placed purchase order.' using errcode = 'P0001';
    end if;
  else
    select supplier_id into v_supplier from public.outside_mro_job where id = p_outside_mro_job and status <> 'cancelled';
    if not found then
      raise exception 'Outside-MRO job not found.' using errcode = 'P0002';
    end if;
    v_currency := app.currency_code();
  end if;
  if length(trim(coalesce(p_invoice_no, ''))) = 0 or p_invoice_date is null then
    raise exception 'Enter the invoice number and date.' using errcode = '23514';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter the invoice amount.' using errcode = '23514';
  end if;
  insert into public.supplier_invoice (purchase_order_id, outside_mro_job_id, supplier_id, invoice_no, invoice_date,
                                       amount, currency, note, recorded_by)
  values (p_purchase_order, p_outside_mro_job, v_supplier, trim(p_invoice_no), p_invoice_date, p_amount, v_currency,
          nullif(trim(coalesce(p_note, '')), ''), v_me)
  returning id into v_id;
  if p_purchase_order is not null then
    perform app.po_event(p_purchase_order, 'Invoice recorded · ' || trim(p_invoice_no));
  end if;
  return v_id;
end;
$$;

-- Price history for a part (COST, D-077): agreed PO prices, newest first,
-- and what outside MROs charged for it.
create or replace function app.price_history(p_part uuid)
returns table (source text, reference text, supplier text, at timestamptz, qty numeric,
               unit_price numeric, currency text, reason text)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform app.cost_check();
  return query
    select 'purchase_order'::text, p.number, s.name, coalesce(p.ordered_at, p.created_at), pl.qty,
           pr.unit_price, pr.currency, pr.reason
      from public.purchase_order_line pl
      join public.purchase_order p on p.id = pl.purchase_order_id
      join public.supplier s on s.id = p.supplier_id
      join lateral (select x.* from public.purchase_order_line_price x where x.po_line_id = pl.id
                     order by x.created_at desc limit 1) pr on true
     where pl.part_id = p_part and p.status <> 'cancelled' and pl.status <> 'cancelled'
    union all
    select 'outside_mro'::text, j.number, s.name, mp.created_at, mp.qty, mp.unit_cost, mp.currency, null::text
      from public.outside_mro_part mp
      join public.outside_mro_job j on j.id = mp.job_id
      join public.supplier s on s.id = j.supplier_id
     where mp.part_id = p_part
     order by 4 desc;
end;
$$;

-- ------------------------------------------------------ outside MRO -----
create or replace function app.mro_job_for_procurement(p_job uuid)
returns public.outside_mro_job
language plpgsql security definer set search_path = ''
as $$
declare
  j public.outside_mro_job;
begin
  perform app.procurement_check('MANAGE_OUTSIDE_MRO');
  select * into j from public.outside_mro_job where id = p_job for update;
  if not found then
    raise exception 'Outside-MRO job not found.' using errcode = 'P0002';
  end if;
  if j.status in ('closed', 'cancelled') then
    raise exception 'Job % is %.', j.number, j.status using errcode = 'P0001';
  end if;
  return j;
end;
$$;

-- Procurement records a job sent to an outside MRO (D-144).
create or replace function app.open_outside_mro_job(
  p_supplier uuid, p_title text, p_scope text default null,
  p_aircraft uuid default null, p_work_order uuid default null, p_us_return uuid default null,
  p_part uuid default null, p_serial text default null, p_sent_on date default null, p_expected_back date default null)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_me  uuid;
  s     public.supplier;
  w     public.work_order;
  u     public.us_return;
  v_ac  uuid := p_aircraft;
  v_num text;
  v_id  uuid;
begin
  v_me := app.procurement_check('MANAGE_OUTSIDE_MRO');
  select * into s from public.supplier where id = p_supplier;
  if not found then
    raise exception 'Supplier not found.' using errcode = 'P0002';
  end if;
  if s.status <> 'approved' or s.kind = 'parts' then
    raise exception '% is not on Quality''s approved list for MRO work (D-148).', s.name using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_title, ''))) = 0 then
    raise exception 'Give the job a title.' using errcode = '23514';
  end if;
  if p_work_order is not null then
    select * into w from public.work_order where id = p_work_order;
    if not found then
      raise exception 'Work order not found.' using errcode = 'P0002';
    end if;
    if v_ac is not null and v_ac <> w.aircraft_id then
      raise exception 'Work order % is for another aircraft.', w.number using errcode = '22023';
    end if;
    v_ac := w.aircraft_id;
  end if;
  if p_us_return is not null then
    select * into u from public.us_return where id = p_us_return;
    if not found then
      raise exception 'U/S return not found.' using errcode = 'P0002';
    end if;
    -- A component sent for repair: its tail and work order come with it
    -- (Procurement does not read work orders itself).
    if p_work_order is null and u.work_order_id is not null then
      select * into w from public.work_order where id = u.work_order_id;
    end if;
    v_ac := coalesce(v_ac, u.aircraft_id);
  end if;
  if p_expected_back is not null and p_sent_on is not null and p_expected_back < p_sent_on then
    raise exception 'Expected back is before the date sent.' using errcode = '22023';
  end if;
  v_num := app.next_number('outside_mro_job', 'MRO-{000000}');
  insert into public.outside_mro_job (number, supplier_id, title, scope, aircraft_id, work_order_id, us_return_id,
                                      part_id, serial_no, sent_on, expected_back, raised_by)
  values (v_num, s.id, trim(p_title), nullif(trim(coalesce(p_scope, '')), ''), v_ac, w.id, p_us_return,
          coalesce(p_part, u.part_id), coalesce(nullif(trim(coalesce(p_serial, '')), ''), u.serial_no),
          p_sent_on, p_expected_back, v_me)
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'number', v_num);
end;
$$;

-- A quote, counter-offer or revised quote in the negotiation log (COST).
create or replace function app.add_mro_quote(p_job uuid, p_entry text, p_amount numeric, p_note text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  j    public.outside_mro_job;
  v_id uuid;
begin
  j := app.mro_job_for_procurement(p_job);
  perform app.cost_check();
  if coalesce(p_entry, '') not in ('quote', 'counter_offer', 'revised_quote') then
    raise exception 'Entry is a quote, counter-offer or revised quote. The agreed cost is signed separately.'
      using errcode = '22023';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter the amount.' using errcode = '23514';
  end if;
  insert into public.outside_mro_quote (job_id, entry, amount, currency, note, entered_by)
  values (j.id, p_entry, p_amount, app.currency_code(), nullif(trim(coalesce(p_note, '')), ''), app.current_person_id())
  returning id into v_id;
  return v_id;
end;
$$;

-- The agreed cost, signed with PIN (D-144). A later renegotiation adds a new
-- "agreed" entry; the newest is in force.
create or replace function app.agree_mro_cost(p_job uuid, p_amount numeric, p_pin text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  j public.outside_mro_job;
begin
  j := app.mro_job_for_procurement(p_job);
  perform app.cost_check();
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter the agreed amount.' using errcode = '23514';
  end if;
  perform app.require_pin(p_pin);
  insert into public.outside_mro_quote (job_id, entry, amount, currency, note, entered_by)
  values (j.id, 'agreed', p_amount, app.currency_code(), nullif(trim(coalesce(p_note, '')), ''), app.current_person_id());
  if j.status = 'quoting' then
    update public.outside_mro_job set status = 'agreed', status_since = now() where id = j.id;
  end if;
end;
$$;

-- A part the outside MRO used, with its cost (COST, D-144).
create or replace function app.add_mro_part(
  p_job uuid, p_qty numeric, p_unit_cost numeric,
  p_part uuid default null, p_part_number_text text default null, p_description text default null)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  j    public.outside_mro_job;
  v_id uuid;
begin
  j := app.mro_job_for_procurement(p_job);
  perform app.cost_check();
  if p_part is null and length(trim(coalesce(p_part_number_text, ''))) = 0 then
    raise exception 'Choose the part or type its part number.' using errcode = '23514';
  end if;
  if coalesce(p_qty, 0) <= 0 then
    raise exception 'Enter a quantity above zero.' using errcode = '23514';
  end if;
  if p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'Enter the unit cost.' using errcode = '23514';
  end if;
  insert into public.outside_mro_part (job_id, part_id, part_number_text, description, qty, unit_cost, currency, entered_by)
  values (j.id, p_part, case when p_part is null then trim(p_part_number_text) end,
          nullif(trim(coalesce(p_description, '')), ''), p_qty, p_unit_cost, app.currency_code(), app.current_person_id())
  returning id into v_id;
  return v_id;
end;
$$;

-- Commercial progress of the job: in work → returned → closed, or cancelled.
create or replace function app.set_outside_mro_status(
  p_job uuid, p_status text, p_date date default null, p_reason text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  j      public.outside_mro_job;
  v_rank jsonb := '{"quoting": 0, "agreed": 1, "in_work": 2, "returned": 3, "closed": 4}';
begin
  j := app.mro_job_for_procurement(p_job);
  if coalesce(p_status, '') not in ('in_work', 'returned', 'closed', 'cancelled') then
    raise exception 'Status is in work, returned, closed or cancelled.' using errcode = '22023';
  end if;
  if p_status = 'cancelled' then
    if length(trim(coalesce(p_reason, ''))) = 0 then
      raise exception 'Give a reason for cancelling.' using errcode = '23514';
    end if;
  elsif (v_rank ->> p_status)::integer <= (v_rank ->> j.status)::integer then
    raise exception 'Job % is already %; it moves only forward.', j.number, replace(j.status, '_', ' ') using errcode = 'P0001';
  end if;
  if p_status in ('in_work', 'returned', 'closed')
     and not exists (select 1 from public.outside_mro_quote q where q.job_id = j.id and q.entry = 'agreed') then
    raise exception 'Record the agreed cost first (D-144).' using errcode = 'P0001';
  end if;
  update public.outside_mro_job
     set status = p_status, status_since = now(),
         sent_on = case when p_status = 'in_work' then coalesce(p_date, sent_on, app.today()) else sent_on end,
         returned_on = case when p_status = 'returned' then coalesce(p_date, app.today()) else returned_on end,
         cancel_reason = case when p_status = 'cancelled' then trim(p_reason) else cancel_reason end
   where id = j.id;
end;
$$;

-- Technical acceptance is Engineering's or Quality's, never Procurement's
-- (D-020, D-144). Nexus records what the licensed person states, with PIN.
create or replace function app.record_mro_technical_acceptance(p_job uuid, p_note text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  j public.outside_mro_job;
begin
  if app.current_person_id() is null or not (app.has_department('ENG') or app.has_department('QUA')) then
    raise exception 'Technical acceptance is recorded by Engineering or Quality, not Procurement (D-020, D-144).'
      using errcode = '42501';
  end if;
  select * into j from public.outside_mro_job where id = p_job for update;
  if not found or not app.can_see_outside_mro(j.aircraft_id) then
    raise exception 'Outside-MRO job not found.' using errcode = 'P0002';
  end if;
  if j.status not in ('returned', 'closed') then
    raise exception 'Job % has not come back yet.', j.number using errcode = 'P0001';
  end if;
  if j.accepted_at is not null then
    raise exception 'Technical acceptance on % is already recorded.', j.number using errcode = 'P0001';
  end if;
  if length(trim(coalesce(p_note, ''))) = 0 then
    raise exception 'State what was accepted and against which record (e.g. the work order or CRS).' using errcode = '23514';
  end if;
  perform app.require_pin(p_pin);
  update public.outside_mro_job
     set acceptance_note = trim(p_note), accepted_by = app.current_person_id(), accepted_at = now()
   where id = j.id;
end;
$$;

-- -------------------------------------------------------- settings -----
-- Bands, currency, labels and number formats (D-025, D-146, D-149). A new
-- version of the setting; history kept (D-023). The Commander for now; the
-- D-078 "Quality proposes, CO approves" flow for chain changes comes later.
create or replace function app.set_procurement_setting(p_key text, p_value jsonb, p_reason text, p_pin text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  e jsonb;
begin
  if app.current_person_id() is null or not app.is_global_super_admin() then
    raise exception 'Only the Commander (Super Admin for all) changes procurement settings for now (D-078).'
      using errcode = '42501';
  end if;
  if p_key = 'requisition.approval_bands' then
    if jsonb_typeof(p_value) <> 'array' or jsonb_array_length(p_value) = 0 then
      raise exception 'Give a list of bands.' using errcode = '22023';
    end if;
    for e in select x from jsonb_array_elements(p_value) x loop
      if jsonb_typeof(e) <> 'object' or not exists (
           select 1 from public.approval_chain c where c.action_type = e ->> 'chain' and c.action_type like 'requisition%')
         or (e ? 'priority' and e ->> 'priority' not in ('ROUTINE', 'AOG'))
         or (e ? 'max_value' and jsonb_typeof(e -> 'max_value') <> 'number') then
        raise exception 'Each band names a requisition chain, and optionally a priority (ROUTINE/AOG) and a max_value.'
          using errcode = '22023';
      end if;
    end loop;
    if (p_value -> -1) ? 'max_value' or (p_value -> -1) ? 'priority' then
      raise exception 'The last band must catch everything (no priority, no max_value).' using errcode = '22023';
    end if;
  elsif p_key = 'procurement.currency' then
    if jsonb_typeof(p_value) <> 'object' or coalesce(p_value ->> 'code', '') !~ '^[A-Z]{3}$' then
      raise exception 'Give the currency as {"code": "ABC", "symbol": "...", "decimals": 2}.' using errcode = '22023';
    end if;
  elsif p_key = 'labels.documents' then
    if jsonb_typeof(p_value) <> 'object' then
      raise exception 'Give the document names as an object.' using errcode = '22023';
    end if;
  elsif p_key in ('requisition.number_format', 'purchase_order.number_format', 'outside_mro_job.number_format') then
    if jsonb_typeof(p_value) <> 'string' or (p_value #>> '{}') !~ '\{0+\}' then
      raise exception 'A number format looks like "REQ-{000000}".' using errcode = '22023';
    end if;
  else
    raise exception 'Not a procurement setting.' using errcode = '22023';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then
    raise exception 'Give a reason for the change.' using errcode = '23514';
  end if;
  perform app.require_pin(p_pin);
  insert into public.operator_setting (key, value, reason) values (p_key, p_value, trim(p_reason));
end;
$$;

-- ======================================================= screen reads =====
-- These read functions apply the same visibility as the tables, and give
-- cost ONLY to people who may see it (D-077, D-121, D-127): for everyone
-- else every price comes back empty.

-- What the signed-in person may do in procurement (the database checks
-- again on every action).
create or replace function app.my_procurement_rights()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'view_cost',          app.can_view_cost(),
    'raise_requisition',  app.has_department('SUP') and app.has_permission('RAISE_REQUISITION'),
    'receive',            app.has_department('SUP') and app.has_permission('RECEIVE_PARTS'),
    'raise_po',           app.has_department('PRO') and app.has_permission('RAISE_PURCHASE_ORDER'),
    'manage_mro',         app.has_department('PRO') and app.has_permission('MANAGE_OUTSIDE_MRO'),
    'maintain_suppliers', app.has_department('QUA'),
    'technical_acceptance', app.has_department('ENG') or app.has_department('QUA'),
    'see_purchase_orders', app.can_see_purchase_orders(),
    'stores', coalesce((select jsonb_agg(g.store_code order by g.store_code) from public.access_grant g
                         where g.person_id = app.current_person_id() and g.revoked_at is null
                           and g.grant_type = 'store'), '[]'::jsonb),
    'currency', coalesce(app.setting('procurement.currency'), '{"code": "XXX"}'::jsonb),
    'labels', coalesce(app.setting('labels.documents'), '{}'::jsonb));
$$;

-- Requisitions with where each one stands and who holds it ("Blocked by",
-- D-006, D-094).
create or replace function app.requisition_list(p_id uuid default null, p_open_only boolean default true)
returns table (
  id uuid, number text, version integer, kind text, status text, stage text, holder text, held_since timestamptz,
  priority text, part_id uuid, part_number text, description text, unit text, qty numeric, store_code text,
  aircraft_id uuid, tail text, request_id uuid, request_number text, request_line_id uuid, request_line_state text,
  request_cancelled boolean, us_return_id uuid, us_return_number text, purpose text, remarks text,
  required_by timestamptz, action_type text, chain_name text, approval_request_id uuid, step_no integer,
  step_count integer, step_name text, raised_by uuid, raised_by_code text, raised_at timestamptz,
  rejected_reason text, superseded_by uuid, cancel_reason text,
  po_id uuid, po_number text, po_status text, po_eta date, supplier_name text,
  estimated_value numeric, currency text, can_approve boolean)
language sql stable security definer set search_path = ''
as $$
  select q.id, q.number, q.version, q.kind, q.status,
         case
           when q.status = 'in_approval' then format('In approval · step %s of %s', ar.current_step, cnt.n)
           when q.status = 'approved' and po.id is null then 'Approved · sourcing'
           when q.status = 'approved' then 'Approved · PO being prepared'
           when q.status = 'ordered' then app.sentence(app.po_state_words(po.status))
           when q.status = 'received' then 'Received into stock'
           when q.status = 'rejected' and q.superseded_by is not null then 'Rejected · resubmitted'
           when q.status = 'rejected' then 'Rejected · back to raiser'
           else 'Cancelled' end,
         case
           when q.status = 'in_approval' then coalesce(st.name, 'Approver')
           when q.status = 'approved' then 'Procurement'
           when q.status = 'ordered' then case po.status
             when 'ordered' then 'Supplier' when 'shipped' then 'Carrier'
             when 'in_clearing' then 'Procurement · customs' when 'delivered' then 'Supply' else 'Procurement' end
           when q.status = 'rejected' and q.superseded_by is null then 'Supply · ' || rp.three_letter_code
           else null end,
         case
           when q.status = 'in_approval'
             then coalesce((select max(d.created_at) from public.approval_decision d where d.request_id = ar.id), q.raised_at)
           when q.status = 'ordered' then po.status_since
           else q.status_since end,
         q.priority, q.part_id, coalesce(p.part_number, q.part_number_text), p.description, p.unit, q.qty, q.store_code,
         coalesce(pr.aircraft_id, us.aircraft_id), a.tail, pr.id, pr.number, q.request_line_id, l.state,
         coalesce(l.state = 'cancelled' or pr.status = 'cancelled', false),
         q.us_return_id, us.number, q.purpose, q.remarks, q.required_by,
         q.action_type, c.name, q.approval_request_id,
         case when q.status = 'in_approval' then ar.current_step end, cnt.n,
         case when q.status = 'in_approval' then st.name end,
         q.raised_by, rp.three_letter_code, q.raised_at, q.rejected_reason, q.superseded_by, q.cancel_reason,
         po.id, po.number, po.status, po.eta, ps.name,
         case when app.can_view_cost() then est.estimated_value end,
         case when app.can_view_cost() then est.currency end,
         (q.status = 'in_approval' and ar.status = 'pending'
          and app.holds_step(ar.action_type, ar.current_step)
          and ar.raised_by <> app.current_person_id()
          and not exists (select 1 from public.approval_decision d
                           where d.request_id = ar.id and d.decided_by = app.current_person_id()))
    from public.requisition q
    join public.person rp on rp.id = q.raised_by
    join public.approval_chain c on c.action_type = q.action_type
    left join public.approval_request ar on ar.id = q.approval_request_id
    left join lateral (select count(*)::integer as n from public.approval_chain_step s
                        where s.action_type = q.action_type) cnt on true
    left join public.approval_chain_step st on st.action_type = q.action_type and st.step_no = ar.current_step
    left join public.part p on p.id = q.part_id
    left join public.part_request_line l on l.id = q.request_line_id
    left join public.part_request pr on pr.id = l.request_id
    left join public.us_return us on us.id = q.us_return_id
    left join public.aircraft a on a.id = coalesce(pr.aircraft_id, us.aircraft_id)
    left join lateral (select x.* from public.purchase_order_line x
                        where x.requisition_id = q.id and x.status <> 'cancelled' limit 1) pol on true
    left join public.purchase_order po on po.id = pol.purchase_order_id
    left join public.supplier ps on ps.id = po.supplier_id
    left join public.requisition_estimate est on est.requisition_id = q.id
   where app.current_person_id() is not null
     and app.can_see_requisition(q.raised_by, q.store_code, q.request_line_id, q.action_type)
     and (p_id is null or q.id = p_id)
     and (p_id is not null or not coalesce(p_open_only, true)
          or (q.status not in ('received', 'cancelled') and q.superseded_by is null))
   order by case q.priority when 'AOG' then 0 else 1 end, q.raised_at, q.number, q.version;
$$;

-- One requisition with its approval trail, versions and flags.
create or replace function app.requisition_detail(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v  jsonb;
  q  public.requisition;
begin
  select to_jsonb(x) into v from app.requisition_list(p_id) x;
  if v is null then
    raise exception 'Requisition not found.' using errcode = 'P0002';
  end if;
  select * into q from public.requisition where id = p_id;
  return v || jsonb_build_object(
    -- Every step of the chain, with who decided it, when, and any reason.
    'steps', (select coalesce(jsonb_agg(jsonb_build_object(
                'step_no', s.step_no, 'name', s.name,
                'held_by', coalesce(d.name, ap.title),
                'decision', dec.decision, 'decided_by', dp.three_letter_code, 'decided_by_name', dp.full_name,
                'decided_at', dec.created_at, 'reason', dec.reason,
                'current', ar.status = 'pending' and ar.current_step = s.step_no) order by s.step_no), '[]'::jsonb)
                from public.approval_chain_step s
                left join public.department d on d.code = s.department_code
                left join public.appointment ap on ap.id = s.appointment_id
                left join public.approval_request ar on ar.id = q.approval_request_id
                left join public.approval_decision dec on dec.request_id = ar.id and dec.step_no = s.step_no
                left join public.person dp on dp.id = dec.decided_by
               where s.action_type = q.action_type),
    -- All versions of this requisition number (D-079, D-023).
    'versions', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', o.id, 'version', o.version, 'status', o.status, 'raised_at', o.raised_at,
                   'rejected_reason', o.rejected_reason) order by o.version), '[]'::jsonb)
                   from public.requisition o where o.number = q.number),
    -- R-3: the same part requisitioned again within the window (split purchases).
    'same_part_recently', (select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'number', o.number,
                                     'qty', o.qty, 'raised_at', o.raised_at, 'status', o.status)), '[]'::jsonb)
                             from public.requisition o
                            where q.part_id is not null and o.part_id = q.part_id and o.number <> q.number
                              and o.status not in ('cancelled', 'rejected')
                              and o.raised_at >= q.raised_at
                                  - make_interval(days => coalesce((app.setting('procurement.split_window_days'))::integer, 30))
                              and o.raised_at <= q.raised_at
                                  + make_interval(days => coalesce((app.setting('procurement.split_window_days'))::integer, 30))),
    'can', jsonb_build_object(
      'approve', (v ->> 'can_approve')::boolean,
      'manage', (q.raised_by = app.current_person_id()
                 or (app.has_department('SUP') and app.has_permission('RAISE_REQUISITION') and app.holds_store(q.store_code))),
      'raise_po', q.status = 'approved' and app.has_department('PRO') and app.has_permission('RAISE_PURCHASE_ORDER'),
      'view_cost', app.can_view_cost()));
end;
$$;

-- Purchase orders, with the overdue flag (ETA passed, not yet arrived).
create or replace function app.purchase_order_list(p_open_only boolean default true)
returns table (
  id uuid, number text, status text, status_since timestamptz, supplier_id uuid, supplier_name text,
  supplier_ref text, eta date, overdue boolean, shipment_ref text, clearing_ref text,
  lines integer, first_line text, tails text, has_aog boolean,
  raised_by_code text, created_at timestamptz, ordered_at timestamptz,
  total numeric, currency text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.number, p.status, p.status_since, s.id, s.name, p.supplier_ref, p.eta,
         p.eta is not null and p.eta < app.today() and p.status in ('ordered', 'shipped', 'in_clearing'),
         p.shipment_ref, p.clearing_ref,
         (select count(*)::integer from public.purchase_order_line x where x.purchase_order_id = p.id and x.status <> 'cancelled'),
         (select coalesce(pt.description || ' ' || pt.part_number, x.part_number_text)
            from public.purchase_order_line x left join public.part pt on pt.id = x.part_id
           where x.purchase_order_id = p.id and x.status <> 'cancelled' order by x.line_no limit 1),
         (select string_agg(distinct a.tail, ', ')
            from public.purchase_order_line x join public.requisition q on q.id = x.requisition_id
            join public.part_request_line l on l.id = q.request_line_id
            join public.part_request r on r.id = l.request_id join public.aircraft a on a.id = r.aircraft_id
           where x.purchase_order_id = p.id and x.status <> 'cancelled'),
         exists (select 1 from public.purchase_order_line x join public.requisition q on q.id = x.requisition_id
                  where x.purchase_order_id = p.id and x.status <> 'cancelled' and q.priority = 'AOG'),
         rp.three_letter_code, p.created_at, p.ordered_at,
         case when app.can_view_cost() then
           (select round(sum(x.qty * pr.unit_price), 2) from public.purchase_order_line x
              join lateral (select y.unit_price from public.purchase_order_line_price y where y.po_line_id = x.id
                             order by y.created_at desc limit 1) pr on true
             where x.purchase_order_id = p.id and x.status <> 'cancelled') end,
         case when app.can_view_cost() then p.currency end
    from public.purchase_order p
    join public.supplier s on s.id = p.supplier_id
    join public.person rp on rp.id = p.raised_by
   where app.can_see_purchase_orders()
     and (not coalesce(p_open_only, true) or p.status not in ('closed', 'cancelled'))
   order by (p.eta is not null and p.eta < app.today() and p.status in ('ordered', 'shipped', 'in_clearing')) desc,
            p.eta nulls last, p.created_at desc;
$$;

-- One PO: lines (with prices, last price and the R-4 flag, for cost viewers
-- only), receipts, timeline and invoices.
create or replace function app.purchase_order_detail(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  p      public.purchase_order;
  v_cost boolean := app.can_view_cost();
  v_flag numeric := coalesce((app.setting('procurement.price_flag_percent'))::numeric, 25);
begin
  select * into p from public.purchase_order where id = p_id;
  if not found or not app.can_see_purchase_orders() then
    raise exception 'Purchase order not found.' using errcode = 'P0002';
  end if;
  return (select to_jsonb(x) from app.purchase_order_list(false) x where x.id = p.id) || jsonb_build_object(
    'supplier', (select jsonb_build_object('id', s.id, 'code', s.code, 'name', s.name, 'status', s.status,
                                           'country', s.country, 'contact', s.contact)
                   from public.supplier s where s.id = p.supplier_id),
    'note', p.note, 'ordered_by', (select three_letter_code from public.person where id = p.ordered_by),
    'cancel_reason', p.cancel_reason,
    'buyers', jsonb_build_array(p.raised_by, p.ordered_by),
    'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', pl.id, 'line_no', pl.line_no, 'status', pl.status, 'qty', pl.qty, 'cancel_reason', pl.cancel_reason,
                'part_id', pl.part_id, 'part_number', coalesce(pt.part_number, pl.part_number_text),
                'description', pt.description, 'unit', pt.unit,
                'requisition_id', q.id, 'requisition_number', q.number, 'requisition_version', q.version,
                'priority', q.priority, 'store_code', q.store_code, 'kind', q.kind,
                'request_number', r.number, 'tail', a.tail,
                'received_qty', (select coalesce(sum(rc.qty), 0) from public.stock_receipt rc
                                  where rc.purchase_order_line_id = pl.id and rc.status = 'accepted'),
                'open_receipt_qty', (select coalesce(sum(rc.qty), 0) from public.stock_receipt rc
                                      where rc.purchase_order_line_id = pl.id and rc.status <> 'quarantined'),
                'unit_price', case when v_cost then pr.unit_price end,
                'line_total', case when v_cost then round(pr.unit_price * pl.qty, 2) end,
                'last_price', case when v_cost then lp.unit_price end,
                'last_price_ref', case when v_cost then lp.number end,
                'price_flag', case when v_cost and lp.unit_price > 0 and pr.unit_price is not null
                                   and (pr.unit_price - lp.unit_price) / lp.unit_price * 100 > v_flag
                                   then round((pr.unit_price - lp.unit_price) / lp.unit_price * 100) end)
                order by pl.line_no), '[]'::jsonb)
                from public.purchase_order_line pl
                join public.requisition q on q.id = pl.requisition_id
                left join public.part pt on pt.id = pl.part_id
                left join public.part_request_line l on l.id = q.request_line_id
                left join public.part_request r on r.id = l.request_id
                left join public.aircraft a on a.id = r.aircraft_id
                left join lateral (select y.unit_price from public.purchase_order_line_price y
                                    where y.po_line_id = pl.id order by y.created_at desc limit 1) pr on true
                left join lateral (select y.unit_price, op.number
                                     from public.purchase_order_line ol
                                     join public.purchase_order op on op.id = ol.purchase_order_id
                                     join lateral (select z.unit_price from public.purchase_order_line_price z
                                                    where z.po_line_id = ol.id order by z.created_at desc limit 1) y on true
                                    where pl.part_id is not null and ol.part_id = pl.part_id and op.id <> p.id
                                      and op.status not in ('draft', 'cancelled') and ol.status <> 'cancelled'
                                    order by op.ordered_at desc nulls last limit 1) lp on true
               where pl.purchase_order_id = p.id),
    'receipts', (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', rc.id, 'number', rc.number, 'status', rc.status, 'qty', rc.qty, 'store_code', rc.store_code,
                   'line_id', rc.purchase_order_line_id, 'opened_by', ob.three_letter_code,
                   'inspected_by', ib.three_letter_code, 'created_at', rc.created_at,
                   'quarantine_reason', rc.quarantine_reason) order by rc.created_at), '[]'::jsonb)
                   from public.stock_receipt rc
                   join public.person ob on ob.id = rc.opened_by
                   left join public.person ib on ib.id = rc.inspected_by
                  where rc.purchase_order_id = p.id),
    'events', (select coalesce(jsonb_agg(jsonb_build_object(
                 'event', e.event, 'note', e.note, 'eta', e.eta, 'by', ep.three_letter_code, 'at', e.created_at)
                 order by e.created_at), '[]'::jsonb)
                 from public.purchase_order_event e left join public.person ep on ep.id = e.done_by
                where e.purchase_order_id = p.id),
    'invoices', case when v_cost then (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', i.id, 'invoice_no', i.invoice_no, 'invoice_date', i.invoice_date, 'amount', i.amount,
                  'currency', i.currency, 'note', i.note, 'recorded_by', ip.three_letter_code, 'created_at', i.created_at)
                  order by i.invoice_date), '[]'::jsonb)
                  from public.supplier_invoice i join public.person ip on ip.id = i.recorded_by
                 where i.purchase_order_id = p.id) end,
    'can', jsonb_build_object(
      'buy', app.has_department('PRO') and app.has_permission('RAISE_PURCHASE_ORDER'),
      'receive', app.has_department('SUP') and app.has_permission('RECEIVE_PARTS')
                 and app.current_person_id() not in (p.raised_by, coalesce(p.ordered_by, p.raised_by)),
      'i_am_buyer', app.current_person_id() in (p.raised_by, coalesce(p.ordered_by, p.raised_by)),
      'view_cost', v_cost));
end;
$$;

-- Outside-MRO jobs, with the agreed cost for cost viewers.
create or replace function app.outside_mro_jobs(p_open_only boolean default true)
returns table (
  id uuid, number text, title text, status text, status_since timestamptz, supplier_name text,
  aircraft_id uuid, tail text, work_order_id uuid, work_order_number text, us_return_number text,
  part_number text, serial_no text, sent_on date, expected_back date, returned_on date,
  overdue boolean, accepted boolean, agreed_cost numeric, currency text, raised_by_code text, created_at timestamptz)
language sql stable security definer set search_path = ''
as $$
  select j.id, j.number, j.title, j.status, j.status_since, s.name, j.aircraft_id, a.tail, j.work_order_id, w.number,
         u.number, coalesce(pt.part_number, u.part_number_text), j.serial_no, j.sent_on, j.expected_back, j.returned_on,
         j.expected_back is not null and j.expected_back < app.today() and j.status in ('agreed', 'in_work'),
         j.accepted_at is not null,
         case when app.can_view_cost() then ag.amount end,
         case when app.can_view_cost() then ag.currency end,
         rp.three_letter_code, j.created_at
    from public.outside_mro_job j
    join public.supplier s on s.id = j.supplier_id
    join public.person rp on rp.id = j.raised_by
    left join public.aircraft a on a.id = j.aircraft_id
    left join public.work_order w on w.id = j.work_order_id
    left join public.us_return u on u.id = j.us_return_id
    left join public.part pt on pt.id = coalesce(j.part_id, u.part_id)
    left join lateral (select q.amount, q.currency from public.outside_mro_quote q
                        where q.job_id = j.id and q.entry = 'agreed' order by q.created_at desc limit 1) ag on true
   where app.can_see_outside_mro(j.aircraft_id)
     and (not coalesce(p_open_only, true) or j.status not in ('closed', 'cancelled'))
   order by j.created_at desc;
$$;

create or replace function app.outside_mro_job_detail(p_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  j      public.outside_mro_job;
  v_cost boolean := app.can_view_cost();
begin
  select * into j from public.outside_mro_job where id = p_id;
  if not found or not app.can_see_outside_mro(j.aircraft_id) then
    raise exception 'Outside-MRO job not found.' using errcode = 'P0002';
  end if;
  return (select to_jsonb(x) from app.outside_mro_jobs(false) x where x.id = j.id) || jsonb_build_object(
    'scope', j.scope, 'cancel_reason', j.cancel_reason,
    'supplier', (select jsonb_build_object('id', s.id, 'name', s.name, 'code', s.code, 'country', s.country, 'contact', s.contact)
                   from public.supplier s where s.id = j.supplier_id),
    -- Engineering's record of the work: shown, never decided here (D-020).
    'work_order', (select jsonb_build_object('id', w.id, 'number', w.number, 'status', w.status,
                                             'certified_by', cp.three_letter_code, 'certified_at', w.certified_at)
                     from public.work_order w left join public.person cp on cp.id = w.certified_by
                    where w.id = j.work_order_id),
    'acceptance', case when j.accepted_at is not null then jsonb_build_object(
                    'note', j.acceptance_note, 'by', (select three_letter_code from public.person where id = j.accepted_by),
                    'by_name', (select full_name from public.person where id = j.accepted_by), 'at', j.accepted_at) end,
    'quotes', case when v_cost then (select coalesce(jsonb_agg(jsonb_build_object(
                'id', q.id, 'entry', q.entry, 'amount', q.amount, 'currency', q.currency, 'note', q.note,
                'by', qp.three_letter_code, 'at', q.created_at) order by q.created_at), '[]'::jsonb)
                from public.outside_mro_quote q join public.person qp on qp.id = q.entered_by
               where q.job_id = j.id) end,
    'parts', case when v_cost then (select coalesce(jsonb_agg(jsonb_build_object(
                'id', mp.id, 'part_number', coalesce(pt.part_number, mp.part_number_text),
                'description', coalesce(mp.description, pt.description), 'qty', mp.qty, 'unit_cost', mp.unit_cost,
                'currency', mp.currency, 'by', mpp.three_letter_code) order by mp.created_at), '[]'::jsonb)
                from public.outside_mro_part mp
                join public.person mpp on mpp.id = mp.entered_by
                left join public.part pt on pt.id = mp.part_id
               where mp.job_id = j.id) end,
    'invoices', case when v_cost then (select coalesce(jsonb_agg(jsonb_build_object(
                  'id', i.id, 'invoice_no', i.invoice_no, 'invoice_date', i.invoice_date, 'amount', i.amount,
                  'currency', i.currency, 'note', i.note) order by i.invoice_date), '[]'::jsonb)
                  from public.supplier_invoice i where i.outside_mro_job_id = j.id) end,
    'can', jsonb_build_object(
      'manage', app.has_department('PRO') and app.has_permission('MANAGE_OUTSIDE_MRO')
                and j.status not in ('closed', 'cancelled'),
      'accept', (app.has_department('ENG') or app.has_department('QUA'))
                and j.status in ('returned', 'closed') and j.accepted_at is null,
      'view_cost', v_cost));
end;
$$;

-- ======================================================= attachments =====
-- Invoice scans: attachments on "supplier_invoice", kind "invoice", PDF or
-- image only (D-026), never deleted (D-023). Visible only to whoever can
-- see the invoice row, i.e. cost viewers (D-127). Same method as 0029: the
-- lists are extended, and "can see record" learns the new tables and hands
-- every other table to the version in force before this migration.
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.attachment'::regclass and conname = 'attachment_record_table_check';
  if v_def not like '%''supplier_invoice''%' then
    alter table public.attachment drop constraint attachment_record_table_check;
    execute 'alter table public.attachment add constraint attachment_record_table_check '
            || replace(v_def, 'ARRAY[', 'ARRAY[''supplier_invoice''::text, ');
  end if;

  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.attachment'::regclass and conname = 'attachment_kind_check';
  if v_def not like '%''invoice''%' then
    alter table public.attachment drop constraint attachment_kind_check;
    execute 'alter table public.attachment add constraint attachment_kind_check '
            || replace(v_def, 'ARRAY[', 'ARRAY[''invoice''::text, ');
  end if;

  if to_regprocedure('app.can_see_record_before_procurement(text, uuid)') is null then
    v_def := pg_get_functiondef('app.can_see_record(text, uuid)'::regprocedure);
    execute replace(v_def, 'FUNCTION app.can_see_record(', 'FUNCTION app.can_see_record_before_procurement(');
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
  -- Runs with the user's own rights: each table's own visibility rule decides.
  if p_table in ('supplier_invoice', 'requisition', 'purchase_order', 'outside_mro_job') then
    if p_id is null then
      return false;
    end if;
    execute format('select exists (select 1 from public.%I where id = $1)', p_table) into v_ok using p_id;
    return v_ok;
  end if;
  return app.can_see_record_before_procurement(p_table, p_id);
end;
$$;

create policy nexus_attachments_upload_invoices on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments'
              and app.current_person_id() is not null
              and (storage.foldername(name))[1] = 'supplier_invoice'
              and (storage.foldername(name))[2] ~ '^[0-9a-f-]{36}$'
              and app.can_see_record('supplier_invoice', ((storage.foldername(name))[2])::uuid));

-- ========================================================== security =====
alter table public.supplier                  enable row level security;
alter table public.requisition               enable row level security;
alter table public.requisition_estimate      enable row level security;
alter table public.purchase_order            enable row level security;
alter table public.purchase_order_line       enable row level security;
alter table public.purchase_order_line_price enable row level security;
alter table public.purchase_order_event      enable row level security;
alter table public.outside_mro_job           enable row level security;
alter table public.outside_mro_quote         enable row level security;
alter table public.outside_mro_part          enable row level security;
alter table public.supplier_invoice          enable row level security;

-- Supplier list: Procurement and Supply use it, Quality owns it, Command sees all.
create policy read_users on public.supplier for select to authenticated
  using (app.has_department('PRO') or app.has_department('SUP') or app.has_department('QUA') or app.has_department('CMD'));

create policy read_visible on public.requisition for select to authenticated
  using (app.can_see_requisition(raised_by, store_code, request_line_id, action_type));

create policy read_po on public.purchase_order for select to authenticated
  using (app.can_see_purchase_orders());
create policy read_po on public.purchase_order_line for select to authenticated
  using (app.can_see_purchase_orders());
create policy read_po on public.purchase_order_event for select to authenticated
  using (app.can_see_purchase_orders());

create policy read_visible on public.outside_mro_job for select to authenticated
  using (app.can_see_outside_mro(aircraft_id));

-- COST tables: only with "View cost" (Command, or granted), never Quality
-- (D-077, D-121, D-127), and only on records the person can see.
create policy read_cost on public.requisition_estimate for select to authenticated
  using (app.can_view_cost() and exists (select 1 from public.requisition q where q.id = requisition_estimate.requisition_id));
create policy read_cost on public.purchase_order_line_price for select to authenticated
  using (app.can_view_cost() and app.can_see_purchase_orders());
create policy read_cost on public.outside_mro_quote for select to authenticated
  using (app.can_view_cost() and exists (select 1 from public.outside_mro_job j where j.id = outside_mro_quote.job_id));
create policy read_cost on public.outside_mro_part for select to authenticated
  using (app.can_view_cost() and exists (select 1 from public.outside_mro_job j where j.id = outside_mro_part.job_id));
create policy read_cost on public.supplier_invoice for select to authenticated
  using (app.can_view_cost()
         and ((purchase_order_id is not null and app.can_see_purchase_orders())
              or exists (select 1 from public.outside_mro_job j where j.id = supplier_invoice.outside_mro_job_id)));

-- Procurement reads part requests (to source them); policies add up, so
-- 0029's rules are unchanged. U/S returns too (repair requisitions).
create policy read_procurement on public.part_request for select to authenticated
  using (app.has_department('PRO'));
create policy read_procurement on public.us_return for select to authenticated
  using (app.has_department('PRO'));

-- The audit log must not hand cost to people who may not see it (D-127):
-- Quality reads the audit log (D-126) but not the cost tables' lines.
create policy hide_cost_lines on audit.log as restrictive for select to authenticated
  using (table_name not in ('public.requisition_estimate', 'public.purchase_order_line_price',
                            'public.outside_mro_quote', 'public.outside_mro_part', 'public.supplier_invoice')
         or app.can_view_cost());

-- No direct writes: every change goes through the functions above.
revoke insert, update, delete, truncate on
  public.supplier, public.requisition, public.requisition_estimate, public.purchase_order,
  public.purchase_order_line, public.purchase_order_line_price, public.purchase_order_event,
  public.outside_mro_job, public.outside_mro_quote, public.outside_mro_part, public.supplier_invoice
  from anon, authenticated;
revoke all on
  public.supplier, public.requisition, public.requisition_estimate, public.purchase_order,
  public.purchase_order_line, public.purchase_order_line_price, public.purchase_order_event,
  public.outside_mro_job, public.outside_mro_quote, public.outside_mro_part, public.supplier_invoice
  from anon;

-- Functions are locked by default (0021). Questions used by the rules:
grant execute on function
  app.can_see_requisition(uuid, text, uuid, text),
  app.can_see_purchase_orders(),
  app.can_see_outside_mro(uuid),
  app.can_see_record_before_procurement(text, uuid)
to authenticated;

-- Actions and questions the screens call:
grant execute on function
  app.add_supplier(text, text, text, text, text, text, text, text),
  app.set_supplier_status(uuid, text, text, text),
  app.raise_requisition(text, uuid, uuid, uuid, text, text, numeric, text, text, numeric, timestamptz, text, timestamptz),
  app.resubmit_requisition(uuid, numeric, text, numeric, timestamptz, text),
  app.cancel_requisition(uuid, text),
  app.create_purchase_order(uuid, uuid[], text, date, text),
  app.add_po_line(uuid, uuid),
  app.remove_po_line(uuid, text),
  app.set_po_line_price(uuid, numeric, text),
  app.place_purchase_order(uuid, text),
  app.update_purchase_order(uuid, text, date, text, text, text),
  app.cancel_purchase_order(uuid, text, text),
  app.receive_po_delivery(uuid, numeric, text, text, date, text, uuid),
  app.record_invoice(text, date, numeric, uuid, uuid, text),
  app.price_history(uuid),
  app.open_outside_mro_job(uuid, text, text, uuid, uuid, uuid, uuid, text, date, date),
  app.add_mro_quote(uuid, text, numeric, text),
  app.agree_mro_cost(uuid, numeric, text, text),
  app.add_mro_part(uuid, numeric, numeric, uuid, text, text),
  app.set_outside_mro_status(uuid, text, date, text),
  app.record_mro_technical_acceptance(uuid, text, text),
  app.set_procurement_setting(text, jsonb, text, text),
  app.my_procurement_rights(),
  app.requisition_list(uuid, boolean),
  app.requisition_detail(uuid),
  app.purchase_order_list(boolean),
  app.purchase_order_detail(uuid),
  app.outside_mro_jobs(boolean),
  app.outside_mro_job_detail(uuid)
to authenticated;
-- =============================================================================
