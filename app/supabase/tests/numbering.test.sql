-- =============================================================================
-- Nexus MRO · Automatic checks: operator numbering, work order revisions and
-- the "In work" chip (D-064, D-120, D-200, D-220)
-- Proprietary to Liebetag. All rights reserved.
-- Everything runs inside a transaction that is rolled back at the end.
-- =============================================================================

begin;
create extension if not exists pgtap with schema extensions;
select plan(38);

\set ZEM '''20000000-0000-0000-0000-000000000002'''
\set ABE '''20000000-0000-0000-0000-000000000003'''
\set QAR '''20000000-0000-0000-0000-000000000004'''
\set KDO '''20000000-0000-0000-0000-000000000005'''
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

select to_char(now() at time zone coalesce(app.setting('operator.time_zone') #>> '{}', 'UTC'), 'YYYY') as yyyy \gset

-- ------------------------------------------------------------ who may set ---
select pg_temp.act_as(:KDO);
select throws_like($$ select * from app.numbering_settings() $$, '%Super Admins and Quality%',
  'D-220: an engineer does not manage numbering');
select throws_like($$ select app.set_numbering_setting('operator.code', 'XYZ', 'Try', '1357') $$,
  '%Super Admins and Quality%', 'D-220: an engineer cannot change a format');
select pg_temp.admin();

select pg_temp.act_as(:QAR);
select is((select count(*) from app.numbering_settings()), 12::bigint, 'D-220: Quality sees every numbered document');
select is((select format from app.numbering_settings() where series = 'work_order'), 'WO-{000000}',
  'D-064: the work order format starts as the sample default');
select throws_like($$ select app.set_numbering_setting('operator.code', 'TST', 'New code', '0000') $$,
  '%PIN not accepted%', 'D-220: a change needs the PIN');
select throws_like($$ select app.set_numbering_setting('operator.code', 'TST', '', '1111') $$,
  '%reason%', 'D-220: a change needs a reason');

-- ------------------------------------------------------ format checks ---
select throws_like($$ select app.set_numbering_setting('work_order.number_format', 'WO-{ABC}{0000}', 'x', '1111') $$,
  '%placeholders%', 'D-220: unknown placeholders are refused');
select throws_like($$ select app.set_numbering_setting('work_order.number_format', 'WO {0000}', 'x', '1111') $$,
  '%placeholders%', 'D-220: spaces are refused');
select throws_like($$ select app.set_numbering_setting('work_order.number_format', '{ORG}/WO/{YYYY}', 'x', '1111') $$,
  '%running number once%', 'D-220: the running number is required');
select throws_like($$ select app.set_numbering_setting('work_order.number_format', 'WO{000}/{000}', 'x', '1111') $$,
  '%running number once%', 'D-220: only one running number');
select throws_like($$ select app.set_numbering_setting('snag.number_format', '{TAIL}-{0000}', 'x', '1111') $$,
  '%work orders only%', 'D-220: {TAIL} is for work orders only');
select throws_like($$ select app.set_numbering_setting('work_order.number_format', 'WO{MM}{0000}', 'x', '1111') $$,
  '%also needs the year%', 'D-220: a month without a year would repeat numbers');
select throws_like($$ select app.set_numbering_setting('operator.code', 'S M P', 'x', '1111') $$,
  '%1 to 10 letters or digits%', 'D-220: codes have no spaces or symbols');
select throws_like($$ select app.set_numbering_setting('work_order.revision_format', 'Rev', 'x', '1111') $$,
  '%{NUMBER} and {REV}%', 'D-220: the revision format keeps the number and the revision');

-- ------------------------------------------------------ the operator's style ---
select lives_ok($$ select app.set_numbering_setting('operator.code', 'tst', 'Operator code agreed', '1111') $$,
  'D-220: Quality sets the operator code');
select is(app.setting('operator.code') #>> '{}', 'TST', 'D-220: codes are kept in capitals');
select lives_ok($$ select app.set_numbering_setting('operator.unit_code', 'U7Q42', 'Unit code agreed', '1111') $$,
  'D-220: Quality sets the unit code');
select is(app.set_numbering_setting('work_order.number_format', '{ORG}/{UNIT}/WO/{YYYY}/{0035}',
                                    'Carry on from the paper WO book', '1111'),
  'TST/U7Q42/WO/' || :'yyyy' || '/0035', 'D-220: {0035} continues from 35, shown in the preview');
select is(app.setting('work_order.number_format') #>> '{}', '{ORG}/{UNIT}/WO/{YYYY}/{0000}',
  'D-220: the format is kept with zeros');
select is(app.preview_number('work_order'), app.preview_number('work_order'),
  'D-220: the preview does not use up a number');
select pg_temp.admin();

select is(app.format_number('WO{YY}{00}', 100, now(), null), 'WO' || right(:'yyyy', 2) || '100',
  'D-220: past its width the number grows, never cut short');

-- ------------------------------------------------------ numbers handed out ---
select pg_temp.act_as(:KDO);
select app.report_snag(:NX201, '[TEST] Reading light inoperative', false, '33-21');
select app.report_snag(:NX201, '[TEST] Lav door latch stiff', false, '52-41');
select pg_temp.admin();
select id as s1 from public.snag where description = '[TEST] Reading light inoperative' \gset
select id as s2 from public.snag where description = '[TEST] Lav door latch stiff' \gset
select pg_temp.act_as(:KDO);
select app.attend_snag(:'s1', 'Bulb and socket checked');
select app.attend_snag(:'s2', 'Latch inspected');
select app.request_work_order(:'s1', 'Replace reading light assembly', 1) as wo1 \gset
select app.request_work_order(:'s2', 'Adjust lav door latch', 1) as wo2 \gset
select pg_temp.admin();
select is((select number from public.work_order where id = :'wo1'), 'TST/U7Q42/WO/' || :'yyyy' || '/0035',
  'D-220: the next work order follows the operator''s format');
select is((select number from public.work_order where id = :'wo2'), 'TST/U7Q42/WO/' || :'yyyy' || '/0036',
  'D-220: and the running number carries on');
select ok(exists (select 1 from app.number_series where series = 'work_order:' || :'yyyy'),
  'D-220: a format with the year counts per year (starts again each January)');

-- A counter set back by hand never gives a number already in use.
update app.number_series set last_value = last_value - 1 where series = 'snag';
select pg_temp.act_as(:KDO);
select lives_ok($$ select app.report_snag('40000000-0000-0000-0000-000000000201', '[TEST] Placard missing', false, '11-00') $$,
  'D-220: Nexus skips a number that is already taken');
select pg_temp.admin();

-- ------------------------------------------------------ In work chip ---
select pg_temp.act_as(:KDO);
select ok((select in_work_ref from app.fleet_board() where tail = 'NX-201') is not null,
  'Option B: Engineering sees the open work order on the tail');
select pg_temp.admin();
select pg_temp.act_as(:PLA);
select is((select in_work_ref from app.fleet_board() where tail = 'NX-201'), null,
  'D-120: pilots do not see work orders');
select pg_temp.admin();

-- ------------------------------------------------------ revisions ---
select approval_request_id as req1 from public.work_order where id = :'wo1' \gset
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.revise_work_order(%L, 'Replace reading light assembly', 1, 'No change', '1357') $$, :'wo1'),
  '%Nothing has changed%', 'D-220: a revision must change something');
select throws_like(format($$ select app.revise_work_order(%L, 'Replace light and socket', 2, 'Socket burnt', '0000') $$, :'wo1'),
  '%PIN not accepted%', 'D-220: a revision is signed with the PIN');
select is(app.revise_work_order(:'wo1', 'Replace light and socket', 2, 'Socket found burnt', '1357') ->> 'label',
  'TST/U7Q42/WO/' || :'yyyy' || '/0035 R1', 'D-220: the corrected work order shows R1');
select pg_temp.admin();
select is((select status || ' ' || revision from public.work_order where id = :'wo1'), 'requested 1',
  'D-063: the revised work order goes back for approval');
select is((select status from public.approval_request where id = :'req1'), 'cancelled',
  'D-063: the approval of the old wording no longer counts');
select ok((select r.summary like '%/0035 R1 · %' and r.status = 'pending'
             from public.work_order w join public.approval_request r on r.id = w.approval_request_id where w.id = :'wo1'),
  'D-063: Quality and the CO see the revision in their inbox');
select is((select previous_scope || ' -> ' || scope from public.work_order_revision where work_order_id = :'wo1'),
  'Replace reading light assembly -> Replace light and socket', 'D-023: the original wording is kept');
select throws_like($$ update public.work_order_revision set reason = 'x' $$, '%append-only%',
  'D-023: a revision cannot be edited');

select pg_temp.act_as(:QAR);
select app.set_numbering_setting('work_order.revision_format', '{NUMBER}-R{REV}', 'House style', '1111');
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select is(app.revise_work_order(:'wo1', 'Replace light, socket and wiring', 3, 'Wiring chafed', '1357') ->> 'label',
  'TST/U7Q42/WO/' || :'yyyy' || '/0035-R2', 'D-220: R2, in the operator''s revision style');
select pg_temp.admin();

-- A refused work order is finished: no more revisions, and off the chip.
select approval_request_id as req2 from public.work_order where id = :'wo2' \gset
select pg_temp.act_as(:QAR);
select app.decide_approval(:'req2', 'reject', '1111', 'Raise against the cabin task card');
select pg_temp.admin();
select pg_temp.act_as(:KDO);
select throws_like(format($$ select app.revise_work_order(%L, 'Replace latch', 1, 'x', '1357') $$, :'wo2'),
  '%rejected%', 'D-220: a refused work order cannot be revised');
select ok((select coalesce(in_work_ref, '') not like '%/0036%' from app.fleet_board() where tail = 'NX-201'),
  'Option B: the chip goes once the work order is no longer open');
select pg_temp.admin();

select * from finish();
rollback;
