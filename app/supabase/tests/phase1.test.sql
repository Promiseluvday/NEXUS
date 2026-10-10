-- =============================================================================
-- Nexus MRO · Phase 1 · Automatic checks of the snag workflow rules
-- Proprietary to Liebetag. All rights reserved.
--
-- Run with:  npm run db:test
-- Everything runs inside a transaction that is rolled back at the end.
--
-- Sample people (seed.sql):
--   KDO duty engineer (G550 scope, NOT certifying on G550)
--   TMB certifying engineer (G550)        PLA pilot (Operations, G550)
--   QAR Quality                            ABE Engineering CO (approves WO step 2)
--   SBK storekeeper (Supply)               FAO procurement officer
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(107);

\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set PLA '''20000000-0000-0000-0000-000000000007'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set SBK '''20000000-0000-0000-0000-000000000008'''
\set FAO '''20000000-0000-0000-0000-000000000009'''
\set NX101 '''40000000-0000-0000-0000-000000000101'''
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

-- PINs for the engineers who sign
select pg_temp.act_as(:TMB); select app.set_my_pin('2468'); select pg_temp.admin();
select pg_temp.act_as(:KDO); select app.set_my_pin('1357'); select pg_temp.admin();
select pg_temp.act_as(:QAR); select app.set_my_pin('1111'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.set_my_pin('2222'); select pg_temp.admin();

-- =============================================================== TAIL STATUS ===
select pg_temp.act_as(:PLA);
select throws_like($$ select app.set_tail_status('40000000-0000-0000-0000-000000000202', 'US', 'test', '0000') $$,
  '%Only an engineer%', 'D-046: a pilot cannot set a tail status');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select throws_like($$ select app.set_tail_status('40000000-0000-0000-0000-000000000202', 'SVC', 'Daily inspection complete', '0000') $$,
  '%PIN not accepted%', 'D-215: setting a tail status needs the PIN');
select lives_ok($$ select app.set_tail_status('40000000-0000-0000-0000-000000000202', 'SVC', 'Daily inspection complete', '1357') $$,
  'D-046: an engineer sets a tail status');
select pg_temp.admin();
select is((select p.three_letter_code from public.aircraft_current_status c join public.person p on p.id = c.set_by
            where c.aircraft_id = :NX202), 'KDO', 'D-046: the status shows who set it');
select throws_like($$ update public.tail_status_event set reason = 'x' $$, '%append-only%',
  'D-023: a status event cannot be edited');

-- ===================================================================== SNAGS ===
select pg_temp.act_as(:PLA);
select lives_ok($$ select app.report_snag('40000000-0000-0000-0000-000000000201', '[TEST] Galley oven inoperative',
                     false, '25-31', '15', '0100', '1', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'D-041: a pilot reports a snag');
select lives_ok($$ select app.report_snag('40000000-0000-0000-0000-000000000201', '[TEST] Galley oven inoperative',
                     false, '25-31', '15', '0100', '1', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'D-103: the same offline report sent twice is accepted');
select pg_temp.admin();
select is((select count(*) from public.snag where client_ref = 'aaaaaaaa-0000-0000-0000-000000000001'), 1::bigint,
  'D-103: ...but only one snag is created');
select matches((select number from public.snag where client_ref = 'aaaaaaaa-0000-0000-0000-000000000001'),
  '^SNAG-[0-9]{6}$', 'D-213: snag numbers follow the fleet-wide format');
select id as snag1 from public.snag where client_ref = 'aaaaaaaa-0000-0000-0000-000000000001' \gset

select pg_temp.act_as(:PLA);
select throws_like($$ select app.report_snag('40000000-0000-0000-0000-000000000101', '[TEST] x') $$,
  '%outside your aircraft scope%', 'D-121: a pilot cannot report on a tail outside their scope');
select is((select snag_display from app.fleet_board() where tail = 'NX-201'), 'snag_open',
  'D-200: a pilot report shows blue "Snag open"');
select is((select status from app.fleet_board() where tail = 'NX-201'), 'SVC',
  'D-045: a pilot report does not change the tail status');
select throws_like(format($$ select app.attend_snag(%L) $$, :'snag1'), '%Only an engineer%',
  'D-042: a pilot cannot assess a snag');
select pg_temp.admin();

select pg_temp.act_as(:SBK);
select throws_like($$ select app.report_snag('40000000-0000-0000-0000-000000000201', '[TEST] x') $$,
  '%pilots (Operations) and engineers%', 'D-041: Supply cannot report snags');
select is((select count(*) from public.snag), 0::bigint, 'D-120: Supply does not see snags');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select lives_ok(format($$ select app.attend_snag(%L, 'Checked oven circuit') $$, :'snag1'),
  'D-040: an engineer attends the snag');
select is((select snag_display from app.fleet_board() where tail = 'NX-201'), 'snag_attended',
  'D-200: an attended snag shows amber "Snag attended"');
select throws_like(format($$ select app.close_snag_no_fault_found(%L, 'Tested, no fault', '1357') $$, :'snag1'),
  '%needs an approved work order%', 'D-218: no fault found cannot be closed without a work order');
select pg_temp.admin();

select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.close_snag_no_fault_found(%L, 'Tested, no fault', '2468') $$, :'snag1'),
  '%needs an approved work order%', 'D-218: not even by a certifying engineer with the right PIN');
select lives_ok(format($$ select app.request_work_order(%L, 'Troubleshoot oven circuit', 1) $$, :'snag1'),
  'D-218: troubleshooting starts with a work order request');
select pg_temp.admin();
select id as wo_nff, approval_request_id as req_nff from public.work_order where snag_id = :'snag1' \gset
select pg_temp.act_as(:QAR);
select app.decide_approval(:'req_nff', 'approve', '1111');
select pg_temp.admin();
select pg_temp.act_as(:ABE);
select app.decide_approval(:'req_nff', 'approve', '2222');
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select app.add_work_order_entry(:'wo_nff', 'Oven run on ground power for 20 minutes, no fault');
select app.complete_work_order(:'wo_nff', 'Ready for certification');
select pg_temp.admin();
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
values ('work_order', :'wo_nff', 'sign_off_card', 'nff.pdf', 'application/pdf', 1000,
        'work_order/' || :'wo_nff' || '/nff.pdf', '10000000-0000-0000-0000-000000000006');
select pg_temp.act_as(:TMB);
select lives_ok(format($$ select app.certify_work_order(%L, '2468', 'Oven tested on ground, no fault', true, '15', '0101') $$, :'wo_nff'),
  'D-218: the certifying engineer certifies the work order as no fault found');
select pg_temp.admin();
select is((select status from public.snag where id = :'snag1'), 'closed', 'D-040: the snag is closed');
select is((select disposition from public.snag where id = :'snag1'), 'nff', 'D-218: recorded as no fault found');

-- =============================================================== WORK ORDERS ===
select id as snag2 from public.snag where aircraft_id = :NX203 and status = 'reported' limit 1 \gset
-- Make QAR an acting deputy for the Engineering CO, to test "no one approves two steps".
insert into public.appointment_deputy (appointment_id, deputy_person_id, valid_from, valid_to, granted_by, reason)
values ('30000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000004',
        now() - interval '1 hour', now() + interval '1 day', '10000000-0000-0000-0000-000000000002', '[TEST] cover');

select pg_temp.act_as(:KDO);
select app.attend_snag(:'snag2', 'Leak check of outflow valve');
select lives_ok(format($$ select app.request_work_order(%L, 'Replace outflow valve seal', 4) $$, :'snag2'),
  'D-063: an engineer requests a work order');
select pg_temp.admin();
select id as wo1, approval_request_id as req1 from public.work_order where snag_id = :'snag2' \gset
select matches((select number from public.work_order where id = :'wo1'), '^WO-[0-9]{6}$',
  'D-064: work order numbers follow the fleet-wide format');

select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.add_work_order_entry(%L, 'Started') $$, :'wo1'),
  '%locked until Quality and the CO approve%', 'D-063: no work can be recorded before approval');
select throws_like(format($$ select app.decide_approval(%L, 'approve', '1357') $$, :'req1'),
  '%do not hold step%', 'D-063: an engineer cannot approve the Quality step');
select pg_temp.admin();

select pg_temp.act_as(:ABE);
select is((select count(*)::integer from app.my_pending_approvals() where id = :'req1'), 0,
  'Inbox: the CO does not see the request before Quality has approved');
select pg_temp.admin();
select pg_temp.act_as(:QAR);
select is((select step_name from app.my_pending_approvals() where id = :'req1'), 'Quality pre-approval',
  'Inbox: Quality sees the request waiting at its step');
select throws_like(format($$ select app.decide_approval(%L, 'approve', '9999') $$, :'req1'),
  '%PIN not accepted%', 'D-094: approving needs the PIN');
select is((select current_step from public.approval_request where id = :'req1'), 1,
  'D-094: a wrong PIN leaves the request where it was');
select lives_ok(format($$ select app.decide_approval(%L, 'approve', '1111') $$, :'req1'),
  'D-063: Quality pre-approves');
select is((select count(*)::integer from app.my_pending_approvals() where id = :'req1'), 0,
  'Inbox: once decided, it leaves Quality''s inbox');
select throws_like(format($$ select app.decide_approval(%L, 'approve', '1111') $$, :'req1'),
  '%two steps%', 'D-146: the same person cannot approve both steps, even as acting CO');
select pg_temp.admin();
select is((select status from public.work_order where id = :'wo1'), 'pre_approved', 'D-063: the work order is pre-approved');

select pg_temp.act_as(:KDO);
select is((select blocked_by || ' | ' || blocked_holder from app.fleet_board() where tail = 'NX-203'),
  'Work order awaiting CO final approval | Engineering CO',
  'D-006: Blocked by shows the CO holding the work order');
select pg_temp.admin();

select pg_temp.act_as(:ABE);
select is((select count(*)::integer from app.my_pending_approvals() where id = :'req1'), 1,
  'Inbox: after Quality, the request reaches the CO');
select throws_like(format($$ select app.decide_approval(%L, 'reject', '2222', '') $$, :'req1'),
  '%needs a reason%', 'D-079: a rejection needs a reason');
select lives_ok(format($$ select app.decide_approval(%L, 'approve', '2222') $$, :'req1'),
  'D-063: the CO gives final approval');
select pg_temp.admin();
select is((select status from public.work_order where id = :'wo1'), 'open', 'D-063: the work order is now open');
select pg_temp.act_as(:TMB);
select is((select count(*)::integer from public.approval_decision d
             join public.approval_request r on r.id = d.request_id where r.id = :'req1'), 2,
  'D-079: an engineer who can see the work order sees its approval trail');
select pg_temp.admin();
select pg_temp.act_as(:SBK);
select is((select count(*)::integer from public.approval_request where id = :'req1'), 0,
  'D-120: Supply cannot see work order approvals');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select lives_ok(format($$ select app.add_work_order_entry(%L, 'Seal replaced, leak check good') $$, :'wo1'),
  'D-063: work is recorded once approved');
select lives_ok(format($$ select app.complete_work_order(%L, 'Ready for certification') $$, :'wo1'),
  'D-063: the engineer marks the work complete');
select pg_temp.admin();

select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.certify_work_order(%L, '2468', 'Certified') $$, :'wo1'),
  '%Attach the required scans first%', 'D-065: certification needs the required scans');
select throws_ok(format($$ insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
                           values ('work_order', %L, 'sign_off_card', 'virus.exe', 'application/x-msdownload', 1000,
                                   'work_order/%s/virus.exe', '10000000-0000-0000-0000-000000000006') $$, :'wo1', :'wo1'),
  '23514', null, 'D-026: only PDF and image files are accepted');
select lives_ok(format($$ insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
                           values ('work_order', %L, 'sign_off_card', 'signoff.pdf', 'application/pdf', 250000,
                                   'work_order/%s/signoff.pdf', '10000000-0000-0000-0000-000000000006') $$, :'wo1', :'wo1'),
  'D-065: the scanned sign-off card is attached');
select lives_ok(format($$ select app.certify_work_order(%L, '2468', 'Work certified') $$, :'wo1'),
  'D-043: a certifying engineer certifies the work order with PIN');
select pg_temp.admin();
select is((select status from public.snag where id = :'snag2'), 'closed', 'D-063: certifying the work order closes the snag');
select is((select status from public.aircraft_current_status where aircraft_id = :NX203), 'SVC',
  'D-046: certifying does not change the tail status by itself');

-- ======================================================================= MEL ===
select pg_temp.act_as(:KDO);
select is((select item_number from app.search_mel(:NX201, '213101') limit 1), '21-31-01',
  'D-058: typing the item number without dashes finds it first');
select is((select item_number from app.search_mel(:NX201, 'reading') limit 1), '33-21-01',
  'D-058: a word from the title finds the item');
select is((select count(*) from app.search_mel(:NX201, '2151')), 0::bigint,
  'D-050: only the aircraft type''s own MEL is searched');
select app.report_snag(:NX201, '[TEST] Cabin pressure indicator blank', false, '21-31', '15', '0101', '1');
select pg_temp.admin();
select id as snag3 from public.snag where description = '[TEST] Cabin pressure indicator blank' \gset
select id as item_c from public.mel_item where item_number = '21-31-01' \gset
select id as item_a from public.mel_item where item_number = '34-11-01' \gset

select pg_temp.act_as(:KDO);
select app.attend_snag(:'snag3');
select throws_like(format($$ select app.apply_mel(%L, %L, '1357', true, true, true) $$, :'snag3', :'item_c'),
  '%certifying authorization%', 'D-104: a non-certifying engineer cannot apply the MEL');
select pg_temp.admin();

select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.apply_mel(%L, %L, '2468', true, true, false) $$, :'snag3', :'item_c'),
  '%placard is fitted%', 'D-053: the placard must be confirmed');
select throws_like(format($$ select app.apply_mel(%L, %L, '2468', false, true, true) $$, :'snag3', :'item_c'),
  '%(M) maintenance procedure%', 'D-053: the (M) procedure must be confirmed');
select lives_ok(format($$ select app.apply_mel(%L, %L, '2468', true, true, true, 'Alternate indication checked') $$, :'snag3', :'item_c'),
  'D-053: the MEL is applied with all confirmations');
select pg_temp.admin();
select results_eq(
  format($$ select kind, mel_ref, mel_category, (due_at is not null) from public.ddls_entry where snag_id = %L $$, :'snag3'),
  $$ values ('mel'::text, '21-31-01'::text, 'C'::text, true) $$,
  'D-163: the MEL deferral is on the DDLS automatically, category from the MEL, with a due time');

-- Cat A, flight-hour limit
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Standby airspeed indicator erratic', false, '34-11');
select pg_temp.admin();
select id as snag4 from public.snag where description = '[TEST] Standby airspeed indicator erratic' \gset
select pg_temp.act_as(:TMB);
select app.attend_snag(:'snag4');
select app.apply_mel(:'snag4', :'item_a', '2468', true, true, true, null, null, null, null, true);
select pg_temp.admin();
select is((select c.status || ' ' || p.three_letter_code from public.aircraft_current_status c
             join public.person p on p.id = c.set_by where c.aircraft_id = :NX201), 'SVC_MEL TMB',
  'D-216: the engineer''s tick sets Serviceable · MEL in the same signed step');
select id as ddls_a from public.ddls_entry where snag_id = :'snag4' \gset
select id as ddls_c from public.ddls_entry where snag_id = :'snag3' \gset
select ok((select due_at is null and limit_text like '10%flight hours%' from public.ddls_entry where id = :'ddls_a'),
  'D-052: a flight-hour limit is shown as written until flight records exist');

select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.request_ddls_extension(%L, 5, 'REF-1', 'Part on order') $$, :'ddls_a'),
  '%category A items cannot be extended%', 'D-163: a Cat A MEL item cannot be extended');
select lives_ok(format($$ select app.request_ddls_extension(%L, 5, '[SAMPLE-AUTH-REF]', 'Part on order') $$, :'ddls_c'),
  'D-056: an extension is requested as a separate approval');
select pg_temp.admin();
select due_at as due_before from public.ddls_entry where id = :'ddls_c' \gset
select approval_request_id as req2 from public.ddls_extension where ddls_entry_id = :'ddls_c' \gset

select pg_temp.act_as(:QAR);
select app.decide_approval(:'req2', 'approve', '1111');
select pg_temp.admin();
select is((select due_at from public.ddls_entry where id = :'ddls_c'), :'due_before'::timestamptz + interval '5 days',
  'D-056: once approved, the due time moves by the extension');

select pg_temp.act_as(:PLA);
select ok((select count(*) > 0 from public.ddls_entry), 'D-120: Operations can see the DDLS (MEL and (O) items)');
select pg_temp.admin();

select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.clear_ddls_entry(%L, 'Indicator replaced, tested serviceable', '2468', '15', '0102') $$, :'ddls_c'),
  '%needs an approved work order%', 'D-218: a DDLS entry cannot be cleared without a work order');
select lives_ok(format($$ select app.request_work_order(%L, 'Replace cabin pressure indicator', 2) $$, :'snag3'),
  'D-218: a work order can be requested on a deferred snag');
select throws_like(format($$ select app.request_work_order(%L, 'Again', 1) $$, :'snag3'),
  '%already has work order%', 'D-218: only one active work order per snag');
select pg_temp.admin();
select is((select status from public.snag where id = :'snag3'), 'deferred',
  'D-218: the snag stays deferred until its work order is certified');
select id as wo_ddls, approval_request_id as req_ddls from public.work_order where snag_id = :'snag3' \gset
select pg_temp.act_as(:QAR);
select app.decide_approval(:'req_ddls', 'approve', '1111');
select pg_temp.admin();
select pg_temp.act_as(:ABE);
select app.decide_approval(:'req_ddls', 'approve', '2222');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select app.add_work_order_entry(:'wo_ddls', 'Indicator replaced, tested serviceable');
select app.complete_work_order(:'wo_ddls', 'Ready for certification');
select pg_temp.admin();
insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
values ('work_order', :'wo_ddls', 'sign_off_card', 'ddls.pdf', 'application/pdf', 1000,
        'work_order/' || :'wo_ddls' || '/ddls.pdf', '10000000-0000-0000-0000-000000000006');
select pg_temp.act_as(:TMB);
select lives_ok(format($$ select app.certify_work_order(%L, '2468', 'Indicator replaced, tested serviceable', false, '15', '0102') $$, :'wo_ddls'),
  'D-218: certifying the work order is the clearing signature');
select pg_temp.admin();
select is((select status from public.ddls_entry where id = :'ddls_c'), 'cleared', 'D-164: the DDLS entry is cleared');
select is((select status from public.snag where id = :'snag3'), 'closed', 'D-164: clearing the DDLS entry closes the snag');

-- DDLS, not MEL: manual reference required
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Dent on lower panel', false, '53-10');
select pg_temp.admin();
select id as snag5 from public.snag where description = '[TEST] Dent on lower panel' \gset
select pg_temp.act_as(:TMB);
select app.attend_snag(:'snag5');
select throws_like(format($$ select app.defer_on_ddls(%L, 30, '', '2468') $$, :'snag5'),
  '%manual reference%', 'D-163: a non-MEL deferral needs a manual reference');
select lives_ok(format($$ select app.defer_on_ddls(%L, 30, '[SAMPLE] SRM 53-10', '2468') $$, :'snag5'),
  'D-163: a non-MEL deferral with a manual reference goes on the DDLS');
select pg_temp.admin();

-- ====================================================================== NADD ===
select pg_temp.act_as(:PLA);
select lives_ok($$ select app.propose_nadd('40000000-0000-0000-0000-000000000201', '[TEST] Galley drawer 2 sticks', 'GALLEY') $$,
  'D-160: a pilot proposes a NADD from the cabin map');
select throws_like($$ select app.propose_nadd('40000000-0000-0000-0000-000000000201', '[TEST] Oxygen mask cover loose', 'OXY') $$,
  '%never NADDs%', 'D-209: emergency equipment can never be a NADD');
select pg_temp.admin();
select id as nadd1, reported_at as nadd1_reported from public.nadd where description = '[TEST] Galley drawer 2 sticks' \gset
select is((select status from public.nadd where id = :'nadd1'), 'proposed', 'D-160: a pilot''s NADD stays proposed');

select pg_temp.act_as(:PLA);
select throws_like(format($$ select app.confirm_nadd(%L, '0000', true) $$, :'nadd1'), '%Only an engineer%',
  'D-160: a pilot cannot confirm a NADD');
select pg_temp.admin();

select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.confirm_nadd(%L, '2468', false) $$, :'nadd1'), '%not covered by the MEL%',
  'D-160: confirming needs the declaration');
select throws_like(format($$ select app.confirm_nadd(%L, '2468', true, 150) $$, :'nadd1'), '%never longer%',
  'D-160: the limit can be shorter than 120 days, never longer');
select lives_ok(format($$ select app.confirm_nadd(%L, '2468', true) $$, :'nadd1'),
  'D-160: a certifying engineer confirms the NADD');
select pg_temp.admin();
select is((select due_at from public.nadd where id = :'nadd1'), app.due_from_days(:'nadd1_reported'::timestamptz, 120),
  'D-166: the countdown is 120 days from the report date');

-- Raiser cannot approve own extension: give TMB Quality as a second department.
insert into public.access_grant (person_id, grant_type, department_code, reason, granted_by)
values ('10000000-0000-0000-0000-000000000006', 'department', 'QUA', '[TEST] second hat', '10000000-0000-0000-0000-000000000002');
select pg_temp.act_as(:TMB);
select lives_ok(format($$ select app.request_nadd_extension(%L, 10, 'Part on order') $$, :'nadd1'),
  'D-160: a NADD extension is requested');
select pg_temp.admin();
select approval_request_id as req3 from public.nadd_extension where nadd_id = :'nadd1' \gset
select pg_temp.act_as(:TMB);
select throws_like(format($$ select app.decide_approval(%L, 'approve', '2468') $$, :'req3'),
  '%raised a request cannot approve%', 'D-075: whoever raised a request cannot approve it');
select pg_temp.admin();

select pg_temp.act_as(:PLA);
select app.propose_nadd(:NX201, '[TEST] Seat 3A tray latch loose', 'CAB-FWD');
select pg_temp.admin();
select id as nadd2 from public.nadd where description = '[TEST] Seat 3A tray latch loose' \gset
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.reject_nadd(%L, '') $$, :'nadd2'), '%needs a reason%',
  'D-209: rejecting a cabin item needs a reason');
select lives_ok(format($$ select app.reject_nadd(%L, 'Latch within limits, adjusted on inspection') $$, :'nadd2'),
  'D-209: an engineer rejects a cabin item with a reason');
select pg_temp.admin();

-- ======================================================== TECHNICAL QUERIES ===
select pg_temp.act_as(:KDO);
select lives_ok(format($$ insert into public.technical_query (record_table, record_id, subject, body, assigned_department, raised_by, number)
                           values ('snag', %L, 'Repeat pressurisation snags', 'Please review the trend', 'QUA', %L, 'x') $$,
                        :'snag5', '10000000-0000-0000-0000-000000000005'),
  'D-207: an engineer raises a query on a snag, assigned to Quality');
select pg_temp.admin();
select id as tq1 from public.technical_query where record_id = :'snag5' \gset

select pg_temp.act_as(:SBK);
select throws_like(format($$ insert into public.technical_query (record_table, record_id, subject, body, assigned_department, raised_by, number)
                           values ('snag', %L, 'x', 'y', 'QUA', %L, 'x') $$, :'snag5', '10000000-0000-0000-0000-000000000008'),
  '%row-level security%', 'D-207: nobody can raise a query on a record they cannot see');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select lives_ok(format($$ insert into public.technical_query_note (query_id, note, author) values (%L, 'Trend reviewed; no action', %L) $$,
                        :'tq1', '10000000-0000-0000-0000-000000000004'),
  'D-207: the assigned department answers with a note');
-- Quality is not the raiser: the security rules hide the row from its update,
-- so the attempt runs but touches nothing.
select lives_ok(format($$ update public.technical_query set status = 'closed' where id = %L $$, :'tq1'),
  'D-207: a non-raiser''s close attempt is quietly ignored');
select pg_temp.admin();
select is((select status from public.technical_query where id = :'tq1'), 'open',
  'D-207: only the raiser closes the query (still open after Quality tried)');
select pg_temp.act_as(:KDO);
select lives_ok(format($$ update public.technical_query set status = 'closed' where id = %L $$, :'tq1'),
  'D-207: the raiser closes the query');
select pg_temp.admin();
select is((select closed_by from public.technical_query where id = :'tq1'), '10000000-0000-0000-0000-000000000005'::uuid,
  'D-207: the closure records who closed it');
select throws_like($$ update public.technical_query_note set note = 'edited' $$, '%append-only%',
  'D-207: notes are never edited');

-- =========================================================== REPEAT DEFECTS ===
select pg_temp.act_as(:KDO);
select app.report_snag(:NX202, '[TEST] Pressure controller fault 1', false, '21-31-05');
select app.report_snag(:NX202, '[TEST] Pressure controller fault 2', false, '21-31-07');
select pg_temp.admin();
select id as rep2 from public.snag where description = '[TEST] Pressure controller fault 2' \gset
select pg_temp.act_as(:KDO);
select is((select is_repeat from app.repeat_defect(:'rep2')), false, 'D-208: two reports are not yet a repeat');
select app.report_snag(:NX202, '[TEST] Pressure controller fault 3', false, '21-31');
select pg_temp.admin();
select id as rep3 from public.snag where description = '[TEST] Pressure controller fault 3' \gset
select pg_temp.act_as(:KDO);
select is((select is_repeat from app.repeat_defect(:'rep3')), true,
  'D-208: three reports in 30 days on one tail and ATA sub-chapter are flagged as a repeat');
select pg_temp.admin();
select is((select status from public.aircraft_current_status where aircraft_id = :NX202), 'SVC',
  'D-020: a repeat flag never changes the tail status');

-- ================================================ ACCOUNTS AND PREFERENCES ===
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                        confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '20000000-0000-0000-0000-000000000099', 'authenticated',
        'authenticated', 'newtech@users.nexus.local', 'x', now(), '{}', '{}', now(), now(), '', '', '', '');

select pg_temp.act_as('20000000-0000-0000-0000-000000000099');
select lives_ok($$ select app.request_account('[New technician]', 'newtech', 'NTC', 'ENG') $$,
  'D-206: a new person requests an account and a department');
select throws_like($$ select app.set_tail_status('40000000-0000-0000-0000-000000000202', 'US', 'x', '0000') $$,
  '%Only an engineer%', 'D-123: a pending account has no rights');
select pg_temp.admin();
select throws_ok($$ update public.user_account set username = 'newtech'
                     where id = '20000000-0000-0000-0000-000000000005' $$, '23505', null,
  'D-206: usernames are unique');

select pg_temp.act_as(:ABE);
select lives_ok($$ update public.user_account set status = 'active' where id = '20000000-0000-0000-0000-000000000099' $$,
  'D-123: the Engineering CO approves an Engineering account request');
select pg_temp.admin();
select is((select p.three_letter_code from public.user_account u join public.person p on p.id = u.activated_by
            where u.id = '20000000-0000-0000-0000-000000000099'), 'ABE',
  'D-033: the approval records who approved');

select pg_temp.act_as(:KDO);
select lives_ok($$ insert into public.user_preference (user_id, key, value)
                   values ('20000000-0000-0000-0000-000000000005', 'columns:work_orders', '["number","tail","status"]') $$,
  'D-210: a user saves their list columns');
select pg_temp.admin();
select pg_temp.act_as(:FAO);
select is((select count(*) from public.user_preference), 0::bigint, 'D-210: nobody sees another user''s preferences');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select is(app.my_pin_is_set(), true, 'D-206: the app can tell a PIN has been set');
select pg_temp.admin();

-- =============================================================== SAFETY NET ===
select throws_like($$ delete from public.snag $$, '%never deleted%', 'D-023: snags are never deleted');
select throws_like($$ delete from public.work_order $$, '%never deleted%', 'D-023: work orders are never deleted');
select is_empty($$ select * from audit.verify_chain() $$, 'D-038: the audit chain is intact after the whole workflow');

select * from finish();
rollback;
