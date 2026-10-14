-- =============================================================================
-- Nexus MRO · Sample data: procurement (FICTIONAL ONLY, D-112)
-- Proprietary to Liebetag. All rights reserved.
--
-- Loaded after seeds/40-parts-stores.sql by `npm run db:reset`. Everything
-- is invented: suppliers are [SAMPLE], prices are in the invented currency
-- "SMP", references are [SAMPLE].
--
--   * SCO  Supply CO (new sample person): Supply, Main + Forward stores,
--          View cost; holds the "Supply CO" appointment, so approves the
--          Supply CO steps. Sign in as "sco", password nexus-dev-only.
--   * SBK  storekeeper: gets "Raise requisitions".
--   * FAO  procurement officer: gets "Raise purchase orders" and
--          "Manage outside-MRO jobs".
--   * ABE  Engineering CO: gets the Main Store, to request the NX-101 pump.
--   * Approval chains for requisitions (operator set-up, D-076, D-146):
--       routine, up to 500 000 SMP:  storekeeper check → Supply CO
--       routine, above (or no estimate): storekeeper check → Supply CO → Commander
--       AOG:                          Supply CO → Commander
--   * Four [SAMPLE] suppliers (one suspended) and one [SAMPLE] outside MRO.
--   * Requisitions in each state: AOG waiting for the Commander, approved
--     waiting for a PO, rejected back to the storekeeper, cancelled, on a PO
--     in clearing (customs), on an overdue PO, and on a PO delivered and
--     waiting for receiving inspection (SBK can inspect it; FAO, the buyer,
--     cannot, D-075).
--   * An outside-MRO job with its negotiation log, agreed cost and parts.
--
-- Actions are made through the real functions where no PIN is involved.
-- Signed steps (approvals, placing orders, agreeing cost) are recorded the
-- way the signed functions record them, without touching anyone's PIN.
-- =============================================================================

-- ------------------------------------------------------------- Supply CO -----
insert into public.person (id, full_name, rank_or_title, service_number, three_letter_code)
values ('10000000-0000-0000-0000-0000000000e1', '[Supply CO]', '[Rank]', 'SN-00E1', 'SCO')
on conflict do nothing;

insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-0000000000e1', 'authenticated',
        'authenticated', 'sco@users.nexus.local', extensions.crypt('nexus-dev-only', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict do nothing;
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now()
  from auth.users u
 where u.id = '20000000-0000-0000-0000-0000000000e1'
   and not exists (select 1 from auth.identities i where i.user_id = u.id);

insert into public.user_account (id, person_id, status, activated_at, activated_by, username)
values ('20000000-0000-0000-0000-0000000000e1', '10000000-0000-0000-0000-0000000000e1', 'active', now(),
        '10000000-0000-0000-0000-000000000002', 'sco')
on conflict do nothing;

insert into public.appointment_holder (appointment_id, person_id, handed_over_by, reason)
select '30000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-0000000000e1',
       '10000000-0000-0000-0000-000000000002', 'Initial set-up'
 where not exists (select 1 from public.appointment_holder
                    where appointment_id = '30000000-0000-0000-0000-000000000004' and held_to is null);

-- Grants made by the Commander (ZEM). Only added if not already held.
insert into public.access_grant (person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
select v.* from (values
  ('10000000-0000-0000-0000-0000000000e1'::uuid, 'department', 'SUP', true,  null,                   null,   'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-0000000000e1'::uuid, 'store',      null,  false, null,                   'MAIN', 'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-0000000000e1'::uuid, 'store',      null,  false, null,                   'FWD',  'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-0000000000e1'::uuid, 'permission', null,  false, 'VIEW_COST',            null,   'Initial set-up', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-000000000008'::uuid, 'permission', null,  false, 'RAISE_REQUISITION',    null,   'Raises requisitions', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-000000000009'::uuid, 'permission', null,  false, 'RAISE_PURCHASE_ORDER', null,   'Buyer', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-000000000009'::uuid, 'permission', null,  false, 'MANAGE_OUTSIDE_MRO',   null,   'Outside-MRO oversight', '10000000-0000-0000-0000-000000000002'::uuid),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'store',      null,  false, null,                   'MAIN', 'Requests parts for any tail', '10000000-0000-0000-0000-000000000002'::uuid)
) as v(person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
where not exists (select 1 from public.access_grant g
                   where g.person_id = v.person_id and g.grant_type = v.grant_type and g.revoked_at is null
                     and g.department_code is not distinct from v.department_code
                     and g.permission_code is not distinct from v.permission_code
                     and g.store_code is not distinct from v.store_code);

-- ------------------------------------------------------- approval chains -----
insert into public.approval_chain_step (action_type, step_no, name, department_code, appointment_id)
select v.* from (values
  ('requisition',      1, 'Storekeeper check',          'SUP', null::uuid),
  ('requisition',      2, 'Supply CO approval',         null,  '30000000-0000-0000-0000-000000000004'::uuid),
  ('requisition_high', 1, 'Storekeeper check',          'SUP', null),
  ('requisition_high', 2, 'Supply CO approval',         null,  '30000000-0000-0000-0000-000000000004'::uuid),
  ('requisition_high', 3, 'Commander approval',         null,  '30000000-0000-0000-0000-000000000001'::uuid),
  ('requisition_aog',  1, 'Supply CO (AOG fast-track)', null,  '30000000-0000-0000-0000-000000000004'::uuid),
  ('requisition_aog',  2, 'Commander approval',         null,  '30000000-0000-0000-0000-000000000001'::uuid)
) as v(action_type, step_no, name, department_code, appointment_id)
where not exists (select 1 from public.approval_chain_step s where s.action_type = v.action_type and s.step_no = v.step_no);

-- ------------------------------------------------------------- settings -----
insert into public.operator_setting (key, value, reason) values
  ('procurement.currency', '{"code": "SMP", "symbol": "SMP ", "decimals": 2, "name": "[SAMPLE] currency"}',
   'Sample data: invented currency'),
  ('requisition.approval_bands',
   '[{"priority": "AOG", "chain": "requisition_aog"}, {"max_value": 500000, "chain": "requisition"}, {"chain": "requisition_high"}]',
   'Sample data: invented threshold of 500 000 SMP');

-- ------------------------------------------------------------- suppliers -----
-- Quality's approved list (D-148), added by QAR.
insert into public.supplier (code, name, kind, country, contact, approval_ref, scope_note, status, status_reason,
                             status_set_by, status_set_at, added_by) values
  ('SMP-A',   '[SAMPLE] Supplier A',  'parts', '[Country]', '[SAMPLE] sales@supplier-a.example', 'QA/SUP/[SAMPLE-01]', 'Seals, filters, consumables',
   'approved',  'Added to the approved list', '10000000-0000-0000-0000-000000000004', now() - interval '90 days', '10000000-0000-0000-0000-000000000004'),
  ('SMP-B',   '[SAMPLE] Supplier B',  'parts', '[Country]', '[SAMPLE] orders@supplier-b.example', 'QA/SUP/[SAMPLE-02]', 'Hydraulic components',
   'approved',  'Added to the approved list', '10000000-0000-0000-0000-000000000004', now() - interval '90 days', '10000000-0000-0000-0000-000000000004'),
  ('SMP-C',   '[SAMPLE] Supplier C',  'parts', '[Country]', null, 'QA/SUP/[SAMPLE-03]', 'Lamps and lighting',
   'suspended', '[SAMPLE] Release certificate discrepancy found at audit', '10000000-0000-0000-0000-000000000004', now() - interval '5 days', '10000000-0000-0000-0000-000000000004'),
  ('SMP-MRO', '[SAMPLE] MRO Alpha',   'mro',   '[Country]', '[SAMPLE] planning@mro-alpha.example', 'QA/SUP/[SAMPLE-04]', 'Hydraulic component overhaul',
   'approved',  'Added to the approved list', '10000000-0000-0000-0000-000000000004', now() - interval '60 days', '10000000-0000-0000-0000-000000000004')
on conflict do nothing;

-- ------------------------------------------- activity (one block, so the -----
-- ids made along the way can be used; acting as each person in turn)
do $$
declare
  v_snag  uuid;
  v_wo    uuid;
  l_pump  uuid; l_oring uuid; l_lamp uuid; l_pin uuid;
  q_pump  jsonb; q_oring jsonb; q_lamp jsonb; q_pin jsonb; q_filter jsonb; q_seal jsonb; q_seal_x jsonb;
  v_po1   uuid; v_po2 uuid; v_po3 uuid;
  v_job   uuid;
  v_ar    uuid;
  v_sup_a uuid := (select id from public.supplier where code = 'SMP-A');
  v_sup_b uuid := (select id from public.supplier where code = 'SMP-B');
  v_mro   uuid := (select id from public.supplier where code = 'SMP-MRO');
  pn      jsonb := '{}';
begin
  if exists (select 1 from public.requisition) then
    return;   -- already loaded
  end if;
  select jsonb_object_agg(part_number, id) into pn from public.part where part_number like '[SAMPLE-%';

  -- Act as a person: the functions read who is signed in from these claims.
  -- ABE (Engineering CO): NX-101 is AOG; a work order for the hydraulic pump
  -- (waiting for Quality and the CO) and an AOG request for the pump. The only
  -- pump in stock is in quarantine, so it needs a requisition.
  insert into public.snag (number, aircraft_id, reported_by, reporter_kind, description, ata, status, attended_by, attended_at)
  values (app.next_number('snag', 'SNAG-{000000}'), '40000000-0000-0000-0000-000000000101',
          '10000000-0000-0000-0000-000000000005', 'engineer', '[SAMPLE] No. 2 hydraulic pump low output', '29-10',
          'attended', '10000000-0000-0000-0000-000000000003', now() - interval '2 days')
  returning id into v_snag;
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
  v_wo := app.request_work_order(v_snag, '[SAMPLE] Replace No. 2 hydraulic pump', 4);
  l_pump := (app.request_part('aircraft_part', 'MAIN', 1, (pn ->> '[SAMPLE-HP-01]')::uuid,
              p_aircraft => '40000000-0000-0000-0000-000000000101', p_work_order => v_wo,
              p_priority => 'AOG', p_position => 'No. 2 engine', p_removed_part => 'unserviceable') #>> '{lines,0,id}')::uuid;

  -- KDO: three requests that are not in stock (expired, uncertified, quarantined).
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000005","role":"authenticated"}', true);
  l_oring := (app.request_part('consumable', 'MAIN', 10, (pn ->> '[SAMPLE-OR-11]')::uuid,
               p_aircraft => '40000000-0000-0000-0000-000000000202', p_purpose => '[SAMPLE] Landing gear servicing') #>> '{lines,0,id}')::uuid;
  l_lamp  := (app.request_part('consumable', 'MAIN', 2, (pn ->> '[SAMPLE-LP-04]')::uuid,
               p_aircraft => '40000000-0000-0000-0000-000000000204', p_purpose => '[SAMPLE] Cabin reading lights') #>> '{lines,0,id}')::uuid;
  l_pin   := (app.request_part('consumable', 'MAIN', 2, (pn ->> '[SAMPLE-BW-05]')::uuid,
               p_aircraft => '40000000-0000-0000-0000-000000000201', p_purpose => '[SAMPLE] Brake wear check') #>> '{lines,0,id}')::uuid;

  -- SBK raises the requisitions (estimates in the invented currency).
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
  q_pump   := app.raise_requisition('part_request', l_pump, p_priority => 'AOG', p_estimated_value => 2450000,
                                    p_remarks => '[SAMPLE] Supplier B quoted 10 days');
  q_oring  := app.raise_requisition('part_request', l_oring, p_estimated_value => 45000);
  q_lamp   := app.raise_requisition('part_request', l_lamp, p_estimated_value => 12000);
  q_pin    := app.raise_requisition('part_request', l_pin, p_estimated_value => 380000);
  q_filter := app.raise_requisition('replenishment', p_store => 'MAIN', p_qty => 20, p_part => (pn ->> '[SAMPLE-FL-02]')::uuid,
                                    p_purpose => '[SAMPLE] Minimum stock for the A-check season', p_estimated_value => 30000);
  q_seal   := app.raise_requisition('replenishment', p_store => 'MAIN', p_qty => 6, p_part => (pn ->> '[SAMPLE-SK-07]')::uuid,
                                    p_purpose => '[SAMPLE] Seal kits expire soon; replace stock', p_estimated_value => 18000);
  q_seal_x := app.raise_requisition('replenishment', p_store => 'MAIN', p_qty => 4, p_part => (pn ->> '[SAMPLE-SL-03]')::uuid,
                                    p_purpose => '[SAMPLE] Sealant top-up', p_estimated_value => 9000);
  perform app.cancel_requisition((q_seal_x ->> 'id')::uuid, '[SAMPLE] Sealant found in the Forward Store');

  -- Approvals: the same rules as the inbox (decide_approval checks the
  -- holder, raiser and two-step rules; only the PIN step is left out here).
  -- Pump (AOG): Supply CO approved; now waiting for the Commander.
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
  perform app.decide_approval_core((select approval_request_id from public.requisition where id = (q_pump ->> 'id')::uuid), 'approve');
  -- O-ring, lamp, filter, seal kit: FSK checks, SCO approves.
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
  perform app.decide_approval_core(r.approval_request_id, 'approve')
     from public.requisition r where r.id in ((q_oring ->> 'id')::uuid, (q_lamp ->> 'id')::uuid,
                                              (q_filter ->> 'id')::uuid, (q_seal ->> 'id')::uuid, (q_pin ->> 'id')::uuid);
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
  perform app.decide_approval_core(r.approval_request_id, 'approve')
     from public.requisition r where r.id in ((q_oring ->> 'id')::uuid, (q_lamp ->> 'id')::uuid,
                                              (q_filter ->> 'id')::uuid, (q_seal ->> 'id')::uuid);
  -- Brake wear pins: rejected with a reason, back to SBK (D-079).
  perform app.decide_approval_core((select approval_request_id from public.requisition where id = (q_pin ->> 'id')::uuid),
                                   'reject', '[SAMPLE] Price looks high: get a second quote from Supplier A');

  -- FAO (buyer) raises three POs.
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
  v_po1 := (app.create_purchase_order(v_sup_a, array[(q_lamp ->> 'id')::uuid], '[SAMPLE] QT-0412', current_date + 3) ->> 'id')::uuid;
  v_po2 := (app.create_purchase_order(v_sup_a, array[(q_filter ->> 'id')::uuid], '[SAMPLE] QT-0398', current_date - 1) ->> 'id')::uuid;
  v_po3 := (app.create_purchase_order(v_sup_b, array[(q_seal ->> 'id')::uuid], '[SAMPLE] QT-0377', current_date - 3) ->> 'id')::uuid;
  perform app.set_po_line_price(pl.id, case pl.purchase_order_id when v_po1 then 5600 when v_po2 then 1400 else 2900 end)
     from public.purchase_order_line pl where pl.purchase_order_id in (v_po1, v_po2, v_po3);
  -- Placing the order is PIN-signed in the app; recorded here as it records it.
  update public.purchase_order set status = 'ordered', status_since = now() - interval '6 days',
         ordered_by = '10000000-0000-0000-0000-000000000009', ordered_at = now() - interval '6 days'
   where id in (v_po1, v_po2, v_po3);
  update public.requisition q set status = 'ordered', status_since = now() - interval '6 days'
    from public.purchase_order_line pl where pl.purchase_order_id in (v_po1, v_po2, v_po3) and q.id = pl.requisition_id;
  perform app.po_event(p.id, 'Ordered from ' || s.name, null, p.eta)
     from public.purchase_order p join public.supplier s on s.id = p.supplier_id where p.id in (v_po1, v_po2, v_po3);
  perform app.po_touch_lines(p) from unnest(array[v_po1, v_po2, v_po3]) p;
  -- Lamps: shipped, now in clearing (customs, D-149). Filters: shipped.
  perform app.update_purchase_order(v_po1, 'shipped', p_shipment_ref => '[SAMPLE] AWB 000-0000 0412');
  perform app.update_purchase_order(v_po1, 'in_clearing', p_clearing_ref => '[SAMPLE] Customs entry C-2207',
                                    p_note => '[SAMPLE] Duty assessment pending');
  perform app.update_purchase_order(v_po2, 'shipped', p_shipment_ref => '[SAMPLE] Local delivery van');
  perform app.record_invoice('[SAMPLE] INV-A-0441', current_date - 2, 11200, v_po1);

  -- SBK registers the filters' arrival: receiving inspection waiting (SBK
  -- can inspect it; FAO, the buyer, never can, D-075).
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000008","role":"authenticated"}', true);
  perform app.receive_po_delivery(pl.id, p_batch => 'B-FL-03', p_bin => '[SAMPLE-C1]')
     from public.purchase_order_line pl where pl.purchase_order_id = v_po2;

  -- Outside MRO: the removed pump goes to MRO Alpha for overhaul (D-144).
  perform set_config('request.jwt.claims', '{"sub":"20000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
  v_job := (app.open_outside_mro_job(v_mro, '[SAMPLE] Hydraulic pump overhaul', '[SAMPLE] Strip, inspect, overhaul to CMM; return with release certificate',
                                     p_aircraft => '40000000-0000-0000-0000-000000000101', p_work_order => v_wo,
                                     p_part => (pn ->> '[SAMPLE-HP-01]')::uuid, p_serial => '[SAMPLE]-HP-0388',
                                     p_sent_on => current_date - 12, p_expected_back => current_date + 9) ->> 'id')::uuid;
  perform app.add_mro_quote(v_job, 'quote', 950000, '[SAMPLE] Initial quote received');
  perform app.add_mro_quote(v_job, 'counter_offer', 820000, '[SAMPLE] Counter-offer sent');
  -- The agreed cost is PIN-signed in the app; recorded here as it records it.
  insert into public.outside_mro_quote (job_id, entry, amount, currency, note, entered_by)
  values (v_job, 'agreed', 860000, 'SMP', '[SAMPLE] Agreed by phone and confirmed in writing', '10000000-0000-0000-0000-000000000009');
  update public.outside_mro_job set status = 'agreed', status_since = now() where id = v_job;
  perform app.set_outside_mro_status(v_job, 'in_work', current_date - 10);
  perform app.add_mro_part(v_job, 1, 25000, p_part_number_text => '[SAMPLE-SEAL-11]', p_description => '[SAMPLE] Seal set');
  perform app.add_mro_part(v_job, 2, 18000, p_part_number_text => '[SAMPLE-BRG-02]', p_description => '[SAMPLE] Bearing');

  perform set_config('request.jwt.claims', '', true);
end;
$$;
