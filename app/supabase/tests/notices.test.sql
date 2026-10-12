-- =============================================================================
-- Nexus MRO · Automatic checks: "Rectified" notices to Quality and the CO,
-- acknowledged by each (Promise, 12 Oct; D-023, D-063, D-120, D-218)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(21);

\set ABE '''20000000-0000-0000-0000-000000000003'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
\set TMB '''20000000-0000-0000-0000-000000000006'''
\set PLA '''20000000-0000-0000-0000-000000000007'''
\set NX201 '''40000000-0000-0000-0000-000000000201'''

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

select pg_temp.act_as(:QAR); select app.set_my_pin('1111'); select pg_temp.admin();
select pg_temp.act_as(:ABE); select app.set_my_pin('2222'); select pg_temp.admin();
select pg_temp.act_as(:KDO); select app.set_my_pin('1357'); select pg_temp.admin();
select pg_temp.act_as(:TMB); select app.set_my_pin('2468'); select pg_temp.admin();

-- Take a work order from request to certification.
create function pg_temp.certify(p_wo uuid, p_note text) returns void language plpgsql as $$
declare v_req uuid;
begin
  select approval_request_id into v_req from public.work_order where id = p_wo;
  perform pg_temp.act_as('20000000-0000-0000-0000-000000000004'); perform app.decide_approval(v_req, 'approve', '1111'); perform pg_temp.admin();
  perform pg_temp.act_as('20000000-0000-0000-0000-000000000003'); perform app.decide_approval(v_req, 'approve', '2222'); perform pg_temp.admin();
  perform pg_temp.act_as('20000000-0000-0000-0000-000000000006');
  perform app.add_work_order_entry(p_wo, 'Work carried out');
  perform app.complete_work_order(p_wo, 'Ready for certification');
  perform pg_temp.admin();
  insert into public.attachment (record_table, record_id, kind, file_name, mime_type, size_bytes, storage_path, uploaded_by)
  values ('work_order', p_wo, 'sign_off_card', 'card.pdf', 'application/pdf', 1000,
          'work_order/' || p_wo || '/card.pdf', '10000000-0000-0000-0000-000000000006');
  perform pg_temp.act_as('20000000-0000-0000-0000-000000000006');
  perform app.certify_work_order(p_wo, '2468', p_note);
  perform pg_temp.admin();
end $$;
grant execute on function pg_temp.certify(uuid, text) to authenticated;

-- ------------------------------------------------ certified work order ---
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Nav light inoperative', false, '33-41');
select pg_temp.admin();
select id as s1 from public.snag where description = '[TEST] Nav light inoperative' \gset
select pg_temp.act_as(:KDO);
select app.attend_snag(:'s1', 'Bulb blown');
select app.request_work_order(:'s1', 'Replace nav light bulb', 1) as wo1 \gset
select pg_temp.admin();
select is((select count(*) from public.notification where record_id = :'wo1'), 0::bigint,
  'No notice before the work is certified');
select pg_temp.certify(:'wo1', 'Bulb replaced, light tested');

select id as n1 from public.notification where record_table = 'work_order' and record_id = :'wo1' \gset
select is((select count(*) from public.notification where record_id = :'wo1'), 1::bigint,
  'Certifying the work order raises one "rectified" notice');
select matches((select title from public.notification where id = :'n1'), '^NX-201 · SNAG-.* rectified$',
  'The notice names the tail and the snag');
select is((select string_agg(name, ' / ' order by step_no) from public.notification_target where notification_id = :'n1'),
  'Quality pre-approval / CO final approval', 'It goes to the work order approval chain: Quality, then the CO');

-- ------------------------------------------------------- who sees it ---
select pg_temp.act_as(:QAR);
select is((select waiting_for_me from app.my_notices() where id = :'n1'), true, 'Quality sees it, waiting for acknowledgement');
select ok(app.my_unacknowledged_count() >= 1, 'Quality''s bell counts it');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select is((select count(*) from app.my_notices() where id = :'n1'), 0::bigint, 'An engineer is not sent the notice');
select throws_like(format($$ select app.acknowledge_notice(%L) $$, :'n1'), '%Nothing for you to acknowledge%',
  'An engineer cannot acknowledge for Quality or the CO');
select pg_temp.admin();
select pg_temp.act_as(:PLA);
select is((select count(*) from public.notification where id = :'n1'), 0::bigint, 'D-120: a pilot does not see it');
select pg_temp.admin();

-- --------------------------------------------------- acknowledgements ---
select pg_temp.act_as(:QAR);
select is(app.acknowledge_notice(:'n1'), 1, 'Quality acknowledges');
select throws_like(format($$ select app.acknowledge_notice(%L) $$, :'n1'), '%already been acknowledged%',
  'Quality''s step is acknowledged once');
select is((select waiting_for_me from app.my_notices() where id = :'n1'), false, 'No longer waiting for Quality');
select pg_temp.admin();

select pg_temp.act_as(:ABE);
select is((select waiting_for_me from app.my_notices() where id = :'n1'), true, 'Still waiting for the CO');
select is(app.acknowledge_notice(:'n1', 'Noted, good job'), 1, 'The CO acknowledges, with a note');
select pg_temp.admin();

select pg_temp.act_as(:KDO);
select is((select string_agg((s ->> 'name') || ': ' || (s ->> 'acknowledged_by'), ' / ')
             from jsonb_array_elements(app.record_notice('work_order', :'wo1') -> 'steps') s),
  'Quality pre-approval: QAR / CO final approval: ABE', 'The work order shows who acknowledged');
select pg_temp.admin();
select throws_like($$ update public.notification_ack set note = 'x' $$, '%append-only%',
  'D-023: an acknowledgement cannot be edited');
select throws_like($$ delete from public.notification $$, '%',
  'D-023: a notice cannot be deleted');

-- ---------------------------------------- NADD rectified directly ---
select pg_temp.act_as(:PLA);
select app.propose_nadd(:NX201, '[TEST] Seat 4C armrest cover loose', 'CAB-FWD');
select pg_temp.admin();
select id as nadd1 from public.nadd where description = '[TEST] Seat 4C armrest cover loose' \gset
select pg_temp.act_as(:TMB);
select app.confirm_nadd(:'nadd1', '2468', true);
select app.rectify_nadd(:'nadd1', 'Cover refitted at outside MRO during C-check', '2468');
select pg_temp.admin();
select is((select count(*) from public.notification where record_table = 'nadd' and record_id = :'nadd1'), 1::bigint,
  'A NADD rectified without a work order raises its own notice');
select ok((select body like '%without a work order%' from public.notification where record_id = :'nadd1'),
  'The notice says it was rectified without a work order');

-- -------------------------- NADD rectified by certifying its work order ---
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Lav mirror cracked', false, '25-41');
select pg_temp.admin();
select id as s2 from public.snag where description = '[TEST] Lav mirror cracked' \gset
select pg_temp.act_as(:KDO);
select app.attend_snag(:'s2', 'Crack in corner, no sharp edge');
select pg_temp.admin();
select pg_temp.act_as(:TMB);
select app.defer_as_nadd(:'s2', '2468', true);
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select app.request_work_order(:'s2', 'Replace lav mirror', 1) as wo2 \gset
select pg_temp.admin();
select pg_temp.certify(:'wo2', 'Mirror replaced');
select is((select count(*) from public.notification where snag_id = :'s2'), 1::bigint,
  'One certification, one notice: the NADD is covered by the work order notice');
select ok((select body like '%NADD rectified%' from public.notification where snag_id = :'s2'),
  'The notice says the NADD was rectified with it');

select * from finish();
rollback;
