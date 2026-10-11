-- =============================================================================
-- Nexus MRO · Phase 2 · Automatic checks of the parts and stores rules
-- (D-023, D-068, D-070 to D-074, D-140 to D-153)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
--
-- Sample people (seed.sql and seeds/40-parts-stores.sql):
--   KDO duty engineer (G550, Main Store)   TMB certifying engineer (G550)
--   SBK storekeeper (Main Store)           FSK Forward storekeeper (made here if missing)
--   FAO procurement officer                QAR Quality            ABE Engineering CO
-- Parts used here are made by this file: [TEST-...] numbers, fictional (D-112).
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set FAO '''20000000-0000-0000-0000-000000000009'''
\set FSK '''20000000-0000-0000-0000-0000000000d1'''
\set KDO_P '''10000000-0000-0000-0000-000000000005'''
\set SBK_P '''10000000-0000-0000-0000-000000000008'''
\set ZEM_P '''10000000-0000-0000-0000-000000000002'''
\set FSK_P '''10000000-0000-0000-0000-0000000000d1'''
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
-- Forward storekeeper (the sample data adds the same person; skipped if there).
insert into public.person (id, full_name, rank_or_title, service_number, three_letter_code)
values (:FSK_P, '[Forward storekeeper]', '[Rank]', 'SN-00D1', 'FSK') on conflict do nothing;
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', :FSK, 'authenticated', 'authenticated', 'fsk@users.nexus.local',
        extensions.crypt('nexus-dev-only', extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
on conflict do nothing;
insert into public.user_account (id, person_id, status, activated_at, activated_by)
values (:FSK, :FSK_P, 'active', now(), :ZEM_P) on conflict do nothing;
insert into public.access_grant (person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
select v.* from (values
  (:FSK_P::uuid, 'department', 'SUP', true,  null,            null,  'Test set-up', :ZEM_P::uuid),
  (:FSK_P::uuid, 'store',      null,  false, null,            'FWD', 'Test set-up', :ZEM_P::uuid),
  (:FSK_P::uuid, 'permission', null,  false, 'ISSUE_PARTS',   null,  'Test set-up', :ZEM_P::uuid),
  (:FSK_P::uuid, 'permission', null,  false, 'RECEIVE_PARTS', null,  'Test set-up', :ZEM_P::uuid),
  (:SBK_P::uuid, 'permission', null,  false, 'RECEIVE_PARTS', null,  'Test set-up', :ZEM_P::uuid)
) as v(person_id, grant_type, department_code, is_home, permission_code, store_code, reason, granted_by)
where not exists (select 1 from public.access_grant g
                   where g.person_id = v.person_id and g.grant_type = v.grant_type and g.revoked_at is null
                     and g.department_code is not distinct from v.department_code
                     and g.permission_code is not distinct from v.permission_code
                     and g.store_code is not distinct from v.store_code);

select pg_temp.act_as(:KDO); select app.set_my_pin('1357'); select pg_temp.admin();
select pg_temp.act_as(:TMB); select app.set_my_pin('2468'); select pg_temp.admin();
select pg_temp.act_as(:QAR); select app.set_my_pin('1111'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.set_my_pin('2222'); select pg_temp.admin();
select pg_temp.act_as(:SBK); select app.set_my_pin('8888'); select pg_temp.admin();
select pg_temp.act_as(:FSK); select app.set_my_pin('9999'); select pg_temp.admin();

-- Test parts and opening stock (as the set-up script would load them).
insert into public.part (part_number, description, part_class, unit, shelf_life_tracked, serialised) values
  ('[TEST-SK-01]', '[TEST] Seal kit',      'consumable', 'EA', true,  false),
  ('[TEST-HP-01]', '[TEST] Hydraulic pump', 'component',  'EA', false, true),
  ('[TEST-FL-01]', '[TEST] Filter',        'consumable', 'EA', false, false);
select id as sk from public.part where part_number = '[TEST-SK-01]' \gset
select id as hp from public.part where part_number = '[TEST-HP-01]' \gset
select id as fl from public.part where part_number = '[TEST-FL-01]' \gset

create function pg_temp.lot(p_part uuid, p_store text, p_qty numeric, p_expiry date, p_cert text,
                            p_serial text default null) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.stock_lot (part_id, store_code, serial_no, certificate_status, certificate_type,
                                certificate_ref, shelf_life_expires_on, source)
  values (p_part, p_store, p_serial, p_cert, case when p_cert = 'valid' then 'EASA Form 1' end,
          case when p_cert = 'valid' then '[TEST-CERT]' end, p_expiry, 'opening_balance')
  returning id into v;
  insert into public.stock_movement (lot_id, part_id, store_code, kind, qty, on_hand_change, done_by)
  values (v, p_part, p_store, 'opening_balance', p_qty, p_qty, '10000000-0000-0000-0000-000000000008');
  return v;
end $$;

-- Seal kit: Main 1 in date + 4 expired + 2 uncertified; Forward 3.
select pg_temp.lot(:'sk', 'MAIN', 1, current_date + 60, 'valid') as sk_main \gset
select pg_temp.lot(:'sk', 'MAIN', 4, current_date - 2, 'valid') as sk_expired \gset
select pg_temp.lot(:'sk', 'MAIN', 2, current_date + 90, 'missing') as sk_nocert \gset
select pg_temp.lot(:'sk', 'FWD', 3, current_date + 60, 'valid') as sk_fwd \gset
-- Filter: Main 2.
select pg_temp.lot(:'fl', 'MAIN', 2, null, 'valid') as fl_main \gset

-- A work order on NX-202, still waiting for Quality and the CO.
insert into public.snag (number, aircraft_id, reported_by, reporter_kind, description, status, attended_by, attended_at)
values (app.next_number('snag', 'SNAG-{000000}'), :NX202, :KDO_P, 'engineer', '[TEST] Hydraulic leak', 'attended', :KDO_P, now())
returning id as snag1 \gset
select pg_temp.act_as(:KDO);
select app.request_work_order(:'snag1', '[TEST] Replace hydraulic pump', 3) as wo1 \gset
select pg_temp.admin();
select approval_request_id as wo1_req from public.work_order where id = :'wo1' \gset

-- ===================================================== stores search ===
select pg_temp.act_as(:KDO);
select is((select jsonb_array_length(stores) from app.search_stores('[TEST-SK-01]')), 1,
  'D-152: an engineer holding only the Main Store sees only Main Store quantities');
select is((select available from app.search_stores('[TEST-SK-01]')), 1::numeric,
  'D-070: live available quantity excludes expired and uncertified stock');
select ok((select expired_qty = 4 and uncertified_qty = 2 and certificate = 'mixed' from app.search_stores('[TEST-SK-01]')),
  'D-072: expired and uncertified stock is counted and flagged');
select is((select count(*) from public.stock_lot where store_code = 'FWD'), 0::bigint,
  'D-152: Forward Store stock is hidden from someone who does not hold it (row-level security)');
select pg_temp.admin();

-- ===================================================== part requests ===
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.request_part('aircraft_part', 'MAIN', 1, %L, p_aircraft => %L) $$, :'hp', :NX202),
  '%needs a tail and a work order (D-143)%', 'D-143: an aircraft part needs a work order');
select throws_like(format($$ select app.request_part('consumable', 'MAIN', 1, %L) $$, :'fl'),
  '%work order, or "General use"%', 'D-143: a consumable needs a work order or a stated purpose');
select throws_like(format($$ select app.request_part('consumable', 'FWD', 1, %L, p_purpose => 'x') $$, :'fl'),
  '%do not hold the Forward Store%', 'D-152: you can only request from a store you hold');

-- The last in-date, certified seal kit.
select app.request_part('consumable', 'MAIN', 1, :'sk', p_purpose => '[TEST] Cabin door seal prep') as r1 \gset
select is(:'r1'::jsonb #>> '{lines,0,state}', 'reserved',
  'D-071: a consumable for General use is reserved at server time');
select is((select lot_id from public.part_request_line where request_id = (:'r1'::jsonb ->> 'id')::uuid), :'sk_main'::uuid,
  'D-148: expired and uncertified stock is never reserved; the good lot is taken');
select app.request_part('consumable', 'MAIN', 1, :'sk', p_purpose => '[TEST] Second engineer') as r2 \gset
select is(:'r2'::jsonb #>> '{lines,0,state}', 'needs_requisition',
  'D-071, D-145: a second request for the last unit is not reserved; it needs a requisition');

-- Filter: 3 wanted, 2 in stock → the line splits.
select app.request_part('consumable', 'MAIN', 3, :'fl', p_work_order => :'wo1') as r3 \gset
select is((select string_agg(qty::int || ' ' || state, ', ' order by line_no) from public.part_request_line
            where request_id = (:'r3'::jsonb ->> 'id')::uuid),
  '2 reserved, 1 needs_requisition', 'D-145: partial stock splits the line into reserved and needs requisition');

-- Offline: the same queued request sent twice is made once.
select app.request_part('consumable', 'MAIN', 1, :'fl', p_purpose => 'Queued', p_client_ref => 'aaaaaaaa-0000-0000-0000-000000000001');
select app.request_part('consumable', 'MAIN', 1, :'fl', p_purpose => 'Queued', p_client_ref => 'aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*) from public.part_request where client_ref = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
  'D-145: a queued offline request re-sent is not doubled');
select pg_temp.admin();

select ok((select qty_reserved <= qty_on_hand and qty_reserved = 2 from public.stock_lot where id = :'fl_main'),
  'D-071: reserved never exceeds what is on the shelf');
select throws_like(format($$ insert into public.stock_movement (lot_id, part_id, store_code, kind, qty, reserved_change, done_by)
                             values (%L, %L, 'MAIN', 'reserve', 1, 1, %L) $$, :'fl_main', :'fl', :SBK_P),
  '%reserved_within_on_hand%', 'D-071: the database refuses any reservation beyond stock, whatever sends it');

-- ================================================== AOG priority (D-147) ===
select pg_temp.act_as(:KDO);
select app.request_part('aircraft_part', 'MAIN', 1, :'hp', p_work_order => :'wo1', p_priority => 'AOG') as r_aog \gset
select pg_temp.admin();
select is((select aog_confirmed_at is null from public.part_request where id = (:'r_aog'::jsonb ->> 'id')::uuid), true,
  'D-147: AOG on a serviceable tail is requested but not confirmed');
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.confirm_aog_priority(%L, '1357') $$, :'r_aog'::jsonb ->> 'id'),
  '%certifying authorization%', 'D-147: confirming AOG needs a certifying engineer for the type (a non-certifying requester cannot)');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select lives_ok(format($$ select app.confirm_aog_priority(%L, '2468') $$, :'r_aog'::jsonb ->> 'id'),
  'D-147: a certifying engineer confirms AOG with PIN');
select pg_temp.admin();
insert into public.tail_status_event (aircraft_id, status, reason, set_by) values (:NX203, 'AOG', '[TEST] AOG', :KDO_P);
insert into public.snag (number, aircraft_id, reported_by, reporter_kind, description, status, attended_by, attended_at)
values (app.next_number('snag', 'SNAG-{000000}'), :NX203, :KDO_P, 'engineer', '[TEST] Pump failed', 'attended', :KDO_P, now())
returning id as snag2 \gset
select pg_temp.act_as(:KDO);
select app.request_work_order(:'snag2', '[TEST] Replace pump', 2) as wo2 \gset
select app.request_part('aircraft_part', 'MAIN', 1, :'hp', p_work_order => :'wo2', p_priority => 'AOG');
select ok(exists (select 1 from public.part_request where work_order_id = :'wo2' and aog_confirmed_how = 'tail_status'),
  'D-147: AOG is confirmed when an engineer has set the tail AOG or U/S');
select throws_like($$ select * from app.priority_use_report() $$, '%Quality and Command%',
  'D-147: the priority-use report is not for engineers');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select ok((select aog_requested >= 2 from app.priority_use_report() where three_letter_code = 'KDO'),
  'D-147: Quality sees priority use per person');
select pg_temp.admin();

-- ==================================================== issue (D-068, D-148) ===
select l.id as fl_line from public.part_request_line l
 where l.request_id = (:'r3'::jsonb ->> 'id')::uuid and l.state = 'reserved' \gset
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.issue_part(%L, '1357') $$, :'fl_line'), '%Only Supply%',
  'D-074: an engineer cannot issue from stores');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.issue_part(%L, '8888') $$, :'fl_line'), '%not approved%D-068%',
  'D-068: reserved before approval, but not issued until the work order is approved');
select pg_temp.admin();
select pg_temp.act_as(:QAR); select app.decide_approval(:'wo1_req', 'approve', '1111'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.decide_approval(:'wo1_req', 'approve', '2222'); select pg_temp.admin();
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.issue_part(%L, '0000') $$, :'fl_line'), '%PIN not accepted%',
  'D-094: issuing is signed with the PIN');
select matches(app.issue_part(:'fl_line', '8888'), '^IV-[0-9]+$',
  'Issue voucher number comes from the server once the work order is approved');
select pg_temp.admin();
select is((select qty_on_hand::int || '/' || qty_reserved::int from public.stock_lot where id = :'fl_main'), '0/0',
  'D-071: stock on hand drops at issue');
select ok((select l.qty_on_hand = coalesce(sum(m.on_hand_change), 0) and l.qty_reserved = coalesce(sum(m.reserved_change), 0)
             from public.stock_lot l join public.stock_movement m on m.lot_id = l.id
            where l.id = :'fl_main' group by l.id, l.qty_on_hand, l.qty_reserved),
  'D-023: lot quantities are exactly the sum of the ledger');
select throws_like(format($$ update public.stock_movement set qty = 99 where lot_id = %L $$, :'fl_main'),
  '%append-only%', 'D-023: ledger lines are never edited');
select throws_like(format($$ delete from public.stock_movement where lot_id = %L $$, :'fl_main'),
  '%never deleted%', 'D-023: ledger lines are never deleted');

-- Expired after reservation: cannot be issued; quarantining releases it.
select l.id as sk_line from public.part_request_line l where l.request_id = (:'r1'::jsonb ->> 'id')::uuid \gset
update public.stock_lot set shelf_life_expires_on = current_date - 1 where id = :'sk_main';
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.issue_part(%L, '8888') $$, :'sk_line'), '%cannot be issued: its shelf life ended%',
  'D-148: expired stock cannot be issued');
select lives_ok(format($$ select app.quarantine_lot(%L, 'Shelf life ended') $$, :'sk_main'),
  'D-148: Supply moves it to quarantine');
select pg_temp.admin();
select is((select state || ' ' || (lot_id is null)::text from public.part_request_line where id = :'sk_line'), 'submitted true',
  'D-148: the reservation on quarantined stock goes back to Supply');

-- Engineer fits; the removed U/S part is expected back at stores.
select l.id as hp_line from public.part_request_line l
  join public.part_request r on r.id = l.request_id where r.work_order_id = :'wo2' \gset

-- =================================================== receiving (D-153) ===
select pg_temp.act_as(:SBK);
select app.open_receipt('MAIN', :'hp', 1, '[TEST]-SN-001', p_delivered_against => '[TEST] PO') as rcv1 \gset
select throws_like(format($$ select app.accept_receipt(%L, 'EASA Form 1', 'F1-1', true, true, '8888') $$, :'rcv1'),
  '%Attach the release documents%D-153%', 'D-153: no acceptance without the release documents');
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
values ('stock_receipt', :'rcv1', 'release_certificate', 'f1.pdf', 'application/pdf', 1000,
        'stock_receipt/' || :'rcv1' || '/f1.pdf', :SBK_P);
select pg_temp.admin();
select is((select count(*) from public.attachment where record_id = :'rcv1'), 1::bigint,
  'D-026, D-153: Supply attaches a release document to its receipt');
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.accept_receipt(%L, 'EASA Form 1', 'F1-1', true, true, '8888') $$, :'rcv1'),
  '%Missing: serviceable tag%', 'D-153: the serviceable tag is required too (Quality setting)');
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
values ('stock_receipt', :'rcv1', 'serviceable_tag', 'tag.jpg', 'image/jpeg', 1000,
        'stock_receipt/' || :'rcv1' || '/tag.jpg', :SBK_P);
select throws_like(format($$ select app.accept_receipt(%L, 'Home-made note', 'X', true, true, '8888') $$, :'rcv1'),
  '%not on Quality''s list%D-148%', 'D-148: only certificate types Quality accepts');
select pg_temp.admin();
select pg_temp.act_as(:FAO);
select throws_like(format($$ select app.accept_receipt(%L, 'EASA Form 1', 'F1-1', true, true, '8888') $$, :'rcv1'),
  '%Only Supply%D-074%', 'D-074: Procurement cannot mark a part available');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select is(app.accept_receipt(:'rcv1', 'EASA Form 1', 'F1-1', true, true, '8888'), 'accepted',
  'D-074: Supply accepts to stock after inspection');
select pg_temp.admin();
select is((select condition || ' ' || certificate_status || ' ' || certificate_type from public.stock_lot
            where receipt_id = :'rcv1'), 'serviceable valid EASA Form 1',
  'D-148: the accepted certificate type is recorded on the stock');

-- Now the AOG pump line can be reserved and issued, then fitted.
select pg_temp.act_as(:SBK);
select is(app.reserve_line(:'hp_line'), 'reserved', 'D-073: Supply reserves the line once stock arrives');
select pg_temp.admin();
select pg_temp.act_as(:QAR); select app.decide_approval((select approval_request_id from public.work_order where id = :'wo2'), 'approve', '1111'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.decide_approval((select approval_request_id from public.work_order where id = :'wo2'), 'approve', '2222'); select pg_temp.admin();
update public.part_request_line set removed_part = 'unserviceable' where id = :'hp_line';
select pg_temp.act_as(:SBK); select app.issue_part(:'hp_line', '8888'); select pg_temp.admin();
select pg_temp.act_as(:KDO);
select app.record_part_fitted(:'hp_line', 'Fitted', '[TEST]-SN-OLD') as usr \gset
select pg_temp.admin();
select is((select status || ' ' || serial_no from public.us_return where id = :'usr'), 'expected [TEST]-SN-OLD',
  'U/S return: a removed unserviceable part is expected at stores');
select pg_temp.act_as(:SBK);
select app.receive_us_return(:'usr', '[TEST]-US-TAG-1') as us_lot \gset
select throws_like(format($$ select app.release_from_quarantine(%L, 'x', 'EASA Form 1', 'r', '8888') $$, :'us_lot'),
  '%Only quarantined stock%', 'U/S parts are not released to stock here (repair comes with procurement)');

-- Reject at receiving → quarantine; release needs documents and PIN.
select app.open_receipt('MAIN', :'fl', 5, p_batch => '[TEST]-B2') as rcv2 \gset
select app.quarantine_receipt(:'rcv2', 'Certificate missing') as q_lot \gset
select pg_temp.admin();
select is((select condition from public.stock_lot where id = :'q_lot'), 'quarantine',
  'Receiving reject sends the part to quarantine with its reason');
select pg_temp.act_as(:SBK);
select throws_like(format($$ select app.release_from_quarantine(%L, 'Certificate found', 'EASA Form 1', 'F1-9', '8888') $$, :'q_lot'),
  '%Attach the release documents to receipt%', 'D-153: release from quarantine needs the documents');
select pg_temp.admin();

-- ============================================ Forward Store (D-142, D-150) ===
select pg_temp.act_as(:FSK);
select app.open_receipt('FWD', :'fl', 2, p_batch => '[TEST]-B3') as rcv3 \gset
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
values ('stock_receipt', :'rcv3', 'release_certificate', 'c.pdf', 'application/pdf', 1000, 'stock_receipt/' || :'rcv3' || '/c.pdf', :FSK_P),
       ('stock_receipt', :'rcv3', 'serviceable_tag', 't.pdf', 'application/pdf', 1000, 'stock_receipt/' || :'rcv3' || '/t.pdf', :FSK_P);
select is(app.accept_receipt(:'rcv3', 'Manufacturer CofC', 'C-3', true, true, '9999'), 'awaiting_ack',
  'D-150: the Forward storekeeper inspects a direct receipt');
select is((select available from app.search_stores('[TEST-FL-01]')), 0::numeric,
  'D-142: a Forward direct receipt does not count as stock before Main acknowledges');
select throws_like(format($$ select app.acknowledge_receipt(%L) $$, :'rcv3'), '%do not hold the Main Store%',
  'D-142: only the Main Store acknowledges');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select lives_ok(format($$ select app.acknowledge_receipt(%L) $$, :'rcv3'), 'D-142: Main acknowledges the Forward receipt');
select pg_temp.admin();
select is((select sum(qty_on_hand)::int from public.stock_lot where receipt_id = :'rcv3' and store_code = 'FWD'), 2,
  'D-142: once acknowledged it is Forward Store stock');

-- Transfer Main → Forward, then the return reverses it (D-142, D-151).
select pg_temp.lot(:'sk', 'MAIN', 5, current_date + 200, 'valid') as sk_main2 \gset
select pg_temp.act_as(:SBK);
select app.raise_transfer(:'sk', 'MAIN', 'FWD', 2) as trf1 \gset
select pg_temp.admin();
select is((select qty_on_hand::int from public.stock_lot where id = :'sk_main2'), 3,
  'D-142: a transfer leaves the Main Store when raised (in transit)');
select pg_temp.act_as(:FSK);
select is(app.receive_transfer(:'trf1'), 'received', 'D-142: Forward confirms receipt');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select app.acknowledge_transfer(:'trf1') as trf1_lot \gset
select pg_temp.admin();
select is((select store_code || ' ' || qty_on_hand::int from public.stock_lot where id = :'trf1_lot'), 'FWD 2',
  'D-142: acknowledged by Main, it is Forward stock');
select pg_temp.act_as(:FSK);
select throws_like(format($$ select app.raise_transfer(%L, 'FWD', 'MAIN', 1, p_return_of => %L) $$, :'fl', :'trf1'),
  '%must reverse a completed transfer%', 'D-151: a return must reverse the transfer it names');
select app.raise_transfer(:'sk', 'FWD', 'MAIN', 1, :'trf1_lot', :'trf1') as trf2 \gset
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select is(app.receive_transfer(:'trf2'), 'acknowledged', 'D-151: a return into the Main Store is complete when Main receives it');
select pg_temp.admin();

-- ========================================================== misc ===
select pg_temp.act_as(:KDO);
select throws_like($$ select app.set_stores_setting('stores.accepted_certificate_types', '["X"]', 'x', '1357') $$,
  '%Only Quality%', 'D-148: only Quality sets the accepted certificate list');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select lives_ok($$ select app.set_stores_setting('stores.accepted_certificate_types',
                    '["EASA Form 1", "FAA Form 8130-3", "Manufacturer CofC", "[TEST] Cert"]', 'Test', '1111') $$,
  'D-148: Quality updates the accepted certificate list (new version, history kept)');
select pg_temp.admin();

select pg_temp.act_as(:SBK);
select ok((select count(*) from app.part_request_lines(p_work_order => :'wo1') where work_order_number is not null) > 0
          and (select count(*) from public.work_order where id = :'wo1') = 0,
  'D-121: Supply sees the work order number on a request, not the work order itself');
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select lives_ok(format($$ select app.cancel_part_request(%L, 'No longer needed') $$, :'r2'::jsonb ->> 'id'),
  'D-023: a request is cancelled with a reason, not deleted');
select pg_temp.admin();

select * from finish();
rollback;
