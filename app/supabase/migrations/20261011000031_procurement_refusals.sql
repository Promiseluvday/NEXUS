-- =============================================================================
-- Nexus MRO · Migration 0031 · Clear refusals on procurement records
-- Proprietary to Liebetag. All rights reserved.
--
-- Opening a requisition, purchase order or outside-MRO job you may not see
-- used to answer "not found" as a server error (HTTP 500). It now answers
-- "not found, or not in your view" as a refusal (HTTP 403). The database
-- still never says whether the record exists (D-125, D-127). The functions
-- are otherwise unchanged copies from migration 0030.
-- =============================================================================

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
    raise exception 'Requisition not found, or not in your view.' using errcode = '42501';
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
    raise exception 'Purchase order not found, or not in your view.' using errcode = '42501';
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
    raise exception 'Outside-MRO job not found, or not in your view.' using errcode = '42501';
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

