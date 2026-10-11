-- =============================================================================
-- Nexus MRO · Phase 2 · Automatic checks of the procurement rules
-- (D-020, D-073 to D-079, D-127, D-144 to D-149)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
--
-- Sample people (seed.sql, seeds/40 and seeds/50; made here if missing):
--   KDO duty engineer (G550, Main Store)   TMB certifying engineer (G550)
--   SBK storekeeper (Main Store)           FSK Forward storekeeper (Supply)
--   SCO Supply CO (Supply, View cost)      FAO procurement officer (View cost)
--   ZEM Commander                          QAR Quality (never cost, D-127)
-- Parts and suppliers used here are made by this file: [TEST-...], fictional (D-112).
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(72);

\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set FAO '''20000000-0000-0000-0000-000000000009'''
\set FSK '''20000000-0000-0000-0000-0000000000d1'''
\set SCO '''20000000-0000-0000-0000-0000000000e1'''
\set KDO_P '''10000000-0000-0000-0000-000000000005'''
\set SBK_P '''10000000-0000-0000-0000-000000000008'''
\set FAO_P '''10000000-0000-0000-0000-000000000009'''
\set ZEM_P '''10000000-0000-0000-0000-000000000002'''
\set FSK_P '''10000000-0000-0000-0000-0000000000d1'''
\set SCO_P '''10000000-0000-0000-0000-0000000000e1'''
\set SUPPLY_CO '''30000000-0000-0000-0000-000000000004'''
\set COMMANDER '''30000000-0000-0000-0000-000000000001'''
\set NX201 '''40000000-0000-0000-0000-000000000201'''
\set NX202 '''40000000-0000-0000-0000-000000000202'''
\set NX203 '''40000000-0000-0000-0000-000000000203'''

create function pg_temp.act_as(p_user uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_user, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;
create function pg_temp.admin() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on function pg_temp.act_as(uuid), pg_temp.admin() to authenticated;

-- ------------------------------------------------------------------ set-up ---
-- People the sample data adds (skipped if already there): FSK and SCO.
insert into public.person (id, full_name, rank_or_title, service_number, three_letter_code) values
  (:FSK_P, '[Forward storekeeper]', '[Rank]', 'SN-00D1', 'FSK'),
  (:SCO_P, '[Supply CO]',           '[Rank]', 'SN-00E1', 'SCO')
on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
       extensions.crypt('nexus-dev-only', extensions.gen_salt('bf')), now(),
       '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from (values (:FSK::uuid, 'fsk@users.nexus.local'), (:SCO::uuid, 'sco@users.nexus.local')) as u(id, email)
on conflict do nothing;
insert into public.user_account (id, person_id, status, activated_at, activated_by) values
  (:FSK, :FSK_P, 'active', now(), :ZEM_P),
  (:SCO, :SCO_P, 'active', now(), :ZEM_P)
on conflict do nothing;
insert into public.appointment_holder (appointment_id, person_id, handed_over_by, reason)
select :SUPPLY_CO, :SCO_P, :ZEM_P, 'Test set-up'
 where not exists (select 1 from public.appointment_holder where appointment_id = :SUPPLY_CO and held_to is null);

insert into public.access_grant (person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
select v.* from (values
  (:FSK_P::uuid, 'department', 'SUP', true,  null,                   null,  'Test set-up', :ZEM_P::uuid),
  (:FSK_P::uuid, 'store',      null,  false, null,                   'FWD', 'Test set-up', :ZEM_P::uuid),
  (:SCO_P::uuid, 'department', 'SUP', true,  null,                   null,  'Test set-up', :ZEM_P::uuid),
  (:SCO_P::uuid, 'store',      null,  false, null,                   'MAIN','Test set-up', :ZEM_P::uuid),
  (:SCO_P::uuid, 'permission', null,  false, 'VIEW_COST',            null,  'Test set-up', :ZEM_P::uuid),
  (:SBK_P::uuid, 'permission', null,  false, 'RAISE_REQUISITION',    null,  'Test set-up', :ZEM_P::uuid),
  (:SBK_P::uuid, 'permission', null,  false, 'RECEIVE_PARTS',        null,  'Test set-up', :ZEM_P::uuid),
  (:FAO_P::uuid, 'permission', null,  false, 'RAISE_PURCHASE_ORDER', null,  'Test set-up', :ZEM_P::uuid),
  (:FAO_P::uuid, 'permission', null,  false, 'MANAGE_OUTSIDE_MRO',   null,  'Test set-up', :ZEM_P::uuid)
) as v(person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
where not exists (select 1 from public.access_grant g
                   where g.person_id = v.person_id and g.grant_type = v.grant_type and g.revoked_at is null
                     and g.department_code is not distinct from v.department_code
                     and g.permission_code is not distinct from v.permission_code
                     and g.store_code is not distinct from v.store_code);

-- The chains as the sample data sets them up (operator set-up, D-076).
insert into public.approval_chain_step (action_type, step_no, name, department_code, appointment_id)
select v.* from (values
  ('requisition',      1, 'Storekeeper check',        'SUP', null::uuid),
  ('requisition',      2, 'Supply CO approval',       null,  :SUPPLY_CO::uuid),
  ('requisition_high', 1, 'Storekeeper check',        'SUP', null),
  ('requisition_high', 2, 'Supply CO approval',       null,  :SUPPLY_CO::uuid),
  ('requisition_high', 3, 'Commander approval',       null,  :COMMANDER::uuid),
  ('requisition_aog',  1, 'Supply CO (AOG fast-track)', null, :SUPPLY_CO::uuid),
  ('requisition_aog',  2, 'Commander approval',       null,  :COMMANDER::uuid)
) as v(action_type, step_no, name, department_code, appointment_id)
where not exists (select 1 from public.approval_chain_step s where s.action_type = v.action_type and s.step_no = v.step_no);

-- Value bands for this test (a new version of the setting, rolled back).
insert into public.operator_setting (key, value, reason) values
  ('requisition.approval_bands',
   '[{"priority": "AOG", "chain": "requisition_aog"}, {"max_value": 500000, "chain": "requisition"}, {"chain": "requisition_high"}]',
   'Test bands');

select pg_temp.act_as(:KDO); select app.set_my_pin('1357'); select pg_temp.admin();
select pg_temp.act_as(:TMB); select app.set_my_pin('2468'); select pg_temp.admin();
select pg_temp.act_as(:QAR); select app.set_my_pin('1111'); select pg_temp.admin();
select pg_temp.act_as(:ZEM); select app.set_my_pin('2020'); select pg_temp.admin();
select pg_temp.act_as(:SBK); select app.set_my_pin('8888'); select pg_temp.admin();
select pg_temp.act_as(:FSK); select app.set_my_pin('9999'); select pg_temp.admin();
select pg_temp.act_as(:SCO); select app.set_my_pin('4444'); select pg_temp.admin();
select pg_temp.act_as(:FAO); select app.set_my_pin('5555'); select pg_temp.admin();

-- Test parts with no stock, so requests need a requisition.
insert into public.part (part_number, description, part_class, unit) values
  ('[TEST-PQ-01]', '[TEST] Actuator seal',  'consumable', 'EA'),
  ('[TEST-PQ-02]', '[TEST] Fuel filter',    'consumable', 'EA'),
  ('[TEST-PQ-03]', '[TEST] Valve gasket',   'consumable', 'EA'),
  ('[TEST-PQ-04]', '[TEST] Pressure switch', 'consumable', 'EA'),
  ('[TEST-PQ-05]', '[TEST] Bleed duct clamp', 'component', 'EA');
select id as pq1 from public.part where part_number = '[TEST-PQ-01]' \gset
select id as pq2 from public.part where part_number = '[TEST-PQ-02]' \gset
select id as pq3 from public.part where part_number = '[TEST-PQ-03]' \gset
select id as pq4 from public.part where part_number = '[TEST-PQ-04]' \gset
select id as pq5 from public.part where part_number = '[TEST-PQ-05]' \gset

-- NX-203 set AOG by an engineer, so an AOG request on it is confirmed (D-147).
insert into public.tail_status_event (aircraft_id, status, reason, set_by) values (:NX203, 'AOG', '[TEST] AOG', :KDO_P);

-- KDO's requests: all "not in stock".
select pg_temp.act_as(:KDO);
select app.request_part('consumable', 'MAIN', 2, :'pq1', p_aircraft => :NX202, p_purpose => '[TEST] seal change') #>> '{lines,0,id}' as l1 \gset
select app.request_part('consumable', 'MAIN', 1, :'pq2', p_aircraft => :NX202, p_purpose => '[TEST] filter') #>> '{lines,0,id}' as l2 \gset
select app.request_part('consumable', 'MAIN', 1, :'pq3', p_aircraft => :NX201, p_purpose => '[TEST] gasket', p_priority => 'AOG') #>> '{lines,0,id}' as l3 \gset
select app.request_part('consumable', 'MAIN', 1, :'pq4', p_aircraft => :NX203, p_purpose => '[TEST] switch', p_priority => 'AOG') #>> '{lines,0,id}' as l4 \gset
select pg_temp.admin();

-- ======================================================= who may raise ===
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.raise_requisition('part_request', %L) $$, :'l1'),
  '%Only Supply%', 'D-073: an engineer cannot raise a requisition');
select pg_temp.admin();
select pg_temp.act_as(:FSK);
select throws_like(format($$ select app.raise_requisition('part_request', %L) $$, :'l1'),
  '%Raise requisitions%', 'D-121: Supply without "Raise requisitions" cannot raise one');
select pg_temp.admin();

-- ======================================================= raising ===
select pg_temp.act_as(:SBK);
select app.raise_requisition('part_request', :'l1', p_estimated_value => 1000) as q1 \gset
select is(:'q1'::jsonb ->> 'chain', 'requisition', 'D-146: a routine requisition under the threshold goes to the standard chain');
select ok((:'q1'::jsonb ->> 'number') like 'REQ-%', 'D-149: the requisition number follows the operator''s format');
select pg_temp.admin();
select is((select state || ' / ' || (requisition_id = (:'q1'::jsonb ->> 'id')::uuid)::text from public.part_request_line where id = :'l1'),
  'on_order / true', 'D-145: the request line goes on order and points at its requisition');
select is((select status from public.approval_request where record_id = (:'q1'::jsonb ->> 'id')::uuid), 'pending',
  'D-076: raising a requisition starts its approval');

select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.raise_requisition('part_request', %L) $$, :'l1'),
  '%only for a line not in stock%', 'D-145: one request line, one requisition');
select app.raise_requisition('part_request', :'l2', p_estimated_value => 600000) as q2 \gset
select is(:'q2'::jsonb ->> 'chain', 'requisition_high', 'D-146: above the threshold goes to the longer chain');
select throws_like(format($$ select app.raise_requisition('part_request', %L, p_priority => 'AOG') $$, :'l3'),
  '%AOG priority%confirmed%D-147%', 'D-147: AOG needs a confirmed AOG part request');
select app.raise_requisition('part_request', :'l3') as q3 \gset
select is(:'q3'::jsonb ->> 'chain', 'requisition_high', 'D-146: no estimate is treated as above every threshold');
select app.raise_requisition('part_request', :'l4', p_priority => 'AOG', p_estimated_value => 900000) as q4 \gset
select is(:'q4'::jsonb ->> 'chain', 'requisition_aog', 'D-146, D-147: a confirmed AOG goes to the AOG chain');
select throws_like($$ select app.raise_requisition('replenishment', p_store => 'MAIN', p_qty => 5, p_part_number_text => '[TEST-X]') $$,
  '%stated purpose%', 'R-1: stock replenishment needs a stated purpose');
select is(app.raise_requisition('replenishment', p_store => 'MAIN', p_qty => 5, p_part => :'pq2',
                                p_purpose => '[TEST] minimum stock') ->> 'chain', 'requisition_high',
  'Stock replenishment with a purpose is raised');
select pg_temp.admin();

select approval_request_id as ar1 from public.requisition where id = (:'q1'::jsonb ->> 'id')::uuid \gset
select approval_request_id as ar2 from public.requisition where id = (:'q2'::jsonb ->> 'id')::uuid \gset
select approval_request_id as ar3 from public.requisition where id = (:'q3'::jsonb ->> 'id')::uuid \gset

-- ======================================================= approving ===
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.decide_approval(%L, 'approve', '8888') $$, :'ar1'),
  '%raised a request cannot approve%', 'D-146: the raiser approves no step, even holding it');
select pg_temp.admin();
select pg_temp.act_as(:SCO);
select lives_ok(format($$ select app.decide_approval(%L, 'approve', '4444') $$, :'ar1'),
  'Supply CO approves step 1 (storekeeper check) with PIN');
select throws_like(format($$ select app.decide_approval(%L, 'approve', '4444') $$, :'ar1'),
  '%two steps%D-146%', 'D-146: nobody approves two steps of the same requisition');
select pg_temp.admin();

select pg_temp.act_as(:FSK);
select throws_like(format($$ select app.decide_approval(%L, 'approve', '0000') $$, :'ar2'),
  '%PIN not accepted%', 'D-094: an approval is signed with the PIN');
select lives_ok(format($$ select app.decide_approval(%L, 'approve', '9999') $$, :'ar2'), 'Another storekeeper approves step 1');
select pg_temp.admin();
select pg_temp.act_as(:SCO);
select throws_like(format($$ select app.decide_approval(%L, 'reject', '4444') $$, :'ar2'),
  '%needs a reason%D-079%', 'D-079: a rejection needs a reason');
select lives_ok(format($$ select app.decide_approval(%L, 'reject', '4444', '[TEST] Get a second quote') $$, :'ar2'),
  'Supply CO rejects with a reason');
select pg_temp.admin();
select is((select status || ' / ' || rejected_reason from public.requisition where id = (:'q2'::jsonb ->> 'id')::uuid),
  'rejected / [TEST] Get a second quote', 'D-079: the requisition shows Rejected with the reason');
select is((select state from public.part_request_line where id = :'l2'), 'needs_requisition',
  'D-079: the line goes back to Supply for a new requisition');

-- Resubmitted as a NEW VERSION (D-079, D-023).
select pg_temp.act_as(:SBK);
select app.resubmit_requisition((:'q2'::jsonb ->> 'id')::uuid, p_estimated_value => 1500) as q2b \gset
select pg_temp.admin();
select is((select number = :'q2'::jsonb ->> 'number' and version = 2 and action_type = 'requisition'
             from public.requisition where id = (:'q2b'::jsonb ->> 'id')::uuid), true,
  'D-079: resubmitting makes version 2 of the same number, chain chosen again');
select is((select status || ' / ' || (superseded_by is not null)::text from public.requisition where id = (:'q2'::jsonb ->> 'id')::uuid),
  'rejected / true', 'D-023: the rejected version stays on record');
select approval_request_id as ar2b from public.requisition where id = (:'q2b'::jsonb ->> 'id')::uuid \gset
select pg_temp.act_as(:FSK); select app.decide_approval(:'ar2b', 'approve', '9999'); select pg_temp.admin();
select pg_temp.act_as(:SCO); select app.decide_approval(:'ar2b', 'approve', '4444'); select pg_temp.admin();
select is((select status from public.requisition where id = (:'q2b'::jsonb ->> 'id')::uuid), 'approved',
  'D-076: all steps approved → Procurement sources it');

-- D-075: the engineer who asked for the part cannot approve its purchase,
-- even when also holding Supply (D-124).
insert into public.access_grant (person_id, grant_type, department_code, reason, granted_by)
values (:KDO_P, 'department', 'SUP', 'Test: second department', :ZEM_P);
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.decide_approval(%L, 'approve', '1357') $$, :'ar3'),
  '%asked for this part%D-075%', 'D-075: the requester cannot approve the purchase');
select pg_temp.admin();
update public.access_grant set revoked_at = now(), revoked_by = :ZEM_P, revoke_reason = 'Test over'
 where person_id = :KDO_P and grant_type = 'department' and department_code = 'SUP' and revoked_at is null;

-- ======================================================= visibility and cost ===
select pg_temp.act_as(:QAR);
select is((select count(*) from public.requisition), 0::bigint, 'D-127: Quality has no default access to requisitions');
select is((select count(*) from public.requisition_estimate), 0::bigint, 'D-127: Quality sees no estimated values');
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select ok((select count(*) from public.requisition where request_line_id = :'l1') = 1,
  'D-145: the engineer follows the requisition for their own request');
select is((select count(*) from public.requisition_estimate), 0::bigint, 'D-121, D-149: engineers see no cost by default');
select is((select count(*) from app.requisition_list(p_open_only => false) where estimated_value is not null), 0::bigint,
  'D-121: the requisition list gives engineers no prices');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select is((select count(*) from public.requisition_estimate), 0::bigint, 'D-121: a storekeeper without "View cost" sees no price');
select pg_temp.admin();
select pg_temp.act_as(:FAO);
select is((select estimated_value from app.requisition_list((:'q1'::jsonb ->> 'id')::uuid)), 1000::numeric,
  'D-077: Procurement with "View cost" sees the estimate');
select pg_temp.admin();

-- ======================================================= approved suppliers ===
select pg_temp.act_as(:FAO);
select throws_like($$ select app.add_supplier('TST-A', '[TEST] Supplier A', 'parts', '5555') $$,
  '%Only Quality%D-148%', 'D-148: Procurement cannot add to the approved supplier list');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select app.add_supplier('TST-A', '[TEST] Supplier A', 'parts', '1111') as sup_a \gset
select app.add_supplier('TST-B', '[TEST] Supplier B', 'parts', '1111') as sup_b \gset
select app.add_supplier('TST-M', '[TEST] MRO M', 'mro', '1111') as sup_m \gset
select throws_like(format($$ select app.set_supplier_status(%L, 'suspended', '', '1111') $$, :'sup_b'),
  '%reason%', 'Suspending a supplier needs a reason');
select lives_ok(format($$ select app.set_supplier_status(%L, 'suspended', '[TEST] Audit finding', '1111') $$, :'sup_b'),
  'D-148: Quality suspends a supplier with a reason and PIN');
select pg_temp.admin();

-- ======================================================= purchase orders ===
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.create_purchase_order(%L, array[%L]::uuid[]) $$, :'sup_a', :'q2b'::jsonb ->> 'id'),
  '%Only Procurement%', 'D-073: only Procurement raises purchase orders');
select pg_temp.admin();
select pg_temp.act_as(:FAO);
select throws_like(format($$ select app.create_purchase_order(%L, array[%L]::uuid[]) $$, :'sup_a', :'q1'::jsonb ->> 'id'),
  '%only an approved requisition%', 'D-076: a requisition still in approval cannot be ordered');
select throws_like(format($$ select app.create_purchase_order(%L, array[%L]::uuid[]) $$, :'sup_b', :'q2b'::jsonb ->> 'id'),
  '%not on Quality''s approved list%D-148%', 'D-148: no order to a suspended supplier');
select app.create_purchase_order(:'sup_a', array[(:'q2b'::jsonb ->> 'id')::uuid], p_eta => current_date + 10) ->> 'id' as po1 \gset
select id as pl1 from public.purchase_order_line where purchase_order_id = :'po1' \gset
select throws_like(format($$ select app.place_purchase_order(%L, '5555') $$, :'po1'),
  '%agreed price on every line%', 'D-077: every line has its agreed price before ordering');
select app.set_po_line_price(:'pl1', 1500);
select throws_like(format($$ select app.place_purchase_order(%L, '0000') $$, :'po1'),
  '%PIN not accepted%', 'D-094: placing the order is signed with the PIN');
select lives_ok(format($$ select app.place_purchase_order(%L, '5555') $$, :'po1'), 'Procurement places the order');
select pg_temp.admin();
select is((select status from public.requisition where id = (:'q2b'::jsonb ->> 'id')::uuid), 'ordered',
  'The requisition follows the PO: ordered');
select pg_temp.act_as(:FAO);
select app.update_purchase_order(:'po1', 'shipped', p_shipment_ref => '[TEST-AWB-1]');
select app.update_purchase_order(:'po1', 'in_clearing', p_clearing_ref => '[TEST-CUSTOMS-1]');
select throws_like(format($$ select app.update_purchase_order(%L, 'shipped') $$, :'po1'),
  '%moves only forward%', 'The PO moves only forward');
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select ok((select state_reason from public.part_request_line where id = :'l2') like '%in clearing (customs)%',
  'D-149: the engineer sees the part is in clearing, without seeing cost');
select pg_temp.admin();

-- ======================================================= delivery and D-075 ===
-- FAO (the buyer) is given Supply as well (D-124), to show the rule holds.
insert into public.access_grant (person_id, grant_type, department_code, permission_code, store_code, reason, granted_by) values
  (:FAO_P, 'department', 'SUP', null, null, 'Test: second department', :ZEM_P),
  (:FAO_P, 'store', null, null, 'MAIN', 'Test', :ZEM_P),
  (:FAO_P, 'permission', null, 'RECEIVE_PARTS', null, 'Test', :ZEM_P);
select pg_temp.act_as(:FAO);
select throws_like(format($$ select app.receive_po_delivery(%L) $$, :'pl1'),
  '%cannot receive it%D-075%', 'D-075: the buyer cannot open the receipt for their own PO');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select app.receive_po_delivery(:'pl1') as rcv1 \gset
select pg_temp.admin();
select is((select (purchase_order_id = :'po1'::uuid and for_request_line_id = :'l2'::uuid)::text from public.stock_receipt where id = :'rcv1'),
  'true', 'Delivery opens a receiving inspection linked to the PO and the request line');
select is((select status from public.purchase_order where id = :'po1'), 'delivered', 'The PO shows delivered (at receiving)');
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by) values
  ('stock_receipt', :'rcv1', 'release_certificate', 'c.pdf', 'application/pdf', 1000, 'stock_receipt/' || :'rcv1' || '/c.pdf', :SBK_P),
  ('stock_receipt', :'rcv1', 'serviceable_tag', 't.pdf', 'application/pdf', 1000, 'stock_receipt/' || :'rcv1' || '/t.pdf', :SBK_P);
select pg_temp.act_as(:FAO);
select throws_like(format($$ select app.accept_receipt(%L, 'EASA Form 1', '[TEST-F1]', true, true, '5555') $$, :'rcv1'),
  '%cannot receive it%D-075%', 'D-075: the buyer cannot accept it into stock');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select is(app.accept_receipt(:'rcv1', 'EASA Form 1', '[TEST-F1]', true, true, '8888'), 'accepted',
  'D-074: Supply accepts it into stock');
select pg_temp.admin();
select is((select state from public.part_request_line where id = :'l2'), 'reserved',
  'D-145: on acceptance the part is reserved for the request it was bought for');
select is((select r.status || ' / ' || p.status from public.requisition r, public.purchase_order p
            where r.id = (:'q2b'::jsonb ->> 'id')::uuid and p.id = :'po1'),
  'received / closed', 'The requisition is received and the PO closes');

-- ======================================================= invoices and price history ===
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.record_invoice('INV-1', current_date, 1500, %L) $$, :'po1'),
  '%Only Procurement%', 'Only Procurement records invoices');
select pg_temp.admin();
select pg_temp.act_as(:FAO);
select app.record_invoice('[TEST-INV-1]', current_date, 1500, :'po1') as inv1 \gset
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
values ('supplier_invoice', :'inv1', 'invoice', 'inv.pdf', 'application/pdf', 1000, 'supplier_invoice/' || :'inv1' || '/inv.pdf', :FAO_P);
select is((select count(*) from public.attachment where record_id = :'inv1'), 1::bigint,
  'D-026: the invoice scan is attached to the invoice');
select is((select unit_price from app.price_history(:'pq2') limit 1), 1500::numeric,
  'D-077: price history per part from agreed prices');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select is((select count(*) from public.supplier_invoice) + (select count(*) from public.attachment where record_id = :'inv1')
          + (select count(*) from public.purchase_order_line_price), 0::bigint,
  'D-127: Quality sees no invoices, invoice scans or prices');
select throws_like($$ select * from app.price_history(gen_random_uuid()) $$, '%View cost%',
  'D-127: Quality cannot read price history');
select is((select count(*) from audit.log where table_name in ('public.purchase_order_line_price', 'public.supplier_invoice')), 0::bigint,
  'D-127: the audit log hides cost lines from Quality');
select pg_temp.admin();
select pg_temp.act_as(:ZEM);
select ok((select count(*) from audit.log where table_name = 'public.purchase_order_line_price') > 0,
  'D-122: Command still sees cost in the audit log');
select pg_temp.admin();

-- ======================================================= outside-MRO jobs ===
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.open_outside_mro_job(%L, '[TEST] Pump overhaul') $$, :'sup_m'),
  '%Only Procurement%', 'D-144: only Procurement records outside-MRO jobs');
select pg_temp.admin();
select pg_temp.act_as(:FAO);
select throws_like(format($$ select app.open_outside_mro_job(%L, '[TEST] Pump overhaul') $$, :'sup_a'),
  '%approved list for MRO work%', 'D-148: the outside MRO must be on the approved list for MRO work');
select app.open_outside_mro_job(:'sup_m', '[TEST] Pump overhaul', p_aircraft => :NX201) ->> 'id' as job1 \gset
select app.add_mro_quote(:'job1', 'quote', 9000);
select throws_like(format($$ select app.set_outside_mro_status(%L, 'in_work') $$, :'job1'),
  '%agreed cost first%', 'D-144: work goes ahead only after the agreed cost is recorded');
select app.agree_mro_cost(:'job1', 8000, '5555');
select app.add_mro_part(:'job1', 2, 150, p_part_number_text => '[TEST-BRG-02]', p_description => '[TEST] bearing');
select app.set_outside_mro_status(:'job1', 'in_work');
select app.set_outside_mro_status(:'job1', 'returned');
select is((select agreed_cost from app.outside_mro_jobs() where id = :'job1'), 8000::numeric,
  'D-144: Procurement records the agreed cost');
select throws_like(format($$ select app.record_mro_technical_acceptance(%L, 'ok', '5555') $$, :'job1'),
  '%not Procurement%D-020%', 'D-020, D-144: Procurement cannot record technical acceptance');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select is((select count(*) from public.outside_mro_job where id = :'job1'), 1::bigint,
  'D-144: Quality sees the job for technical acceptance');
select is((select count(*) from public.outside_mro_quote) + (select count(*) from public.outside_mro_part), 0::bigint,
  'D-127: but not its quotes or parts cost');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select lives_ok(format($$ select app.record_mro_technical_acceptance(%L, '[TEST] Accepted against WO record', '2468') $$, :'job1'),
  'D-020: an engineer records the technical acceptance, with PIN');
select is((select (app.outside_mro_job_detail(:'job1') ->> 'quotes') is null), true,
  'D-121: the job detail gives an engineer no quotes');
select pg_temp.admin();

-- ======================================================= repair and cancel ===
select pg_temp.act_as(:KDO);
select app.record_us_removal(:NX201, :'pq5', null, '[TEST]-SN-1', '[TEST] Cracked', 'MAIN') as us1 \gset
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.raise_requisition('repair', p_us_return => %L) $$, :'us1'),
  '%Receive and tag%', 'A repair requisition needs the U/S part received first');
select app.receive_us_return(:'us1', '[TEST-TAG-1]');
select is(app.raise_requisition('repair', p_us_return => :'us1') ->> 'chain', 'requisition_high',
  'A received U/S part gets a repair requisition');
select lives_ok(format($$ select app.cancel_requisition(%L, '[TEST] Found in other store') $$, :'q1'::jsonb ->> 'id'),
  'The raiser cancels a requisition with a reason');
select pg_temp.admin();
select is((select q.status || ' / ' || a.status || ' / ' || l.state
             from public.requisition q join public.approval_request a on a.id = q.approval_request_id
             join public.part_request_line l on l.id = q.request_line_id
            where q.id = (:'q1'::jsonb ->> 'id')::uuid),
  'cancelled / cancelled / needs_requisition', 'D-023: cancelled with who and why; the approval stops; the line waits again');

select * from finish();
rollback;
